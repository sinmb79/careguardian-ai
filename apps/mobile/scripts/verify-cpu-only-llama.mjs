import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const MAX_ZIP_COMMENT_BYTES = 0xffff;
const REQUIRED_ABIS = ["arm64-v8a", "x86_64"];
const CPU_JNI_NAMES_BY_ABI = {
  "arm64-v8a": new Set([
    "librnllama_jni.so",
    "librnllama_jni_v8.so",
    "librnllama_jni_v8_2.so",
    "librnllama_jni_v8_2_dotprod.so",
    "librnllama_jni_v8_2_i8mm.so",
    "librnllama_jni_v8_2_dotprod_i8mm.so"
  ]),
  x86_64: new Set([
    "librnllama_jni.so",
    "librnllama_jni_x86_64.so"
  ])
};
const REQUIRED_GRADLE_EVIDENCE = [
  "life-steward-cpu-only-llama",
  "**/*hexagon*.so",
  "**/*_opencl*.so",
  "**/libOpenCL.so",
  "**/libcdsprpc.so",
  "**/libggml-htp-*.so",
  "**/*htp*.so",
  "**/*Htp*.so",
  "**/*HTP*.so",
  'assets.exclude("ggml-hexagon/**")',
  "syncRNLlamaHtpAssets"
];
const ACCELERATED_ENTRY_PATTERN =
  /(?:hexagon|opencl|cdsprpc|ggml[-_]?htp|vulkan|(?:^|[/_.-])htp(?:[/_.-]|$)|(?:^|[/_.-])gpu(?:[/_.-]|$))/iu;

function fail(message) {
  throw new Error(message);
}

function parseProductionArguments(rawArguments) {
  const allowed = new Set(["--aab", "--gradle", "--evidence"]);
  const values = new Map();

  for (let index = 0; index < rawArguments.length; index += 2) {
    const flag = rawArguments[index];
    const value = rawArguments[index + 1];
    if (!allowed.has(flag)) {
      fail(`Unknown production verifier argument: ${flag ?? "(missing)"}`);
    }
    if (!value || value.startsWith("--")) {
      fail(`Production verifier argument ${flag} requires a file path`);
    }
    if (values.has(flag)) {
      fail(`Production verifier argument ${flag} was provided more than once`);
    }
    values.set(flag, value);
  }

  for (const flag of allowed) {
    if (!values.has(flag)) {
      fail(`Production verifier requires ${flag} <file>`);
    }
  }

  const parsed = {
    aabPath: resolve(process.cwd(), values.get("--aab")),
    evidencePath: resolve(process.cwd(), values.get("--evidence")),
    gradlePath: resolve(process.cwd(), values.get("--gradle"))
  };
  if (
    parsed.evidencePath === parsed.aabPath ||
    parsed.evidencePath === parsed.gradlePath
  ) {
    fail("Evidence JSON path must not overwrite the production AAB or Gradle file");
  }
  return parsed;
}

async function readRequiredFile(path, label) {
  const fileStat = await stat(path).catch(() => null);
  if (!fileStat?.isFile()) {
    fail(`${label} is not a readable file: ${path}`);
  }
  return {
    bytes: await readFile(path),
    sizeBytes: fileStat.size
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum =
        (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

async function verifyGradle(gradlePath) {
  const normalizedPath = gradlePath.replaceAll("\\", "/");
  if (!/\/android\/app\/build\.gradle$/u.test(normalizedPath)) {
    fail(
      `--gradle must point to the generated android/app/build.gradle: ${gradlePath}`
    );
  }

  const { bytes, sizeBytes } = await readRequiredFile(
    gradlePath,
    "Android app Gradle file"
  );
  const contents = bytes.toString("utf8");
  const missing = REQUIRED_GRADLE_EVIDENCE.filter(
    (required) => !contents.includes(required)
  );
  if (missing.length > 0) {
    fail(`CPU-only Gradle evidence is missing: ${missing.join(", ")}`);
  }

  return {
    marker: "life-steward-cpu-only-llama",
    path: gradlePath,
    sha256: sha256(bytes),
    sizeBytes
  };
}

function findEndOfCentralDirectory(archive) {
  const minimumOffset = Math.max(
    0,
    archive.length - (22 + MAX_ZIP_COMMENT_BYTES)
  );
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return offset;
    }
  }
  fail("AAB ZIP end-of-central-directory record is missing");
}

function readZipEntries(archive) {
  if (
    archive.length < 22 ||
    archive.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE
  ) {
    fail("AAB must begin with the ZIP local-file-header magic");
  }

  const endOffset = findEndOfCentralDirectory(archive);
  const diskNumber = archive.readUInt16LE(endOffset + 4);
  const centralDiskNumber = archive.readUInt16LE(endOffset + 6);
  const diskEntryCount = archive.readUInt16LE(endOffset + 8);
  const totalEntryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const commentLength = archive.readUInt16LE(endOffset + 20);

  if (
    diskNumber !== 0 ||
    centralDiskNumber !== 0 ||
    diskEntryCount !== totalEntryCount
  ) {
    fail("Multi-disk AAB ZIP archives are not supported");
  }
  if (
    totalEntryCount === ZIP64_SENTINEL_16 ||
    centralSize === ZIP64_SENTINEL_32 ||
    centralOffset === ZIP64_SENTINEL_32
  ) {
    fail("ZIP64 AAB archives are not supported by this release verifier");
  }
  if (totalEntryCount === 0) {
    fail("AAB ZIP must contain release entries");
  }
  if (endOffset + 22 + commentLength !== archive.length) {
    fail("AAB ZIP has an invalid end-of-central-directory boundary");
  }
  if (centralOffset + centralSize !== endOffset) {
    fail("AAB ZIP has an invalid central-directory boundary");
  }

  const centralEnd = centralOffset + centralSize;
  const entries = [];
  const seenNames = new Set();
  let cursor = centralOffset;

  for (let index = 0; index < totalEntryCount; index += 1) {
    if (
      cursor + 46 > centralEnd ||
      archive.readUInt32LE(cursor) !== CENTRAL_FILE_HEADER_SIGNATURE
    ) {
      fail(`AAB ZIP central-directory entry ${index} is malformed`);
    }

    const flags = archive.readUInt16LE(cursor + 8);
    const compressionMethod = archive.readUInt16LE(cursor + 10);
    const expectedCrc32 = archive.readUInt32LE(cursor + 16);
    const compressedSizeBytes = archive.readUInt32LE(cursor + 20);
    const uncompressedSizeBytes = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const entryCommentLength = archive.readUInt16LE(cursor + 32);
    const entryDisk = archive.readUInt16LE(cursor + 34);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    const nextCursor =
      cursor + 46 + nameLength + extraLength + entryCommentLength;

    if (nextCursor > centralEnd || nameLength === 0) {
      fail(`AAB ZIP central-directory entry ${index} has invalid lengths`);
    }
    if (
      compressedSizeBytes === ZIP64_SENTINEL_32 ||
      uncompressedSizeBytes === ZIP64_SENTINEL_32 ||
      localHeaderOffset === ZIP64_SENTINEL_32
    ) {
      fail("ZIP64 AAB entries are not supported by this release verifier");
    }
    if (entryDisk !== 0) {
      fail("Multi-disk AAB ZIP entries are not supported");
    }
    if ((flags & 0x1) !== 0) {
      fail("Encrypted AAB ZIP entries are not supported");
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      fail(`Unsupported AAB ZIP compression method: ${compressionMethod}`);
    }

    const name = archive
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    if (seenNames.has(name)) {
      fail(`AAB ZIP contains a duplicate entry: ${name}`);
    }
    seenNames.add(name);

    if (
      localHeaderOffset + 30 > centralOffset ||
      archive.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      fail(`AAB ZIP local header is missing for: ${name}`);
    }
    const localFlags = archive.readUInt16LE(localHeaderOffset + 6);
    const localCompressionMethod = archive.readUInt16LE(localHeaderOffset + 8);
    const localCrc32 = archive.readUInt32LE(localHeaderOffset + 14);
    const localCompressedSize = archive.readUInt32LE(localHeaderOffset + 18);
    const localUncompressedSize = archive.readUInt32LE(localHeaderOffset + 22);
    const localNameLength = archive.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28);
    const localNameStart = localHeaderOffset + 30;
    const localDataStart = localNameStart + localNameLength + localExtraLength;
    const localName = archive
      .subarray(localNameStart, localNameStart + localNameLength)
      .toString("utf8");

    if (
      localName !== name ||
      localFlags !== flags ||
      localCompressionMethod !== compressionMethod ||
      localDataStart + compressedSizeBytes > centralOffset
    ) {
      fail(`AAB ZIP local entry is inconsistent for: ${name}`);
    }
    if (
      (flags & 0x08) === 0 &&
      (localCrc32 !== expectedCrc32 ||
        localCompressedSize !== compressedSizeBytes ||
        localUncompressedSize !== uncompressedSizeBytes)
    ) {
      fail(`AAB ZIP local sizes or CRC do not match for: ${name}`);
    }

    entries.push({
      compressionMethod,
      compressedSizeBytes,
      dataOffset: localDataStart,
      expectedCrc32,
      name,
      uncompressedSizeBytes
    });
    cursor = nextCursor;
  }

  if (cursor !== centralEnd) {
    fail("AAB ZIP central-directory size does not match its entries");
  }

  return entries;
}

function verifyEntryPayload(archive, entry) {
  const compressed = archive.subarray(
    entry.dataOffset,
    entry.dataOffset + entry.compressedSizeBytes
  );
  let payload;
  try {
    payload =
      entry.compressionMethod === 0 ? compressed : inflateRawSync(compressed);
  } catch {
    fail(`AAB ZIP payload cannot be decompressed for: ${entry.name}`);
  }
  if (
    payload.length !== entry.uncompressedSizeBytes ||
    crc32(payload) !== entry.expectedCrc32
  ) {
    fail(`AAB ZIP payload size or CRC does not match for: ${entry.name}`);
  }
}

function verifyCpuOnlyEntries(archive, entries) {
  const manifest = entries.find(
    (entry) => entry.name === "base/manifest/AndroidManifest.xml"
  );
  if (!manifest || manifest.uncompressedSizeBytes === 0) {
    fail("AAB must contain a nonempty base/manifest/AndroidManifest.xml");
  }
  verifyEntryPayload(archive, manifest);

  const acceleratedEntries = entries
    .filter((entry) => ACCELERATED_ENTRY_PATTERN.test(entry.name))
    .map((entry) => entry.name);
  if (acceleratedEntries.length > 0) {
    fail(
      `Accelerated llama artifacts remain in AAB: ${acceleratedEntries.join(", ")}`
    );
  }

  const cpuJniEntries = Object.fromEntries(
    REQUIRED_ABIS.map((abi) => {
      const abiPrefix = `base/lib/${abi}/`;
      const names = entries
        .filter(
          (entry) =>
            entry.name.startsWith(abiPrefix) &&
            CPU_JNI_NAMES_BY_ABI[abi].has(
              entry.name.slice(abiPrefix.length)
            ) &&
            entry.uncompressedSizeBytes > 0
        )
        .map((entry) => entry.name);
      if (names.length === 0) {
        fail(`AAB is missing a nonempty CPU rnllama JNI for ${abi}`);
      }
      for (const entry of entries.filter((entry) => names.includes(entry.name))) {
        verifyEntryPayload(archive, entry);
      }
      return [abi, names];
    })
  );

  return {
    acceleratedEntries,
    cpuJniEntries,
    manifestEntry: manifest.name
  };
}

async function main() {
  const { aabPath, evidencePath, gradlePath } = parseProductionArguments(
    process.argv.slice(2)
  );
  if (!/\.aab$/iu.test(aabPath)) {
    fail(`--aab must point to a production .aab file: ${aabPath}`);
  }
  const gradleEvidence = await verifyGradle(gradlePath);
  const { bytes: archive, sizeBytes } = await readRequiredFile(
    aabPath,
    "Production AAB"
  );
  const entries = readZipEntries(archive);
  const cpuOnlyEvidence = verifyCpuOnlyEntries(archive, entries);

  const evidence = {
    schemaVersion: 1,
    mode: "production",
    generatedAt: new Date().toISOString(),
    aab: {
      path: aabPath,
      sha256: sha256(archive),
      sizeBytes,
      entryCount: entries.length,
      entries: entries.map(
        ({
          compressedSizeBytes,
          name,
          uncompressedSizeBytes
        }) => ({
          compressedSizeBytes,
          name,
          uncompressedSizeBytes
        })
      ),
      ...cpuOnlyEvidence
    },
    gradle: gradleEvidence,
    evidence: {
      path: evidencePath
    }
  };

  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`CPU-only AAB verification passed. Evidence: ${evidencePath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CPU-only AAB verification failed: ${message}`);
  process.exitCode = 1;
});

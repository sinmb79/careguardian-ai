import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

interface ZipEntryFixture {
  name: string;
  data: Buffer | string;
}

const verifierPath = join(
  process.cwd(),
  "apps",
  "mobile",
  "scripts",
  "verify-cpu-only-llama.mjs"
);

const validGradle = `
apply plugin: "com.android.application"
// life-steward-cpu-only-llama
android {
  packagingOptions {
    jniLibs {
      excludes += [
        "**/*hexagon*.so",
        "**/*_opencl*.so",
        "**/libOpenCL.so",
        "**/libcdsprpc.so",
        "**/libggml-htp-*.so",
        "**/*htp*.so",
        "**/*Htp*.so",
        "**/*HTP*.so"
      ]
    }
  }
  sourceSets {
    main {
      assets.exclude("ggml-hexagon/**")
    }
  }
}
tasks.configureEach { task ->
  if (task.name == "syncRNLlamaHtpAssets") {
    task.enabled = false
  }
}
`;

const validAabEntries: ZipEntryFixture[] = [
  {
    name: "base/manifest/AndroidManifest.xml",
    data: Buffer.from([0x03, 0x00, 0x08, 0x00])
  },
  {
    name: "base/lib/arm64-v8a/librnllama_jni.so",
    data: "arm64-v8"
  },
  {
    name: "base/lib/x86_64/librnllama_jni_x86_64.so",
    data: "x86-cpu"
  }
];

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createCaseRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "life-steward-aab-verifier-"));
  temporaryRoots.push(root);
  return root;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries: ZipEntryFixture[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);

    const localPart = Buffer.concat([localHeader, name, data]);
    localParts.push(localPart);
    centralParts.push(Buffer.concat([centralHeader, name]));
    localOffset += localPart.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function spoofEmptyManifestAsNonempty(): Buffer {
  const archive = createStoredZip(
    validAabEntries.map((entry) =>
      entry.name === "base/manifest/AndroidManifest.xml"
        ? { ...entry, data: Buffer.alloc(0) }
        : entry
    )
  );
  const centralOffset = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  archive.writeUInt32LE(1, centralOffset + 24);
  return archive;
}

function writeFixture(
  root: string,
  entries: ZipEntryFixture[] = validAabEntries,
  archive = createStoredZip(entries)
): {
  aabPath: string;
  evidencePath: string;
  gradlePath: string;
  archive: Buffer;
} {
  const gradlePath = join(root, "android", "app", "build.gradle");
  const aabPath = join(root, "production.aab");
  const evidencePath = join(root, "cpu-only-evidence.json");
  mkdirSync(dirname(gradlePath), { recursive: true });
  writeFileSync(gradlePath, validGradle);
  writeFileSync(aabPath, archive);
  return { aabPath, evidencePath, gradlePath, archive };
}

async function runVerifier(
  cwd: string,
  args: string[]
): Promise<{
  status: number | null;
  stderr: string;
  stdout: string;
}> {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, [verifierPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout
  };
}

describe("production CPU-only AAB verifier", () => {
  test("directly verifies a real AAB ZIP and writes hash-backed evidence", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(root);

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(true);
    const evidence = JSON.parse(readFileSync(fixture.evidencePath, "utf8"));
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      mode: "production",
      aab: {
        path: fixture.aabPath,
        sha256: createHash("sha256").update(fixture.archive).digest("hex"),
        sizeBytes: fixture.archive.length,
        entryCount: 3,
        entries: [
          {
            name: "base/manifest/AndroidManifest.xml",
            compressedSizeBytes: 4,
            uncompressedSizeBytes: 4
          },
          {
            name: "base/lib/arm64-v8a/librnllama_jni.so",
            compressedSizeBytes: 8,
            uncompressedSizeBytes: 8
          },
          {
            name: "base/lib/x86_64/librnllama_jni_x86_64.so",
            compressedSizeBytes: 7,
            uncompressedSizeBytes: 7
          }
        ],
        manifestEntry: "base/manifest/AndroidManifest.xml",
        cpuJniEntries: {
          "arm64-v8a": ["base/lib/arm64-v8a/librnllama_jni.so"],
          x86_64: ["base/lib/x86_64/librnllama_jni_x86_64.so"]
        },
        acceleratedEntries: []
      },
      gradle: {
        path: fixture.gradlePath,
        marker: "life-steward-cpu-only-llama",
        sha256: createHash("sha256").update(validGradle).digest("hex"),
        sizeBytes: Buffer.byteLength(validGradle)
      },
      evidence: {
        path: fixture.evidencePath
      }
    });
    expect(new Date(evidence.generatedAt).toISOString()).toBe(
      evidence.generatedAt
    );
  });

  test("requires production AAB, Gradle, and evidence flags instead of an archive-list shortcut", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(root);
    const archiveListPath = join(root, "package.json");
    writeFileSync(archiveListPath, "{}");

    const result = await runVerifier(root, [
      "--gradle",
      fixture.gradlePath,
      "--archive-list",
      archiveListPath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test("rejects archive-list even when all production flags are also present", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(root);
    const archiveListPath = join(root, "archive-list.txt");
    writeFileSync(archiveListPath, "");

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath,
      "--archive-list",
      archiveListPath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test("refuses to overwrite the production AAB or Gradle file with evidence JSON", async () => {
    for (const protectedPath of ["aabPath", "gradlePath"] as const) {
      const root = createCaseRoot();
      const fixture = writeFixture(root);
      const original = readFileSync(fixture[protectedPath]);

      const result = await runVerifier(root, [
        "--aab",
        fixture.aabPath,
        "--gradle",
        fixture.gradlePath,
        "--evidence",
        fixture[protectedPath]
      ]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(fixture[protectedPath])).toEqual(original);
    }
  });

  test("rejects a package.json masquerading as the required app build.gradle", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(root);
    const packagePath = join(root, "package.json");
    writeFileSync(packagePath, validGradle);

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      packagePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test("rejects a valid ZIP renamed to package.json instead of a production AAB", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(root);
    const packagePath = join(root, "package.json");
    writeFileSync(packagePath, fixture.archive);

    const result = await runVerifier(root, [
      "--aab",
      packagePath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test.each([
    {
      name: "a fake ZIP",
      archive: Buffer.from("PK-not-a-real-aab", "utf8")
    },
    {
      name: "an empty ZIP",
      archive: createStoredZip([])
    }
  ])("rejects $name", async ({ archive }) => {
    const root = createCaseRoot();
    const fixture = writeFixture(root, validAabEntries, archive);

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test("rejects a ZIP whose central directory falsely claims an empty required payload is nonempty", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(
      root,
      validAabEntries,
      spoofEmptyManifestAsNonempty()
    );

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test.each([
    {
      name: "the Android manifest is missing",
      entries: validAabEntries.filter(
        (entry) => entry.name !== "base/manifest/AndroidManifest.xml"
      )
    },
    {
      name: "the Android manifest is empty",
      entries: validAabEntries.map((entry) =>
        entry.name === "base/manifest/AndroidManifest.xml"
          ? { ...entry, data: Buffer.alloc(0) }
          : entry
      )
    },
    {
      name: "the arm64-v8a CPU JNI is missing",
      entries: validAabEntries.filter(
        (entry) => !entry.name.includes("/arm64-v8a/")
      )
    },
    {
      name: "the x86_64 CPU JNI is missing",
      entries: validAabEntries.filter(
        (entry) => !entry.name.includes("/x86_64/")
      )
    },
    {
      name: "a required CPU JNI is empty",
      entries: validAabEntries.map((entry) =>
        entry.name.includes("/arm64-v8a/")
          ? { ...entry, data: Buffer.alloc(0) }
          : entry
      )
    },
    {
      name: "a CPU JNI uses the wrong filename case",
      entries: validAabEntries.map((entry) =>
        entry.name.includes("/arm64-v8a/")
          ? {
              ...entry,
              name: "base/lib/arm64-v8a/LIBRNLLAMA_JNI.SO"
            }
          : entry
      )
    },
    {
      name: "an unknown rnllama JNI suffix impersonates a CPU target",
      entries: validAabEntries.map((entry) =>
        entry.name.includes("/arm64-v8a/")
          ? {
              ...entry,
              name: "base/lib/arm64-v8a/librnllama_jni_fake.so"
            }
          : entry
      )
    },
    {
      name: "an accelerated HTP asset remains",
      entries: [
        ...validAabEntries,
        {
          name: "base/assets/ggml-hexagon/htp-kernels.bin",
          data: "accelerated"
        }
      ]
    },
    {
      name: "an OpenCL JNI remains",
      entries: [
        ...validAabEntries,
        {
          name: "base/lib/arm64-v8a/libggml_opencl.so",
          data: "accelerated"
        }
      ]
    },
    {
      name: "a cdsprpc JNI remains",
      entries: [
        ...validAabEntries,
        {
          name: "base/lib/arm64-v8a/libcdsprpc.so",
          data: "accelerated"
        }
      ]
    },
    {
      name: "a GPU JNI remains",
      entries: [
        ...validAabEntries,
        {
          name: "base/lib/arm64-v8a/librnllama_jni_gpu.so",
          data: "accelerated"
        }
      ]
    },
    {
      name: "a Vulkan JNI remains",
      entries: [
        ...validAabEntries,
        {
          name: "base/lib/arm64-v8a/libggml-vulkan.so",
          data: "accelerated"
        }
      ]
    }
  ])("rejects an AAB when $name", async ({ entries }) => {
    const root = createCaseRoot();
    const fixture = writeFixture(root, entries);

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });

  test("rejects app build.gradle when the CPU-only marker or exclusions are incomplete", async () => {
    const root = createCaseRoot();
    const fixture = writeFixture(root);
    writeFileSync(
      fixture.gradlePath,
      'apply plugin: "com.android.application"\n// life-steward-cpu-only-llama\n'
    );

    const result = await runVerifier(root, [
      "--aab",
      fixture.aabPath,
      "--gradle",
      fixture.gradlePath,
      "--evidence",
      fixture.evidencePath
    ]);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.evidencePath)).toBe(false);
  });
});

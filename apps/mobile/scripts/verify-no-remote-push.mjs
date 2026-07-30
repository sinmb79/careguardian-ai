import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";

const MAX_ARCHIVE_ENTRIES = 100_000;
const MAX_ENTRY_NAME_BYTES = 4_096;
const MAX_SCANNED_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_SCANNED_BYTES = 512 * 1024 * 1024;
const STREAM_PATTERN_CARRY = 512;

const FORBIDDEN_DEPENDENCIES = [
  ["expo-notifications", /(?:^|[^a-z0-9_-])expo-notifications(?:$|[^a-z0-9_-])/i],
  ["Firebase Messaging", /com\.google\.firebase:firebase-messaging/i],
  ["Firebase Installations", /com\.google\.firebase:firebase-installations/i],
  ["Google DataTransport", /com\.google\.android\.datatransport:transport-/i],
  ["ShortcutBadger", /(?:me\.leolin:ShortcutBadger|shortcutbadger)/i],
  ["Cloud Messaging", /cloud-messaging/i],
  ["AD_ID provider", /play-services-(?:ads-identifier|measurement)/i]
];

const FORBIDDEN_JAVA_ARTIFACT_SURFACES = [
  ["Firebase namespace", /com[./\\]google[./\\]firebase/i],
  ["Firebase Messaging", /FirebaseMessaging|firebase[_-]?messaging/i],
  ["Firebase Installations", /firebase[_-]?installations?/i],
  ["Google DataTransport", /com[./\\]google[./\\]android[./\\]datatransport/i],
  ["Cloud Messaging", /cloud[_-]?messaging/i],
  ["messaging event", /messaging[_-]?event/i],
  ["ShortcutBadger", /shortcutbadger/i],
  ["C2DM", /com[./\\]google[./\\]android[./\\]c2dm|c2dm[./\\]permission/i],
  ["advertising identifier", /com[./\\]google[./\\]android[./\\]gms[./\\](?:permission[./\\]AD_ID|ads[./\\]identifier)|advertising_id/i],
  ["launcher badge", /BADGE_COUNT|provider\.badge\.permission|launcher\.permission\.(?:READ_SETTINGS|WRITE_SETTINGS|UPDATE_COUNT|UPDATE_BADGE)/i]
];

const FORBIDDEN_ARTIFACT_ENTRIES = [
  ["legacy Expo notification namespace", /expo[./\\]modules[./\\]notifications/i],
  ...FORBIDDEN_JAVA_ARTIFACT_SURFACES
];

// DEX is intentionally excluded from this generic content scan. Its actual
// classes are inspected semantically with apkanalyzer, while the four legacy
// migration strings are counted separately and cannot authorize old classes.
const FORBIDDEN_ARTIFACT_CONTENTS =
  FORBIDDEN_JAVA_ARTIFACT_SURFACES;

const FORBIDDEN_DEX_PACKAGES = [
  ["legacy Expo notifications", /(?:^|\s)expo\.modules\.notifications(?:[.$\s]|$)/im],
  ["Firebase", /(?:^|\s)com\.google\.firebase(?:[.$\s]|$)/im],
  ["Google Cloud Messaging", /(?:^|\s)com\.google\.android\.gms\.cloudmessaging(?:[.$\s]|$)/im],
  ["Google DataTransport", /(?:^|\s)com\.google\.android\.datatransport(?:[.$\s]|$)/im],
  ["ShortcutBadger", /(?:^|\s)me\.leolin\.shortcutbadger(?:[.$\s]|$)/im],
  ["advertising identifier", /(?:^|\s)com\.google\.android\.gms\.ads\.identifier(?:[.$\s]|$)/im]
];

const LEGACY_MIGRATION_DEX_STRINGS = [
  "expo.modules.notifications.SharedPreferencesNotificationsStore",
  "expo.modules.notifications.SharedPreferencesNotificationCategoriesStore",
  "expo.modules.notifications.NOTIFICATION_EVENT",
  "expo.modules.notifications.service.NotificationsService"
];
const LEGACY_MIGRATION_PREFIX = "expo.modules.notifications";

function asSearchableText(value) {
  if (Buffer.isBuffer(value)) return value.toString("latin1");
  return String(value);
}

function addPatternProblems(problems, patterns, value, messagePrefix) {
  const searchable = asSearchableText(value);
  for (const [label, pattern] of patterns) {
    if (pattern.test(searchable)) {
      problems.add(`${messagePrefix}: ${label}`);
    }
  }
}

export function analyzeNoRemotePush({
  dependencyReport = "",
  artifactEntries = [],
  artifactContents = []
}) {
  const problems = new Set();
  addPatternProblems(
    problems,
    FORBIDDEN_DEPENDENCIES,
    dependencyReport,
    "forbidden resolved dependency"
  );
  for (const entry of artifactEntries) {
    addPatternProblems(
      problems,
      FORBIDDEN_ARTIFACT_ENTRIES,
      entry,
      "forbidden assembled artifact entry"
    );
  }
  for (const content of artifactContents) {
    addPatternProblems(
      problems,
      FORBIDDEN_ARTIFACT_CONTENTS,
      content,
      "forbidden assembled artifact content"
    );
  }
  return {
    gate: "no-remote-push",
    status: problems.size === 0 ? "pass" : "fail",
    problems: [...problems]
  };
}

export function analyzeDexPackageReport(packageReport) {
  const problems = new Set();
  addPatternProblems(
    problems,
    FORBIDDEN_DEX_PACKAGES,
    packageReport,
    "forbidden DEX package"
  );
  return {
    gate: "no-remote-push-dex",
    status: problems.size === 0 ? "pass" : "fail",
    problems: [...problems]
  };
}

export function analyzeMigrationDexStringCounts(
  counts,
  prefixCount = LEGACY_MIGRATION_DEX_STRINGS.reduce(
    (total, value) => total + (counts.get(value) ?? 0),
    0
  )
) {
  const problems = [];
  for (const value of LEGACY_MIGRATION_DEX_STRINGS) {
    const count = counts.get(value) ?? 0;
    if (count !== 1) {
      problems.push(
        `legacy migration DEX string must occur exactly once: ${value}`
      );
    }
  }
  if (prefixCount !== LEGACY_MIGRATION_DEX_STRINGS.length) {
    problems.push(
      "legacy Expo notification DEX prefix count exceeds the fixed migration allowlist"
    );
  }
  return {
    gate: "legacy-notification-migration",
    status: problems.length === 0 ? "pass" : "fail",
    problems
  };
}

function valueAfter(argumentsList, flag) {
  const index = argumentsList.indexOf(flag);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}

export function resolveNoRemotePushInputs(args) {
  const packageLockPath = valueAfter(args, "--package-lock");
  const dependenciesPath = valueAfter(args, "--dependencies");
  const aabPath = valueAfter(args, "--aab");
  const universalApkPath = valueAfter(args, "--universal-apk");
  const hasAabFlag = args.includes("--aab");
  const hasUniversalApkFlag = args.includes("--universal-apk");

  if (hasAabFlag && !aabPath) {
    throw new Error("--aab requires a raw Android App Bundle path");
  }
  if (hasUniversalApkFlag && !universalApkPath) {
    throw new Error("--universal-apk requires a universal APK path");
  }
  if (aabPath && !universalApkPath) {
    throw new Error(
      "A raw AAB must be inspected together with its universal APK"
    );
  }
  if (universalApkPath && !aabPath) {
    throw new Error(
      "A universal APK must be inspected together with its raw AAB"
    );
  }
  if (aabPath && !/\.aab$/i.test(aabPath)) {
    throw new Error("--aab must point to a .aab archive");
  }
  if (universalApkPath && !/\.apk$/i.test(universalApkPath)) {
    throw new Error("--universal-apk must point to a .apk archive");
  }

  const artifactPaths = args.flatMap((argument, index) =>
    argument === "--artifact" && args[index + 1] ? [args[index + 1]] : []
  );
  if (aabPath && universalApkPath) {
    artifactPaths.push(aabPath, universalApkPath);
  }
  if (!packageLockPath && !dependenciesPath && artifactPaths.length === 0) {
    throw new Error(
      "Provide --package-lock, --dependencies, --artifact, or the " +
      "--aab/--universal-apk release pair"
    );
  }
  return {
    packageLockPath,
    dependenciesPath,
    artifactPaths,
    releaseBinaryPair: Boolean(aabPath && universalApkPath)
  };
}

export function validateArchiveInspectionBounds({
  entryCount,
  entryBytes,
  totalBytes
}) {
  if (entryCount <= 0 || entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new Error(
      `archive entry count is outside the allowed range: ${entryCount}`
    );
  }
  if (entryBytes < 0 || entryBytes > MAX_SCANNED_ENTRY_BYTES) {
    throw new Error("archive entry exceeds the content scan byte limit");
  }
  if (totalBytes < 0 || totalBytes > MAX_TOTAL_SCANNED_BYTES) {
    throw new Error("archive exceeds the total content scan byte limit");
  }
}

function isUnsafeArchivePath(entryName) {
  return (
    entryName.length === 0 ||
    Buffer.byteLength(entryName, "utf8") > MAX_ENTRY_NAME_BYTES ||
    entryName.includes("\0") ||
    entryName.includes("\\") ||
    entryName.startsWith("/") ||
    /^[A-Za-z]:/.test(entryName) ||
    entryName.split("/").includes("..")
  );
}

function isDexEntry(entryName) {
  return /(?:^|\/)classes\d*\.dex$/i.test(entryName);
}

function shouldScanAndroidContent(entryName) {
  return (
    /(?:^|\/)AndroidManifest\.xml$/i.test(entryName) ||
    /(?:^|\/)resources\.(?:arsc|pb)$/i.test(entryName) ||
    /(?:^|\/)dependencies\.pb$/i.test(entryName) ||
    /^META-INF\/.*\.(?:MF|properties|version|json|xml|pb)$/i.test(entryName) ||
    /^BUNDLE-METADATA\/.*(?:dependenc|manifest|resource).*\.(?:pb|json|xml|txt)$/i.test(entryName)
  );
}

function createLiteralCounter(value) {
  return {
    carry: Buffer.alloc(0),
    count: 0,
    needle: Buffer.from(value, "utf8")
  };
}

function countLiteralChunk(counter, chunk) {
  const combined = counter.carry.length > 0
    ? Buffer.concat([counter.carry, chunk])
    : chunk;
  let offset = 0;
  while (offset <= combined.length - counter.needle.length) {
    const found = combined.indexOf(counter.needle, offset);
    if (found < 0) break;
    counter.count += 1;
    offset = found + counter.needle.length;
  }
  const carryLength = Math.min(
    counter.needle.length - 1,
    combined.length
  );
  counter.carry = Buffer.from(
    combined.subarray(combined.length - carryLength)
  );
}

function scanEntryStream(stream, { dex, problems }) {
  const migrationCounters = new Map(
    LEGACY_MIGRATION_DEX_STRINGS.map((value) => [
      value,
      createLiteralCounter(value)
    ])
  );
  const migrationPrefixCounter = createLiteralCounter(
    LEGACY_MIGRATION_PREFIX
  );
  let genericCarry = "";
  let scannedBytes = 0;

  return new Promise((resolveStream, rejectStream) => {
    stream.on("data", (chunk) => {
      scannedBytes += chunk.length;
      if (scannedBytes > MAX_SCANNED_ENTRY_BYTES) {
        stream.destroy(
          new Error("archive entry exceeds the content scan byte limit")
        );
        return;
      }
      if (dex) {
        for (const counter of migrationCounters.values()) {
          countLiteralChunk(counter, chunk);
        }
        countLiteralChunk(migrationPrefixCounter, chunk);
      }

      const text = genericCarry + chunk.toString("latin1");
      addPatternProblems(
        problems,
        FORBIDDEN_ARTIFACT_CONTENTS,
        text,
        dex
          ? "forbidden DEX literal"
          : "forbidden assembled artifact content"
      );
      genericCarry = text.slice(-STREAM_PATTERN_CARRY);
    });
    stream.once("error", rejectStream);
    stream.once("end", () => {
      resolveStream({
        migrationCounts: new Map(
          [...migrationCounters].map(([value, counter]) => [
            value,
            counter.count
          ])
        ),
        migrationPrefixCount: migrationPrefixCounter.count,
        scannedBytes
      });
    });
  });
}

function openArchive(archivePath) {
  return new Promise((resolveArchive, rejectArchive) => {
    yauzl.open(
      archivePath,
      {
        autoClose: false,
        lazyEntries: true,
        strictFileNames: true,
        validateEntrySizes: true
      },
      (error, archive) => {
        if (error) rejectArchive(error);
        else resolveArchive(archive);
      }
    );
  });
}

export async function inspectArchive(archivePath) {
  const archive = await openArchive(archivePath);
  try {
    validateArchiveInspectionBounds({
      entryCount: archive.entryCount,
      entryBytes: 0,
      totalBytes: 0
    });
  } catch (error) {
    archive.close();
    throw error;
  }

  const names = new Set();
  const problems = new Set();
  const migrationCounts = new Map(
    LEGACY_MIGRATION_DEX_STRINGS.map((value) => [value, 0])
  );
  let migrationPrefixCount = 0;
  let plannedScannedBytes = 0;
  let scannedBytes = 0;
  let processedEntries = 0;

  return new Promise((resolveInspection, rejectInspection) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      archive.close();
      rejectInspection(error);
    };

    archive.once("error", fail);
    archive.once("end", () => {
      if (settled) return;
      settled = true;
      archive.close();
      if (processedEntries !== archive.entryCount) {
        rejectInspection(
          new Error("archive ended before every declared entry was inspected")
        );
        return;
      }
      resolveInspection({
        entryCount: processedEntries,
        migrationCounts,
        migrationPrefixCount,
        path: archivePath,
        problems: [...problems],
        scannedBytes
      });
    });

    archive.on("entry", (entry) => {
      processedEntries += 1;
      const entryName = entry.fileName;
      if (isUnsafeArchivePath(entryName)) {
        fail(new Error(`archive contains an unsafe path: ${entryName}`));
        return;
      }
      if (names.has(entryName)) {
        fail(new Error(`archive contains a duplicate entry: ${entryName}`));
        return;
      }
      names.add(entryName);
      if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
        fail(new Error(`archive contains an encrypted entry: ${entryName}`));
        return;
      }
      addPatternProblems(
        problems,
        FORBIDDEN_ARTIFACT_ENTRIES,
        entryName,
        "forbidden assembled artifact entry"
      );

      const dex = isDexEntry(entryName);
      const scanContent = dex || shouldScanAndroidContent(entryName);
      if (!scanContent || entryName.endsWith("/")) {
        archive.readEntry();
        return;
      }
      plannedScannedBytes += entry.uncompressedSize;
      try {
        validateArchiveInspectionBounds({
          entryCount: archive.entryCount,
          entryBytes: entry.uncompressedSize,
          totalBytes: plannedScannedBytes
        });
      } catch (error) {
        fail(error);
        return;
      }

      archive.openReadStream(entry, (error, stream) => {
        if (error) {
          fail(error);
          return;
        }
        scanEntryStream(stream, { dex, problems })
          .then((result) => {
            scannedBytes += result.scannedBytes;
            if (scannedBytes > MAX_TOTAL_SCANNED_BYTES) {
              fail(
                new Error("archive exceeded the total content scan byte limit")
              );
              return;
            }
            if (dex) {
              for (const [value, count] of result.migrationCounts) {
                migrationCounts.set(
                  value,
                  (migrationCounts.get(value) ?? 0) + count
                );
              }
              migrationPrefixCount += result.migrationPrefixCount;
            }
            archive.readEntry();
          })
          .catch(fail);
      });
    });

    archive.readEntry();
  });
}

function findApkAnalyzerRuntime() {
  const executable = process.platform === "win32"
    ? "apkanalyzer.bat"
    : "apkanalyzer";
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : undefined
  ].filter(Boolean);
  const candidates = [
    process.env.APKANALYZER,
    ...sdkRoots.map((root) =>
      join(root, "cmdline-tools", "latest", "bin", executable)
    )
  ].filter(Boolean);
  const launcher = candidates.find((candidate) => existsSync(candidate));
  if (!launcher) {
    throw new Error(
      "Android SDK apkanalyzer is required for universal APK DEX inspection"
    );
  }
  const toolRoot = resolve(dirname(launcher), "..");
  const classpath = join(
    toolRoot,
    "lib",
    "apkanalyzer-classpath.jar"
  );
  if (!existsSync(classpath)) {
    throw new Error(
      "Android SDK apkanalyzer classpath is unavailable"
    );
  }

  const javaExecutable = process.platform === "win32"
    ? "java.exe"
    : "java";
  const studioRuntime =
    "C:\\Program Files\\Android\\Android Studio\\jbr";
  const javaCandidates = [
    process.env.JAVA_HOME
      ? join(process.env.JAVA_HOME, "bin", javaExecutable)
      : undefined,
    process.platform === "win32"
      ? join(studioRuntime, "bin", javaExecutable)
      : undefined
  ].filter(Boolean);
  const java = javaCandidates.find((candidate) =>
    existsSync(candidate)
  ) ?? javaExecutable;
  return { classpath, java, toolRoot };
}

function inspectUniversalApkDex(apkPath) {
  const analyzer = findApkAnalyzerRuntime();
  const result = spawnSync(
    analyzer.java,
    [
      `-Dcom.android.sdklib.toolsdir=${analyzer.toolRoot}`,
      "-classpath",
      analyzer.classpath,
      "com.android.tools.apk.analyzer.ApkAnalyzerCli",
      "dex",
      "packages",
      "--defined-only",
      resolve(apkPath)
    ],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      shell: false
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `apkanalyzer DEX package inspection failed for ${basename(apkPath)}: ` +
      (result.stderr || result.stdout || "unknown error")
    );
  }
  return analyzeDexPackageReport(result.stdout);
}

async function runCli() {
  const args = process.argv.slice(2);
  const {
    packageLockPath,
    dependenciesPath,
    artifactPaths,
    releaseBinaryPair
  } = resolveNoRemotePushInputs(args);
  const dependencyReport = [
    packageLockPath ? readFileSync(resolve(packageLockPath), "utf8") : "",
    dependenciesPath ? readFileSync(resolve(dependenciesPath), "utf8") : ""
  ].join("\n");
  const sourceReport = analyzeNoRemotePush({ dependencyReport });
  const problems = new Set(sourceReport.problems);
  const inspections = [];

  for (const artifactPath of artifactPaths) {
    const inspection = await inspectArchive(resolve(artifactPath));
    inspections.push(inspection);
    for (const problem of inspection.problems) problems.add(problem);
  }

  let dexPackageReport;
  if (releaseBinaryPair) {
    for (const inspection of inspections.slice(-2)) {
      const migrationReport = analyzeMigrationDexStringCounts(
        inspection.migrationCounts,
        inspection.migrationPrefixCount
      );
      for (const problem of migrationReport.problems) problems.add(problem);
    }
    const universalApkPath = valueAfter(args, "--universal-apk");
    dexPackageReport = inspectUniversalApkDex(universalApkPath);
    for (const problem of dexPackageReport.problems) problems.add(problem);
  }

  const report = {
    gate: "no-remote-push",
    status: problems.size === 0 ? "pass" : "fail",
    problems: [...problems],
    releaseBinaryPair,
    artifacts: inspections.map((inspection) => ({
      entryCount: inspection.entryCount,
      path: inspection.path,
      scannedBytes: inspection.scannedBytes
    })),
    dexPackageGate: dexPackageReport?.status
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

if (
  resolve(fileURLToPath(import.meta.url)) ===
  resolve(process.argv[1] ?? "")
) {
  await runCli();
}

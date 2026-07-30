import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

let verifier;
let importError;
try {
  verifier = await import("./verify-no-remote-push.mjs");
} catch (error) {
  importError = error;
}

test("exports the deterministic dependency and artifact verifier", () => {
  assert.ifError(importError);
  assert.equal(typeof verifier?.analyzeNoRemotePush, "function");
  assert.equal(typeof verifier?.analyzeDexPackageReport, "function");
  assert.equal(typeof verifier?.analyzeMigrationDexStringCounts, "function");
  assert.equal(typeof verifier?.inspectArchive, "function");
  assert.equal(typeof verifier?.validateArchiveInspectionBounds, "function");
  assert.equal(typeof verifier?.resolveNoRemotePushInputs, "function");
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content ?? "");
    const flags = entry.flags ?? 0;
    const method = entry.method ?? 0;
    const declaredSize = entry.declaredSize ?? content.length;
    const checksum = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function withZipFixture(t, entries) {
  const root = mkdtempSync(join(tmpdir(), "life-no-push-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const archive = join(root, "fixture.apk");
  writeFileSync(archive, createStoredZip(entries));
  return archive;
}

test("requires the raw AAB and universal APK as one release-binary pair", () => {
  assert.throws(
    () => verifier.resolveNoRemotePushInputs(["--aab", "release.aab"]),
    /universal APK/i
  );
  assert.throws(
    () => verifier.resolveNoRemotePushInputs([
      "--universal-apk",
      "universal.apk"
    ]),
    /AAB/i
  );
  assert.deepEqual(
    verifier.resolveNoRemotePushInputs([
      "--package-lock",
      "package-lock.json",
      "--aab",
      "release.aab",
      "--universal-apk",
      "universal.apk"
    ]),
    {
      packageLockPath: "package-lock.json",
      dependenciesPath: undefined,
      artifactPaths: ["release.aab", "universal.apk"],
      releaseBinaryPair: true
    }
  );
});

test("fails closed on excessive archive entries or content scan bytes", () => {
  assert.throws(
    () => verifier.validateArchiveInspectionBounds({
      entryCount: 100_001,
      entryBytes: 0,
      totalBytes: 0
    }),
    /entry count/i
  );
  assert.throws(
    () => verifier.validateArchiveInspectionBounds({
      entryCount: 1,
      entryBytes: 256 * 1024 * 1024 + 1,
      totalBytes: 0
    }),
    /entry.*byte limit/i
  );
  assert.throws(
    () => verifier.validateArchiveInspectionBounds({
      entryCount: 1,
      entryBytes: 1,
      totalBytes: 512 * 1024 * 1024 + 1
    }),
    /total.*byte limit/i
  );
});

test("accepts a custom local-only dependency tree and artifact", () => {
  const result = verifier.analyzeNoRemotePush({
    dependencyReport: "+--- project :life-local-notifications\n\\--- androidx.core:core:1.16.0",
    artifactEntries: ["AndroidManifest.xml", "classes.dex"],
    artifactContents: ["life-steward-tasks-v1", "LifeReminderReceiver"]
  });
  assert.deepEqual(result, { gate: "no-remote-push", status: "pass", problems: [] });
});

test("scans a logically large artifact iterable without assembling one giant string", () => {
  const reusableChunk = Buffer.alloc(256 * 1024, 0x20);
  function* largeFixture() {
    for (let index = 0; index < 64; index += 1) {
      yield reusableChunk;
    }
  }
  const result = verifier.analyzeNoRemotePush({
    artifactContents: largeFixture()
  });
  assert.equal(result.status, "pass");
});

test("streams a real yauzl 3 archive and counts split-safe migration strings", async (t) => {
  const migrationPayload = Buffer.concat([
    Buffer.alloc(2 * 1024 * 1024, 0x20),
    Buffer.from([
      "expo.modules.notifications.SharedPreferencesNotificationsStore",
      "expo.modules.notifications.SharedPreferencesNotificationCategoriesStore",
      "expo.modules.notifications.NOTIFICATION_EVENT",
      "expo.modules.notifications.service.NotificationsService"
    ].join("\n"))
  ]);
  const archive = withZipFixture(t, [
    { name: "AndroidManifest.xml", content: "<manifest />" },
    { name: "classes.dex", content: migrationPayload }
  ]);

  const inspection = await verifier.inspectArchive(archive);
  assert.equal(inspection.entryCount, 2);
  assert.equal(inspection.scannedBytes, migrationPayload.length + 12);
  assert.deepEqual(inspection.problems, []);
  assert.equal(
    verifier.analyzeMigrationDexStringCounts(
      inspection.migrationCounts,
      inspection.migrationPrefixCount
    ).status,
    "pass"
  );
});

test("real ZIP inspection rejects forbidden content and unsafe archive metadata", async (t) => {
  const forbidden = withZipFixture(t, [
    {
      name: "AndroidManifest.xml",
      content: "com.google.android.c2dm.permission.RECEIVE"
    }
  ]);
  const forbiddenInspection = await verifier.inspectArchive(forbidden);
  assert.match(
    forbiddenInspection.problems.join("\n"),
    /forbidden assembled artifact content/i
  );

  const unsafe = withZipFixture(t, [
    { name: "../AndroidManifest.xml", content: "<manifest />" }
  ]);
  await assert.rejects(
    verifier.inspectArchive(unsafe),
    /(?:unsafe path|invalid relative path)/i
  );

  const duplicate = withZipFixture(t, [
    { name: "AndroidManifest.xml", content: "<manifest />" },
    { name: "AndroidManifest.xml", content: "<manifest />" }
  ]);
  await assert.rejects(
    verifier.inspectArchive(duplicate),
    /duplicate entry/i
  );
});

test("real ZIP inspection enforces the declared per-entry byte bound before streaming", async (t) => {
  const archive = withZipFixture(t, [
    {
      name: "classes.dex",
      content: Buffer.from([0]),
      declaredSize: 256 * 1024 * 1024 + 1,
      method: 8
    }
  ]);
  await assert.rejects(
    verifier.inspectArchive(archive),
    /entry.*byte limit/i
  );
});

test("real DEX streaming rejects forbidden reflective class and Intent literals", async (t) => {
  const safeMigrationStrings = [
    "expo.modules.notifications.SharedPreferencesNotificationsStore",
    "expo.modules.notifications.SharedPreferencesNotificationCategoriesStore",
    "expo.modules.notifications.NOTIFICATION_EVENT",
    "expo.modules.notifications.service.NotificationsService"
  ].join("\n");
  for (const forbiddenLiteral of [
    "Class.forName(com.google.firebase.messaging.FirebaseMessaging)",
    "Intent(com.google.android.c2dm.intent.RECEIVE)",
    "Lcom/google/android/c2dm/Receiver;",
    "com.google.android.gms.permission.AD_ID",
    "Class.forName(com.google.android.gms.ads.identifier.AdvertisingIdClient)",
    "me.leolin.shortcutbadger.ShortcutBadger"
  ]) {
    const archive = withZipFixture(t, [
      {
        name: "classes.dex",
        content: `${safeMigrationStrings}\n${forbiddenLiteral}`
      }
    ]);
    const inspection = await verifier.inspectArchive(archive);
    assert.match(
      inspection.problems.join("\n"),
      /forbidden DEX literal/i
    );
  }
});

test("invokes apkanalyzer through direct Java without a command shell", () => {
  const source = readFileSync(
    new URL("./verify-no-remote-push.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /com\.android\.tools\.apk\.analyzer\.ApkAnalyzerCli/);
  assert.doesNotMatch(source, /shell:\s*process\.platform/);
});

test("rejects actual forbidden DEX packages but accepts the custom module", async (t) => {
  for (const forbiddenPackage of [
    "expo.modules.notifications.service",
    "com.google.firebase.messaging",
    "com.google.android.gms.cloudmessaging",
    "com.google.android.datatransport.runtime",
    "me.leolin.shortcutbadger"
  ]) {
    await t.test(forbiddenPackage, () => {
      const report = verifier.analyzeDexPackageReport(
        `P d 1 1 1 ${forbiddenPackage}`
      );
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), /DEX package/);
    });
  }

  assert.deepEqual(
    verifier.analyzeDexPackageReport(
      "P d 1 1 1 expo.modules.lifelocalnotifications"
    ),
    { gate: "no-remote-push-dex", status: "pass", problems: [] }
  );
});

test("allows only the four fixed legacy migration strings exactly once per binary", () => {
  const exactCounts = new Map([
    [
      "expo.modules.notifications.SharedPreferencesNotificationsStore",
      1
    ],
    [
      "expo.modules.notifications.SharedPreferencesNotificationCategoriesStore",
      1
    ],
    ["expo.modules.notifications.NOTIFICATION_EVENT", 1],
    ["expo.modules.notifications.service.NotificationsService", 1]
  ]);
  assert.deepEqual(
    verifier.analyzeMigrationDexStringCounts(exactCounts),
    { gate: "legacy-notification-migration", status: "pass", problems: [] }
  );
  const duplicated = new Map(exactCounts);
  duplicated.set(
    "expo.modules.notifications.service.NotificationsService",
    2
  );
  assert.equal(
    verifier.analyzeMigrationDexStringCounts(duplicated).status,
    "fail"
  );
  const missing = new Map(exactCounts);
  missing.delete("expo.modules.notifications.NOTIFICATION_EVENT");
  assert.equal(
    verifier.analyzeMigrationDexStringCounts(missing).status,
    "fail"
  );
});

test("rejects every forbidden resolved dependency independently", async (t) => {
  for (const forbidden of [
    "com.google.firebase:firebase-messaging",
    "com.google.firebase:firebase-installations",
    "com.google.android.datatransport:transport-runtime",
    "me.leolin:ShortcutBadger",
    "expo-notifications"
  ]) {
    await t.test(forbidden, () => {
      const result = verifier.analyzeNoRemotePush({
        dependencyReport: `+--- ${forbidden}:1.0.0`,
        artifactEntries: [],
        artifactContents: []
      });
      assert.equal(result.status, "fail");
      assert.match(result.problems.join("\n"), /dependency/i);
    });
  }
});

test("rejects remote-push, badge, C2DM, AD_ID and legacy Expo surfaces in artifacts", async (t) => {
  for (const forbidden of [
    "com/google/firebase/messaging/FirebaseMessagingService.class",
    "firebaseinstallations",
    "cloud-messaging",
    "messaging_event",
    "me/leolin/shortcutbadger",
    "com.google.android.c2dm.permission.RECEIVE",
    "com.google.android.gms.permission.AD_ID",
    "expo/modules/notifications/service/NotificationsService"
  ]) {
    await t.test(forbidden, () => {
      const result = verifier.analyzeNoRemotePush({
        dependencyReport: "",
        artifactEntries: [forbidden],
        artifactContents: [forbidden]
      });
      assert.equal(result.status, "fail");
      assert.match(result.problems.join("\n"), /artifact/i);
    });
  }
});

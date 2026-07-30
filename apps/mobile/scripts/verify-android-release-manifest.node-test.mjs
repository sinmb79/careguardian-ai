import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

let manifestVerifier;
let importError;
try {
  manifestVerifier = await import("./verify-android-release-manifest.mjs");
} catch (error) {
  importError = error;
}

test("exports the release merged-manifest validator", () => {
  assert.ifError(importError);
  assert.equal(typeof manifestVerifier?.validateReleaseManifest, "function");
});

const fixtureRoot = resolve(
  import.meta.dirname,
  "fixtures",
  "android-manifests"
);
const hardenedManifest = readFileSync(
  resolve(fixtureRoot, "hardened-local.xml"),
  "utf8"
);
const currentRemoteManifest = readFileSync(
  resolve(fixtureRoot, "current-remote.xml"),
  "utf8"
);

test("rejects the current manifest fixture with remote-push and badge surfaces", () => {
  const report = manifestVerifier.validateReleaseManifest(currentRemoteManifest);

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /c2dm/i);
  assert.match(report.problems.join("\n"), /badge/i);
  assert.match(report.problems.join("\n"), /ExpoFirebaseMessagingService/);
  assert.match(report.problems.join("\n"), /FirebaseInstanceIdReceiver/);
  assert.match(report.problems.join("\n"), /FirebaseMessagingService/);
  assert.match(report.problems.join("\n"), /ComponentDiscoveryService/);
  assert.match(report.problems.join("\n"), /FirebaseInitProvider/);
  assert.match(report.problems.join("\n"), /FirebaseMessagingRegistrar/);
  assert.match(report.problems.join("\n"), /FirebaseInstallationsRegistrar/);
  assert.match(report.problems.join("\n"), /TransportRegistrar/);
});

test("accepts the hardened local-notification-only manifest fixture", () => {
  assert.deepEqual(
    manifestVerifier.validateReleaseManifest(hardenedManifest),
    {
      gate: "android-release-manifest",
      status: "pass",
      problems: []
    }
  );
});

function addManifestChild(fragment) {
  return hardenedManifest.replace(
    "  <application>",
    `  ${fragment}\n  <application>`
  );
}

function addApplicationChild(fragment) {
  return hardenedManifest.replace(
    "  </application>",
    `    ${fragment}\n  </application>`
  );
}

test("detects every forbidden remote-push component and registrar independently", async (t) => {
  const cases = [
    [
      "C2DM receive permission",
      addManifestChild(
        '<uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />'
      ),
      /C2DM/
    ],
    [
      "Expo Firebase messaging service",
      addApplicationChild(
        '<service android:name="expo.modules.notifications.service.ExpoFirebaseMessagingService" />'
      ),
      /ExpoFirebaseMessagingService/
    ],
    [
      "Firebase instance receiver",
      addApplicationChild(
        '<receiver android:name="com.google.firebase.iid.FirebaseInstanceIdReceiver" />'
      ),
      /FirebaseInstanceIdReceiver/
    ],
    [
      "Firebase messaging service",
      addApplicationChild(
        '<service android:name="com.google.firebase.messaging.FirebaseMessagingService" />'
      ),
      /FirebaseMessagingService/
    ],
    [
      "Firebase component discovery",
      addApplicationChild(
        '<service android:name="com.google.firebase.components.ComponentDiscoveryService" />'
      ),
      /ComponentDiscoveryService/
    ],
    [
      "Firebase init provider",
      addApplicationChild(
        '<provider android:name="com.google.firebase.provider.FirebaseInitProvider" />'
      ),
      /FirebaseInitProvider/
    ],
    [
      "Firebase messaging registrar",
      addApplicationChild(
        '<meta-data android:name="com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingRegistrar" />'
      ),
      /FirebaseMessagingRegistrar/
    ],
    [
      "Firebase messaging KTX registrar",
      addApplicationChild(
        '<meta-data android:name="com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingKtxRegistrar" />'
      ),
      /FirebaseMessagingKtxRegistrar/
    ],
    [
      "Firebase installations registrar",
      addApplicationChild(
        '<meta-data android:name="com.google.firebase.components:com.google.firebase.installations.FirebaseInstallationsRegistrar" />'
      ),
      /FirebaseInstallationsRegistrar/
    ],
    [
      "Firebase installations KTX registrar",
      addApplicationChild(
        '<meta-data android:name="com.google.firebase.components:com.google.firebase.installations.FirebaseInstallationsKtxRegistrar" />'
      ),
      /FirebaseInstallationsKtxRegistrar/
    ],
    [
      "Firebase data transport registrar",
      addApplicationChild(
        '<meta-data android:name="com.google.firebase.components:com.google.firebase.datatransport.TransportRegistrar" />'
      ),
      /TransportRegistrar/
    ]
  ];

  for (const [name, manifest, expectedProblem] of cases) {
    await t.test(name, () => {
      const report = manifestVerifier.validateReleaseManifest(manifest);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), expectedProblem);
    });
  }
});

test("detects every ShortcutBadger launcher permission independently", async (t) => {
  const badgePermissions = [
    "com.sec.android.provider.badge.permission.READ",
    "com.sec.android.provider.badge.permission.WRITE",
    "com.htc.launcher.permission.READ_SETTINGS",
    "com.htc.launcher.permission.UPDATE_SHORTCUT",
    "com.sonyericsson.home.permission.BROADCAST_BADGE",
    "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
    "com.anddoes.launcher.permission.UPDATE_COUNT",
    "com.majeur.launcher.permission.UPDATE_BADGE",
    "com.huawei.android.launcher.permission.CHANGE_BADGE",
    "com.huawei.android.launcher.permission.READ_SETTINGS",
    "com.huawei.android.launcher.permission.WRITE_SETTINGS",
    "android.permission.READ_APP_BADGE",
    "com.oppo.launcher.permission.READ_SETTINGS",
    "com.oppo.launcher.permission.WRITE_SETTINGS",
    "me.everything.badger.permission.BADGE_COUNT_READ",
    "me.everything.badger.permission.BADGE_COUNT_WRITE"
  ];

  for (const permission of badgePermissions) {
    await t.test(permission, () => {
      const report = manifestVerifier.validateReleaseManifest(
        addManifestChild(
          `<uses-permission android:name="${permission}" />`
        )
      );
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), /launcher badge permission/);
    });
  }
});

test("requires every local notification permission and component", async (t) => {
  const cases = [
    [
      "post notifications permission",
      /  <uses-permission android:name="android\.permission\.POST_NOTIFICATIONS" \/>\r?\n/,
      /POST_NOTIFICATIONS/
    ],
    [
      "vibrate permission",
      /  <uses-permission android:name="android\.permission\.VIBRATE" \/>\r?\n/,
      /VIBRATE/
    ],
    [
      "boot permission",
      /  <uses-permission android:name="android\.permission\.RECEIVE_BOOT_COMPLETED" \/>\r?\n/,
      /RECEIVE_BOOT_COMPLETED/
    ],
    [
      "local notification receiver",
      /    <receiver[\s\S]*?<\/receiver>\r?\n/,
      /NotificationsService/
    ],
    [
      "notification forwarder activity",
      /    <activity[\s\S]*?\/>\r?\n/,
      /NotificationForwarderActivity/
    ]
  ];

  for (const [name, removal, expectedProblem] of cases) {
    await t.test(name, () => {
      const mutated = hardenedManifest.replace(removal, "");
      assert.notEqual(mutated, hardenedManifest);
      const report = manifestVerifier.validateReleaseManifest(mutated);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), expectedProblem);
    });
  }
});

test("requires local scheduling, reboot, and package-replacement receiver actions", async (t) => {
  const actions = [
    "expo.modules.notifications.NOTIFICATION_EVENT",
    "android.intent.action.BOOT_COMPLETED",
    "android.intent.action.MY_PACKAGE_REPLACED"
  ];

  for (const action of actions) {
    await t.test(action, () => {
      const mutated = hardenedManifest.replace(
        new RegExp(
          `\\s*<action android:name="${action.replaceAll(".", "\\.")}" \\/>`
        ),
        ""
      );
      assert.notEqual(mutated, hardenedManifest);
      const report = manifestVerifier.validateReleaseManifest(mutated);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), new RegExp(action.split(".").at(-1)));
    });
  }
});

test("requires each Firebase and analytics disable metadata value to be false", async (t) => {
  const flags = [
    "firebase_messaging_auto_init_enabled",
    "firebase_analytics_collection_enabled",
    "google_analytics_adid_collection_enabled"
  ];

  for (const flag of flags) {
    await t.test(`${flag} absent`, () => {
      const mutated = hardenedManifest.replace(
        new RegExp(
          `\\s*<meta-data\\s+android:name="${flag}"\\s+android:value="false"\\s*\\/>`
        ),
        ""
      );
      assert.notEqual(mutated, hardenedManifest);
      const report = manifestVerifier.validateReleaseManifest(mutated);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), new RegExp(flag));
    });

    await t.test(`${flag} true`, () => {
      const mutated = hardenedManifest.replace(
        `android:name="${flag}"\n      android:value="false"`,
        `android:name="${flag}"\n      android:value="true"`
      );
      assert.notEqual(mutated, hardenedManifest);
      const report = manifestVerifier.validateReleaseManifest(mutated);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), new RegExp(flag));
    });
  }
});

test("CLI accepts only a hardened manifest file", () => {
  const script = resolve(
    import.meta.dirname,
    "verify-android-release-manifest.mjs"
  );
  const hardened = spawnSync(
    process.execPath,
    [script, resolve(fixtureRoot, "hardened-local.xml")],
    { encoding: "utf8" }
  );
  const remote = spawnSync(
    process.execPath,
    [script, resolve(fixtureRoot, "current-remote.xml")],
    { encoding: "utf8" }
  );

  assert.equal(hardened.status, 0, hardened.stderr);
  assert.match(hardened.stdout, /"status": "pass"/);
  assert.notEqual(remote.status, 0);
  assert.match(remote.stdout, /"status": "fail"/);
});

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

test("rejects the current manifest fixture with remote-push and badge surfaces", async () => {
  const report = await manifestVerifier.validateReleaseManifest(
    currentRemoteManifest
  );

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

test("accepts the hardened local-notification-only manifest fixture", async () => {
  assert.deepEqual(
    await manifestVerifier.validateReleaseManifest(hardenedManifest),
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
    await t.test(name, async () => {
      const report = await manifestVerifier.validateReleaseManifest(manifest);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), expectedProblem);
    });
  }
});

test("detects every ShortcutBadger launcher permission independently", async (t) => {
  for (const permission of badgePermissions) {
    await t.test(permission, async () => {
      const report = await manifestVerifier.validateReleaseManifest(
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
    await t.test(name, async () => {
      const mutated = hardenedManifest.replace(removal, "");
      assert.notEqual(mutated, hardenedManifest);
      const report = await manifestVerifier.validateReleaseManifest(mutated);
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
    await t.test(action, async () => {
      const mutated = hardenedManifest.replace(
        new RegExp(
          `\\s*<action android:name="${action.replaceAll(".", "\\.")}" \\/>`
        ),
        ""
      );
      assert.notEqual(mutated, hardenedManifest);
      const report = await manifestVerifier.validateReleaseManifest(mutated);
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
    await t.test(`${flag} absent`, async () => {
      const mutated = hardenedManifest.replace(
        new RegExp(
          `\\s*<meta-data\\s+android:name="${flag}"\\s+android:value="false"\\s*\\/>`
        ),
        ""
      );
      assert.notEqual(mutated, hardenedManifest);
      const report = await manifestVerifier.validateReleaseManifest(mutated);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), new RegExp(flag));
    });

    await t.test(`${flag} true`, async () => {
      const mutated = hardenedManifest.replace(
        `android:name="${flag}"\n      android:value="false"`,
        `android:name="${flag}"\n      android:value="true"`
      );
      assert.notEqual(mutated, hardenedManifest);
      const report = await manifestVerifier.validateReleaseManifest(mutated);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), new RegExp(flag));
    });
  }
});

test("decodes XML character references before checking forbidden permissions", async () => {
  const report = await manifestVerifier.validateReleaseManifest(
    addManifestChild(
      '<uses-permission android:name="com.google.android.c2dm.permission.RECEIV&#69;" />'
    )
  );

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /C2DM/);
});

test("honors an Android namespace alias on forbidden components", async () => {
  const aliased = addApplicationChild(
    '<service a:name="com.google.firebase.messaging.FirebaseMessagingService" />'
  ).replace(
    'xmlns:android="http://schemas.android.com/apk/res/android"',
    'xmlns:android="http://schemas.android.com/apk/res/android" xmlns:a="http://schemas.android.com/apk/res/android"'
  );
  const report = await manifestVerifier.validateReleaseManifest(aliased);

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /FirebaseMessagingService/);
});

test("requires receiver actions at receiver > intent-filter > action hierarchy", async () => {
  const mutated = hardenedManifest.replace(
    '        <action android:name="android.intent.action.BOOT_COMPLETED" />',
    '        <meta-data android:name="android.intent.action.BOOT_COMPLETED" />'
  );
  assert.notEqual(mutated, hardenedManifest);

  const report = await manifestVerifier.validateReleaseManifest(mutated);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /BOOT_COMPLETED/);
});

test("fails closed on malformed XML", async () => {
  const malformed = hardenedManifest.replace("</manifest>", "");
  assert.notEqual(malformed, hardenedManifest);

  const report = await manifestVerifier.validateReleaseManifest(malformed);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /XML|parse|malformed/i);
});

test("honors an Android namespace alias throughout a valid manifest", async () => {
  const aliased = hardenedManifest
    .replace("xmlns:android=", "xmlns:a=")
    .replaceAll("android:", "a:");

  assert.deepEqual(
    await manifestVerifier.validateReleaseManifest(aliased),
    {
      gate: "android-release-manifest",
      status: "pass",
      problems: []
    }
  );
});

test("rejects duplicate disable metadata expressed through a namespace alias", async () => {
  const duplicate = addApplicationChild(
    '<meta-data a:name="firebase_messaging_auto_init_enabled" a:value="false" />'
  ).replace(
    'xmlns:android="http://schemas.android.com/apk/res/android"',
    'xmlns:android="http://schemas.android.com/apk/res/android" xmlns:a="http://schemas.android.com/apk/res/android"'
  );
  const report = await manifestVerifier.validateReleaseManifest(duplicate);

  assert.equal(report.status, "fail");
  assert.match(
    report.problems.join("\n"),
    /firebase_messaging_auto_init_enabled/
  );
});

test("distinguishes forbidden component names from unrelated element kinds", async () => {
  const decoy = addApplicationChild(
    '<meta-data android:name="com.google.firebase.messaging.FirebaseMessagingService" />'
  );

  assert.deepEqual(
    await manifestVerifier.validateReleaseManifest(decoy),
    {
      gate: "android-release-manifest",
      status: "pass",
      problems: []
    }
  );
});

test("detects a C2DM permission through an element-scoped Android namespace alias", async () => {
  const scopedAlias = addManifestChild(
    '<uses-permission xmlns:a="http://schemas.android.com/apk/res/android" a:name="com.google.android.c2dm.permission.RECEIVE" />'
  );

  const report = await manifestVerifier.validateReleaseManifest(scopedAlias);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /C2DM/);
});

test("detects an FCM service through a service-scoped Android namespace alias", async () => {
  const scopedAlias = addApplicationChild(
    '<service xmlns:a="http://schemas.android.com/apk/res/android" a:name="com.google.firebase.messaging.FirebaseMessagingService" />'
  );

  const report = await manifestVerifier.validateReleaseManifest(scopedAlias);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /FirebaseMessagingService/);
});

test("detects an FCM service through an application-scoped Android namespace alias", async () => {
  const scopedAlias = addApplicationChild(
    '<service a:name="com.google.firebase.messaging.FirebaseMessagingService" />'
  ).replace(
    "<application>",
    '<application xmlns:a="http://schemas.android.com/apk/res/android">'
  );

  const report = await manifestVerifier.validateReleaseManifest(scopedAlias);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /FirebaseMessagingService/);
});

test("rejects duplicate disable metadata through an application-scoped alias", async () => {
  const duplicate = addApplicationChild(
    '<meta-data a:name="firebase_messaging_auto_init_enabled" a:value="false" />'
  ).replace(
    "<application>",
    '<application xmlns:a="http://schemas.android.com/apk/res/android">'
  );

  const report = await manifestVerifier.validateReleaseManifest(duplicate);
  assert.equal(report.status, "fail");
  assert.match(
    report.problems.join("\n"),
    /firebase_messaging_auto_init_enabled/
  );
});

test("rejects a descendant rebind that removes the receiver Android name", async () => {
  const rebound = hardenedManifest.replace(
    '    <receiver\n      android:name="expo.modules.notifications.service.NotificationsService"',
    '    <receiver\n      xmlns:android="urn:not-android"\n      android:name="expo.modules.notifications.service.NotificationsService"'
  );
  assert.notEqual(rebound, hardenedManifest);

  const report = await manifestVerifier.validateReleaseManifest(rebound);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /namespace|NotificationsService/i);
});

test("honors an action-scoped Android namespace alias", async () => {
  const scopedAlias = hardenedManifest.replace(
    '<action android:name="android.intent.action.BOOT_COMPLETED" />',
    '<action xmlns:a="http://schemas.android.com/apk/res/android" a:name="android.intent.action.BOOT_COMPLETED" />'
  );
  assert.notEqual(scopedAlias, hardenedManifest);

  assert.deepEqual(
    await manifestVerifier.validateReleaseManifest(scopedAlias),
    {
      gate: "android-release-manifest",
      status: "pass",
      problems: []
    }
  );
});

test("fails closed on duplicate lexical Android attributes", async () => {
  const duplicate = hardenedManifest.replace(
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" android:name="com.google.android.c2dm.permission.RECEIVE" />'
  );
  assert.notEqual(duplicate, hardenedManifest);

  const report = await manifestVerifier.validateReleaseManifest(duplicate);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /duplicate|XML|parse/i);
});

test("fails closed on duplicate expanded Android attributes through an encoded URI alias", async () => {
  const duplicate = hardenedManifest.replace(
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission xmlns:a="http://schemas.android.com/apk/res/and&#114;oid" android:name="android.permission.POST_NOTIFICATIONS" a:name="com.google.android.c2dm.permission.RECEIVE" />'
  );
  assert.notEqual(duplicate, hardenedManifest);

  const report = await manifestVerifier.validateReleaseManifest(duplicate);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /duplicate|XML|parse/i);
});

test("detects every forbidden permission in uses-permission-sdk-23", async (t) => {
  const forbiddenPermissions = [
    "com.google.android.c2dm.permission.RECEIVE",
    ...badgePermissions
  ];

  for (const permission of forbiddenPermissions) {
    await t.test(permission, async () => {
      const manifest = addManifestChild(
        `<uses-permission-sdk-23 android:name="${permission}" />`
      );
      const report = await manifestVerifier.validateReleaseManifest(manifest);

      assert.equal(report.status, "fail");
      assert.match(
        report.problems.join("\n"),
        permission.includes("c2dm") ? /C2DM/ : /launcher badge permission/
      );
    });
  }
});

test("detects an sdk-23 C2DM permission through a scoped namespace alias", async () => {
  const scopedAlias = addManifestChild(
    '<uses-permission-sdk-23 xmlns:a="http://schemas.android.com/apk/res/android" a:name="com.google.android.c2dm.permission.RECEIVE" />'
  );

  const report = await manifestVerifier.validateReleaseManifest(scopedAlias);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /C2DM/);
});

test("accepts a required permission in the official sdk-23 element", async () => {
  const sdk23Permission = hardenedManifest.replace(
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission-sdk-23 android:name="android.permission.VIBRATE" />'
  );
  assert.notEqual(sdk23Permission, hardenedManifest);

  assert.deepEqual(
    await manifestVerifier.validateReleaseManifest(sdk23Permission),
    {
      gate: "android-release-manifest",
      status: "pass",
      problems: []
    }
  );
});

test("rejects a nested permission declaration instead of treating it as a decoy", async () => {
  const nested = addApplicationChild(
    '<uses-permission-sdk-23 android:name="com.google.android.c2dm.permission.RECEIVE" />'
  );

  const report = await manifestVerifier.validateReleaseManifest(nested);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /permission|C2DM/i);
});

test("fails closed on unrecognized uses-permission variants", async (t) => {
  const cases = [
    addManifestChild(
      '<uses-permission-sdk-24 android:name="android.permission.VIBRATE" />'
    ),
    addApplicationChild(
      '<uses-permission-future android:name="com.google.android.c2dm.permission.RECEIVE" />'
    ),
    addManifestChild(
      '<fake:uses-permission-sdk-23 xmlns:fake="urn:not-android" android:name="com.google.android.c2dm.permission.RECEIVE" />'
    )
  ];

  for (const manifest of cases) {
    await t.test("unrecognized permission element", async () => {
      const report = await manifestVerifier.validateReleaseManifest(manifest);
      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), /permission-declaring|unrecognized/i);
    });
  }
});

test("rejects benign, external, and internal DOCTYPE declarations", async (t) => {
  const declarations = [
    "<!DOCTYPE manifest>",
    '<!DOCTYPE manifest SYSTEM "file:///definitely-not-present.dtd">',
    '<!DOCTYPE manifest [<!ENTITY local "harmless">]>'
  ];

  for (const declaration of declarations) {
    await t.test(declaration, async () => {
      const manifest = hardenedManifest.replace(
        "<manifest ",
        `${declaration}\n<manifest `
      );
      const report = await manifestVerifier.validateReleaseManifest(manifest);

      assert.equal(report.status, "fail");
      assert.match(report.problems.join("\n"), /DOCTYPE|DTD|entity/i);
    });
  }
});

test("continues to accept a standard XML declaration", async () => {
  const declared = hardenedManifest.replace(
    '<?xml version="1.0" encoding="utf-8"?>',
    '<?xml version="1.0" encoding="utf-8" standalone="yes"?>'
  );
  assert.notEqual(declared, hardenedManifest);

  assert.deepEqual(
    await manifestVerifier.validateReleaseManifest(declared),
    {
      gate: "android-release-manifest",
      status: "pass",
      problems: []
    }
  );
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

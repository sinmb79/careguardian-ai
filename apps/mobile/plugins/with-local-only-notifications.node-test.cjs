const assert = require("node:assert/strict");
const test = require("node:test");

const withLocalOnlyNotifications = require("./with-local-only-notifications");

test("exports a pure manifest hardening function for deterministic verification", () => {
  assert.equal(
    typeof withLocalOnlyNotifications.applyLocalOnlyNotificationManifest,
    "function"
  );
});

test("adds each remote-push and badge removal exactly once while preserving local entries", () => {
  const manifest = {
    $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
    "uses-permission": [
      { $: { "android:name": "android.permission.POST_NOTIFICATIONS" } }
    ],
    application: [
      {
        receiver: [
          {
            $: {
              "android:name":
                "expo.modules.notifications.service.NotificationsService"
            }
          }
        ],
        activity: [
          {
            $: {
              "android:name":
                "expo.modules.notifications.service.NotificationForwarderActivity"
            }
          }
        ]
      }
    ]
  };

  const first =
    withLocalOnlyNotifications.applyLocalOnlyNotificationManifest(manifest);
  const hardened =
    withLocalOnlyNotifications.applyLocalOnlyNotificationManifest(first);
  const application = hardened.application[0];

  assert.equal(
    hardened.$["xmlns:tools"],
    "http://schemas.android.com/tools"
  );
  assert.deepEqual(
    hardened["uses-permission"]
      .filter((entry) => entry.$["tools:node"] === "remove")
      .map((entry) => entry.$["android:name"])
      .sort(),
    [
      "android.permission.READ_APP_BADGE",
      "com.anddoes.launcher.permission.UPDATE_COUNT",
      "com.google.android.c2dm.permission.RECEIVE",
      "com.htc.launcher.permission.READ_SETTINGS",
      "com.htc.launcher.permission.UPDATE_SHORTCUT",
      "com.huawei.android.launcher.permission.CHANGE_BADGE",
      "com.huawei.android.launcher.permission.READ_SETTINGS",
      "com.huawei.android.launcher.permission.WRITE_SETTINGS",
      "com.majeur.launcher.permission.UPDATE_BADGE",
      "com.oppo.launcher.permission.READ_SETTINGS",
      "com.oppo.launcher.permission.WRITE_SETTINGS",
      "com.sec.android.provider.badge.permission.READ",
      "com.sec.android.provider.badge.permission.WRITE",
      "com.sonyericsson.home.permission.BROADCAST_BADGE",
      "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
      "me.everything.badger.permission.BADGE_COUNT_READ",
      "me.everything.badger.permission.BADGE_COUNT_WRITE"
    ]
  );
  assert.deepEqual(
    [
      ...application.service,
      ...application.receiver,
      ...application.provider
    ]
      .filter((entry) => entry.$["tools:node"] === "remove")
      .map((entry) => entry.$["android:name"])
      .sort(),
    [
      "com.google.firebase.components.ComponentDiscoveryService",
      "com.google.firebase.iid.FirebaseInstanceIdReceiver",
      "com.google.firebase.messaging.FirebaseMessagingService",
      "com.google.firebase.provider.FirebaseInitProvider",
      "expo.modules.notifications.service.ExpoFirebaseMessagingService"
    ]
  );
  assert.deepEqual(
    application["meta-data"]
      .map((entry) => [entry.$["android:name"], entry.$["android:value"]])
      .sort(),
    [
      ["firebase_analytics_collection_enabled", "false"],
      ["firebase_messaging_auto_init_enabled", "false"],
      ["google_analytics_adid_collection_enabled", "false"]
    ]
  );
  assert.equal(
    application.receiver.filter(
      (entry) =>
        entry.$["android:name"] ===
        "expo.modules.notifications.service.NotificationsService"
    ).length,
    1
  );
  assert.equal(
    application.activity.filter(
      (entry) =>
        entry.$["android:name"] ===
        "expo.modules.notifications.service.NotificationForwarderActivity"
    ).length,
    1
  );
});

const { withAndroidManifest } = require("@expo/config-plugins");

const REMOVED_PERMISSIONS = [
  "com.google.android.c2dm.permission.RECEIVE",
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

const REMOVED_COMPONENTS = {
  service: [
    "expo.modules.notifications.service.ExpoFirebaseMessagingService",
    "com.google.firebase.messaging.FirebaseMessagingService",
    "com.google.firebase.components.ComponentDiscoveryService"
  ],
  receiver: ["com.google.firebase.iid.FirebaseInstanceIdReceiver"],
  provider: ["com.google.firebase.provider.FirebaseInitProvider"]
};

function setBooleanMetadata(application, name, value) {
  const entries = application["meta-data"] ?? [];
  const existing = entries.find((entry) => entry.$?.["android:name"] === name);
  const attributes = {
    "android:name": name,
    "android:value": value ? "true" : "false"
  };

  if (existing) {
    existing.$ = attributes;
  } else {
    entries.push({ $: attributes });
  }
  application["meta-data"] = entries;
}

function upsertRemoval(entries, name) {
  return [
    ...(entries ?? []).filter(
      (entry) => entry.$?.["android:name"] !== name
    ),
    {
      $: {
        "android:name": name,
        "tools:node": "remove"
      }
    }
  ];
}

function applyLocalOnlyNotificationManifest(manifest) {
  const application = manifest.application?.[0];
  if (!application) {
    throw new Error("Android application manifest entry is missing");
  }

  manifest.$ = {
    ...(manifest.$ ?? {}),
    "xmlns:tools": "http://schemas.android.com/tools"
  };
  for (const permission of REMOVED_PERMISSIONS) {
    manifest["uses-permission"] = upsertRemoval(
      manifest["uses-permission"],
      permission
    );
  }
  for (const [componentType, names] of Object.entries(REMOVED_COMPONENTS)) {
    for (const name of names) {
      application[componentType] = upsertRemoval(
        application[componentType],
        name
      );
    }
  }

  setBooleanMetadata(application, "firebase_messaging_auto_init_enabled", false);
  setBooleanMetadata(application, "firebase_analytics_collection_enabled", false);
  setBooleanMetadata(application, "google_analytics_adid_collection_enabled", false);
  return manifest;
}

module.exports = function withLocalOnlyNotifications(config) {
  return withAndroidManifest(config, (androidConfig) => {
    androidConfig.modResults.manifest = applyLocalOnlyNotificationManifest(
      androidConfig.modResults.manifest
    );
    return androidConfig;
  });
};

module.exports.applyLocalOnlyNotificationManifest = applyLocalOnlyNotificationManifest;

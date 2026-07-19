const { withAndroidManifest } = require("@expo/config-plugins");

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

module.exports = function withLocalOnlyNotifications(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error("Android application manifest entry is missing");
    }

    setBooleanMetadata(application, "firebase_messaging_auto_init_enabled", false);
    setBooleanMetadata(application, "firebase_analytics_collection_enabled", false);
    setBooleanMetadata(application, "google_analytics_adid_collection_enabled", false);
    return androidConfig;
  });
};

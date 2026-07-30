import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const C2DM_PERMISSION = "com.google.android.c2dm.permission.RECEIVE";
const BADGE_PERMISSIONS = [
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
const FORBIDDEN_COMPONENTS = [
  "expo.modules.notifications.service.ExpoFirebaseMessagingService",
  "com.google.firebase.iid.FirebaseInstanceIdReceiver",
  "com.google.firebase.messaging.FirebaseMessagingService",
  "com.google.firebase.components.ComponentDiscoveryService",
  "com.google.firebase.provider.FirebaseInitProvider"
];
const FORBIDDEN_REGISTRARS = [
  "FirebaseMessagingKtxRegistrar",
  "FirebaseMessagingRegistrar",
  "FirebaseInstallationsKtxRegistrar",
  "FirebaseInstallationsRegistrar",
  "TransportRegistrar"
];
const REQUIRED_PERMISSIONS = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.VIBRATE",
  "android.permission.RECEIVE_BOOT_COMPLETED"
];
const REQUIRED_LOCAL_RECEIVER =
  "expo.modules.notifications.service.NotificationsService";
const REQUIRED_LOCAL_ACTIVITY =
  "expo.modules.notifications.service.NotificationForwarderActivity";
const REQUIRED_LOCAL_ACTIONS = [
  "expo.modules.notifications.NOTIFICATION_EVENT",
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.MY_PACKAGE_REPLACED"
];
const REQUIRED_FALSE_METADATA = [
  "firebase_messaging_auto_init_enabled",
  "firebase_analytics_collection_enabled",
  "google_analytics_adid_collection_enabled"
];

function hasAndroidName(manifest, value) {
  return new RegExp(
    `android:name\\s*=\\s*["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`
  ).test(manifest);
}

function parseAttributes(tag) {
  const attributes = new Map();
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gu)) {
    attributes.set(match[1], match[3]);
  }
  return attributes;
}

function findTags(manifest, tagName) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...manifest.matchAll(new RegExp(`<${escapedTagName}\\b[^>]*>`, "gu"))]
    .map((match) => parseAttributes(match[0]));
}

function findComponentBlock(manifest, tagName, componentName) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<${escapedTagName}\\b[^>]*>[\\s\\S]*?<\\/${escapedTagName}>`,
    "gu"
  );
  return [...manifest.matchAll(pattern)]
    .map((match) => match[0])
    .find((block) => hasAndroidName(block.slice(0, block.indexOf(">") + 1), componentName));
}

export function validateReleaseManifest(manifest) {
  const problems = [];
  if (hasAndroidName(manifest, C2DM_PERMISSION)) {
    problems.push(`forbidden C2DM receive permission: ${C2DM_PERMISSION}`);
  }
  for (const permission of BADGE_PERMISSIONS) {
    if (hasAndroidName(manifest, permission)) {
      problems.push(`forbidden launcher badge permission: ${permission}`);
    }
  }
  for (const component of FORBIDDEN_COMPONENTS) {
    if (hasAndroidName(manifest, component)) {
      problems.push(`forbidden Android component: ${component}`);
    }
  }
  for (const registrar of FORBIDDEN_REGISTRARS) {
    if (manifest.includes(registrar)) {
      problems.push(`forbidden Firebase registrar: ${registrar}`);
    }
  }

  const permissions = new Set(
    findTags(manifest, "uses-permission").map((tag) => tag.get("android:name"))
  );
  for (const permission of REQUIRED_PERMISSIONS) {
    if (!permissions.has(permission)) {
      problems.push(`required local notification permission is missing: ${permission}`);
    }
  }

  const localReceiverBlock = findComponentBlock(
    manifest,
    "receiver",
    REQUIRED_LOCAL_RECEIVER
  );
  if (!localReceiverBlock) {
    problems.push(`required local notification receiver is missing: ${REQUIRED_LOCAL_RECEIVER}`);
  } else {
    for (const action of REQUIRED_LOCAL_ACTIONS) {
      if (!hasAndroidName(localReceiverBlock, action)) {
        problems.push(`required local notification receiver action is missing: ${action}`);
      }
    }
  }
  const hasLocalActivity = findTags(manifest, "activity").some(
    (tag) => tag.get("android:name") === REQUIRED_LOCAL_ACTIVITY
  );
  if (!hasLocalActivity) {
    problems.push(`required local notification activity is missing: ${REQUIRED_LOCAL_ACTIVITY}`);
  }

  const metadata = findTags(manifest, "meta-data");
  for (const name of REQUIRED_FALSE_METADATA) {
    const values = metadata
      .filter((tag) => tag.get("android:name") === name)
      .map((tag) => tag.get("android:value"));
    if (values.length !== 1 || values[0] !== "false") {
      problems.push(`required disable metadata must occur once with value false: ${name}`);
    }
  }

  return {
    gate: "android-release-manifest",
    status: problems.length === 0 ? "pass" : "fail",
    problems
  };
}

export function verifyReleaseManifestFile(manifestPath) {
  const absoluteManifestPath = resolve(manifestPath);
  const report = validateReleaseManifest(
    readFileSync(absoluteManifestPath, "utf8")
  );
  return {
    ...report,
    manifestPath: absoluteManifestPath
  };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    throw new Error("Provide the exact release merged AndroidManifest.xml path");
  }
  const report = verifyReleaseManifestFile(manifestPath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

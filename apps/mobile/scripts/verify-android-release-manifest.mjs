import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import configPlugins from "@expo/config-plugins";

const { XML } = configPlugins;
const ANDROID_NAMESPACE_URI = "http://schemas.android.com/apk/res/android";
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
const FORBIDDEN_COMPONENT_TAGS = [
  "service",
  "receiver",
  "service",
  "service",
  "provider"
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

function childElements(element, tagName) {
  const children = element?.[tagName];
  return Array.isArray(children) ? children : [];
}

function collectDescendants(element, tagName, matches = []) {
  if (!element || typeof element !== "object") return matches;
  for (const [childTagName, children] of Object.entries(element)) {
    if (childTagName === "$" || childTagName === "_") continue;
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      if (childTagName === tagName) matches.push(child);
      collectDescendants(child, tagName, matches);
    }
  }
  return matches;
}

function androidNamespacePrefixes(manifestRoot) {
  return Object.entries(manifestRoot?.$ ?? {})
    .filter(
      ([attributeName, value]) =>
        attributeName.startsWith("xmlns:") &&
        value === ANDROID_NAMESPACE_URI
    )
    .map(([attributeName]) => attributeName.slice("xmlns:".length));
}

function androidAttributeValues(element, localName, namespacePrefixes) {
  const attributes = element?.$ ?? {};
  return namespacePrefixes
    .map((prefix) => attributes[`${prefix}:${localName}`])
    .filter((value) => typeof value === "string");
}

function hasAndroidAttributeValue(
  element,
  localName,
  expectedValue,
  namespacePrefixes
) {
  return androidAttributeValues(element, localName, namespacePrefixes)
    .includes(expectedValue);
}

function parseFailureReport(error) {
  return {
    gate: "android-release-manifest",
    status: "fail",
    problems: [
      `AndroidManifest.xml XML parse failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    ]
  };
}

export async function validateReleaseManifest(manifest) {
  let parsed;
  try {
    parsed = await XML.parseXMLAsync(manifest);
  } catch (error) {
    return parseFailureReport(error);
  }

  const problems = [];
  const manifestRoot = parsed?.manifest;
  if (!manifestRoot || typeof manifestRoot !== "object") {
    return parseFailureReport(new Error("missing manifest root element"));
  }

  const namespacePrefixes = androidNamespacePrefixes(manifestRoot);
  if (namespacePrefixes.length === 0) {
    problems.push(
      `Android namespace binding is missing: ${ANDROID_NAMESPACE_URI}`
    );
  }

  const usesPermissions = childElements(manifestRoot, "uses-permission");
  const permissionNames = usesPermissions.flatMap((permission) =>
    androidAttributeValues(permission, "name", namespacePrefixes)
  );
  if (permissionNames.includes(C2DM_PERMISSION)) {
    problems.push(`forbidden C2DM receive permission: ${C2DM_PERMISSION}`);
  }
  for (const permission of BADGE_PERMISSIONS) {
    if (permissionNames.includes(permission)) {
      problems.push(`forbidden launcher badge permission: ${permission}`);
    }
  }

  const applications = childElements(manifestRoot, "application");
  if (applications.length !== 1) {
    problems.push("Android manifest must contain exactly one application element");
  }
  const applicationComponents = (tagName) =>
    applications.flatMap((application) => childElements(application, tagName));

  for (const [index, component] of FORBIDDEN_COMPONENTS.entries()) {
    const tagName = FORBIDDEN_COMPONENT_TAGS[index];
    const hasForbiddenComponent = applicationComponents(tagName).some(
      (element) =>
        hasAndroidAttributeValue(
          element,
          "name",
          component,
          namespacePrefixes
        )
    );
    if (hasForbiddenComponent) {
      problems.push(`forbidden Android component: ${component}`);
    }
  }

  const metadataDescendants = applications.flatMap((application) =>
    collectDescendants(application, "meta-data")
  );
  for (const registrar of FORBIDDEN_REGISTRARS) {
    const hasForbiddenRegistrar = metadataDescendants.some((metadata) =>
      androidAttributeValues(metadata, "name", namespacePrefixes).some(
        (name) => name.split(":").at(-1)?.split(".").at(-1) === registrar
      )
    );
    if (hasForbiddenRegistrar) {
      problems.push(`forbidden Firebase registrar: ${registrar}`);
    }
  }

  const permissions = new Set(permissionNames);
  for (const permission of REQUIRED_PERMISSIONS) {
    if (!permissions.has(permission)) {
      problems.push(`required local notification permission is missing: ${permission}`);
    }
  }

  const localReceivers = applicationComponents("receiver").filter((receiver) =>
    hasAndroidAttributeValue(
      receiver,
      "name",
      REQUIRED_LOCAL_RECEIVER,
      namespacePrefixes
    )
  );
  if (localReceivers.length !== 1) {
    problems.push(`required local notification receiver is missing: ${REQUIRED_LOCAL_RECEIVER}`);
  } else {
    const localReceiverActions = childElements(
      localReceivers[0],
      "intent-filter"
    ).flatMap((intentFilter) =>
      childElements(intentFilter, "action").flatMap((action) =>
        androidAttributeValues(action, "name", namespacePrefixes)
      )
    );
    for (const action of REQUIRED_LOCAL_ACTIONS) {
      if (!localReceiverActions.includes(action)) {
        problems.push(`required local notification receiver action is missing: ${action}`);
      }
    }
  }
  const localActivities = applicationComponents("activity").filter((activity) =>
    hasAndroidAttributeValue(
      activity,
      "name",
      REQUIRED_LOCAL_ACTIVITY,
      namespacePrefixes
    )
  );
  if (localActivities.length !== 1) {
    problems.push(`required local notification activity is missing: ${REQUIRED_LOCAL_ACTIVITY}`);
  }

  const metadata = applications.flatMap((application) =>
    childElements(application, "meta-data")
  );
  for (const name of REQUIRED_FALSE_METADATA) {
    const matchingMetadata = metadata.filter((element) =>
      hasAndroidAttributeValue(
        element,
        "name",
        name,
        namespacePrefixes
      )
    );
    const values = matchingMetadata.flatMap((element) =>
      androidAttributeValues(element, "value", namespacePrefixes)
    );
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

export async function verifyReleaseManifestFile(manifestPath) {
  const absoluteManifestPath = resolve(manifestPath);
  const report = await validateReleaseManifest(
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
  const report = await verifyReleaseManifestFile(manifestPath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

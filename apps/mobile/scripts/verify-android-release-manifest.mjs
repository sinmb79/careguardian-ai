import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import xml2js from "xml2js";

const { Parser } = xml2js;
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
const RECOGNIZED_PERMISSION_ELEMENTS = new Set([
  "uses-permission",
  "uses-permission-sdk-23"
]);

function childElements(element, tagName) {
  const children = element?.[tagName];
  if (!Array.isArray(children)) return [];
  return children.filter(
    (child) =>
      child?.$ns?.local === tagName &&
      child.$ns.uri === ""
  );
}

function collectDescendants(element, tagName, matches = []) {
  if (!element || typeof element !== "object") return matches;
  for (const [childTagName, children] of Object.entries(element)) {
    if (
      childTagName === "$" ||
      childTagName === "$ns" ||
      childTagName === "_"
    ) {
      continue;
    }
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      if (
        childTagName === tagName &&
        child?.$ns?.local === tagName &&
        child.$ns.uri === ""
      ) {
        matches.push(child);
      }
      collectDescendants(child, tagName, matches);
    }
  }
  return matches;
}

function collectAllDescendantElements(element, matches = []) {
  if (!element || typeof element !== "object") return matches;
  for (const [childTagName, children] of Object.entries(element)) {
    if (
      childTagName === "$" ||
      childTagName === "$ns" ||
      childTagName === "_"
    ) {
      continue;
    }
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      matches.push(child);
      collectAllDescendantElements(child, matches);
    }
  }
  return matches;
}

function createNamespaceAwareParser() {
  const parser = new Parser({
    explicitArray: true,
    explicitRoot: true,
    strict: true,
    xmlns: true
  });
  let expandedAttributeNames = new Set();
  let inheritedNamespaces = {};

  parser.saxParser.onopentagstart = (element) => {
    expandedAttributeNames = new Set();
    inheritedNamespaces = { ...element.ns };
  };
  parser.saxParser.onattribute = (attribute) => {
    const expandedName = `${attribute.uri}\u0000${attribute.local}`;
    if (expandedAttributeNames.has(expandedName)) {
      throw new Error(
        `duplicate expanded XML attribute: {${attribute.uri}}${attribute.local}`
      );
    }
    expandedAttributeNames.add(expandedName);

    if (
      attribute.prefix === "xmlns" &&
      Object.hasOwn(inheritedNamespaces, attribute.local) &&
      inheritedNamespaces[attribute.local] !== attribute.value
    ) {
      throw new Error(
        `descendant XML namespace prefix rebind is forbidden: ${attribute.local}`
      );
    }
  };
  const rejectDocumentTypeDeclaration = () => {
    throw new Error(
      "DOCTYPE, DTD, and entity declarations are forbidden"
    );
  };
  parser.saxParser.ondoctype = rejectDocumentTypeDeclaration;
  parser.saxParser.onsgmldeclaration = rejectDocumentTypeDeclaration;

  return parser;
}

function androidAttributeValues(element, localName) {
  const attributes = element?.$ ?? {};
  return Object.values(attributes)
    .filter(
      (attribute) =>
        attribute?.uri === ANDROID_NAMESPACE_URI &&
        attribute.local === localName
    )
    .map((attribute) => attribute.value);
}

function hasAndroidAttributeValue(
  element,
  localName,
  expectedValue
) {
  return androidAttributeValues(element, localName).includes(expectedValue);
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
    parsed = await createNamespaceAwareParser().parseStringPromise(manifest);
  } catch (error) {
    return parseFailureReport(error);
  }

  const problems = [];
  const manifestRoot = parsed?.manifest;
  if (
    !manifestRoot ||
    typeof manifestRoot !== "object" ||
    manifestRoot?.$ns?.local !== "manifest" ||
    manifestRoot.$ns.uri !== ""
  ) {
    return parseFailureReport(new Error("missing manifest root element"));
  }

  const rootPermissionElements = [
    ...childElements(manifestRoot, "uses-permission"),
    ...childElements(manifestRoot, "uses-permission-sdk-23")
  ];
  const rootPermissionElementSet = new Set(rootPermissionElements);
  const allPermissionLikeElements = collectAllDescendantElements(
    manifestRoot
  ).filter((element) =>
    element?.$ns?.local === "uses-permission" ||
    element?.$ns?.local?.startsWith("uses-permission-")
  );
  const recognizedPermissionElements = [];
  for (const element of allPermissionLikeElements) {
    const localName = element.$ns.local;
    if (
      element.$ns.uri !== "" ||
      !RECOGNIZED_PERMISSION_ELEMENTS.has(localName)
    ) {
      problems.push(
        `unrecognized permission-declaring element: {${element.$ns.uri}}${localName}`
      );
      continue;
    }
    recognizedPermissionElements.push(element);
    if (!rootPermissionElementSet.has(element)) {
      problems.push(
        `permission-declaring element must be a direct manifest child: ${localName}`
      );
    }
  }

  const permissionNames = recognizedPermissionElements.flatMap((permission) =>
    androidAttributeValues(permission, "name")
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
          component
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
      androidAttributeValues(metadata, "name").some(
        (name) => name.split(":").at(-1)?.split(".").at(-1) === registrar
      )
    );
    if (hasForbiddenRegistrar) {
      problems.push(`forbidden Firebase registrar: ${registrar}`);
    }
  }

  const permissions = new Set(
    rootPermissionElements.flatMap((permission) =>
      androidAttributeValues(permission, "name")
    )
  );
  for (const permission of REQUIRED_PERMISSIONS) {
    if (!permissions.has(permission)) {
      problems.push(`required local notification permission is missing: ${permission}`);
    }
  }

  const localReceivers = applicationComponents("receiver").filter((receiver) =>
    hasAndroidAttributeValue(
      receiver,
      "name",
      REQUIRED_LOCAL_RECEIVER
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
        androidAttributeValues(action, "name")
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
      REQUIRED_LOCAL_ACTIVITY
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
        name
      )
    );
    const values = matchingMetadata.flatMap((element) =>
      androidAttributeValues(element, "value")
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

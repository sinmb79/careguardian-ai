import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeNoRemotePush } from "./verify-no-remote-push.mjs";
import { verifyReleaseManifestFile } from "./verify-android-release-manifest.mjs";

const expoCli = fileURLToPath(import.meta.resolve("expo/bin/cli"));
const expoAutolinkingCli = fileURLToPath(
  import.meta.resolve(
    "expo-modules-autolinking/bin/expo-modules-autolinking.js"
  )
);
const mobileRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repositoryRoot = path.resolve(mobileRoot, "..", "..");
const packageLock = path.join(repositoryRoot, "package-lock.json");
const androidRoot = path.join(mobileRoot, "android");
const appBuildGradle = path.join(androidRoot, "app", "build.gradle");
const releaseMergedManifest = path.join(
  androidRoot,
  "app",
  "build",
  "intermediates",
  "merged_manifests",
  "release",
  "processReleaseManifest",
  "AndroidManifest.xml"
);
const gradleWrapper = path.join(
  androidRoot,
  process.platform === "win32" ? "gradlew.bat" : "gradlew"
);
const requestedContract = process.argv[2] ?? "all";
const supportedContracts = new Set([
  "all",
  "dependencies",
  "entry",
  "kotlin",
  "manifest",
  "metro"
]);

if (!supportedContracts.has(requestedContract)) {
  throw new Error(
    `Unsupported native contract "${requestedContract}". Use all, dependencies, entry, kotlin, manifest, or metro.`
  );
}

function requireSuccessfulProcess(result, label) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}`
    );
  }
}

function runGradleContract(task, environment) {
  const result = spawnSync(
    gradleWrapper,
    [
      task,
      "-PreactNativeArchitectures=x86_64",
      "--console=plain",
      "--no-daemon",
      "--rerun-tasks"
    ],
    {
      cwd: androidRoot,
      env: environment,
      shell: process.platform === "win32",
      stdio: "inherit"
    }
  );
  requireSuccessfulProcess(result, task);
}

function captureGradleContract(argumentsList, environment, label) {
  const result = spawnSync(
    gradleWrapper,
    [
      ...argumentsList,
      "-PreactNativeArchitectures=x86_64",
      "--console=plain",
      "--no-daemon"
    ],
    {
      cwd: androidRoot,
      env: environment,
      shell: process.platform === "win32",
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    process.stderr.write(result.stdout ?? "");
  }
  requireSuccessfulProcess(result, label);
  return result.stdout;
}

function verifyExpoAutolinking() {
  const result = spawnSync(
    process.execPath,
    [
      expoAutolinkingCli,
      "resolve",
      "--platform",
      "android",
      "--json"
    ],
    {
      cwd: mobileRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
  }
  requireSuccessfulProcess(result, "Expo Android module autolinking");

  let resolution;
  try {
    resolution = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error("Expo Android module autolinking returned invalid JSON", {
      cause: error
    });
  }
  const modules = Array.isArray(resolution.modules)
    ? resolution.modules
    : [];
  const localModules = modules.filter(
    (candidate) => candidate.packageName === "life-local-notifications"
  );
  const localModuleClasses = localModules.flatMap((candidate) =>
    (candidate.projects ?? []).flatMap((project) => project.modules ?? [])
  );
  if (
    localModules.length !== 1 ||
    localModuleClasses.length !== 1 ||
    localModuleClasses[0] !==
      "expo.modules.lifelocalnotifications.LifeLocalNotificationsModule"
  ) {
    throw new Error(
      "Expo autolinking must resolve exactly one LifeLocalNotificationsModule"
    );
  }
  const legacyExpoNotifications = modules.filter(
    (candidate) =>
      candidate.packageName === "expo-notifications" ||
      (candidate.projects ?? []).some((project) =>
        (project.modules ?? []).some((moduleName) =>
          moduleName.startsWith("expo.modules.notifications.")
        )
      )
  );
  if (legacyExpoNotifications.length !== 0) {
    throw new Error(
      "Expo autolinking resolved forbidden expo-notifications code"
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      gate: "expo-autolinking",
      status: "pass",
      lifeLocalNotifications: localModules.length,
      expoNotifications: legacyExpoNotifications.length
    }, null, 2)}\n`
  );
}

function verifyResolvedRuntimeDependencies() {
  const runtimeClasspath = captureGradleContract(
    [
      ":app:dependencies",
      "--configuration",
      "releaseRuntimeClasspath"
    ],
    { ...process.env, NODE_ENV: "production" },
    "Android releaseRuntimeClasspath resolution"
  );
  const report = analyzeNoRemotePush({
    dependencyReport: [
      readFileSync(packageLock, "utf8"),
      runtimeClasspath
    ].join("\n")
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "pass") {
    throw new Error(
      `Android resolved dependency verification failed:\n` +
      report.problems.join("\n")
    );
  }
}

function verifyAndroidEntry() {
  const entryResult = spawnSync(
    process.execPath,
    [
      "-e",
      "require('expo/scripts/resolveAppEntry')",
      mobileRoot,
      "android",
      "absolute"
    ],
    { cwd: mobileRoot, encoding: "utf8" }
  );
  if (entryResult.status !== 0) {
    process.stderr.write(entryResult.stderr ?? "");
  }
  requireSuccessfulProcess(entryResult, "Expo Android entry resolution");

  const resolvedEntry = path.resolve(entryResult.stdout.trim());
  const expectedEntry = path.join(mobileRoot, "index.ts");
  if (resolvedEntry !== expectedEntry) {
    throw new Error(
      `Expo resolved an unexpected Android entry: ${resolvedEntry}; expected ${expectedEntry}`
    );
  }
  return resolvedEntry;
}

async function runNativeContracts() {
  if (requestedContract === "entry") {
    process.stdout.write(`${verifyAndroidEntry()}\n`);
    return;
  }

  const prebuildResult = spawnSync(
    process.execPath,
    [
      expoCli,
      "prebuild",
      "--clean",
      "--platform",
      "android",
      "--no-install"
    ],
    {
      cwd: mobileRoot,
      env: { ...process.env, CI: "1" },
      stdio: "inherit"
    }
  );
  requireSuccessfulProcess(prebuildResult, "Expo clean Android prebuild");

  verifyExpoAutolinking();

  const generatedGradle = readFileSync(appBuildGradle, "utf8");
  const requiredGeneratedLines = [
    "life-steward-mobile-react-root",
    "root = file(projectRoot)",
    'entryFile = file(new File(projectRoot, "index.ts"))',
    'bundleConfig = file(new File(projectRoot, "metro.config.js"))',
    "process.env.EXPO_NO_METRO_WORKSPACE_ROOT='1';require(process.argv[1])"
  ];
  for (const requiredLine of requiredGeneratedLines) {
    if (!generatedGradle.includes(requiredLine)) {
      throw new Error(
        `Generated Android release configuration is missing: ${requiredLine}`
      );
    }
  }

  verifyAndroidEntry();

  if (
    requestedContract === "all" ||
    requestedContract === "dependencies"
  ) {
    verifyResolvedRuntimeDependencies();
  }

  if (requestedContract === "all" || requestedContract === "manifest") {
    runGradleContract(":app:processReleaseManifest", {
      ...process.env,
      NODE_ENV: "production"
    });
    const manifestReport = await verifyReleaseManifestFile(
      releaseMergedManifest
    );
    process.stdout.write(`${JSON.stringify(manifestReport, null, 2)}\n`);
    if (manifestReport.status !== "pass") {
      throw new Error(
        `Android release merged-manifest verification failed:\n` +
        manifestReport.problems.join("\n")
      );
    }
  }

  if (requestedContract === "all" || requestedContract === "kotlin") {
    runGradleContract(":model-integrity:compileDebugKotlin", {
      ...process.env
    });
    runGradleContract(":life-local-notifications:compileDebugKotlin", {
      ...process.env
    });
  }

  if (requestedContract === "all" || requestedContract === "metro") {
    const metroEnvironment = { ...process.env, NODE_ENV: "production" };
    delete metroEnvironment.EXPO_NO_METRO_WORKSPACE_ROOT;
    runGradleContract(
      ":app:createBundleReleaseJsAndAssets",
      metroEnvironment
    );
  }
}

const backupContainer = mkdtempSync(
  path.join(mobileRoot, ".native-contract-backup-")
);
const backupAndroidRoot = path.join(backupContainer, "android");
let originalAndroidMoved = false;

try {
  if (existsSync(androidRoot)) {
    renameSync(androidRoot, backupAndroidRoot);
    originalAndroidMoved = true;
  }

  try {
    await runNativeContracts();
  } finally {
    try {
      if (existsSync(androidRoot)) {
        rmSync(androidRoot, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200
        });
      }
      if (originalAndroidMoved) {
        renameSync(backupAndroidRoot, androidRoot);
        originalAndroidMoved = false;
      }
    } catch (error) {
      const recoveryLocation = originalAndroidMoved
        ? ` The original Android tree is preserved at ${backupAndroidRoot}.`
        : "";
      throw new Error(
        `Failed to restore the pre-verification Android tree.${recoveryLocation}`,
        { cause: error }
      );
    }
  }
} finally {
  if (!originalAndroidMoved) {
    rmSync(backupContainer, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    });
  }
}

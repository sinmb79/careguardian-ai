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

const expoCli = fileURLToPath(import.meta.resolve("expo/bin/cli"));
const expoResolveAppEntryCli = fileURLToPath(
  import.meta.resolve("expo/scripts/resolveAppEntry.js")
);
const mobileRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const androidRoot = path.join(mobileRoot, "android");
const appBuildGradle = path.join(androidRoot, "app", "build.gradle");
const gradleWrapper = path.join(
  androidRoot,
  process.platform === "win32" ? "gradlew.bat" : "gradlew"
);
const requestedContract = process.argv[2] ?? "all";
const supportedContracts = new Set(["all", "kotlin", "metro"]);

if (!supportedContracts.has(requestedContract)) {
  throw new Error(
    `Unsupported native contract "${requestedContract}". Use all, kotlin, or metro.`
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

function runNativeContracts() {
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

  const entryResult = spawnSync(
    process.execPath,
    [
      expoResolveAppEntryCli,
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

  if (requestedContract === "all" || requestedContract === "kotlin") {
    runGradleContract(":model-integrity:compileDebugKotlin", {
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
    runNativeContracts();
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

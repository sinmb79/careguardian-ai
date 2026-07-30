import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const problems = [];
const releaseRoots = ["apps/mobile/", "src/", "packages/life-core/", "public/"];
const exactFiles = new Set(["index.html", "package.json", "vite.config.ts", "apps/mobile/app.json", "apps/mobile/package.json"]);
const policyAllowlist = new Set([
  "packages/life-core/src/policy.ts",
  "apps/mobile/src/local-ai/assistantPolicy.ts",
  "apps/mobile/src/ui/LocalAiScreen.tsx",
  "apps/mobile/src/storage/mobileWorkspaceRepository.ts",
  "apps/mobile/src/notifications/lifeNotifications.ts",
  "apps/mobile/plugins/with-local-only-notifications.js"
]);
const forbiddenHealth = /(?:복약|투약|약물|처방약|진단|증상|치료|알레르기|질환|재활|건강|혈압|혈당|체온|심박|의료|caregiver|medication|prescription|diagnos(?:e|is)|symptom|treatment|allerg(?:y|ies|ic)|disease|rehabilitation|health(?:care)?|medical)/iu;
const forbiddenServiceImport = /(?:from\s*["']|require\s*\(\s*["'])(?:firebase|@sentry|@amplitude|mixpanel|analytics|@segment|openai|@anthropic|@google\/generative-ai)/iu;

for (const file of tracked) {
  if (!(releaseRoots.some((prefix) => file.startsWith(prefix)) || exactFiles.has(file))) continue;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file) || file.includes("/assets/model-licenses/")) continue;
  if (file === "apps/mobile/.gitignore" || file === "package.json" || file === "public/privacy-policy.html") continue;
  if (/\.(?:png|jpg|jpeg|webp|ico|ttf|woff2?|gguf)$/i.test(file)) continue;
  const text = readFileSync(resolve(root, file), "utf8");
  if (!policyAllowlist.has(file) && forbiddenHealth.test(text)) problems.push(`${file}: active health-shaped term`);
  if (forbiddenServiceImport.test(text)) problems.push(`${file}: prohibited cloud service import`);
  if (text.includes("@careguardian/care-core")) problems.push(`${file}: retired care-core dependency`);
  if (file.startsWith("apps/mobile/src/") && file !== "apps/mobile/src/local-ai/modelRegistry.ts" && /https?:\/\//.test(text)) {
    problems.push(`${file}: runtime source has an unapproved remote URL`);
  }
}

const app = JSON.parse(readFileSync(resolve(root, "apps/mobile/app.json"), "utf8")).expo;
const mobilePackage = JSON.parse(readFileSync(resolve(root, "apps/mobile/package.json"), "utf8"));
if (app.name !== "생활후견 AI") problems.push("app identity name is not exact");
if (app.version !== "1.1.0" || mobilePackage.version !== "1.1.0") problems.push("app version is not exact 1.1.0");
if (app.android?.package !== "com.sinmb.careguardianai" || app.ios?.bundleIdentifier !== "com.sinmb.careguardianai") problems.push("mobile package identity is not exact");
if (app.slug !== "careguardian-ai-mobile" || app.extra?.eas?.projectId !== "15b9e293-b631-4b77-8cfc-9937cd604dd4") problems.push("EAS linkage is not exact");
if (app.android?.versionCode !== 7 || app.android?.allowBackup !== false) problems.push("Android release version or backup policy is unsafe");
const permissions = app.android?.permissions ?? [];
if (permissions.length !== 1 || permissions[0] !== "android.permission.POST_NOTIFICATIONS") problems.push("Android permissions are not minimal");
const allowedDependencies = new Set(["expo", "expo-asset", "expo-crypto", "expo-device", "expo-file-system", "expo-font", "expo-local-authentication", "expo-notifications", "expo-screen-capture", "expo-secure-store", "expo-sqlite", "expo-status-bar", "llama.rn", "react", "react-native", "@life-steward/life-core"]);
for (const dependency of Object.keys(mobilePackage.dependencies ?? {})) {
  if (!allowedDependencies.has(dependency)) problems.push(`unexpected mobile dependency: ${dependency}`);
  if (/(?:firebase|sentry|amplitude|mixpanel|analytics|segment|openai|anthropic|generative-ai)/i.test(dependency)) problems.push(`prohibited cloud dependency: ${dependency}`);
}

const report = { gate: "non-medical-release", status: problems.length === 0 ? "pass" : "fail", checkedTrackedFiles: tracked.length, problems };
console.log(JSON.stringify(report, null, 2));
if (problems.length > 0) process.exitCode = 1;

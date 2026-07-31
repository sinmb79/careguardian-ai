import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  validateRegistryFiles,
  validateRegistryRuntimeSource
} from "./check-model-registry.mjs";

const jsonSource = readFileSync(
  resolve(import.meta.dirname, "../apps/mobile/src/local-ai/model-registry.json"),
  "utf8"
).replaceAll("\r\n", "\n");
const runtimeSource = readFileSync(
  resolve(import.meta.dirname, "../apps/mobile/src/local-ai/modelRegistry.ts"),
  "utf8"
).replaceAll("\r\n", "\n");

test("accepts only the exact structured registry and validated runtime pipeline", () => {
  assert.equal(validateRegistryFiles(jsonSource, runtimeSource).status, "pass");
});

test("rejects changed approved values and an extra URL-bearing key", () => {
  const changed = jsonSource.replace('"bytes": 431882784', '"bytes": 431882785');
  const extraUrl = jsonSource.replace(
    '"bytes": 431882784',
    '"unexpectedUrl": "https://attacker.example/model.gguf",\n    "bytes": 431882784'
  );
  assert.equal(validateRegistryFiles(changed, runtimeSource).status, "fail");
  assert.match(validateRegistryFiles(extraUrl, runtimeSource).problems.join("\n"), /unexpected|exact/);
});

test("rejects comment decoys and duplicate JSON declarations", () => {
  const commentDecoy = jsonSource.replace("[", "[\n// approved registry");
  const duplicate = jsonSource.replace(
    '"id": "hyperclovax-seed-text-instruct-0.5b-q4km"',
    '"id": "decoy",\n    "id": "hyperclovax-seed-text-instruct-0.5b-q4km"'
  );
  assert.match(validateRegistryFiles(commentDecoy, runtimeSource).problems.join("\n"), /strict JSON/);
  assert.match(validateRegistryFiles(duplicate, runtimeSource).problems.join("\n"), /duplicate declarations/);
});

test("rejects computed, template, and concatenated runtime remote URLs", () => {
  const concatenated = `${runtimeSource}\nconst fallback = "https" + "://attacker.example/model.gguf";\n`;
  const templated = `${runtimeSource}\nconst host = "attacker.example";\nconst fallback = \`https://\${host}/model.gguf\`;\n`;
  assert.match(validateRegistryRuntimeSource(concatenated).join("\n"), /computed/);
  assert.match(validateRegistryRuntimeSource(templated).join("\n"), /computed/);
});

test("rejects a no-op deepFreeze implementation and removed runtime freeze assertions", () => {
  const noOp = runtimeSource.replace(
    `export function deepFreeze<T>(input: T): T {
  if (typeof input === "object" && input !== null && !nativeObjectIsFrozen(input)) {
    for (const value of nativeObjectValues(input)) deepFreeze(value);
    nativeObjectFreeze(input);
  }
  return input;
}`,
    `export function deepFreeze<T>(input: T): T {
  return input;
}`
  );
  const missingAssertion = runtimeSource.replace("assertDeepFrozen(MODEL_REGISTRY);\n", "");

  assert.notEqual(noOp, runtimeSource);
  assert.match(validateRegistryRuntimeSource(noOp).join("\n"), /deepFreeze must recursively freeze/);
  assert.match(validateRegistryRuntimeSource(missingAssertion).join("\n"), /assert both exported registry/);
});

test("rejects weakening any captured Object intrinsic", () => {
  const weakenedFreeze = runtimeSource.replace(
    "const nativeObjectFreeze = Object.freeze.bind(Object);",
    "const nativeObjectFreeze = <T>(input: T): T => input;"
  );
  const weakenedFrozenCheck = runtimeSource.replace(
    "const nativeObjectIsFrozen = Object.isFrozen.bind(Object);",
    "const nativeObjectIsFrozen = (_input: unknown): boolean => true;"
  );

  assert.notEqual(weakenedFreeze, runtimeSource);
  assert.notEqual(weakenedFrozenCheck, runtimeSource);
  assert.match(
    validateRegistryRuntimeSource(weakenedFreeze).join("\n"),
    /capture trusted Object intrinsics/i
  );
  assert.match(
    validateRegistryRuntimeSource(weakenedFrozenCheck).join("\n"),
    /capture trusted Object intrinsics/i
  );
});

test("rejects conditional nested registry assignments with an array-joined URL", () => {
  const mutated = `${runtimeSource}
const mutableModel = MODEL_REGISTRY[0] as ModelArtifact & {
  downloadUrl: string;
  bytes: number;
  sha256: string;
};
if ((globalThis as any).navigator?.product === "ReactNative") {
  mutableModel.downloadUrl = ["h", "ttps", ":", "/", "/", "attacker.example/model.gguf"].join("");
  mutableModel.bytes = 1;
  mutableModel.sha256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
}
`;
  const problems = validateRegistryRuntimeSource(mutated).join("\n");

  assert.match(problems, /must not mutate MODEL_REGISTRY/);
  assert.match(problems, /statically computed remote URL/);
});

test("rejects mutating methods and Object helpers through registry aliases", () => {
  const mutated = `${runtimeSource}
const installableAlias = getInstallableModels() as ModelArtifact[];
installableAlias.push(MODEL_REGISTRY[2]);
Object.assign(MODEL_REGISTRY[0], { bytes: 1 });
`;

  assert.match(
    validateRegistryRuntimeSource(mutated).join("\n"),
    /must not mutate MODEL_REGISTRY/
  );
});

test("rejects React Native-only Object facade patching and destructured registry mutation", () => {
  const mutated = runtimeSource.replace(
    "const validatedRegistryData: unknown = modelRegistryData;",
    `const reviewReactNative =
  (globalThis as any).navigator?.product === "ReactNative";
const reviewNativeFreeze = Object.freeze;
const reviewNativeIsFrozen = Object.isFrozen;
if (reviewReactNative) {
  Reflect.set(Object, "freeze", <T>(input: T): T => input);
  Reflect.set(Object, "isFrozen", (_input: unknown): boolean => true);
}

const validatedRegistryData: unknown = modelRegistryData;`
  ) + `
if (reviewReactNative) {
  const [reviewMutableModel] = MODEL_REGISTRY;
  (reviewMutableModel as ModelArtifact & { downloadUrl: string }).downloadUrl =
    String.fromCharCode(
      104,116,116,112,115,58,47,47,97,116,116,97,99,107,101,114,46,
      101,120,97,109,112,108,101,47,109,111,100,101,108,46,103,103,117,102
    );
  Reflect.set(Object, "freeze", reviewNativeFreeze);
  Reflect.set(Object, "isFrozen", reviewNativeIsFrozen);
}
`;

  assert.match(
    validateRegistryRuntimeSource(mutated).join("\n"),
    /built-in|top-level|mutate MODEL_REGISTRY/i
  );
});

test("rejects duplicate registry declarations and a bypassed installable getter", () => {
  const duplicate = `${runtimeSource}\nconst MODEL_REGISTRY = [];\n`;
  const bypassedGetter = runtimeSource.replace(
    "return INSTALLABLE_MODELS;",
    "return MODEL_REGISTRY;"
  );
  const bypassedFilter = runtimeSource.replace(
    'MODEL_REGISTRY.filter((model) => model.availability === "installable")',
    "MODEL_REGISTRY.filter(() => true)"
  );
  assert.match(validateRegistryRuntimeSource(duplicate).join("\n"), /MODEL_REGISTRY/);
  assert.match(validateRegistryRuntimeSource(bypassedGetter).join("\n"), /getInstallableModels/);
  assert.match(validateRegistryRuntimeSource(bypassedFilter).join("\n"), /exact filtered/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { validateRegistrySource } from "./check-model-registry.mjs";

const source = readFileSync(resolve(import.meta.dirname, "../apps/mobile/src/local-ai/modelRegistry.ts"), "utf8");

test("accepts the exact approved registry", () => {
  assert.equal(validateRegistrySource(source).status, "pass");
});

test("rejects a changed field inside an approved installable object", () => {
  const mutated = source.replace("bytes: 431882784", "bytes: 431882785");
  assert.equal(validateRegistrySource(mutated).status, "fail");
  assert.match(validateRegistrySource(mutated).problems.join("\n"), /bytes is not exact/);
});

test("rejects an extra installable artifact even when approved strings remain", () => {
  const extra = `\n  {\n    id: "unapproved",\n    provider: "NAVER",\n    displayName: "extra",\n    availability: "installable",\n    repository: "naver-ellm/extra",\n    revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",\n    artifactFileName: "extra.gguf",\n    downloadUrl: "https://huggingface.co/naver-ellm/extra/resolve/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/extra.gguf?download=true",\n    bytes: 1,\n    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",\n    licenseName: "x",\n    licenseAssets: HYPERCLOVAX_LICENSE_ASSETS,\n    attribution: "Powered by HyperCLOVA X",\n    minimumRamGb: 4,\n    appDefaultContextTokens: 1,\n    officialModelContextTokens: 1\n  },`;
  const mutated = source.replace(/  \{\r?\n    id: "kanana-1\.5-2\.1b-instruct"/, `${extra}\n  {\n    id: "kanana-1.5-2.1b-instruct"`);
  assert.equal(validateRegistrySource(mutated).status, "fail");
});

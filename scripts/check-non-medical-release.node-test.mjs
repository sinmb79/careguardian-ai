import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  loadReleaseFiles,
  validateReleasePolicy
} from "./check-non-medical-release.mjs";

const root = resolve(import.meta.dirname, "..");
const baseline = loadReleaseFiles(root);

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
  assert.match(problems, /computed, template, or concatenated/);
  assert.match(problems, /network API/);
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

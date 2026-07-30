import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { validateReleaseWorkflow } from "./check-release-workflow.mjs";

const source = readFileSync(resolve(import.meta.dirname, "../.github/workflows/ci.yml"), "utf8");

test("accepts one exact-SHA verify-to-deploy workflow", () => {
  assert.equal(validateReleaseWorkflow(source).status, "pass");
});

test("rejects deployment that no longer depends on verify", () => {
  const mutated = source.replace("    needs: verify\n", "");
  assert.match(validateReleaseWorkflow(mutated).problems.join("\n"), /depend directly/);
});

test("rejects a missing gate or a gate moved after artifact upload", () => {
  const missing = source.replace("        run: npm run release:audit-policy\n", "");
  const moved = `${source.replace("        run: npm run mobile:doctor\n", "")}\nrun: npm run mobile:doctor\n`;
  assert.match(validateReleaseWorkflow(missing).problems.join("\n"), /audit-policy/);
  assert.match(validateReleaseWorkflow(moved).problems.join("\n"), /mobile:doctor/);
});

test("rejects mutable Action refs and a non-exact checkout SHA", () => {
  const mutableAction = source.replace(
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/setup-node@v4"
  );
  const branchCheckout = source.replace("ref: ${{ github.sha }}", "ref: main");
  const missingActionRef = source.replace(
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/setup-node"
  );
  assert.match(validateReleaseWorkflow(mutableAction).problems.join("\n"), /full commit SHA/);
  assert.match(validateReleaseWorkflow(missingActionRef).problems.join("\n"), /full commit SHA/);
  assert.match(validateReleaseWorkflow(branchCheckout).problems.join("\n"), /exact workflow SHA/);
});

test("rejects a second workflow or deploy-side checkout and rebuild", () => {
  assert.match(
    validateReleaseWorkflow(source, ["ci.yml", "deploy-pages.yml"]).problems.join("\n"),
    /single ci.yml/
  );
  const rebuilt = source.replace(
    "    steps:\n      - name: Deploy artifact",
    "    steps:\n      - run: npm run build\n      - name: Deploy artifact"
  );
  assert.match(validateReleaseWorkflow(rebuilt).problems.join("\n"), /without checkout or rebuild/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { validateReleaseWorkflow } from "./check-release-workflow.mjs";

const source = readFileSync(
  resolve(import.meta.dirname, "../.github/workflows/ci.yml"),
  "utf8"
).replaceAll("\r\n", "\n");

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

test("rejects if false and expression-based continue-on-error on required verify steps", () => {
  const conditional = source.replace(
    "      - name: Production dependency audit\n        run: npm run release:audit-policy",
    "      - name: Production dependency audit\n        if: false\n        run: npm run release:audit-policy"
  );
  const continuing = source.replace(
    "      - name: Pinned structured model registry policy\n        run: npm run release:model-check",
    "      - name: Pinned structured model registry policy\n        continue-on-error: ${{ true }}\n        run: npm run release:model-check"
  );

  assert.match(validateReleaseWorkflow(conditional).problems.join("\n"), /cannot be conditional/);
  assert.match(validateReleaseWorkflow(continuing).problems.join("\n"), /continue-on-error/);
});

test("rejects shell overrides and success-masking command suffixes", () => {
  const shellOverride = source.replace(
    "      - name: Non-medical release policy\n        run: npm run release:policy-check",
    "      - name: Non-medical release policy\n        shell: bash\n        run: npm run release:policy-check"
  );
  const ignoredFailure = source.replace(
    "        run: npm run release:audit-policy",
    "        run: npm run release:audit-policy || true"
  );

  assert.match(validateReleaseWorkflow(shellOverride).problems.join("\n"), /cannot be conditional/);
  assert.match(validateReleaseWorkflow(ignoredFailure).problems.join("\n"), /audit-policy|failure-ignoring/);
});

test("rejects workflow and verify-job defaults, env, and working-directory execution overrides", () => {
  const jobDefaultShell = source.replace(
    "    permissions:\n      contents: read\n    steps:",
    `    permissions:
      contents: read
    defaults:
      run:
        shell: bash -c "bash {0} || true"
    steps:`
  );
  const workflowDefaults = source.replace(
    "permissions:\n  contents: read",
    `defaults:
  run:
    shell: bash -c "bash {0} || true"

permissions:
  contents: read`
  );
  const jobEnv = source.replace(
    "    permissions:\n      contents: read\n    steps:",
    "    permissions:\n      contents: read\n    env:\n      NODE_OPTIONS: --require ./bypass.cjs\n    steps:"
  );
  const stepWorkingDirectory = source.replace(
    "      - name: Production dependency audit\n        run: npm run release:audit-policy",
    "      - name: Production dependency audit\n        working-directory: ./decoy\n        run: npm run release:audit-policy"
  );

  assert.match(validateReleaseWorkflow(jobDefaultShell).problems.join("\n"), /defaults|verify job/i);
  assert.match(validateReleaseWorkflow(workflowDefaults).problems.join("\n"), /defaults|workflow root/i);
  assert.match(validateReleaseWorkflow(jobEnv).problems.join("\n"), /env|verify job/i);
  assert.match(validateReleaseWorkflow(stepWorkingDirectory).problems.join("\n"), /conditional|execution|working-directory/i);
});

test("rejects a required command moved into the deploy job", () => {
  const withoutAudit = source.replace(
    "      - name: Production dependency audit\n        run: npm run release:audit-policy\n\n",
    ""
  );
  const moved = withoutAudit.replace(
    "    steps:\n      - name: Deploy artifact built and gated at the exact workflow SHA",
    "    steps:\n      - name: Production dependency audit\n        run: npm run release:audit-policy\n\n      - name: Deploy artifact built and gated at the exact workflow SHA"
  );
  const problems = validateReleaseWorkflow(moved).problems.join("\n");

  assert.match(problems, /verify command must run exactly once.*audit-policy/);
  assert.match(problems, /without checkout or rebuild/);
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

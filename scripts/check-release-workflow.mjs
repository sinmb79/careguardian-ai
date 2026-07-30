import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_VERIFY_COMMANDS = [
  "npm ci",
  "npm test -- --run",
  "npm run build",
  "npm run release:static-security-check",
  "npm run mobile:typecheck",
  "npm run mobile:doctor",
  "npm run release:policy-check",
  "npm run release:model-check",
  "npm run release:gate-tests",
  "npm run release:audit-policy",
  "npm run release:workflow-check"
];

export function validateReleaseWorkflow(source, workflowFiles = ["ci.yml"]) {
  const problems = [];
  if (workflowFiles.length !== 1 || workflowFiles[0] !== "ci.yml") {
    problems.push("Pages verification and deployment must use the single ci.yml workflow");
  }
  if (!source.includes("ref: ${{ github.sha }}")) {
    problems.push("verify checkout must bind to the exact workflow SHA");
  }
  if (!/\n  deploy:\n[\s\S]*?\n    needs: verify\n/u.test(source)) {
    problems.push("deploy must depend directly on the complete verify job");
  }
  if (
    !source.includes("permissions:\n  contents: read") ||
    !source.includes("    permissions:\n      pages: write\n      id-token: write")
  ) {
    problems.push("workflow permissions are not least-privilege by job");
  }
  if (/\bcontinue-on-error\s*:\s*true/u.test(source)) {
    problems.push("release gates cannot continue on error");
  }

  const remoteActionUses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith("./"));
  if (
    remoteActionUses.length === 0 ||
    remoteActionUses.some((reference) => !/^[^@\s]+@[a-f0-9]{40}$/u.test(reference))
  ) {
    problems.push("every third-party Action must use a full commit SHA");
  }

  const uploadIndex = source.indexOf("actions/upload-pages-artifact@");
  const deployIndex = source.indexOf("actions/deploy-pages@");
  if (uploadIndex < 0 || deployIndex < 0 || deployIndex < uploadIndex) {
    problems.push("verified artifact upload and deployment chain is incomplete");
  }
  const deploySource = source.slice(source.indexOf("\n  deploy:\n"));
  if (/actions\/checkout@|npm run build/u.test(deploySource)) {
    problems.push("deploy must consume the verified artifact without checkout or rebuild");
  }
  for (const command of REQUIRED_VERIFY_COMMANDS) {
    const first = source.indexOf(`run: ${command}`);
    const last = source.lastIndexOf(`run: ${command}`);
    if (first < 0 || first !== last || (uploadIndex >= 0 && first > uploadIndex)) {
      problems.push(`verify command must run exactly once before artifact upload: ${command}`);
    }
  }
  if (
    !source.includes("if: github.event_name == 'workflow_dispatch' || github.event_name == 'push'") ||
    !source.includes("branches: [main]")
  ) {
    problems.push("Pages deployment trigger is not limited to verified main pushes or manual runs");
  }
  return {
    gate: "release-workflow",
    status: problems.length ? "fail" : "pass",
    problems
  };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const workflowsDirectory = resolve(import.meta.dirname, "../.github/workflows");
  const workflowFiles = readdirSync(workflowsDirectory)
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort();
  const source = readFileSync(resolve(workflowsDirectory, "ci.yml"), "utf8");
  const report = validateReleaseWorkflow(source, workflowFiles);
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

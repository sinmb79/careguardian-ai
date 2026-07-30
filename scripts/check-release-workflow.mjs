import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

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

const EXPECTED_DEPLOY_CONDITION =
  "github.event_name == 'workflow_dispatch' || github.event_name == 'push'";
const ALLOWED_REMOTE_ACTIONS = new Set([
  "actions/checkout",
  "actions/setup-node",
  "actions/upload-pages-artifact",
  "actions/deploy-pages"
]);
const FAILURE_IGNORE_PATTERN =
  /(?:\|\|\s*(?:true|:)|;\s*(?:true|exit\s+0)|\bset\s+\+e\b|\bexit\s+0\b|\$LASTEXITCODE\s*=\s*0|\bcontinue-on-error\b)/iu;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value, expectedKeys) {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join("\0") === [...expectedKeys].sort().join("\0")
  );
}

function parseWorkflow(source, problems) {
  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true
  });
  if (document.errors.length) {
    problems.push(`workflow YAML is invalid: ${document.errors[0].message}`);
    return undefined;
  }
  const workflow = document.toJS();
  if (!isRecord(workflow)) {
    problems.push("workflow root must be a YAML mapping");
    return undefined;
  }
  return workflow;
}

function collectSteps(jobs) {
  const collected = [];
  for (const [jobName, job] of Object.entries(jobs)) {
    if (!isRecord(job) || !Array.isArray(job.steps)) continue;
    job.steps.forEach((step, index) => {
      if (isRecord(step)) collected.push({ jobName, index, step });
    });
  }
  return collected;
}

export function validateReleaseWorkflow(source, workflowFiles = ["ci.yml"]) {
  const problems = [];
  if (workflowFiles.length !== 1 || workflowFiles[0] !== "ci.yml") {
    problems.push("Pages verification and deployment must use the single ci.yml workflow");
  }
  const workflow = parseWorkflow(source, problems);
  if (!workflow) {
    return {
      gate: "release-workflow",
      status: "fail",
      problems
    };
  }

  const triggers = workflow.on;
  if (
    !isRecord(triggers) ||
    Object.keys(triggers).sort().join("\0") !==
      ["pull_request", "push", "workflow_dispatch"].sort().join("\0") ||
    !isRecord(triggers.push) ||
    !Array.isArray(triggers.push.branches) ||
    triggers.push.branches.length !== 1 ||
    triggers.push.branches[0] !== "main"
  ) {
    problems.push("Pages deployment trigger is not limited to verified main pushes or manual runs");
  }
  if (!hasExactKeys(workflow.permissions, ["contents"]) || workflow.permissions.contents !== "read") {
    problems.push("workflow permissions are not least-privilege by job");
  }

  const jobs = workflow.jobs;
  if (
    !isRecord(jobs) ||
    Object.keys(jobs).sort().join("\0") !== ["deploy", "verify"].sort().join("\0")
  ) {
    problems.push("workflow must contain only the verify and deploy jobs");
  }
  const safeJobs = isRecord(jobs) ? jobs : {};
  const verify = safeJobs.verify;
  const deploy = safeJobs.deploy;
  if (!isRecord(verify) || !Array.isArray(verify.steps)) {
    problems.push("verify job and its steps must be structurally present");
  }
  if (
    !isRecord(verify) ||
    verify["runs-on"] !== "ubuntu-latest" ||
    hasOwn(verify, "if") ||
    hasOwn(verify, "continue-on-error") ||
    !hasExactKeys(verify.permissions, ["contents"]) ||
    verify.permissions.contents !== "read"
  ) {
    problems.push("verify job execution and permissions are not unconditional least privilege");
  }
  if (
    !isRecord(deploy) ||
    deploy.needs !== "verify" ||
    deploy.if !== EXPECTED_DEPLOY_CONDITION
  ) {
    problems.push("deploy must depend directly on the complete verify job");
  }
  if (
    !isRecord(deploy) ||
    !hasExactKeys(deploy.permissions, ["pages", "id-token"]) ||
    deploy.permissions.pages !== "write" ||
    deploy.permissions["id-token"] !== "write"
  ) {
    problems.push("workflow permissions are not least-privilege by job");
  }

  const steps = collectSteps(safeJobs);
  const verifySteps = isRecord(verify) && Array.isArray(verify.steps) ? verify.steps : [];
  const actionSteps = steps.filter(({ step }) => hasOwn(step, "uses"));
  const remoteActionUses = actionSteps
    .map(({ step }) => step.uses)
    .filter((reference) => typeof reference === "string" && !reference.startsWith("./"));
  if (
    remoteActionUses.length !== actionSteps.length ||
    remoteActionUses.length === 0 ||
    remoteActionUses.some((reference) => !/^[^@\s]+@[a-f0-9]{40}$/u.test(reference))
  ) {
    problems.push("every third-party Action must use a full commit SHA");
  }
  const actionNames = remoteActionUses.map((reference) => reference.slice(0, reference.lastIndexOf("@")));
  if (
    actionNames.some((name) => !ALLOWED_REMOTE_ACTIONS.has(name)) ||
    [...ALLOWED_REMOTE_ACTIONS].some(
      (expected) => actionNames.filter((name) => name === expected).length !== 1
    )
  ) {
    problems.push("workflow contains an unexpected or missing release Action");
  }

  const checkout = steps.filter(({ step }) =>
    typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")
  );
  if (
    checkout.length !== 1 ||
    checkout[0].jobName !== "verify" ||
    !hasExactKeys(checkout[0].step.with, ["ref"]) ||
    checkout[0].step.with.ref !== "${{ github.sha }}" ||
    hasOwn(checkout[0].step, "if") ||
    hasOwn(checkout[0].step, "continue-on-error")
  ) {
    problems.push("verify checkout must bind to the exact workflow SHA");
  }

  const upload = steps.filter(({ step }) =>
    typeof step.uses === "string" && step.uses.startsWith("actions/upload-pages-artifact@")
  );
  const uploadIndex = upload.length === 1 && upload[0].jobName === "verify"
    ? upload[0].index
    : -1;
  if (
    uploadIndex < 0 ||
    upload[0].step.if !== EXPECTED_DEPLOY_CONDITION ||
    hasOwn(upload[0].step, "continue-on-error") ||
    !hasExactKeys(upload[0].step.with, ["path"]) ||
    upload[0].step.with.path !== "./dist"
  ) {
    problems.push("verified artifact upload and deployment chain is incomplete");
  }

  const requiredIndices = [];
  for (const command of REQUIRED_VERIFY_COMMANDS) {
    const exactOccurrences = steps.filter(({ step }) => step.run === command);
    if (
      exactOccurrences.length !== 1 ||
      exactOccurrences[0].jobName !== "verify" ||
      exactOccurrences[0].index >= uploadIndex
    ) {
      problems.push(`verify command must run exactly once before artifact upload: ${command}`);
      continue;
    }
    const occurrence = exactOccurrences[0];
    requiredIndices.push(occurrence.index);
    if (
      !hasExactKeys(occurrence.step, ["name", "run"]) ||
      hasOwn(occurrence.step, "if") ||
      hasOwn(occurrence.step, "continue-on-error") ||
      hasOwn(occurrence.step, "shell") ||
      FAILURE_IGNORE_PATTERN.test(occurrence.step.run)
    ) {
      problems.push(`verify command cannot be conditional or failure-ignoring: ${command}`);
    }
  }
  if (requiredIndices.some((index, offset) => offset > 0 && index <= requiredIndices[offset - 1])) {
    problems.push("verify commands must retain their fail-fast security order");
  }
  for (const { jobName, step } of steps) {
    if (hasOwn(step, "continue-on-error")) {
      problems.push(`${jobName} steps cannot declare continue-on-error`);
    }
    if (
      typeof step.run === "string" &&
      (
        !REQUIRED_VERIFY_COMMANDS.includes(step.run) ||
        FAILURE_IGNORE_PATTERN.test(step.run)
      )
    ) {
      problems.push(`${jobName} contains an unapproved or failure-ignoring run command`);
    }
  }

  const deploySteps = isRecord(deploy) && Array.isArray(deploy.steps) ? deploy.steps : [];
  const deployActions = deploySteps.filter(
    (step) => isRecord(step) && typeof step.uses === "string" && step.uses.startsWith("actions/deploy-pages@")
  );
  if (
    deploySteps.length !== 1 ||
    deployActions.length !== 1 ||
    deploySteps.some((step) => isRecord(step) && (hasOwn(step, "run") || hasOwn(step, "if") || hasOwn(step, "continue-on-error")))
  ) {
    problems.push("deploy must consume the verified artifact without checkout or rebuild");
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

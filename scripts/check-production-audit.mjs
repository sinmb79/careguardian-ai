import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEVERITIES = ["critical", "high", "moderate", "low", "info"];

function sortedUniqueStrings(input) {
  if (!Array.isArray(input) || input.some((value) => typeof value !== "string")) return undefined;
  const sorted = [...input].sort();
  return new Set(sorted).size === sorted.length ? sorted : undefined;
}

function equalSorted(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return undefined;
  }
  return timestamp;
}

function validateAcceptance(acceptance, problems) {
  if (!acceptance || typeof acceptance !== "object") {
    problems.push("risk acceptance is not an object");
    return false;
  }
  let valid = true;
  const reviewDate = parseIsoDate(acceptance.reviewDate);
  const expiresOn = parseIsoDate(acceptance.expiresOn);
  if (
    typeof acceptance.owner !== "string" ||
    acceptance.owner.trim().length === 0 ||
    reviewDate === undefined ||
    expiresOn === undefined
  ) {
    problems.push("risk acceptance owner or ISO calendar dates are invalid");
    valid = false;
  } else if (reviewDate > expiresOn) {
    problems.push("risk acceptance reviewDate must be on or before expiresOn");
    valid = false;
  }
  const countKeys = Object.keys(acceptance.acceptedCounts ?? {}).sort();
  if (
    !equalSorted(countKeys, [...SEVERITIES].sort()) ||
    SEVERITIES.some(
      (severity) =>
        !Number.isSafeInteger(acceptance.acceptedCounts[severity]) ||
        acceptance.acceptedCounts[severity] < 0
    )
  ) {
    problems.push("accepted severity counts are not exact non-negative integers");
    valid = false;
  }
  if (!sortedUniqueStrings(acceptance.acceptedPackages)) {
    problems.push("accepted package list must contain unique strings");
    valid = false;
  }
  const advisoryIds = sortedUniqueStrings(acceptance.advisoryIds);
  if (!advisoryIds || advisoryIds.some((id) => !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(id))) {
    problems.push("accepted advisory IDs are invalid or duplicated");
    valid = false;
  }
  return valid;
}

function collectAdvisoryIds(audit) {
  const advisories = new Set();
  for (const vulnerability of Object.values(audit.vulnerabilities ?? {})) {
    if (!vulnerability || typeof vulnerability !== "object" || !Array.isArray(vulnerability.via)) continue;
    for (const via of vulnerability.via) {
      if (!via || typeof via !== "object" || typeof via.url !== "string") continue;
      for (const match of via.url.matchAll(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/gi)) {
        advisories.add(match[0].toUpperCase());
      }
    }
  }
  return [...advisories].sort();
}

export function validateAuditReport(audit, acceptance, now = Date.now()) {
  const problems = [];
  const acceptanceValid = validateAcceptance(acceptance, problems);
  if (!acceptanceValid) {
    return { problems, counts: {}, packages: [], advisoryIds: [], acceptanceValid: false };
  }
  if (!audit || typeof audit !== "object" || audit.error) {
    problems.push("npm audit returned an error payload");
    return { problems, counts: {}, packages: [], advisoryIds: [], acceptanceValid: true };
  }
  const actualCounts = audit.metadata?.vulnerabilities;
  const vulnerabilities = audit.vulnerabilities;
  if (!actualCounts || typeof actualCounts !== "object" || !vulnerabilities || typeof vulnerabilities !== "object") {
    problems.push("npm audit JSON schema is incomplete");
    return {
      problems,
      counts: actualCounts ?? {},
      packages: [],
      advisoryIds: [],
      acceptanceValid: true
    };
  }

  const expiry = Date.parse(`${acceptance.expiresOn}T23:59:59.999Z`);
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(expiry) || expiry < nowMs) {
    problems.push(`risk acceptance expired on ${acceptance.expiresOn}`);
  }

  const actualCountKeys = Object.keys(actualCounts).sort();
  if (!equalSorted(actualCountKeys, [...SEVERITIES, "total"].sort())) {
    problems.push("npm audit severity count keys are not exact");
  }
  for (const severity of SEVERITIES) {
    if (
      !Number.isSafeInteger(actualCounts[severity]) ||
      actualCounts[severity] !== acceptance.acceptedCounts[severity]
    ) {
      problems.push(
        `${severity} count changed: expected ${acceptance.acceptedCounts[severity]}, got ${String(actualCounts[severity])}`
      );
    }
  }
  const expectedTotal = SEVERITIES.reduce(
    (total, severity) => total + acceptance.acceptedCounts[severity],
    0
  );
  if (actualCounts.total !== expectedTotal) {
    problems.push(`total count changed: expected ${expectedTotal}, got ${String(actualCounts.total)}`);
  }

  const actualPackages = Object.keys(vulnerabilities).sort();
  const expectedPackages = [...acceptance.acceptedPackages].sort();
  if (!equalSorted(actualPackages, expectedPackages)) {
    problems.push("vulnerability package baseline changed");
  }

  const actualAdvisories = collectAdvisoryIds(audit);
  const expectedAdvisories = acceptance.advisoryIds.map((id) => id.toUpperCase()).sort();
  if (!equalSorted(actualAdvisories, expectedAdvisories)) {
    problems.push("advisory baseline changed");
  }
  return {
    problems,
    counts: actualCounts,
    packages: actualPackages,
    advisoryIds: actualAdvisories,
    acceptanceValid: true
  };
}

export function validateAuditExecution(execution, acceptance, now = Date.now()) {
  const commandProblems = [];
  if (execution.error) {
    commandProblems.push(`npm audit command failed: ${execution.error.message ?? String(execution.error)}`);
  }
  if (execution.signal) commandProblems.push(`npm audit was terminated by signal ${execution.signal}`);
  if (execution.status !== 0 && execution.status !== 1) {
    commandProblems.push(`npm audit exited with unexpected status ${String(execution.status)}`);
  }

  let audit;
  try {
    audit = JSON.parse(execution.stdout ?? "");
  } catch {
    commandProblems.push("npm audit did not produce valid JSON");
  }
  if (audit === undefined) {
    return {
      gate: "production-audit",
      status: "fail",
      problems: commandProblems,
      counts: {},
      packages: [],
      advisoryIds: []
    };
  }

  const validation = validateAuditReport(audit, acceptance, now);
  if (validation.acceptanceValid) {
    const expectedTotal = SEVERITIES.reduce(
      (total, severity) => total + acceptance.acceptedCounts[severity],
      0
    );
    const expectedStatus = expectedTotal > 0 ? 1 : 0;
    if (execution.status !== expectedStatus) {
      commandProblems.push(
        `npm audit exit status is inconsistent with the accepted vulnerability total: expected ${expectedStatus}, got ${String(execution.status)}`
      );
    }
  }
  const problems = [...commandProblems, ...validation.problems];
  return {
    gate: "production-audit",
    status: problems.length ? "fail" : "accepted-baseline",
    owner: acceptance?.owner,
    reviewDate: acceptance?.reviewDate,
    expiresOn: acceptance?.expiresOn,
    counts: validation.counts,
    packages: validation.packages,
    advisoryIds: validation.advisoryIds,
    productionAabReachability:
      "Unproven without Task 10 AAB dependency inspection; this gate does not claim accepted findings are harmless.",
    problems
  };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const root = resolve(import.meta.dirname, "..");
  const acceptance = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "audit-risk-acceptance.json"), "utf8")
  );
  const execution = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm audit --omit=dev --json"], {
        cwd: root,
        encoding: "utf8"
      })
    : spawnSync("npm", ["audit", "--omit=dev", "--json"], { cwd: root, encoding: "utf8" });
  const report = validateAuditExecution(execution, acceptance);
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

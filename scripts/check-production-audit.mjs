import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const acceptance = JSON.parse(readFileSync(resolve(import.meta.dirname, "audit-risk-acceptance.json"), "utf8"));
const result = process.platform === "win32"
  ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm audit --omit=dev --json"], { cwd: root, encoding: "utf8" })
  : spawnSync("npm", ["audit", "--omit=dev", "--json"], { cwd: root, encoding: "utf8" });
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  console.error(JSON.stringify({ gate: "production-audit", status: "fail", problems: ["npm audit did not produce JSON"] }, null, 2));
  process.exit(1);
}
const actualCounts = audit.metadata?.vulnerabilities ?? {};
const actualPackages = Object.keys(audit.vulnerabilities ?? {}).sort();
const expectedPackages = [...acceptance.acceptedPackages].sort();
const problems = [];
if (new Date(`${acceptance.expiresOn}T23:59:59Z`).getTime() < Date.now()) problems.push(`risk acceptance expired on ${acceptance.expiresOn}`);
for (const severity of ["critical", "high", "moderate", "low", "info"]) {
  if ((actualCounts[severity] ?? 0) !== acceptance.acceptedCounts[severity]) {
    problems.push(`${severity} count changed: expected ${acceptance.acceptedCounts[severity]}, got ${actualCounts[severity] ?? 0}`);
  }
}
if (JSON.stringify(actualPackages) !== JSON.stringify(expectedPackages)) problems.push("vulnerability package baseline changed");
const seenAdvisories = new Set();
for (const vulnerability of Object.values(audit.vulnerabilities ?? {})) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via === "object" && via.url) {
      const match = via.url.match(/GHSA-[a-z0-9-]+/i);
      if (match) seenAdvisories.add(match[0]);
    }
  }
}
for (const advisory of seenAdvisories) if (!acceptance.advisoryIds.includes(advisory)) problems.push(`new advisory: ${advisory}`);
const report = {
  gate: "production-audit",
  status: problems.length ? "fail" : "accepted-baseline",
  owner: acceptance.owner,
  reviewDate: acceptance.reviewDate,
  expiresOn: acceptance.expiresOn,
  counts: actualCounts,
  productionAabReachability: "Unproven without Task 10 AAB dependency inspection; this gate does not claim accepted findings are harmless.",
  problems
};
console.log(JSON.stringify(report, null, 2));
if (problems.length) process.exitCode = 1;

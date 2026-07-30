import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  validateAuditExecution,
  validateAuditReport
} from "./check-production-audit.mjs";

const acceptance = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "audit-risk-acceptance.json"), "utf8")
);
const beforeExpiry = new Date("2026-08-01T00:00:00Z");

function auditFixture() {
  const vulnerabilities = Object.fromEntries(
    acceptance.acceptedPackages.map((name, index) => [
      name,
      {
        name,
        via: index < acceptance.advisoryIds.length
          ? [{ url: `https://github.com/advisories/${acceptance.advisoryIds[index]}` }]
          : []
      }
    ])
  );
  return {
    metadata: {
      vulnerabilities: {
        ...acceptance.acceptedCounts,
        total: Object.values(acceptance.acceptedCounts).reduce((sum, count) => sum + count, 0)
      }
    },
    vulnerabilities
  };
}

test("accepts exact sorted equality for counts, packages, and advisories", () => {
  const report = validateAuditExecution(
    { status: 1, signal: null, stdout: JSON.stringify(auditFixture()) },
    acceptance,
    beforeExpiry
  );
  assert.equal(report.status, "accepted-baseline");
  assert.deepEqual(report.problems, []);
});

test("rejects count and package mutations in either direction", () => {
  const changedCount = auditFixture();
  changedCount.metadata.vulnerabilities.high -= 1;
  changedCount.metadata.vulnerabilities.total -= 1;
  const removedPackage = auditFixture();
  delete removedPackage.vulnerabilities[acceptance.acceptedPackages[0]];
  const extraCount = auditFixture();
  extraCount.metadata.vulnerabilities.unknown = 0;
  assert.match(validateAuditReport(changedCount, acceptance, beforeExpiry).problems.join("\n"), /count changed/);
  assert.match(validateAuditReport(removedPackage, acceptance, beforeExpiry).problems.join("\n"), /package baseline changed/);
  assert.match(validateAuditReport(extraCount, acceptance, beforeExpiry).problems.join("\n"), /count keys/);
});

test("rejects missing, replacement, and additional advisories", () => {
  const missing = auditFixture();
  missing.vulnerabilities[acceptance.acceptedPackages[0]].via = [];
  const replacement = auditFixture();
  replacement.vulnerabilities[acceptance.acceptedPackages[0]].via = [
    { url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }
  ];
  const additional = auditFixture();
  additional.vulnerabilities[acceptance.acceptedPackages.at(-1)].via = [
    { url: "https://github.com/advisories/GHSA-dddd-eeee-ffff" }
  ];
  for (const audit of [missing, replacement, additional]) {
    assert.match(validateAuditReport(audit, acceptance, beforeExpiry).problems.join("\n"), /advisory baseline changed/);
  }
});

test("rejects expired acceptance with an injected clock", () => {
  const report = validateAuditReport(auditFixture(), acceptance, new Date("2026-08-14T00:00:00Z"));
  assert.match(report.problems.join("\n"), /expired/);
});

test("rejects malformed or reversed review dates without throwing", () => {
  const invalidCalendarDate = { ...acceptance, reviewDate: "2026-02-30" };
  const reversedDates = { ...acceptance, reviewDate: "2026-08-14" };
  const malformedCounts = { ...acceptance, acceptedCounts: null };

  assert.doesNotThrow(() =>
    validateAuditReport(auditFixture(), invalidCalendarDate, beforeExpiry)
  );
  assert.match(
    validateAuditReport(auditFixture(), invalidCalendarDate, beforeExpiry).problems.join("\n"),
    /calendar dates/
  );
  assert.match(
    validateAuditReport(auditFixture(), reversedDates, beforeExpiry).problems.join("\n"),
    /on or before/
  );
  assert.match(
    validateAuditReport(auditFixture(), malformedCounts, beforeExpiry).problems.join("\n"),
    /severity counts/
  );
});

test("fails closed on invalid JSON, network errors, signals, and unexpected exit status", () => {
  const invalidJson = validateAuditExecution(
    { status: 1, signal: null, stdout: "registry timeout" },
    acceptance,
    beforeExpiry
  );
  const networkError = validateAuditExecution(
    { status: null, signal: null, stdout: "", error: new Error("ENETUNREACH") },
    acceptance,
    beforeExpiry
  );
  const signaled = validateAuditExecution(
    { status: null, signal: "SIGTERM", stdout: JSON.stringify(auditFixture()) },
    acceptance,
    beforeExpiry
  );
  const unexpected = validateAuditExecution(
    { status: 2, signal: null, stdout: JSON.stringify(auditFixture()) },
    acceptance,
    beforeExpiry
  );
  for (const report of [invalidJson, networkError, signaled, unexpected]) {
    assert.equal(report.status, "fail");
    assert.ok(report.problems.length > 0);
  }
});

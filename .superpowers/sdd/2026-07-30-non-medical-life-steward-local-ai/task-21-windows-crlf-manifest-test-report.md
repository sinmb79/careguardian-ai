# Task 21 — Windows CRLF Android manifest test portability

## Scope

Fix a test-fixture mutation in
`apps/mobile/scripts/verify-android-release-manifest.node-test.mjs` that
silently became a no-op after a Windows CRLF checkout. This change affects
test construction only; release-manifest validation behavior is unchanged.

## TDD evidence

1. Added `restore-filter mutation remains effective for a CRLF manifest fixture`.
2. Before the implementation, the focused Node test failed at
   `assert.notEqual(mutated, crlfManifest)`: the literal LF boundary did not
   match the CRLF fixture.
3. Replaced the shared restore-receiver closing boundary with one `\r?\n`
   regular expression and used it in both the existing mutation and the CRLF
   regression test.
4. After the implementation, the focused test suite passed: 115/115.

## Verification

- `node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs`
  — PASS (115 tests)
- `npm run verify` — PASS (298 Vitest tests, build, TypeScript, Expo Doctor
  18/18, static security, non-medical policy, local-model, remote-push and
  workflow gates)
- `git diff --check` — PASS

## Safety

The mutation now proves the validator rejects an additional restore
`intent-filter` on either LF or CRLF fixtures. No mobile runtime, Android
manifest, model, dependency, or Play Console setting changed.

## Independent-review correction (2026-07-31)

The initial CRLF fixture conversion used `replaceAll("\n", "\r\n")`. That
operation is not idempotent: a true CRLF checkout becomes CRCRLF when it is
converted again. Independent review correctly rejected that evidence.

The corrected helper uses `replace(/\r?\n/g, "\r\n")`, so both an LF fixture
and an already-CRLF fixture normalize to exactly CRLF. The revised regression
test now proves, for **both** source forms, that:

1. the unmodified fixture passes the real release-manifest validator;
2. the restore-filter mutation changes the fixture; and
3. the mutated fixture fails the real validator.

### Corrected TDD and verification evidence

- RED: with the old `replaceAll` implementation,
  `assert.equal(asCrLf(crlfManifest), crlfManifest)` failed and displayed
  CRCRLF bytes.
- GREEN: the `\r?\n` conversion passed the focused suite (117/117).
- A temporary copied `scripts/` tree had both the test source and hardened
  XML fixture physically converted to CRLF (`CRCRLF=0`); its focused suite
  also passed (117/117).
- The temporary verification tree is not a release artifact and is excluded
  from the commits.

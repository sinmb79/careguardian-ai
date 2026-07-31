# Task 14 candidate portability fix — round 1/5

- Date: 2026-07-31 (Asia/Seoul)
- Status: `DONE`
- Discarded candidate: `5130c92d9b778a19872ebebee906fded3429b410`
- Implementation commit:
  `79d61092b9d2642fb0c36e4599b5a05203eb89bf`
- Product behavior changed: no

## Failure and disposition

The immutable Task 14 candidate was checked out cleanly into the existing
ASCII worktree with repository `core.autocrlf=true`. `npm ci` completed, but
`npm run verify` stopped in `release:policy-check:test`.

The four failing leaf mutations were:

1. `firebase_messaging_auto_init_enabled` changed from `false` to `true`;
2. `firebase_analytics_collection_enabled` changed from `false` to `true`;
3. `google_analytics_adid_collection_enabled` changed from `false` to `true`;
4. a descendant Android namespace rebind on `NotificationsService`.

TAP reported five failures because the three flag leaves also caused their
parent subtest to fail. The failure was a valid test-harness portability RED:
the fresh checkout converted the XML fixture to CRLF while the mutations
matched literal LF-only fragments. Each mutation became a no-op and
`assert.notEqual(mutated, hardenedManifest)` failed.

The candidate was marked invalid immediately. No APK, AAB, screenshot, EAS,
Play, or GitHub artifact was promoted from it.

## Minimal fix

Only
`apps/mobile/scripts/verify-android-release-manifest.node-test.mjs` changed.
The affected test mutations now match `\r?\n`, capture the actual line ending,
and reuse it in the replacement. The assertions and manifest verifier
expectations were not relaxed. Product code, manifest policy, fixtures,
dependencies, and release configuration did not change.

## RED evidence

Environment:

- worktree:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-final-android-v7-20260731`
- HEAD: `5130c92d9b778a19872ebebee906fded3429b410`
- Node: `v22.23.2`
- fixture: 30 LF bytes, all 30 preceded by CR
- test source: 628 LF bytes, all 628 preceded by CR

Command:

```powershell
npm run verify
```

Observed before the fix:

- Vitest: 30 files / 280 tests passed
- web build, static security, mobile typecheck, Expo Doctor 18/18,
  non-medical policy and model registry passed
- manifest/policy mutation suite: 115 passed / 5 reported failed
- process exit: 1

## GREEN evidence

### Branch worktree, LF

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
npm run verify
git diff --check
```

Results:

- focused manifest matrix: 95/95 passed
- full verification: exit 0
- Vitest: 30 files / 280 tests passed
- policy mutation suite: 120/120 passed
- Expo Doctor: 18/18
- accepted production audit baseline: Critical 0, High 19, Moderate 10,
  expires 2026-08-13
- diff check: passed

### Fresh `core.autocrlf=true` ASCII checkout

Path:
`C:\Users\sinmb\AppData\Local\Temp\careguardian-task14-eol-crlf-79d6109`

The checkout was clean at implementation commit `79d6109`; the fixture had
30/30 CRLF line endings and the test file had 630/630 CRLF line endings.

```powershell
npm ci --no-audit --prefer-offline
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
npm run release:policy-check:test
```

Results: focused 95/95 passed; complete policy mutation matrix 120/120 passed;
checkout remained clean.

### Fresh `core.autocrlf=false` ASCII checkout

Path:
`C:\Users\sinmb\AppData\Local\Temp\careguardian-task14-eol-lf-79d6109`

The checkout was clean at implementation commit `79d6109`; both relevant
files contained LF with zero CRLF sequences.

```powershell
npm ci --no-audit --prefer-offline
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
npm run release:policy-check:test
```

Results: focused 95/95 passed; complete policy mutation matrix 120/120 passed;
checkout remained clean.

## Handoff

An independent review must approve the tooling-only change before selecting a
new immutable `CANDIDATE_SHA`. Task 14 APK/AAB execution must restart from a
fresh, clean ASCII checkout of that new SHA; the discarded SHA cannot be
reused or promoted.

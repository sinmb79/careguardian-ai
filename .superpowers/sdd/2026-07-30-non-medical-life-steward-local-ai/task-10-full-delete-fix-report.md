# Task 10 Android smoke blocker: idempotent full deletion report

## Status

`DONE`

## Red evidence

Before changing production code, I added five regression tests to
`apps/mobile/src/storage/mobileWorkspaceRepository.test.ts` and ran:

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.test.ts
```

Observed result: **21 tests total; 19 passed, 2 failed**. The failures were
the two new success-postcondition cases:

- `full deletion accepts absent current and legacy databases after native not-found errors`
- `full deletion accepts a database that native deletion removed before throwing`

Both rejected with the pre-fix `AggregateError` containing typed SQLite
namespace failures. This confirmed that the existing implementation treated a
native deletion exception as failure without checking whether the database
file was already absent.

## Implementation

The SQLite deletion loop now records a native deletion error, then always
checks the database-file postcondition. An absent file is success regardless
of whether the native delete returned or threw. A remaining file still records
the same typed `MobileDataDeletionError` for its exact `sqlite:<database>`
namespace. The implementation does not inspect native error text or codes.

## Green verification

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.test.ts apps/mobile/src/security/clearMobileData.test.ts
```

Result: **2 files passed; 26 tests passed.**

```powershell
npm run mobile:typecheck
```

Result: passed (`tsc --noEmit -p apps/mobile/tsconfig.json`).

```powershell
git diff --check
```

Result: passed with no whitespace errors.

## Regression coverage

1. Both current and legacy databases are absent while native deletion throws a
   `DatabaseNotFoundException`-style error.
2. A current database is removed before native deletion throws.
3. Native deletion throws while a database remains.
4. Native deletion returns normally while a database remains.
5. The legacy database namespace is still attempted after the current
   namespace remains.

## Files changed

- `apps/mobile/src/storage/mobileWorkspaceRepository.ts`
- `apps/mobile/src/storage/mobileWorkspaceRepository.test.ts`
- `.superpowers/sdd/2026-07-30-non-medical-life-steward-local-ai/task-10-full-delete-fix-report.md`

## Self-review

- Preserved the exhaustive current plus legacy database inventory and ordered
  best-effort iteration.
- Preserved typed aggregate reporting when a file remains or postcondition
  verification itself fails.
- Left secure-store and legacy KV deletion/verification unchanged.
- Left the separate inference-release barrier and `clearMobileData` domain
  reporting unchanged.
- Used file-state postconditions only; no platform-specific exception matching
  was introduced.

## Concerns

No source-level concern remains. The signed-APK full-deletion retry is a
separate integration verification step and should be rerun after this commit.

## Commits

- Implementation and regression tests: `5ad2eb148278b4548647b54a78bd2af36c7c4ccb`
- This verification report: recorded in the subsequent documentation commit.

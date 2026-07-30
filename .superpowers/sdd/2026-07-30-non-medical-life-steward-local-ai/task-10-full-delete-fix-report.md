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

## Fix round 1: Android FileSystem adapter boundary

Independent review found that Expo SQLite exposes Android's default database
directory as a raw `/data/...` path, while legacy Expo FileSystem requires a
`file:///...` URI for filesystem postcondition checks. The original loop fix
therefore still failed closed on a fresh Android install.

### Red evidence

Before changing production code, I added
`apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts` and
ran:

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts
```

Observed result: **3 tests total; 1 passed, 2 failed**.

- The raw Android SQLite directory case passed a scheme-null path to legacy
  FileSystem and rejected with the typed SQLite aggregate failure.
- The unsupported `content://` directory case delegated to FileSystem instead
  of rejecting at the adapter boundary.

### Implementation and green evidence

`databaseFileUri()` now converts an absolute raw platform path to a
`file:///...` URI, preserves an already-valid `file:///...` directory without
double-prefixing, and rejects unsupported directory schemes before invoking
FileSystem. It does not change SQLite delete semantics or match native errors.

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.test.ts apps/mobile/src/security/clearMobileData.test.ts apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts
```

Result: **3 files passed; 29 tests passed.**

```powershell
npm run mobile:typecheck
git diff --check
```

Result: both passed.

### Fix-round self-review

- Raw Android and raw iOS-style absolute paths become valid file URIs.
- Existing `file:///` URIs are used as-is apart from trailing-slash removal.
- `content:`, relative, and other unsupported forms fail closed before the
  legacy FileSystem boundary.
- The exhaustive deletion loop, typed namespace failures, secure-store/KV
  verification, inference-release barrier, and `clearMobileData` reporting
  remain unchanged.

## Concerns

The signed-APK full-deletion retry remains a separate integration verification
step and must be rerun after this fix round.

## Commits

- Implementation and regression tests: `5ad2eb148278b4548647b54a78bd2af36c7c4ccb`
- This verification report: recorded in the subsequent documentation commit.
- Fix round 1 implementation and adapter regression test:
  `b4e246f12a1669dba3512ab961cdd00a466c5c85`

# Task 10 full-data deletion fix round 1 rereview

## Scope

Rereviewed implementation commit
`b4e246f12a1669dba3512ab961cdd00a466c5c85` and its updated report commit
`cf8120b8c2245aeb6a63f94e25982914594bca8a` against the Important adapter
finding recorded in
`de1217057522fe0686c412c748d2e1d0e0eb99af`.

The supplied long report SHA ending in `...b00d` was not present in the
repository; the supplied short SHA `cf8120b` resolves to the exact commit
`cf8120b8c2245aeb6a63f94e25982914594bca8a`, which is the commit reviewed
here.

## Verdict

`PASS`

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| Important | 0 |
| Minor | 0 |

## Finding closure

The prior Important finding is closed.

### Raw Android SQLite directory becomes one valid file URI

`databaseFileUri()` removes trailing slashes, recognizes an absolute raw
platform path by its leading slash, and prefixes it with exactly `file://`.
Android's native
`/data/user/0/<package>/files/SQLite` directory therefore becomes
`file:///data/user/0/<package>/files/SQLite/<database>`.

Evidence:

- `apps/mobile/src/storage/mobileWorkspaceRepository.ts:24-34`
- `apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts:27-43`

This matches the installed dependency boundary: Expo SQLite's Android module
returns a raw canonical path, while legacy Expo FileSystem takes its real-file
branch only for a `file` URI.

### Existing file URI is preserved

An existing `file:///data/.../SQLite` directory takes the first branch and is
used without a second prefix. Only trailing slashes are removed before the
known database filename is appended.

Evidence:

- `apps/mobile/src/storage/mobileWorkspaceRepository.ts:24-27`
- `apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts:45-54`

### Unsupported schemes fail closed

Directories that are neither an existing `file:///` URI nor an absolute raw
path throw `unsupported SQLite database directory`. The exception is captured
as a typed SQLite namespace failure by the exhaustive deletion loop, and the
unsupported path is never delegated to FileSystem.

Evidence:

- `apps/mobile/src/storage/mobileWorkspaceRepository.ts:24-28,256-272`
- `apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts:56-62`

### Retained-data postcondition remains intact

The deletion loop was not weakened. It always runs `databaseExists()` after
the native delete attempt. A `true` result records
`MobileDataDeletionError("sqlite:<database>", ...)`; a verifier error also
records a typed failure; and the loop proceeds to every current and legacy
database before KV and SecureStore verification.

Evidence:

- `apps/mobile/src/storage/mobileWorkspaceRepository.ts:250-292`
- `apps/mobile/src/storage/mobileWorkspaceRepository.test.ts:275-317`

For additional adversarial evidence, I temporarily ran an adapter-level test
with:

- raw Android directory ending in `/`;
- native deletion returning normally; and
- FileSystem reporting `exists: true` for both database files.

Result: **1 test passed**. The promise rejected with an `AggregateError`
containing the two exact typed namespaces:

- `sqlite:life-steward-workspace-encrypted.db`
- `sqlite:careguardian-caremanual-encrypted.db`

The test also confirmed exactly one `file:///` prefix for both postcondition
calls. The temporary rereview test was removed and is not part of the commit.

## Independent verification

All commands used Node `22.23.2`.

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.test.ts apps/mobile/src/security/clearMobileData.test.ts apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.test.ts
```

Result: **3 files passed; 29 tests passed.**

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.androidAdapter.rereview.test.ts
```

Result: **1 file passed; 1 adversarial test passed.** The temporary test was
then deleted.

```powershell
npm run mobile:typecheck
```

Result: passed (`tsc --noEmit -p apps/mobile/tsconfig.json`).

```powershell
git diff --check de1217057522fe0686c412c748d2e1d0e0eb99af cf8120b8c2245aeb6a63f94e25982914594bca8a
```

Result: passed with no whitespace errors.

The final implementation diff adds only the URI adapter and its regression
test. It adds no dependency, network, analytics, account, medical, or policy
surface.

## Concerns

No source-level concern remains for the reviewed finding. A rebuilt signed APK
must still repeat the fresh-install full-deletion smoke test before release,
because unit tests cannot substitute for the Android native integration check.

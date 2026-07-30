# Task 10 full-data deletion independent review

## Scope

Reviewed implementation commit
`5ad2eb148278b4548647b54a78bd2af36c7c4ccb` and report commit
`9df7b75` against
`task-10-full-delete-fix-brief.md`. The review treated the signed-Android
full-deletion failure as a release-blocking privacy control and inspected the
installed Expo SQLite and Expo FileSystem Android implementations, not only
the injected unit-test harness.

## Verdict

`FAIL`

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| Important | 1 |
| Minor | 0 |

## Findings

### [Important] The postcondition adapter does not pass an Android file URI

Location:

- `apps/mobile/src/storage/mobileWorkspaceRepository.ts:24-28`
- `apps/mobile/node_modules/expo-sqlite/android/src/main/java/expo/modules/sqlite/SQLiteModule.kt:32-34`
- `node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt:122-156`

Evidence:

1. Expo SQLite exposes `defaultDatabaseDirectory` as
   `context.filesDir.canonicalPath + "/SQLite"`, a raw Android path such as
   `/data/user/0/<package>/files/SQLite`; it is not a `file://` URI.
2. `databaseFileExists()` appends the database name to that raw path and passes
   it directly to legacy `FileSystem.getInfoAsync()`.
3. Expo FileSystem only takes the real filesystem branch when
   `Uri.parse(value).scheme == "file"`. A scheme-less value takes the resource
   branch and calls `openResourceInputStream()`, which looks for an Android
   `raw` or `drawable` resource and throws when it cannot find one.
4. Expo SQLite's Android `deleteDatabase()` throws
   `DatabaseNotFoundException` when the file is already absent. The new loop
   correctly catches that native error, but its required postcondition check
   then throws because the path is not a file URI. The loop consequently adds
   typed failures for both SQLite namespaces instead of accepting the absent
   files.

Impact:

The source-level loop is idempotent only with the injected test double. On the
actual Android adapter, a fresh install with no workspace database still
fails `deleteAllKnownData()`, so the signed APK remains locked behind the
`workspace-and-legacy-storage` deletion failure. This fails closed and does
not falsely claim successful erasure, but it does not resolve the
release-blocking full-deletion behavior required by the brief.

Independent adversarial reproduction:

I temporarily added an adapter-level Vitest that mocked the exact raw
`defaultDatabaseDirectory` returned by Android and reproduced legacy
FileSystem's scheme-null behavior. The test expected already-absent databases
to delete successfully:

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.android-adapter.review.test.ts
```

Result: **1 test failed**. `deleteAllKnownMobileData()` rejected with an
`AggregateError` containing two `MobileDataDeletionError` entries:

- `sqlite:life-steward-workspace-encrypted.db`
- `sqlite:careguardian-caremanual-encrypted.db`

Both causes recorded the scheme-less `/data/user/.../files/SQLite/...` path.
The temporary review test was removed after the reproduction and is not part
of the commit.

Required correction:

- Convert the database path to a valid `file://` URI before calling legacy
  `FileSystem.getInfoAsync()`, while safely accepting a directory that may
  already be a file URI.
- Add an adapter-boundary regression test using Android's raw
  `defaultDatabaseDirectory` and assert the exact `file:///data/...` URI passed
  to FileSystem.
- Retain the new postcondition-first success semantics and all typed,
  exhaustive failure behavior.
- Rebuild the signed APK and repeat the fresh/absent full-deletion smoke test.

## Passing evidence

The core deletion loop and injected unit tests otherwise satisfy the five
required behavior cases. Independently rerun on Node `22.23.2`:

```powershell
npx vitest run apps/mobile/src/storage/mobileWorkspaceRepository.test.ts apps/mobile/src/security/clearMobileData.test.ts
```

Result: **2 files passed; 26 tests passed.**

```powershell
npm run mobile:typecheck
```

Result: passed (`tsc --noEmit -p apps/mobile/tsconfig.json`).

```powershell
git diff --check 5ad2eb148278b4548647b54a78bd2af36c7c4ccb^ 9df7b75
```

Result: passed with no whitespace errors.

The implementation does not inspect exception text or codes; it attempts both
database namespaces after failure; it preserves typed namespace reporting;
and it leaves secure-store, legacy KV, inference-release, and higher-level
domain reporting unchanged.

## Concerns

The implementer's green tests mock `databaseExists` as a logical set lookup,
so they cannot validate the production Expo SQLite-to-FileSystem path
contract. The signed-APK deletion retry must remain blocked until the adapter
finding is corrected and independently re-reviewed.

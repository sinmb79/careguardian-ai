# Task 14 brief fix report — round 1/5

- Date: 2026-07-31 (Asia/Seoul)
- Status: `DONE`
- Reviewed input: `task-14-final-android-candidate-review.md` at `ec3175e`
- Fixed brief commit: `c1ecdb77dbe725e5595e9b8443a32745b6eeb9dd`

## Fixes applied

1. **Composite full-delete proof** — The task now mandates three separate
   signed-APK deletion variants: empty workspace; saved workspace plus a
   scheduled notification and paused 0.5B partial; and installed/loaded 0.5B
   plus scheduled notification. Each requires a cold restart and explicit
   absence checks for current/legacy SQLCipher data, SecureStore keys, model
   metadata/files/partials/temp/backups, scheduled notifications, and native
   inference residuals. Every remaining item or typed delete error is a
   release blocker.
2. **Immutable candidate identity** — `CANDIDATE_SHA` is now selected only
   after independent reviews and is a before/after-clean invariant for the
   ASCII checkout, local APK, merged manifest, capture-only parent/diff, EAS
   source attestation, AAB, APKS, and evidence report. The brief requires EAS
   build metadata containing source revision/profile/project/timestamp; lack
   of source attestation blocks AAB-to-source identity.
3. **Local APK release attestation** — The task now requires `apksigner
   verify --verbose --print-certs`, signing-scheme and certificate digest
   recording, debug-certificate rejection, and binding of the APK SHA and
   merged-manifest SHA to APK manifest and installed-package facts including
   package/version, target SDK 36, `debuggable=false`, and
   `allowBackup=false`.
4. **Cleanup safety** — Temporary cleanup now requires exact literal target
   resolution/validation, content listing, and a task-created directory under
   the dedicated temporary artifact root. Globs, broad parents, source
   worktrees, user files, and final evidence artifacts are prohibited.

## Verification

```powershell
git diff --cached --check
```

Result: PASS. Only the Task 14 brief was staged for the fix commit. Existing
uncommitted Android manifest/test changes from other agents were left
untouched and unstaged.

## Scope and concerns

This round changes the SDD execution contract only; it changes no product
source, dependencies, generated Android files, Play Console state, or GitHub
state. The strengthened brief still correctly leaves physical Samsung/Pixel
proof as a real-data/general-release gate, not a fabricated prerequisite or
claim for the synthetic private test.

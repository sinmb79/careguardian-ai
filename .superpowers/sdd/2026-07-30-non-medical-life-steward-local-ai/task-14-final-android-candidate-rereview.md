# Task 14 final Android candidate independent rereview — round 1/5

Review date: 2026-07-31 (Asia/Seoul)

Reviewed inputs:

- prior review: `ec3175efd6f4ec51ad5e68522251d2e2ef063a40`
- corrected brief: `c1ecdb77dbe725e5595e9b8443a32745b6eeb9dd`
- implementer fix report: `cdaba531c29c86a7580e5a618cc4f739f1f747e5`

## Verdict: PASS

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| Important | 0 |
| Minor | 0 |

All three prior Important findings are closed as executable candidate gates.
The revised brief does not claim that the tests have already run; it correctly
requires the eventual Task 14 evidence to prove every result.

## Closure verification

### Immutable candidate identity and EAS attestation

The brief now makes `CANDIDATE_SHA` an explicit pre-build input selected after
review gates, rather than an observation from a moving branch. It requires
`HEAD == CANDIDATE_SHA` and a clean porcelain status both before and after
each native-generation stage, and binds the same value to the normal ASCII
checkout, APK, merged manifest, capture-only parent/diff, EAS metadata, AAB,
APKS, and final report.

The EAS check is appropriately fail-closed: build details/metadata must attest
the source revision, profile, project ID, and timestamp; inability to attest
`CANDIDATE_SHA` blocks AAB-to-source identity. The capture-only worktree is
also constrained to have that parent and its sole intentional source/config
difference is the named `FLAG_SECURE` control, never an upload directory.

### Signed local APK identity

The corrected checklist requires `apksigner verify --verbose --print-certs`
for the exact SHA-256-named APK, recording enabled schemes and certificate
digest and rejecting the Android debug certificate or an unexpected signer.
It additionally binds that hash to APK-manifest and installed-package facts
using `pm path`, `dumpsys package`, and launcher resolution: package,
`1.1.0 (7)`, target SDK 36, `debuggable=false`, and `allowBackup=false`.
It correctly keeps this local signing proof separate from Play App Signing and
retains downloaded-AAB/APKS inspection and cold launch as independent gates.

### Composite full deletion and cold restart

Three independently fresh signed-APK variants are now mandatory:

1. empty-install full delete followed by cold restart;
2. an explicitly saved synthetic workspace with a future local reminder and
   paused approved 0.5B partial download, followed by full delete and cold
   restart; and
3. loaded verified 0.5B plus a scheduled reminder, followed by full delete
   and cold restart.

The required postconditions cover current/legacy SQLCipher state, SecureStore
keys, workspace data, scheduled notifications, model metadata and installed/
partial/temp/backup files, and inference residue. Any typed deletion error or
survivor blocks release. This closes the previous invalid inference from
separate cancel/remove actions to full-delete behaviour.

## Additional acceptance pressure checks

The brief still requires all of the following without contradiction:

- ASCII-only clean checkout with portable Node 22, JBR 21, SDK/API 36,
  `npm ci`, root verification, Android release gate, clean prebuild, and
  semantic Gradle merged-manifest verification;
- separate x86_64 signed APK emulator evidence and production multi-ABI AAB
  inspection, including arm64-v8a/x86_64 llama libraries, CPU-only scope,
  permissions, backup/debug/development status, and no FCM/FID/push surface;
- NAVER 0.5B pause/resume/SHA/load/Korean generation/cancel/delete and the
  explicit user-approval boundary;
- exact privacy-policy and Hugging Face privacy-link outcomes, bounded
  network/crash evidence, and honest method limitations;
- a capture-only, never-uploaded temporary build with retained `FLAG_SECURE`
  proof for normal production, eight actual Android synthetic screenshots
  (4 phone, 2 7-inch, 2 10-inch), validation, dimensions, opaque format,
  size, source, device profile, and SHA-256 records;
- final EAS AAB download/hash, bundletool APKS generation, x86_64 install and
  cold launch, plus static parity failure if APK/AAB facts diverge; and
- no fabricated Samsung/Pixel coverage. Physical-device validation remains a
  prerequisite for sensitive-data/general-release work, not a false claim or
  a synthetic-private-test submission prerequisite.

Cleanup is now safely limited to literal, resolved, content-listed,
task-created directories beneath a dedicated temporary artifact root. It
forbids globs, broad parents, source worktrees, user files, and final
artifacts, which is sufficient to prevent destructive cleanup scope creep.

## Disposition

The Task 14 brief is ready for execution. Its final status must remain
`BLOCKED` if any required runtime artifact, source-attestation, deletion,
signing, screenshot, or AAB/APKS evidence is absent or mismatched.
No product or brief source was changed by this review.

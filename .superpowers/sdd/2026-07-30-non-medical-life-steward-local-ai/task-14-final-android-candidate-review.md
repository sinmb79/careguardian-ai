# Task 14 final Android candidate independent review

Review date: 2026-07-31 (Asia/Seoul)

Reviewed brief: `d6985c9` —
`task-14-final-android-candidate-brief.md`

Related current reviewed source includes the subsequent manifest namespace
hardening at `cde907eaedf8f88e1886ef396a0c23eb3692954a`. This review does not
approve an arbitrary moving branch tip as the release candidate.

## Verdict: FAIL

The brief is strong on the ASCII checkout, AAB/APKS installation, actual
Android rendering, capture-only isolation, model lifecycle, exact links, and
physical-device honesty. It has three Important evidence gaps that could let a
candidate be called releasable without proving the complete privacy-critical
deletion behaviour or the identity of the binary actually tested/uploaded.

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| Important | 3 |
| Minor | 0 |

## Important findings

### 1. Full-delete is not required to erase a scheduled reminder and installed/partial model in the same real-APK scenario

The brief requires an empty-install full delete and a saved-workspace full
delete, and tests local-notification cancellation and model deletion as
separate flows. It does not require invoking the **full-delete action** after
there is a scheduled notification and after the approved 0.5B model is either
installed or paused with a partial file.

That is insufficient for the product's stated full-data-deletion guarantee:
the likely cross-domain regressions are precisely stale scheduled notices,
model files/partial downloads, model metadata, and inference resources that
survive workspace deletion. A separately successful `cancel` or
`removeModel` action does not prove that the full-delete coordinator calls it.

Required correction:

1. In one fresh signed-APK scenario, create and explicitly save a synthetic
   workspace task with a future local notification, start a 0.5B download and
   retain a paused partial file, then invoke full delete. Verify after a cold
   restart that the workspace/database/key state, scheduled notification,
   partial model file/state, and model metadata are absent.
2. In a second signed-APK scenario, install and load the verified 0.5B model,
   schedule a synthetic reminder, invoke full delete, then cold restart and
   prove the model cannot load without reinstall and no reminder remains.
3. Treat every typed deletion error and every remaining scheduled item or
   model-state/file as a release blocker. Record the exact synthetic values,
   package state checks, and commands in the final evidence document.

### 2. The candidate SHA is described but not pinned as an input/output invariant across local APK and EAS AAB

“Start from the final reviewed branch SHA only” and later “record exact source
commit” do not name or mechanically enforce a single immutable SHA. The
currently reviewed work was still receiving manifest hardening after the
brief's commit, so a builder can legitimately choose a different moving tip
for the local APK, capture build, and EAS submission while recording each one
afterwards. That breaks the requested final-SHA fixation and makes the local
APK/AAB comparison non-decisive.

Required correction:

1. Add a `CANDIDATE_SHA` value selected only after all current independent
   reviews pass. At every build stage, require `git rev-parse HEAD` to equal
   that value and `git status --porcelain` to be empty before and after native
   generation; otherwise stop rather than silently refreshing the candidate.
2. Record the same SHA in the APK, capture-only diff evidence, EAS submission
   metadata/build details, downloaded-AAB evidence, and final handoff. If EAS
   cannot attest that source revision, document the limitation and mark the
   AAB-to-source identity blocked rather than infer it from the local tree.
3. Allow the capture-only worktree to differ solely in the explicitly named
   `FLAG_SECURE` control, while proving its parent is `CANDIDATE_SHA`; do not
   let it become the EAS upload directory.

### 3. “Signed x86_64 production release APK” lacks a required signer and release-variant attestation

The task calls for a signed release APK and asks for package/version/manifest
inspection, but it never requires `apksigner verify --print-certs` (or
equivalent) and an explicit assertion that the installed APK is the release,
non-debuggable artifact. A Gradle `assembleRelease` output can still be
misidentified, or use an unintended debug/default key in a local environment.
The later EAS AAB is separately inspected, so this gap specifically weakens
the claimed real-APK functional evidence.

Required correction:

1. Before installation, run and record `apksigner verify --verbose
   --print-certs` for the exact SHA-256-named APK; record certificate SHA-256
   and verify all required signing schemes. Assert it is not the known Android
   debug certificate.
2. Inspect the installed package (`dumpsys package`/`pm path` and resolved
   activity) and the APK manifest to bind package
   `com.sinmb.careguardianai`, version `1.1.0 (7)`, target SDK 36,
   `android:debuggable=false`, and `allowBackup=false` to that same APK hash.
3. Keep this local signing evidence distinct from Google Play App Signing; the
   production EAS AAB/APKS inspection remains mandatory and must not inherit a
   claim from the local APK.

## Items that satisfy the brief review

| Requirement | Review result |
| --- | --- |
| ASCII clean checkout, Node 22/JBR 21/SDK 36, root and native gates | covered, with before/after clean-state requirement |
| x86_64 release APK versus multi-ABI production AAB | covered distinctly |
| semantic Gradle merged-manifest verification and local-only notification contract | covered |
| exact privacy and Hugging Face links, clean-run crash evidence, bounded network claim | covered with limitation reporting |
| 0.5B pause/resume/SHA/load/Korean generation/cancel/delete and approval boundary | covered |
| capture-only `FLAG_SECURE` exception, 4 + 2 + 2 Android-native synthetic assets, dimensions/opaque/size/SHA | covered |
| EAS finished AAB, SHA, bundletool/APKS/x86_64 install/cold launch, static parity check | covered |
| Samsung/Pixel non-claim and synthetic-test-only boundary | covered |
| exact verified temporary-directory cleanup | covered; no broad worktree/user-file deletion is authorized |

## Required disposition

Do not start Task 14 as `DONE` until the three corrections above are added to
the task brief (or an equally binding execution checklist) and independently
re-reviewed. No product source was modified in this review.

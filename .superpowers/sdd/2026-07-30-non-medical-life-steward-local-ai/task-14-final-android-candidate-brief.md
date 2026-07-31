# Task 14: final Android `1.1.0 (7)` candidate evidence

## Purpose

Produce a reproducible final Android candidate evidence set for the
non-medical, local-first `생활후견 AI` / `Life Steward AI` private test. This
task validates the reviewed source as an Android deliverable; it does not
change product behavior, upload to Google Play, publish GitHub Pages, or push
Git branches.

The resulting evidence must be sufficient to decide whether the synthetic,
non-sensitive closed test may be submitted. It must not claim physical-device
coverage that was not actually performed.

## Preconditions and boundaries

- Start from the final reviewed branch SHA only. Preserve all other agents'
  changes and do not overwrite a dirty main or worktree checkout.
- The product identity is fixed: package `com.sinmb.careguardianai`, EAS
  project `15b9e293-b631-4b77-8cfc-9937cd604dd4`, display name `생활후견 AI`,
  version `1.1.0`, and Android `versionCode 7`.
- Retain the non-medical, no-account, no-ad, no-analytics, no-cloud-AI,
  CPU-only model scope. Do not weaken policy/static/manifest gates to make a
  build pass.
- Test only synthetic, non-sensitive schedule/list/note/checklist data. Do
  not use personal, health, medication, credential, contact, or location
  data.
- Google Play upload/publication and GitHub push/Pages deployment are outside
  this task. Record only artifacts and facts that those later steps need.

## Candidate identity invariant

Select one immutable `CANDIDATE_SHA` only after all source and independent
review gates have passed. It is an explicit input to this task, not an
after-the-fact value recorded from a moving branch tip.

- Before every source build, require `git rev-parse HEAD` to equal
  `CANDIDATE_SHA` and `git status --porcelain` to be empty. Repeat both checks
  after prebuild/native generation. Any mismatch or generated drift stops the
  candidate; do not refresh the SHA or silently use a newer checkout.
- Bind `CANDIDATE_SHA` to the ASCII source checkout, signed local APK,
  generated merged manifest, normal production source, EAS submission/build
  metadata, downloaded AAB, bundletool APKS, and final evidence document. A
  hash/source mismatch invalidates the candidate rather than being explained
  away by equivalent version numbers.
- The capture-only worktree must be based on `CANDIDATE_SHA` and may differ
  only in the named `FLAG_SECURE` control. Preserve the parent SHA and exact
  single-file/single-diff proof; it is never the EAS upload directory.
- Obtain EAS source attestation from submitted build details/metadata (the
  source commit/revision, build profile, project ID, and submission timestamp)
  and retain the exported metadata or API/CLI output beside the AAB evidence.
  If EAS cannot attest the submitted source revision as `CANDIDATE_SHA`, mark
  AAB-to-source identity `BLOCKED`; local checkout state is not a substitute.

## Reproducible build environment

1. Create or refresh an ASCII-only temporary worktree from the exact candidate
   commit, and prove it is clean before and after native generation. Do not
   build from a Korean-path checkout when testing native tooling.
2. Use the portable Node.js 22 runtime, Android Studio JBR 21, and Android SDK
   platform/API 36 explicitly. Record their resolved paths and versions.
3. In the ASCII worktree run `npm ci`, then the complete root verification
   suite. Run the Android release gate as well, including all source policy,
   model, static, audit, workflow, type, and native contract checks.
4. Run a clean Expo prebuild. Confirm generated values still match the fixed
   identity/version and that the worktree has no generated drift when the
   command completes.
5. Build a signed x86_64 production release APK for emulator QA. Retain the
   APK path and SHA-256 outside Git; do not silently substitute a debug or
   Expo Go artifact. Before installing it, run `apksigner verify --verbose
   --print-certs` on that exact SHA-256-named file, record all enabled signing
   schemes and certificate SHA-256, and reject the known Android debug
   certificate or any unexpected signer.

## Generated Android contract and static inspection

Run the semantic release merged-manifest verifier against the Gradle-produced
release manifest, not a fixture alone. Preserve its path, SHA-256, command,
and result. It must prove the local-notification-only contract:

- only required local notification surfaces remain;
- C2DM, FCM receive/registration/init/discovery, Firebase Messaging,
  Installations and transport registrars, and launcher badge permissions are
  absent;
- the three Firebase/analytics/ad-ID auto-init metadata values remain literal
  `false`; and
- required local notification receiver/activity and boot permissions remain.

Inspect the signed APK and final AAB/APKS for all of the following:

- package, version name/code, target SDK 36, `allowBackup=false`, release
  non-debuggable state, and absence of development launcher/menu surfaces;
- arm64-v8a and x86_64 llama native libraries in the production AAB;
- CPU-only configuration (`n_gpu_layers: 0`) and no NPU/OpenCL claim;
- no AD_ID, external-storage, Health Connect, microphone, camera, contact,
  location, SMS, or unexpected sensitive permissions;
- no FCM/FID/remote-push components, tokens, or manifest entry points; and
- only the fixed HTTPS model artifact paths are represented by the approved
  model registry.

For the local APK specifically, bind the artifact hash to the tested install:
inspect the APK manifest and use `pm path`, `dumpsys package`, and resolved
launcher activity after install to record package `com.sinmb.careguardianai`,
version `1.1.0 (7)`, target SDK 36, `android:debuggable=false`, and
`allowBackup=false`. Record the APK SHA-256, merged-manifest SHA-256, signer
certificate digest, and installed package facts in one evidence row. This is
local signing evidence only; it must not be confused with Google Play App
Signing evidence for the EAS AAB.

## Emulator functional QA

Use a clean x86_64 Android emulator. Fresh-install the signed release APK,
launch it cold, and record Android version/device ABI, package version, and
the first-launch result. Re-run cold launch after the important destructive
flows below.

1. **Workspace and deletion**
   - From an empty install, exercise the full-delete action as its own variant,
     cold restart, and prove it returns to a clean usable state. Verify zero
     app-owned SQLCipher/current-and-legacy database state, SecureStore keys,
     model/partial/temp/backup files, scheduled notifications, and native
     inference state remain; record the exact package-state checks used.
   - In a second fresh signed-APK variant, create and explicitly save a
     synthetic task/list workspace with a future local notification, start the
     approved 0.5B download, pause it while its partial file is retained, then
     invoke the **full-delete action**. Cold restart and prove that the
     workspace/database/current-and-legacy state, SecureStore keys, scheduled
     notification, model metadata, partial/temp/backup file, and inference
     residual are all absent.
   - In a third fresh signed-APK variant, install and load the verified 0.5B
     model, schedule a synthetic local reminder, invoke full delete, and cold
     restart. Prove the model cannot load without an explicit reinstall and no
     scheduled reminder remains. This composite run, not separate `cancel` or
     `removeModel` successes, is the deletion proof.
   - Treat every typed deletion error, remaining scheduled item, model state,
     model/partial/temp/backup file, workspace row, legacy persistence value,
     key, or live inference context as a release blocker. Record exact
     synthetic values, postconditions, commands, and cold-restart observations
     in the final evidence document.
2. **Local notifications**
   - Grant the Android notification permission where required; schedule a
     synthetic local reminder, observe the displayed notification, cancel it,
     and prove it is no longer scheduled/displayed.
   - Record any emulator limitation (for example, lock-screen policy) rather
     than inferring physical-device behavior.
3. **0.5B local model path**
   - Use only the approved NAVER 0.5B artifact. Start the download, pause it,
     resume it, verify final byte size and SHA-256, load it, and generate a
     short Korean non-medical synthetic checklist or memo rewrite.
   - Exercise generation cancel and model deletion; confirm a later load is
     unavailable until an explicit reinstall.
   - Observe the user-approval boundary: generated output is not committed to
     workspace data before the explicit save/approval action.
4. **Links, crash, and network boundary**
   - Open the app privacy-policy link and the Hugging Face privacy link; record
     their exact URLs and successful/open-failed state.
   - Collect crash/ANR evidence (logcat and relevant system process state) for
     the above scenario. A clean run is evidence, not a guarantee of absence.
   - Observe network activity across fresh launch, workspace use, notification
     use, model download, local inference, and deletion. The model download may
     reach the fixed Hugging Face artifact host; prompts, outputs, workspace
     data, FCM/FID, push-token, analytics, and other unexpected endpoints must
     not appear. Record method/tool limitations precisely.

## Android-native Play screenshots

Production retains screen-capture protection (`FLAG_SECURE`). For Play assets
only, create a separate temporary **capture-only** native build whose single
intentional source/configuration difference is disabling that capture flag.

- Do not upload, distribute, or call the capture-only build a production
  candidate.
- Diff and preserve proof that the capture-only change is limited to the
  capture flag. Rebuild the normal production candidate with `FLAG_SECURE`
  intact after captures.
- Use the same reviewed source, fixed identity, and synthetic data. Capture
  four phone screenshots, two 7-inch tablet screenshots, and two 10-inch
  tablet screenshots from actual Android rendering; replace/prepare only
  assets that meet Play dimensions, opaque color/format, and file-size rules.
- Screens must show ordinary life tasks/lists/notes/model controls and no
  medical or health-shaped language. Record device profile/resolution,
  screenshot source, SHA-256, and image validation results.
- Remove or isolate temporary capture build outputs after retaining the
  reproducible command/evidence. Never leave a capture-disabled artifact in
  the release upload location.

## Production EAS AAB

After local candidate QA passes, initiate a production Android EAS build using
the exact reviewed commit and production profile. `autoIncrement` must remain
off so the source-reviewed `1.1.0 (7)` is the cloud artifact identity.

1. Wait for a finished build; record EAS build ID, source commit, build URL,
   timestamps, and any warnings.
2. Download the actual `.aab`, calculate SHA-256, and retain it in a clearly
   identified non-Git artifact location.
3. Use bundletool to inspect the AAB, generate APKS for an x86_64 emulator,
   install the resulting split set, and cold-launch it. This installation is
   the final proof that the uploaded AAB rather than only the local APK is
   installable.
4. Re-run artifact static inspection on the downloaded AAB/APKS. If any local
   APK and cloud AAB fact differs, stop and mark the candidate blocked.

## Evidence and cleanup

Create/update one honest final evidence document under
`docs/security/android-aab-evidence-2026-07-30.md` with:

- immutable `CANDIDATE_SHA`, tools/versions, commands, environment/device
  profiles, and all before/after clean-state checks;
- APK/AAB/APKS/merged-manifest/screenshot paths and SHA-256 values;
- APK signer verification output/certificate SHA-256, APK manifest facts, and
  installed-package binding; EAS source-attestation metadata and its relation
  to `CANDIDATE_SHA`;
- pass/fail results for every acceptance item, including explicit test data;
- notification, model, deletion, approval, link, crash, and network evidence;
- residual dependencies/permissions/components actually present, if any;
- capture-only exception and proof that production retains `FLAG_SECURE`; and
- EAS build ID/status plus the clear distinction between local APK and cloud
  AAB evidence.

Clean only exact, verified temporary directories and emulator helper packages
created for this task. Before any cleanup, resolve and validate each literal
target path as a task-created directory beneath the dedicated temporary
artifact root, list its contents, and record that validation. Do not use
globs, computed broad parents, source worktrees, user-owned files, or the
final AAB/evidence artifact as deletion targets. Preserve enough command
output to reproduce each assertion.

## Acceptance criteria

Task 14 is `DONE` only when all of the following are true:

1. One immutable `CANDIDATE_SHA` binds the clean ASCII checkout, normal local
   APK/merged manifest, capture-only parent/diff proof, EAS source attestation,
   downloaded AAB, APKS, and final report; any mismatch is discarded/blocked.
2. ASCII-worktree `npm ci`, full `npm run verify`, Android release gate,
   clean prebuild, signed APK build, and semantic merged-manifest verifier
   pass without unexplained generated drift.
3. The signed local APK has verified non-debug signing schemes/certificate and
   is bound by hash to its manifest and installed release package
   (`debuggable=false`); it completes cold launch, empty full-delete, partial
   download plus notification composite full-delete, installed/loaded model
   plus notification composite full-delete, local notification
   schedule/display/cancel, the 0.5B pause/resume/SHA/load/Korean
   inference/cancel/delete path, and exact privacy/Hugging Face link checks
   without a release-blocking crash.
4. Eight valid Android-native synthetic screenshots exist (4 phone, 2 tablet
   7-inch, 2 tablet 10-inch), with documented capture-only isolation; the
   production candidate still protects screenshots.
5. A finished EAS production AAB is downloaded, hashed, bundletool-inspected,
   converted to APKS, installed, and cold-launched; it passes all package,
   version, ABI, CPU-only, backup/debug/development, permission, and
   FCM/remote-push absence checks.
6. The final evidence document is committed and contains no unsupported claim.
   In particular, there is **no claim of Samsung or Pixel physical-device
   validation** unless it was actually run. Their evidence remains required
   before real personal/sensitive data or general release, but is not a
   precondition for submission of the synthetic closed test.

## Handoff

Report `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`, the evidence-document
commit SHA, final AAB SHA-256, EAS build ID/status, and every remaining
external gate. Do not perform Google Play or GitHub actions as part of this
task.

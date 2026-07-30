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
   Expo Go artifact.

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

## Emulator functional QA

Use a clean x86_64 Android emulator. Fresh-install the signed release APK,
launch it cold, and record Android version/device ABI, package version, and
the first-launch result. Re-run cold launch after the important destructive
flows below.

1. **Workspace and deletion**
   - From an empty install, exercise the full-delete action and prove it
     returns to a clean usable state without crash or stale scheduled notice.
   - Create and explicitly save a synthetic task/list workspace, then full
     delete it. Verify the created workspace does not reappear after restart.
   - Treat any typed full-delete failure as a release blocker; do not turn it
     into a success claim merely because part of the cleanup ran.
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

- exact source commit, tools/versions, commands, environment/device profiles;
- APK/AAB/APKS/merged-manifest/screenshot paths and SHA-256 values;
- pass/fail results for every acceptance item, including explicit test data;
- notification, model, deletion, approval, link, crash, and network evidence;
- residual dependencies/permissions/components actually present, if any;
- capture-only exception and proof that production retains `FLAG_SECURE`; and
- EAS build ID/status plus the clear distinction between local APK and cloud
  AAB evidence.

Clean only exact, verified temporary directories and emulator helper packages
created for this task. Do not delete source worktrees, user-owned files, or
the final AAB/evidence artifact. Preserve enough command output to reproduce
each assertion.

## Acceptance criteria

Task 14 is `DONE` only when all of the following are true:

1. ASCII-worktree `npm ci`, full `npm run verify`, Android release gate,
   clean prebuild, signed APK build, and semantic merged-manifest verifier
   pass without unexplained generated drift.
2. A freshly installed signed APK completes cold launch, empty/full deletion,
   created-workspace deletion, local notification schedule/display/cancel,
   the 0.5B pause/resume/SHA/load/Korean inference/cancel/delete path, and
   exact privacy/Hugging Face link checks without a release-blocking crash.
3. Eight valid Android-native synthetic screenshots exist (4 phone, 2 tablet
   7-inch, 2 tablet 10-inch), with documented capture-only isolation; the
   production candidate still protects screenshots.
4. A finished EAS production AAB is downloaded, hashed, bundletool-inspected,
   converted to APKS, installed, and cold-launched; it passes all package,
   version, ABI, CPU-only, backup/debug/development, permission, and
   FCM/remote-push absence checks.
5. The final evidence document is committed and contains no unsupported claim.
   In particular, there is **no claim of Samsung or Pixel physical-device
   validation** unless it was actually run. Their evidence remains required
   before real personal/sensitive data or general release, but is not a
   precondition for submission of the synthetic closed test.

## Handoff

Report `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`, the evidence-document
commit SHA, final AAB SHA-256, EAS build ID/status, and every remaining
external gate. Do not perform Google Play or GitHub actions as part of this
task.

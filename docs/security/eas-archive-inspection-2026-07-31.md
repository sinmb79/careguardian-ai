# EAS archive contamination remediation evidence — 2026-07-31

## Scope

This evidence records the local, non-billed EAS archive inspection for the Android production profile. It does not start an EAS cloud build, modify application runtime behavior, or submit anything to Google Play.

## Source and command

- Source commit: `150a34858f764da7dd68a7d2eb662cb614171d79`
- EAS CLI: `16.18.0` (invoked through `npx --yes eas-cli@16.18.0`)
- Command: `eas build:inspect -p android -s archive -e production -o <unique-temp-directory> --force`
- Inspected archive directory: `C:\Users\sinmb\AppData\Local\Temp\careguardian-eas-archive-150a348-30b1249091ae4a0da1e5bcefeb99df9c`

## Result

The archive was created successfully with 175 files and 4,608,809 bytes (4.395 MiB). The following paths were checked individually and were absent:

- `apps/mobile/android`
- `apps/mobile/.expo`
- `apps/mobile/node_modules`
- `node_modules`
- `.git`

The root `.easignore` copies every functional root `.gitignore` rule and adds exact directory plus recursive-glob exclusions for generated Android/iOS/Expo/dependency/build/Git directories. It also excludes APK, AAB, log, and TypeScript build-info files. `release:workflow-check` now fails when any required rule is removed.

## Verification

- Focused archive-policy tests: 12 passed
- `npm run verify`: 31 test files / 308 tests passed; build, mobile typecheck, Expo Doctor (18/18), policy, static-security, model, no-remote-push, audit, and workflow gates passed
- `git diff --check`: passed

## Limits

This proves only the local archive composition for the cited source commit. A future production AAB still requires its own exact-source build and binary inspection before upload.

# Task 11: Android local-notification-only hardening

## Context

The application promises local scheduled notifications only and never calls
any remote push-token API. The final Android release merge nevertheless
contains FCM/C2DM startup and receive surfaces pulled in transitively by
`expo-notifications`:

- `com.google.android.c2dm.permission.RECEIVE`
- `expo.modules.notifications.service.ExpoFirebaseMessagingService`
- `com.google.firebase.iid.FirebaseInstanceIdReceiver`
- `com.google.firebase.messaging.FirebaseMessagingService`
- `com.google.firebase.provider.FirebaseInitProvider`
- Firebase component discovery entries for Messaging, Installations, and
  data transport

It also contains launcher badge permissions although the runtime handler
always uses `shouldSetBadge: false` and the product has no badge feature.
Setting Firebase auto-init to false is useful but does not remove these
capability and startup surfaces.

## Goal

Make the generated Android app structurally incapable of receiving remote
push through the bundled Expo notification path while preserving local
one-time scheduling, cancellation, notification display, and reboot/package
replacement restoration.

The source configuration and the **final merged release manifest** must both
be enforced by tests and the native release gate.

## Scope and constraints

- Keep `expo-notifications` for local scheduled notifications.
- Keep the app package, EAS project, version `1.1.0 (7)`, and CPU-only local
  model behavior unchanged.
- Do not add analytics, advertising, accounts, cloud AI, new network hosts,
  or new dependencies.
- Do not remove the local Expo `NotificationsService`,
  `NotificationForwarderActivity`, `POST_NOTIFICATIONS`, `VIBRATE`, or
  `RECEIVE_BOOT_COMPLETED`.
- Keep Firebase messaging/analytics/ad-ID auto initialization explicitly
  disabled as defense in depth.
- Do not claim that a dependency was removed if it remains compiled into the
  artifact. The enforceable goal is removal of remote startup, receive,
  registration, and permission surfaces from the merged manifest.
- Preserve the current fail-closed release gates and exact allowlists.

## Required implementation behavior

1. The local-only notification config plugin must add deterministic Android
   manifest removals for:
   - C2DM receive permission;
   - Expo's Firebase messaging service;
   - Firebase Instance ID receiver;
   - Firebase messaging service;
   - Firebase init provider;
   - Firebase component discovery service, when it only exists for this
     unwanted Firebase graph.
2. Remove all launcher badge permissions contributed by ShortcutBadger,
   because the app neither requests nor displays badge counts.
3. The generated merged release manifest must contain none of the forbidden
   permissions/components/registrars and must still contain the explicitly
   required local-notification receiver/activity and boot permission.
4. The manifest must keep `firebase_messaging_auto_init_enabled=false`,
   `firebase_analytics_collection_enabled=false`, and
   `google_analytics_adid_collection_enabled=false`.
5. Add a native manifest verifier to the existing Android release contract.
   It must read exactly the release merged manifest produced by Gradle and
   fail on:
   - any forbidden remote-push component or permission;
   - any Firebase Messaging/Installations/data-transport registrar or init
     provider;
   - any launcher badge permission;
   - missing required local notification components/permissions; or
   - any of the three disable metadata values being absent or not `false`.
6. The `all` native contract must execute release manifest merge plus this
   verifier. Expose a focused `manifest` contract for fast reproduction.
7. Add mutation/fixture tests that prove each forbidden surface is detected
   and each required local surface or disable flag is required.
8. Keep the source-level non-medical gate aligned so future edits cannot
   silently remove the manifest hardening plugin or its exact removals.

## Functional verification

After a clean Expo prebuild:

- compile/merge the release manifest;
- run the focused manifest verifier;
- build/install an x86_64 release APK;
- schedule a synthetic local notification and verify it appears;
- cancel and verify it is absent;
- if practical in the emulator, exercise the boot/package-replacement
  receiver path without relying on remote push.

The implementation agent may stop after source/native gate verification; the
controller owns the final signed-APK device smoke after all Task 11 changes.

## TDD requirements

Write failing tests/mutations first and record the red evidence. At minimum:

- the current merged-manifest fixture fails because C2DM/FCM surfaces exist;
- removing the local notification receiver fails;
- changing any disable flag to true fails;
- adding one badge permission fails;
- the hardened manifest fixture passes.

Run at minimum:

```powershell
npm run release:policy-check:test
npm run release:policy-check
npm run mobile:typecheck
npm run verify:android-release -- manifest
```

Run `git diff --check`, inspect the final diff, and commit focused changes.

## Report

Write:

`.superpowers/sdd/2026-07-30-non-medical-life-steward-local-ai/task-11-local-notification-hardening-report.md`

Include status, red/green evidence, generated merged-manifest paths, exact
remaining permissions/components, files changed, self-review, concerns, and
commit SHA(s).

# Mobile Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current PWA repository into a shared-core web + Expo mobile workspace that can be tested on Android locally and prepared for iOS cloud deployment.

**Architecture:** Move reusable care logic into a shared package, keep the Vite web app as a demo/distribution surface, and add an Expo mobile app for Android/iOS/iPad delivery. Use native Expo modules only behind platform adapters so web and mobile can evolve without duplicating domain logic.

**Tech Stack:** npm workspaces, TypeScript, Vite, React, Expo, React Native, Vitest, Expo SecureStore, Expo SQLite, Expo Notifications, Expo Speech

---

### Task 1: Workspace Restructure

**Files:**
- Create: `apps/mobile/`
- Create: `apps/web/`
- Create: `packages/care-core/`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing workspace test**

```bash
npm test -- --run
```

Expected: existing tests fail after imports are redirected to non-existent shared package paths.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run`
Expected: FAIL with module resolution errors pointing to `packages/care-core`.

- [ ] **Step 3: Write minimal workspace implementation**

```text
- add npm workspaces
- create shared package package.json + tsconfig
- move or re-export existing domain modules into shared package
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run`
Expected: PASS with shared imports resolved.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore apps packages
git commit -m "refactor: create shared mobile workspace"
```

### Task 2: Web App Rewire

**Files:**
- Modify: `apps/web/src/**/*`
- Modify: `apps/web/package.json`
- Modify: `vite.config.ts` or `apps/web/vite.config.ts`

- [ ] **Step 1: Write the failing web integration test**

```bash
npm --workspace apps/web test -- --run
```

Expected: FAIL until the web app imports the shared package correctly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/web test -- --run`
Expected: FAIL with missing shared module or broken state wiring.

- [ ] **Step 3: Write minimal implementation**

```text
- point the web app to shared care-core imports
- keep web-only adapters for storage and speech
- preserve the current caregiver and companion UI
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace apps/web test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "refactor: rewire web app to shared core"
```

### Task 3: Expo Mobile Scaffold

**Files:**
- Create: `apps/mobile/app/`
- Create: `apps/mobile/src/`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/babel.config.js`

- [ ] **Step 1: Write the failing mobile smoke test**

```tsx
it("renders caregiver mode in the Expo app", () => {
  // render the mobile root
  // expect caregiver copy to exist
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/mobile test -- --run`
Expected: FAIL because the Expo root does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```text
- generate Expo app
- add mobile navigation shell
- render caregiver screen with shared manual model
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace apps/mobile test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: scaffold expo mobile app"
```

### Task 4: Native Adapters

**Files:**
- Create: `apps/mobile/src/storage/mobileManualRepository.ts`
- Create: `apps/mobile/src/voice/mobileSpeech.ts`
- Create: `apps/mobile/src/notifications/medicationNotifications.ts`
- Create: `apps/mobile/src/state/useMobileCareAppState.ts`

- [ ] **Step 1: Write the failing adapter tests**

```tsx
it("persists the care manual through the mobile repository", async () => {
  // save then load through the adapter
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/mobile test -- --run`
Expected: FAIL because native adapters are not implemented.

- [ ] **Step 3: Write minimal implementation**

```text
- secure passphrase storage via SecureStore
- manual cache via SQLite
- notification scheduling from medication items
- speech wrapper around expo-speech
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace apps/mobile test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: add mobile storage speech and notifications"
```

### Task 5: Android Verification + iOS Delivery Prep

**Files:**
- Create: `apps/mobile/eas.json`
- Create: `docs/mobile-delivery.md`
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Write the failing verification checklist**

```text
- Android emulator launch command
- iOS cloud build command
- expected caregiver -> companion flow
```

- [ ] **Step 2: Run verification to expose missing pieces**

Run: `npx expo start --android`
Expected: FAIL until Android SDK/emulator or app config is complete.

- [ ] **Step 3: Write minimal implementation**

```text
- configure EAS
- document Android SDK and emulator requirements
- document iOS cloud-build path from Windows
```

- [ ] **Step 4: Run verification to verify it passes**

Run: `npm test -- --run && npm run build && npm --workspace apps/mobile test -- --run`
Expected: PASS for automated checks, plus Android emulator app launch succeeds locally if SDK is present.

- [ ] **Step 5: Commit**

```bash
git add README.md README.en.md docs apps/mobile/eas.json
git commit -m "docs: add mobile delivery workflow"
```

# CareGuardian AI Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Phase 0 web PWA foundation with local care-manual capture, encrypted storage, caregiver authoring flow, and a simplified daily companion screen.

**Architecture:** Use a Vite + React + TypeScript web app with small domain modules under `src/features/*` and app composition in `src/app/*`. Persist the care manual locally with encrypted JSON storage and derive companion behavior from structured manual context rather than full model inference for this first slice.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Web Crypto, Tailwind CSS, vite-plugin-pwa

---

## File Structure

- `package.json`: project scripts and dependencies
- `tsconfig*.json`: TypeScript configuration for app and Vitest
- `vite.config.ts`: Vite config with PWA support
- `tailwind.config.ts`, `postcss.config.js`: styling pipeline
- `index.html`: web entry
- `src/main.tsx`: app bootstrap
- `src/app/App.tsx`: top-level app shell and mode switching
- `src/app/state/useCareAppState.ts`: local app state orchestration
- `src/features/manual/manualSchema.ts`: care manual types and default document helpers
- `src/features/manual/manualSections.ts`: caregiver input metadata
- `src/features/companion/dailySchedule.ts`: derive daily companion cards from manual
- `src/features/companion/companionEngine.ts`: manual-aware response generation
- `src/features/storage/secureLocalStore.ts`: AES-GCM encrypt/decrypt storage helpers
- `src/features/storage/careManualRepository.ts`: load/save repository API
- `src/features/ui/CaregiverEditor.tsx`: caregiver input flow
- `src/features/ui/CompanionHome.tsx`: companion daily screen
- `src/features/ui/SectionCard.tsx`: shared section UI
- `src/styles/index.css`: theme and Tailwind imports
- `src/test/setup.ts`: test setup
- `src/test/fixtures/manual.ts`: reusable manual fixtures
- `src/**/*.test.ts(x)`: behavior-first tests

### Task 1: Bootstrap The Web App Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `index.html`

- [ ] **Step 1: Add a smoke test target for the planned app entry**

```ts
import { describe, expect, test } from "vitest";

describe("tooling", () => {
  test("test runner is configured", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the smoke test to verify the runner fails before setup**

Run: `npm test -- --run`
Expected: FAIL because Vitest is not installed yet

- [ ] **Step 3: Add the minimal package and config needed for Vite, Vitest, Tailwind, and PWA support**

- [ ] **Step 4: Run the smoke test to verify the tooling passes**

Run: `npm test -- --run`
Expected: PASS with 1 passed test

### Task 2: Define The Care Manual Domain

**Files:**
- Create: `src/features/manual/manualSchema.ts`
- Test: `src/features/manual/manualSchema.test.ts`

- [ ] **Step 1: Write a failing test for default manual creation and required section keys**

```ts
test("createEmptyCareManual returns all Phase 0 sections", () => {
  const manual = createEmptyCareManual();

  expect(manual.subject.name).toBe("");
  expect(Object.keys(manual.sections)).toEqual(
    expect.arrayContaining(["daily_routine", "medication", "communication", "emotional"])
  );
});
```

- [ ] **Step 2: Run the manual schema test to verify it fails**

Run: `npm test -- src/features/manual/manualSchema.test.ts --run`
Expected: FAIL because `createEmptyCareManual` does not exist

- [ ] **Step 3: Implement the minimal care manual types and factory**

- [ ] **Step 4: Re-run the manual schema test**

Run: `npm test -- src/features/manual/manualSchema.test.ts --run`
Expected: PASS

### Task 3: Add Encrypted Local Storage

**Files:**
- Create: `src/features/storage/secureLocalStore.ts`
- Create: `src/features/storage/careManualRepository.ts`
- Test: `src/features/storage/secureLocalStore.test.ts`
- Test: `src/features/storage/careManualRepository.test.ts`

- [ ] **Step 1: Write a failing test for encrypt → decrypt round-trip**

```ts
test("encrypts and decrypts JSON payloads", async () => {
  const encrypted = await encryptJson({ name: "수호" }, "demo-passphrase");
  const decrypted = await decryptJson(encrypted, "demo-passphrase");

  expect(decrypted).toEqual({ name: "수호" });
});
```

- [ ] **Step 2: Run the storage test to verify it fails**

Run: `npm test -- src/features/storage/secureLocalStore.test.ts --run`
Expected: FAIL because encryption helpers do not exist

- [ ] **Step 3: Implement AES-GCM helpers plus repository wrappers for browser localStorage**

- [ ] **Step 4: Re-run the storage tests**

Run: `npm test -- src/features/storage/secureLocalStore.test.ts src/features/storage/careManualRepository.test.ts --run`
Expected: PASS

### Task 4: Build Companion Derivation Logic

**Files:**
- Create: `src/features/companion/dailySchedule.ts`
- Create: `src/features/companion/companionEngine.ts`
- Create: `src/test/fixtures/manual.ts`
- Test: `src/features/companion/dailySchedule.test.ts`
- Test: `src/features/companion/companionEngine.test.ts`

- [ ] **Step 1: Write a failing test for schedule card derivation**

```ts
test("builds schedule cards from manual routines and medication", () => {
  const cards = buildDailyScheduleCards(makeFixtureManual());

  expect(cards[0].title).toContain("아침");
  expect(cards.some((card) => card.kind === "medication")).toBe(true);
});
```

- [ ] **Step 2: Run the schedule test to verify it fails**

Run: `npm test -- src/features/companion/dailySchedule.test.ts --run`
Expected: FAIL because `buildDailyScheduleCards` does not exist

- [ ] **Step 3: Implement minimal schedule derivation and a manual-aware companion reply helper**

- [ ] **Step 4: Re-run the companion tests**

Run: `npm test -- src/features/companion/dailySchedule.test.ts src/features/companion/companionEngine.test.ts --run`
Expected: PASS

### Task 5: Build The Caregiver And Companion UI

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/state/useCareAppState.ts`
- Create: `src/features/manual/manualSections.ts`
- Create: `src/features/ui/CaregiverEditor.tsx`
- Create: `src/features/ui/CompanionHome.tsx`
- Create: `src/features/ui/SectionCard.tsx`
- Create: `src/main.tsx`
- Create: `src/styles/index.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write a failing UI test for switching from caregiver editing to companion view**

```tsx
test("shows companion mode after saving caregiver data", async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText("피돌봄자 이름"), "수호");
  await userEvent.click(screen.getByRole("button", { name: "저장하고 동반자 보기" }));

  expect(screen.getByText("오늘의 돌봄 동반자")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the app UI test to verify it fails**

Run: `npm test -- src/app/App.test.tsx --run`
Expected: FAIL because `App` and UI components do not exist

- [ ] **Step 3: Implement the app shell, caregiver editor, and companion home with the smallest working flow**

- [ ] **Step 4: Re-run the UI test and full suite**

Run: `npm test -- --run`
Expected: PASS

### Task 6: Verify PWA Build

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write a failing expectation that manifest metadata is exposed**

```ts
test("exposes the CareGuardian title", () => {
  expect(document.title).toContain("CareGuardian");
});
```

- [ ] **Step 2: Run the app test to verify it fails for the expected reason**

Run: `npm test -- src/app/App.test.tsx --run`
Expected: FAIL because metadata/bootstrap is incomplete

- [ ] **Step 3: Add manifest metadata, theme tokens, and final shell polish**

- [ ] **Step 4: Run build verification**

Run: `npm run build`
Expected: PASS with generated production assets

### Task 7: Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a concise bilingual README for local run instructions**
- [ ] **Step 2: Run the complete verification set**

Run: `npm test -- --run`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Record remaining Phase 0 gaps**

Remaining gaps to note:
- Real on-device Gemma integration
- STT/TTS device integration
- Push/OS notification delivery
- True SQLite/vector search layer
- Android packaging and install validation

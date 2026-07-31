# 생활후견 AI 비의료 전환 및 로컬 AI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 건강형 CareGuardian AI를 비의료 생활 정리 앱 `생활후견 AI`로 전환하고, 검증된 NAVER 소형 한국어 모델의 온디바이스 실행을 추가해 새 AAB를 Google Play 비공개 테스트에 배포한다.

**Architecture:** `packages/life-core`가 일반 작업공간·사용자 기능·비의료 정책을 소유하고 웹과 Expo 모바일이 공유한다. 모바일은 SQLCipher 저장, 일반 일정 알림, 고정 GGUF 레지스트리, 스트리밍 SHA-256 검증, `llama.rn` CPU 추론을 플랫폼 계층으로 제공한다. 모델이 없거나 실패해도 생활 관리 기능은 독립적으로 동작한다.

**Tech Stack:** TypeScript 5.9, React 19, Vite 7, Vitest 4, Expo SDK 54, React Native 0.81, SQLCipher, SecureStore, Expo FileSystem, llama.rn, EAS Build, Google Play Console

## Global Constraints

- 기존 Play 패키지 `com.sinmb.careguardianai`와 EAS project ID `15b9e293-b631-4b77-8cfc-9937cd604dd4`를 유지한다.
- 표시명은 `생활후견 AI`, 영문명은 `Life Steward AI`, 앱 버전은 `1.1.0`, Android versionCode는 `7` 이상이어야 한다.
- 현재 출시 코드·기본 데이터·스토어 문구에는 복약·투약·증상·질환·알레르기·진단·치료·재활·건강 측정 기능이 없어야 한다.
- 의료 기능을 일반 기능으로 숨기거나 간접 사례로 유도하지 않는다.
- 계정, 광고, 분석 SDK, 클라우드 AI, 사용자 본문 원격 전송, 임의 URL·코드·플러그인 실행을 추가하지 않는다.
- NAVER 0.5B 기본 문맥은 2048, NAVER 1.5B 기본 문맥은 4096이며 동시에 한 모델·한 생성만 허용한다.
- 32비트 ABI에서는 로컬 AI를 활성화하지 않고 첫 비공개 테스트의 추론은 CPU만 사용한다.
- Kakao Kanana 1.5 2.1B는 공식 또는 내부 승인 GGUF가 없으므로 설치 버튼을 비활성화한다.
- 기존 건강형 백업과 데이터를 새 스키마로 자동 마이그레이션하지 않는다.
- 사용자 소유 미추적 경로 `.claude/`는 열거나 수정하거나 커밋하지 않는다.

---

### Task 1: 비의료 공용 코어

**Files:**
- Create: `packages/life-core/package.json`
- Create: `packages/life-core/src/model.ts`
- Create: `packages/life-core/src/extensions.ts`
- Create: `packages/life-core/src/policy.ts`
- Create: `packages/life-core/src/index.ts`
- Test: `packages/life-core/src/model.test.ts`
- Test: `packages/life-core/src/extensions.test.ts`
- Test: `packages/life-core/src/policy.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `PersonalWorkspace`, `LifeList`, `LifeRecord`, `LifeTask`, `LifeReminder`, `FieldDefinition`, `ExtensionDefinition`
- Produces: `createEmptyWorkspace(now?: string): PersonalWorkspace`
- Produces: `validateWorkspace(input: unknown): ValidationResult<PersonalWorkspace>`
- Produces: `validateExtension(input: unknown): ValidationResult<ExtensionDefinition>`
- Produces: `detectRestrictedHealthIntent(input: string): PolicyDecision`

- [ ] **Step 1: 공용 코어의 실패 테스트 작성**

```ts
expect(createEmptyWorkspace("2026-07-30T00:00:00.000Z")).toMatchObject({
  schemaVersion: 1,
  lists: [],
  tasks: [],
  extensions: []
});
expect(detectRestrictedHealthIntent("약 먹을 시간 알려줘").allowed).toBe(false);
expect(detectRestrictedHealthIntent("외출 준비물 목록").allowed).toBe(true);
expect(validateExtension({
  id: "trip",
  title: "외출 준비",
  fields: [{ id: "bag", label: "준비물", kind: "text" }],
  automations: [{ trigger: "manual", action: "createTask" }]
}).ok).toBe(true);
```

- [ ] **Step 2: 테스트가 구현 부재로 실패하는지 확인**

Run: `npx vitest run packages/life-core/src/model.test.ts packages/life-core/src/extensions.test.ts packages/life-core/src/policy.test.ts`

Expected: 새 모듈을 찾지 못해 FAIL.

- [ ] **Step 3: 엄격한 타입과 런타임 검증 구현**

```ts
export type FieldKind =
  | "text" | "longText" | "number" | "date"
  | "time" | "choice" | "boolean" | "fileReference";

export type AutomationTrigger = "manual" | "scheduled" | "fieldChanged";
export type AutomationAction = "showNotification" | "createTask" | "copyText";
export type AiAction = "summarize" | "rewriteText" | "suggestTitle" | "draftChecklist";

export type PolicyDecision = {
  allowed: boolean;
  reasonCode?: "restricted_health_intent";
  message?: string;
};
```

검증기는 알 수 없는 키를 거부하고 문자열 길이, 배열 개수, `HH:mm`, ISO 날짜, ID 문자 집합을 제한한다. 정책 검사는 Unicode NFKC 정규화, 공백·구두점 제거, 한국어·영문 의료어 패턴을 함께 사용한다.

루트 `package.json`에는 기존 care-core 의존성을 일시 유지한 채 `"@life-steward/life-core": "file:packages/life-core"`를 함께 추가한다. Task 4에서 모든 소비자가 전환된 뒤 care-core 의존성을 제거한다.

- [ ] **Step 4: 공용 코어 테스트 실행**

Run: `npx vitest run packages/life-core/src`

Expected: PASS.

- [ ] **Step 5: 공용 코어 커밋**

```powershell
git add -- package.json packages/life-core
git commit -m "feat: 비의료 생활 관리 공용 코어 추가"
```

### Task 2: 모바일 생활 작업공간과 일반 알림

**Files:**
- Create: `apps/mobile/src/state/useLifeWorkspace.ts`
- Create: `apps/mobile/src/storage/mobileWorkspaceRepository.ts`
- Create: `apps/mobile/src/notifications/lifeNotifications.ts`
- Create: `apps/mobile/src/ui/LifeWorkspaceScreen.tsx`
- Create: `apps/mobile/src/ui/ExtensionBuilderScreen.tsx`
- Create: `apps/mobile/src/test/fixtureWorkspace.ts`
- Test: `apps/mobile/src/storage/mobileWorkspaceRepository.test.ts`
- Test: `apps/mobile/src/notifications/lifeNotifications.test.ts`
- Test: `apps/mobile/src/state/useLifeWorkspace.test.ts`
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/src/security/clearMobileData.ts`
- Modify: `apps/mobile/src/security/privacyGate.ts`
- Delete: `apps/mobile/src/ui/MobileCaregiverScreen.tsx`
- Delete: `apps/mobile/src/ui/MobileCompanionScreen.tsx`
- Delete: `apps/mobile/src/state/useMobileCareAppState.ts`
- Delete: `apps/mobile/src/state/mobileCareSaveFlow.ts`
- Delete: `apps/mobile/src/storage/mobileManualRepository.ts`
- Delete: `apps/mobile/src/notifications/medicationNotifications.ts`
- Delete: `apps/mobile/src/notifications/notificationSchedule.ts`
- Delete: health-shaped mobile tests and fixtures replaced above

**Interfaces:**
- Consumes: `PersonalWorkspace`, `ExtensionDefinition`, `validateExtension`
- Produces: `loadWorkspace()`, `saveWorkspace(workspace)`, `deleteWorkspace()`
- Produces: `syncLifeNotifications(tasks)`, `cancelAllLifeNotifications()`
- Produces: `useLifeWorkspace(): LifeWorkspaceState`

- [ ] **Step 1: 저장·일반 알림·삭제 실패 테스트 작성**

```ts
it("stores a workspace without health-shaped fields", async () => {
  await saveWorkspace(fixtureWorkspace);
  await expect(loadWorkspace()).resolves.toEqual(fixtureWorkspace);
});

it("uses a generic private notification payload", async () => {
  const request = buildLifeNotification(fixtureWorkspace.tasks[0]);
  expect(request.content.title).toBe("생활 일정 알림");
  expect(JSON.stringify(request)).not.toMatch(/약|복약|질환|치료/);
});
```

- [ ] **Step 2: 모바일 대상 테스트가 실패하는지 확인**

Run: `npx vitest run apps/mobile/src/storage apps/mobile/src/notifications apps/mobile/src/state`

Expected: 새 생활 모듈 부재로 FAIL.

- [ ] **Step 3: 기존 SQLCipher·SecureStore 보안 경계를 재사용해 생활 저장 구현**

DB 키 수명주기, 기기 인증, 백그라운드 잠금, 화면 캡처 차단은 유지한다. 이전 스키마가 발견되면 자동 변환하지 않고 `이전 테스트 데이터 삭제 후 시작` 화면을 제공한다.

모바일 workspace에는 `"@life-steward/life-core": "file:../../packages/life-core"`를 추가하되 Task 4 전까지 기존 care-core dependency를 함께 유지한다.

- [ ] **Step 4: 모바일 화면과 일반 알림 구현**

초기 화면은 `오늘`, `목록`, `기능 만들기`, `로컬 AI`, `설정`의 다섯 진입점을 제공한다. 알림 payload에는 사용자 메모 본문을 넣지 않고 일반 제목과 task ID만 둔다.

- [ ] **Step 5: 모바일 테스트와 타입검사 실행**

Run: `npx vitest run apps/mobile/src`

Run: `npm run mobile:typecheck`

Expected: 모두 PASS.

- [ ] **Step 6: 모바일 생활 경험 커밋**

```powershell
git add -- apps/mobile
git commit -m "feat: 모바일을 비의료 생활 작업공간으로 전환"
```

### Task 3: 웹 PWA 비의료 전환

**Files:**
- Create: `src/features/workspace/WorkspaceEditor.tsx`
- Create: `src/features/workspace/WorkspaceHome.tsx`
- Create: `src/features/workspace/workspaceRepository.ts`
- Create: `src/app/state/useLifeAppState.ts`
- Test: `src/features/workspace/workspaceRepository.test.ts`
- Test: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/index.css`
- Delete: `src/features/manual`
- Delete: `src/features/reminders`
- Delete: `src/features/companion`
- Delete: `src/features/relay`
- Delete: `src/features/ui/CaregiverEditor.tsx`
- Delete: `src/features/ui/CompanionHome.tsx`
- Delete: `src/app/state/useCareAppState.ts`
- Delete: old care fixtures replaced by neutral fixtures

**Interfaces:**
- Consumes: `PersonalWorkspace`, `validateWorkspace`, `validateExtension`
- Produces: browser-local `loadWorkspace`, `saveWorkspace`, `clearWorkspace`

- [ ] **Step 1: 웹 중립 카피와 저장 실패 테스트 작성**

```ts
expect(screen.getByRole("heading", { name: "생활후견 AI" })).toBeInTheDocument();
expect(screen.getByText("나만의 생활 기능 만들기")).toBeInTheDocument();
expect(document.body.textContent).not.toMatch(/복약|질환|치료|피돌봄/);
```

- [ ] **Step 2: 기존 웹에서 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/App.test.tsx`

Expected: 기존 CareGuardian 카피 때문에 FAIL.

- [ ] **Step 3: 웹 작업공간·기능 만들기 UI 구현**

웹은 모바일의 스키마와 기본 템플릿을 공유한다. 웹 음성 입력과 건강형 백업 가져오기는 제거한다. 저장 데이터는 새 키 공간을 사용해 이전 health-shaped localStorage를 자동 로드하지 않는다.

- [ ] **Step 4: 웹 테스트와 production build 실행**

Run: `npx vitest run src`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: 웹 전환 커밋**

```powershell
git add -- src
git commit -m "feat: 웹을 생활 정리 작업공간으로 전환"
```

### Task 4: 건강형 공용 코어 제거와 의존성 정리

**Files:**
- Modify: `package.json`
- Modify: `apps/mobile/package.json`
- Modify: `package-lock.json`
- Delete: `packages/care-core`

**Interfaces:**
- Consumes: Tasks 1–3의 `@life-steward/life-core`
- Produces: health-shaped shared package가 없는 workspace dependency graph

- [ ] **Step 1: 활성 import 회귀 검사 추가**

Run: `rg -n "@careguardian/care-core|packages/care-core" package.json apps/mobile src packages --glob "!packages/care-core/**"`

Expected: 마이그레이션 전 참조가 출력됨.

- [ ] **Step 2: 모든 import와 workspace dependency를 life-core로 교체**

루트와 모바일은 `"@life-steward/life-core": "file:packages/life-core"`를 사용한다.

- [ ] **Step 3: 기존 care-core 삭제 후 의존성 재설치**

Run: `npm install`

Run: `npm ls --all`

Expected: `ELSPROBLEMS` 없이 종료.

- [ ] **Step 4: 전체 자동 검증**

Run: `npm test -- --run`

Run: `npm run build`

Run: `npm run mobile:typecheck`

Expected: 모두 PASS.

- [ ] **Step 5: 의존성 전환 커밋**

```powershell
git add -- package.json package-lock.json apps/mobile/package.json packages
git commit -m "refactor: 건강형 care core를 life core로 교체"
```

### Task 5: 모델 레지스트리와 법적 고지

**Files:**
- Create: `apps/mobile/src/local-ai/modelRegistry.ts`
- Create: `apps/mobile/src/local-ai/modelRegistry.test.ts`
- Create: `apps/mobile/src/legal/thirdPartyModels.ts`
- Create: `apps/mobile/assets/model-licenses/hyperclovax-seed/LICENSE.txt`
- Create: `apps/mobile/assets/model-licenses/hyperclovax-seed/NOTICE.txt`
- Create: `apps/mobile/assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt`
- Create: `apps/mobile/assets/model-licenses/apache-2.0/LICENSE.txt`
- Create: `docs/model-supply-chain.md`
- Create: `docs/terms/model-use.md`

**Interfaces:**
- Produces: `ModelArtifact`, `MODEL_REGISTRY`, `getInstallableModels()`
- Produces: `getThirdPartyModelNotice(modelId)`

- [ ] **Step 1: 리비전·크기·해시·설치 상태 테스트 작성**

```ts
expect(MODEL_REGISTRY[0]).toMatchObject({
  id: "hyperclovax-seed-text-instruct-0.5b-q4km",
  revision: "27831169fdebe6fe30bb1b9d76b12a2d06693f26",
  bytes: 431882784,
  sha256: "bc6a93b452648e8e90b06dc04f81edbdce9703fa76bdf589a63cc8418699d44f",
  availability: "installable"
});
expect(MODEL_REGISTRY.find((m) => m.provider === "Kakao")?.availability)
  .toBe("blocked_no_approved_gguf");
```

- [ ] **Step 2: 테스트가 레지스트리 부재로 실패하는지 확인**

Run: `npx vitest run apps/mobile/src/local-ai/modelRegistry.test.ts`

Expected: FAIL.

- [ ] **Step 3: immutable URL과 라이선스 메타데이터 구현**

NAVER URL은 `resolve/<revision>/<artifact>?download=true` 형식만 사용한다. 모든 installable 항목은 `bytes`, 64자리 소문자 SHA-256, 라이선스 asset, minimum RAM, context 값을 가져야 한다.

- [ ] **Step 4: 라이선스·NOTICE·약관 문서 추가**

NAVER 화면에는 `Powered by HyperCLOVA X`를 항상 노출하고, §2.3 금지 사용 정책을 앱 약관에 포함한다. 문서는 영문 원문과 한국어 설명을 함께 제공한다.

- [ ] **Step 5: 레지스트리 테스트 실행**

Run: `npx vitest run apps/mobile/src/local-ai/modelRegistry.test.ts`

Expected: PASS.

- [ ] **Step 6: 모델 공급망 커밋**

```powershell
git add -- apps/mobile/src/local-ai/modelRegistry* apps/mobile/src/legal apps/mobile/assets/model-licenses docs/model-supply-chain.md docs/terms/model-use.md
git commit -m "feat: 검증된 한국어 모델 레지스트리와 고지 추가"
```

### Task 6: 모델 다운로드·무결성·삭제

**Files:**
- Create: `apps/mobile/src/local-ai/modelDownloadState.ts`
- Create: `apps/mobile/src/local-ai/modelStore.ts`
- Create: `apps/mobile/src/local-ai/modelStore.test.ts`
- Create: `apps/mobile/modules/model-integrity/index.ts`
- Create: `apps/mobile/modules/model-integrity/android/src/main/java/expo/modules/modelintegrity/ModelIntegrityModule.kt`
- Create: `apps/mobile/modules/model-integrity/expo-module.config.json`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/src/security/clearMobileData.ts`

**Interfaces:**
- Produces: `downloadModel(model, callbacks): Promise<InstalledModel>`
- Produces: `verifyFileSha256(uri, expectedSha256): Promise<boolean>`
- Produces: `removeModel(modelId)`, `removeAllModels()`, `cleanupPartialDownloads()`
- Produces state: `notInstalled | downloading | paused | verifying | ready | failed`

- [ ] **Step 1: 상태 전이·부분 파일·해시 실패 테스트 작성**

```ts
expect(reduceDownloadState({ kind: "notInstalled" }, { type: "START" }).kind)
  .toBe("downloading");
await expect(installFromPartial(model, fakeFs, fakeHasher)).rejects.toThrow("sha256_mismatch");
expect(fakeFs.deleted).toContain(expect.stringMatching(/\.partial$/));
```

- [ ] **Step 2: 테스트가 구현 부재로 실패하는지 확인**

Run: `npx vitest run apps/mobile/src/local-ai/modelStore.test.ts`

Expected: FAIL.

- [ ] **Step 3: app-specific 문서 저장과 이어받기 구현**

완료 파일은 `models/<id>/<revision>.gguf`, 부분 파일은 같은 디렉터리의 `.partial`을 사용한다. 다운로드 완료 후 byte size와 Kotlin `FileInputStream + MessageDigest("SHA-256")` 결과가 모두 일치할 때만 원자적으로 완료 파일로 이동한다.

- [ ] **Step 4: 전체 삭제 경로와 모델 삭제 연결**

전체 삭제 순서는 active inference 중지, 일반 알림 취소, 부분 파일·모델 삭제, workspace DB 삭제, SecureStore 키 삭제, 메모리 초기화다.

- [ ] **Step 5: 다운로드 모듈 테스트와 타입검사**

Run: `npx vitest run apps/mobile/src/local-ai/modelStore.test.ts apps/mobile/src/security`

Run: `npm run mobile:typecheck`

Expected: PASS.

- [ ] **Step 6: 다운로드·무결성 커밋**

```powershell
git add -- apps/mobile
git commit -m "feat: 모델 다운로드와 스트리밍 무결성 검증 추가"
```

### Task 7: llama.rn 런타임과 AI 안전 흐름

**Files:**
- Create: `apps/mobile/src/local-ai/llamaRuntime.ts`
- Create: `apps/mobile/src/local-ai/assistantPolicy.ts`
- Create: `apps/mobile/src/local-ai/assistantPolicy.test.ts`
- Create: `apps/mobile/src/local-ai/useLocalAssistant.ts`
- Create: `apps/mobile/src/ui/LocalAiScreen.tsx`
- Create: `apps/mobile/src/ui/LocalAiSettingsScreen.tsx`
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/eas.json`

**Interfaces:**
- Produces: `loadLocalModel(installed): Promise<LocalModelSession>`
- Produces: `generateLocalText(session, request, onToken): Promise<GenerationResult>`
- Produces: `stopGeneration()`, `unloadLocalModel()`
- Produces: `guardAssistantInput(text)`, `guardAssistantOutput(text)`

- [ ] **Step 1: 의료 입력·출력과 승인 전 미저장 테스트 작성**

```ts
expect(guardAssistantInput("이 약을 언제 먹어?").allowed).toBe(false);
expect(guardAssistantInput("회의 메모를 체크리스트로 바꿔줘").allowed).toBe(true);
expect(guardAssistantOutput("증상에 따라 복용량을 바꾸세요").allowed).toBe(false);
```

- [ ] **Step 2: 안전 테스트가 실패하는지 확인**

Run: `npx vitest run apps/mobile/src/local-ai/assistantPolicy.test.ts`

Expected: FAIL.

- [ ] **Step 3: llama.rn CPU 런타임과 수명주기 구현**

```ts
const context = await initLlama({
  model: installed.localUri,
  n_ctx: model.defaultContextTokens,
  n_gpu_layers: 0
});
```

arm64-v8a와 x86_64에서만 활성화하고, 한 context·한 generation queue를 강제한다. background·잠금·사용자 취소 시 completion을 중단하고 context를 해제한다.

- [ ] **Step 4: 로컬 AI 화면 구현**

모델 미설치, 다운로드, 라이선스 동의, 로드, 생성, 취소, 결과 미리보기, 사용자 승인 저장, 문제 신고, 모델 삭제 상태를 각각 분리한다. NAVER 모델이 활성화된 화면에는 `Powered by HyperCLOVA X`를 지속 표시한다.

- [ ] **Step 5: 테스트·타입검사·Expo Doctor 실행**

Run: `npx vitest run apps/mobile/src/local-ai`

Run: `npm run mobile:typecheck`

Run: `npm run mobile:doctor`

Expected: 모두 PASS.

- [ ] **Step 6: 로컬 AI 런타임 커밋**

```powershell
git add -- apps/mobile
git commit -m "feat: 모바일 한국어 로컬 AI 실행과 안전 경계 추가"
```

### Task 8: 앱 식별자·문서·개인정보처리방침·스토어 자산

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `public/privacy-policy.html`
- Modify: `docs/store-listing.md`
- Modify: `docs/mobile-delivery.md`
- Modify: `docs/private-test-operations.md`
- Create: `docs/security/private-test-readiness-2026-07-30.md`
- Replace: `docs/screenshots/feature-graphic.png`
- Replace: `docs/screenshots/phone-screenshot-*.png`
- Replace: `docs/screenshots/tablet*-screenshot-*.png`

**Interfaces:**
- Produces: 앱과 Play Console에 그대로 적용할 한국어·영문 문구와 검증 증거

- [ ] **Step 1: 현재 출시 표면의 금지 문자열 기준선 기록**

Run: `rg -n "복약|투약|질환|알레르기|진단|치료|Medical|Medication and Treatment" README.md README.en.md public docs/store-listing.md docs/mobile-delivery.md docs/private-test-operations.md apps/mobile src packages/life-core`

Expected: 전환 전 잔여 문자열 출력.

- [ ] **Step 2: 앱 버전과 표시 문구 변경**

`apps/mobile/app.json`은 display name `생활후견 AI`, version `1.1.0`, versionCode `7`, 비의료 기기 인증 설명을 사용한다. native prebuild 뒤 생성된 Gradle 값도 같은 값을 사용해야 한다.

- [ ] **Step 3: 한국어 우선 README와 영문 링크 유지**

README 첫 화면은 한국어이고 `[English](./README.en.md)` 링크를 제공한다. 다이어그램은 life-core, web, mobile, local AI의 경계를 보여준다.

- [ ] **Step 4: 현재 정책·스토어·테스터 문서 교체**

개인정보처리방침은 모델 다운로드 네트워크, 기기 내 추론, SQLCipher, 삭제, 미수집 데이터를 정확히 설명한다. 과거 건강형 감사 문서는 역사 자료로 표시하고 현재 제출 근거로 인용하지 않는다.

- [ ] **Step 5: 새 앱 화면으로 스크린샷과 feature graphic 생성**

합성 생활 일정만 사용해 phone 4장, 7-inch 2장, 10-inch 2장과 1024×500 feature graphic을 만든다. 의료·보호자·약·건강 상징과 문구를 포함하지 않는다.

- [ ] **Step 6: 문서·자산 회귀 검사와 웹 build**

Run: `npm run build`

Run: `rg -n "복약|투약|질환|알레르기|진단|치료|Medical|Medication and Treatment" README.md README.en.md public docs/store-listing.md docs/mobile-delivery.md docs/private-test-operations.md apps/mobile src packages/life-core`

Expected: 현재 출시 표면 0건. 역사 문서는 검사 경로에서 제외한다.

- [ ] **Step 7: 문서·스토어 자산 커밋**

```powershell
git add -- apps/mobile/app.json apps/mobile/package.json README.md README.en.md public docs
git commit -m "docs: 생활후견 비공개 테스트 문서와 스토어 자산 갱신"
```

### Task 9: 통합 보안·품질 게이트

**Files:**
- Create: `scripts/check-non-medical-release.mjs`
- Create: `scripts/check-model-registry.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml` if present
- Modify: `docs/security/private-test-readiness-2026-07-30.md`

**Interfaces:**
- Produces: `npm run release:policy-check`
- Produces: `npm run release:model-check`
- Produces: `npm run verify`

- [ ] **Step 1: 정책 검사 스크립트 실패 테스트 작성**

검사기는 현재 출시 경로에서 금지 문자열, `@careguardian/care-core`, 임의 HTTP 모델 URL, 누락된 SHA-256, 민감 권한을 찾으면 exit code 1을 반환한다. 역사 문서와 라이선스 원문은 명시된 제외 목록으로만 제외한다.

- [ ] **Step 2: 검사기를 기존 잔여물에 실행해 실패 확인**

Run: `npm run release:policy-check`

Expected: 정리되지 않은 출시 잔여물이 있으면 FAIL.

- [ ] **Step 3: 정책·모델 검사기를 완성하고 CI에 연결**

모델 검사는 installable artifact의 URL revision, byte size, SHA-256, license asset, attribution을 검사한다.

- [ ] **Step 4: 전체 품질 명령 실행**

Run: `npm run verify`

Run: `npm audit --omit=dev`

Run: `npm run release:policy-check`

Run: `npm run release:model-check`

Expected: Critical 0, production-reachable High 0, 모든 출시 검사 명령 PASS. Expo/React Native 빌드 도구에만 남는 High는 제품 도달 불가 근거, 소유자, 재검토일을 보안 문서에 기록하고 별도 위험 승인 파일로 검사기에 입력한다.

- [ ] **Step 5: 통합 게이트 커밋**

```powershell
git add -- package.json package-lock.json scripts .github docs/security/private-test-readiness-2026-07-30.md
git commit -m "test: 비의료 로컬 AI 출시 게이트 추가"
```

### Task 10: Android 네이티브 검증과 production AAB

**Files:**
- Modify: generated `apps/mobile/android` files only through Expo prebuild and reviewed config-plugin output
- Create: `docs/security/android-aab-evidence-2026-07-30.md`
- Artifact outside Git: verified `.aab`

**Interfaces:**
- Produces: installable Android dev build and production AAB with recorded SHA-256

- [ ] **Step 1: 네이티브 설정 재생성**

Run: `npm --workspace apps/mobile run prebuild -- --clean`

Expected: custom notification privacy plugin, SQLCipher, backup off, version `1.1.0`, versionCode `7`이 생성 결과에 유지됨.

- [ ] **Step 2: 에뮬레이터 native smoke**

Run: `npm run mobile:android:dev`

Expected: x86_64 에뮬레이터에서 시작·작업 저장·기능 생성·잠금·전체 삭제가 정상 동작하고 모델 미설치 상태에서 crash가 없음.

- [ ] **Step 3: arm64 실기기 모델 smoke**

0.5B 모델의 다운로드 중단·이어받기·SHA 검증·로드·한국어 생성·취소·삭제를 실행한다. 1.5B는 6GB 이상 기기에서 동일하게 확인한다.

- [ ] **Step 4: production EAS build**

Run: `npx eas-cli build --platform android --profile production --non-interactive`

Expected: EAS build status `finished`.

- [ ] **Step 5: AAB 정적 감사**

검사 항목:

- package `com.sinmb.careguardianai`
- versionName `1.1.0`
- versionCode `> 6`
- targetSdk 36
- arm64-v8a와 x86_64 llama native library
- `allowBackup=false`
- AD_ID, 외부 저장소, Health Connect, 마이크, 카메라 권한 부재
- debuggable, dev launcher, dev menu 부재

- [ ] **Step 6: AAB 증거 커밋**

```powershell
git add -- apps/mobile/android docs/security/android-aab-evidence-2026-07-30.md
git commit -m "build: 생활후견 Android 출시 증거 기록"
```

### Task 11: Google Play 비공개 테스트 업데이트

**Files:**
- Modify: `docs/mobile-delivery.md`
- Modify: `docs/private-test-operations.md`
- Modify: `docs/security/private-test-readiness-2026-07-30.md`

**Interfaces:**
- Consumes: Task 10의 검증된 AAB
- Produces: 기존 비공개 테스트 트랙의 새 release와 게시 상태 기록

- [ ] **Step 1: Play Console 현재 대기 변경 읽기**

기존 건강형 `1.0.1 (6)` release, Medical 카테고리, Health 선언, 스토어 문구, 스크린샷, Data safety의 현재 상태를 기록한다.

- [ ] **Step 2: 새 AAB로 기존 release 교체**

검증된 versionCode 7 이상 AAB만 업로드하고 Play가 package, version, target SDK, ABI를 올바르게 읽는지 확인한다.

- [ ] **Step 3: 비의료 등록정보 동기화**

앱 이름, 짧은 설명, 전체 설명, Productivity 카테고리, 개인정보처리방침, 스크린샷, feature graphic, 출시 노트를 Task 8 문서와 동일하게 저장한다.

- [ ] **Step 4: 선언 동기화**

최종 AAB에 건강 기능이 없음을 다시 확인한 뒤 Health apps declaration을 비건강 상태로 저장한다. Data safety는 사용자 데이터 수집·공유 없음, 모델 다운로드 네트워크, 계정·광고·분석 없음과 실제 바이너리를 일치시킨다.

- [ ] **Step 5: 게시 개요 잔여물 검사와 검토 제출**

게시 개요에서 건강형 release·Medical·Medication declaration·이전 스크린샷이 남은 변경 0건인지 확인한다. 새 비의료 변경 묶음만 Google 검토에 제출한다.

- [ ] **Step 6: 비공개 테스트 상태 기록**

tester 목록과 opt-in URL을 유지하고, 제출 시각·release version·AAB SHA-256·검토 상태를 문서에 기록한다.

- [ ] **Step 7: Play 업데이트 기록 커밋**

```powershell
git add -- docs/mobile-delivery.md docs/private-test-operations.md docs/security/private-test-readiness-2026-07-30.md
git commit -m "docs: 생활후견 Play 비공개 테스트 업데이트 기록"
```

### Task 12: 최종 검토·GitHub 푸시

**Files:**
- Modify: `README.md` and `README.en.md` only if final evidence changed
- Modify: final evidence documents

**Interfaces:**
- Produces: public GitHub branch and reproducible handoff

- [ ] **Step 1: 최종 변경 범위와 사용자 파일 보존 확인**

Run: `git status --short`

Run: `git diff origin/main...HEAD --stat`

Expected: `.claude/`는 미추적 상태로 유지되고 제품 변경만 커밋됨.

- [ ] **Step 2: 최종 전체 검증**

Run: `npm ci`

Run: `npm run verify`

Run: `npm audit --omit=dev`

Run: `npm run release:policy-check`

Run: `npm run release:model-check`

Expected: Critical 0, production-reachable High 0, 출시 게이트 모두 PASS. 빌드 도구 전용 High가 남으면 Task 9의 위험 승인과 정확히 일치해야 한다.

- [ ] **Step 3: 마지막 미커밋 증거가 있으면 커밋**

```powershell
git add -- README.md README.en.md docs
git commit -m "docs: 생활후견 비공개 테스트 최종 증거 정리"
```

변경이 없으면 빈 커밋을 만들지 않는다.

- [ ] **Step 4: 현재 branch push**

Run: `git push -u origin codex/non-medical-local-ai-closed-test`

Expected: GitHub 원격 branch 생성 성공.

- [ ] **Step 5: 최종 인계**

보스에게 GitHub branch, 커밋, Play release/versionCode, AAB SHA-256, 검증 결과, Play 검토 상태, 남은 외부 게이트를 한국어로 보고한다.

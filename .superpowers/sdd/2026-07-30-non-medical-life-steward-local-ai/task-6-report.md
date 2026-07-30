# Task 6 보고서 — 모델 다운로드·무결성·삭제

## Scaffold

- `apps/mobile`에서 요구된 명령을 먼저 실행했습니다.

```powershell
$env:CI='1'
npx create-expo-module@latest --local --name ModelIntegrity --description "Streaming SHA-256 for local model artifacts" --package expo.modules.modelintegrity
```

- `create-expo-module@57.0.0`의 local template이 `repo` 미정의 상태에서 podspec EJS를 렌더링하다 `repo is not defined`로 중단됐습니다.
- 생성에 성공한 top-level Android scaffold를 `modules/model-integrity`로 옮겨 사용하고, 실패 중 생긴 `package/` 템플릿 사본, iOS, web, native view, 예제 이벤트·상수·함수를 모두 제거했습니다.
- 최종 모듈에는 `package.json`, `index.ts`, Android `build.gradle`/manifest/Kotlin source, Android-only `expo-module.config.json`만 남겼습니다.

## 구현

- `modelDownloadState.ts`
  - `notInstalled → downloading → paused/verifying → ready/failed`의 명시적 reducer를 추가했습니다.
  - 정의되지 않은 상태 전이는 `invalid_download_state_transition`으로 거부합니다.
- `modelStore.ts`
  - Task 5의 installable registry identity 전체가 정확히 일치하는 경우만 설치하고, caller가 바꾼 URL이나 blocked 모델은 네트워크 호출 전에 거부합니다.
  - SDK 54에 실제 설치된 `expo-file-system 19.0.23`의 `expo-file-system/legacy` `createDownloadResumable`을 사용합니다. 새 `File.downloadFileAsync`에는 pause/resume API가 없기 때문입니다.
  - 앱 전용 `documentDirectory/models/<id>/<revision>.gguf.partial`에 받고, byte size와 Android native streaming SHA-256을 모두 확인한 뒤 같은 디렉터리의 `.gguf`로 `moveAsync`합니다.
  - Android SDK 구현의 `moveAsync`는 같은 경로 계층에서 `File.renameTo`를 사용합니다. 기존 완료 파일을 사전 삭제하지 않으므로 rename 실패 시 정상본을 보존합니다.
  - 명시적 pause는 resume token과 partial을 보존합니다. Android 19.0.23 token은 실제 partial byte length이므로 재개 시 파일 크기와 정확히 일치해야 합니다. pause intent를 native `pauseAsync()` await 전에 기록해 `downloadAsync()` 완료와의 race가 cancellation cleanup으로 오인되지 않게 했습니다.
  - mismatch, cancellation, network/HTTP/disk/rename/verification 실패는 typed error로 닫고 partial을 삭제합니다. cleanup 자체가 실패하면 `cleanup_failed`를 별도로 반환해 숨기지 않습니다.
  - 프로세스당 설치 작업은 하나만 허용합니다.
  - `removeModel`, `removeAllModels`, `cleanupPartialDownloads`를 추가했습니다.
- `ModelIntegrityModule.kt`
  - `AsyncFunction("sha256") Coroutine`에서 `Dispatchers.IO`로 이동합니다.
  - 1 MiB 고정 `ByteArray`와 `FileInputStream`으로 streaming SHA-256을 계산하며 `readBytes()`를 사용하지 않습니다.
  - `file:` URI만 받고 canonical path가 Android app `filesDir` 아래인지 확인합니다.
  - 설치된 Expo FileSystem의 `documentDirectory` 근거인 `persistentFilesDirectory = context.filesDir`와 같은 root를 사용합니다.
- `clearMobileData.ts`
  - 현재 순서는 알림 → 모델/partial → workspace DB → SecureStore key → memory입니다.
  - Task 7이 `stopActiveInference` hook을 주입하면 전체 삭제보다 먼저 실행합니다.
  - 각 단계는 순차 await하며 실패를 삼키거나 뒤 단계를 계속하지 않습니다.

## 테스트와 검증

- TDD red:
  - `modelStore.ts`/`modelDownloadState.ts` 부재와 기존 삭제 순서 때문에 예상대로 실패했습니다.
  - pause/download race와 기존 완료 파일 보존 회귀도 수정 전에 각각 `download_cancelled`, 기존 파일 삭제로 실패하는 것을 확인했습니다.
- fake 기반 회귀:
  - reducer, resume/pause, exact registry allowlist, single operation, size mismatch, SHA mismatch, partial cleanup, cancellation, network/HTTP/disk/rename, atomic replacement failure, model/removeAll 삭제, native bridge absent, cleanup failure를 검사합니다.
  - Kotlin source는 `FileInputStream`, fixed buffer, incremental `MessageDigest.update`, `readBytes()` 부재를 정적으로 검사합니다.
  - 설치된 Expo Android source와 Kotlin module이 모두 `context.filesDir` root를 쓰는 characterization test를 추가했습니다.
- Expo autolinking:
  - Android module `model-integrity`와 `expo.modules.modelintegrity.ModelIntegrityModule`을 중복 없이 발견했습니다.
  - `expo-modules-autolinking verify --platform android`는 `Everything is fine`을 반환했습니다.
- 앱 manifest, 모델 관리 UI, llama runtime은 변경하지 않았고 모델 파일도 다운로드하지 않았습니다.

## 남은 우려

- 저장소에는 generated `apps/mobile/android` 프로젝트가 없으므로 이번 Task에서 Gradle Kotlin compile은 실행하지 않았습니다. manifest를 생성·변경하는 prebuild는 Task 7 경계를 침범하므로 수행하지 않았습니다. Task 7 dev client/AAB 빌드에서 Kotlin compile과 실제 Android pause/resume를 확인해야 합니다.
- Expo resume token의 영속 저장은 UI/상태 저장 계층이 결정해야 합니다. 이번 API는 token을 반환하며, Android에서는 설치된 19.0.23 계약에 따라 token과 partial byte length이 정확히 일치할 때만 재개합니다.
- 실모델 byte/hash 검증과 실기기 다운로드는 모델 파일을 받지 말라는 Task 6 범위에 따라 수행하지 않았습니다.

## 최종 실행 결과

```text
npm test -- --run
Test Files  15 passed (15)
Tests       110 passed (110)

npm run build
TypeScript + Vite production build passed

npm run mobile:typecheck
passed

npx expo-modules-autolinking verify --platform android
Everything is fine

npx expo-modules-autolinking resolve --platform android
model-integrity -> expo.modules.modelintegrity.ModelIntegrityModule
```

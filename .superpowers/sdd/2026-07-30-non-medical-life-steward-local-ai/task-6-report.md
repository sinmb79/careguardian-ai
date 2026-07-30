# Task 6 보고서 — 모델 다운로드·무결성·삭제

## Scaffold

- `apps/mobile`에서 요구된 `create-expo-module` 명령을 먼저 실행했습니다.
- generator의 podspec EJS 오류(`repo is not defined`) 뒤 생성된 Android scaffold만 정리해 사용했습니다.
- 최종 모듈은 Android 전용이며 iOS, web, native view와 실패 산출물은 제거했습니다.

## 구현

### 모델 저장소

- Task 5 registry의 installable identity 전체가 일치할 때만 다운로드합니다.
- 모델 ID는 안전한 소문자 ASCII 단일 경로 segment만 허용하며 `.`, `..`, slash, backslash, URL 인코딩 우회를 거부합니다.
- `documentDirectory`는 canonical `file:` URL만 받고 모든 생성 경로를 Android native `models/` root confinement로 재검증합니다.
- download 생성 전 오류부터 callback 오류, HTTP/네트워크/디스크/검증/교체 오류까지 하나의 typed lifecycle에서 종료·partial cleanup·active slot 해제를 보장합니다.
- pause record는 `modelId`, `revision`, `partialUri`, `bytesWritten`, `resumeData`를 함께 묶습니다. 재개 시 선택 모델, revision, canonical partial URI와 terminal byte length가 전부 일치해야 합니다.
- pause/cancel/remove/cleanup/remove-all은 하나의 control queue에서 직렬화됩니다. pause/remove-all은 native writer terminal을 기다린 뒤 metadata 확인 또는 삭제를 수행합니다.
- 관찰자 callback 오류는 설치 transaction과 격리했습니다.
- 알 수 없는 download total은 `-1` 대신 `null`로 정규화합니다.
- cleanup 실패는 `ModelStoreCleanupError.primaryError`와 `cleanupError`를 함께 노출합니다.

### Android 무결성 모듈

- SHA-256은 `Dispatchers.IO`, 1 MiB 고정 buffer, `FileInputStream`으로 streaming 계산합니다.
- `filesDir/models` 자체와 각 child의 canonical path를 검사해 root/child symlink escape를 거부합니다.
- 완료본 교체는 native `replaceVerified`에서 수행합니다.
  - partial size/hash 사전 검증
  - 동일 filesystem 확인
  - file/directory fsync
  - 기존 완료본을 `.backup`으로 보존
  - `Os.rename` 교체
  - 완료본 size/hash 사후 검증
  - 오류 시 backup 복구
- 기존 정상 완료본은 사전 삭제하지 않습니다.

### 전체 데이터 삭제

- 생산 앱의 `useLifeWorkspace().actions.deleteAllData()`가 공통 `clearMobileData` coordinator를 직접 사용합니다.
- 순서는 알림 취소 → active download 취소 및 모델 root 삭제 → repository 삭제(SQLite + repository-owned SecureStore keys) → memory reset입니다.
- SecureStore를 별도 중복 삭제하던 hook은 제거했습니다.
- repository는 한 SecureStore key 삭제가 실패해도 나머지 repository-owned key 삭제를 모두 시도한 뒤 첫 오류를 전달합니다.
- 모델 삭제가 실패하면 repository와 메모리를 지우지 않고 오류를 그대로 전달합니다.
- Task 7은 필요할 때 `stopActiveInference` hook만 가장 앞에 주입할 수 있습니다.

## 회귀 검증

- exact allowlist, unsafe ID/path, native confinement 실패 시 무변경
- preflight/create/callback 실패와 install slot 회수
- resume identity/byte mismatch 및 cross-model record 거부
- pause token/writer terminal race, cancel/remove-all serialization
- size/SHA/HTTP/network/disk/native replacement/cleanup typed 오류
- 기존 완료본 보존과 Android backup/rollback/fsync/post-verify 계약
- 생산 전체 삭제 순서와 model deletion fail-closed
- 실제 repository fake에서 세 SecureStore key 각각의 삭제 실패와 잔존 key

## 최종 실행 결과

```text
npm test -- --run
Test Files  15 passed (15)
Tests       128 passed (128)

npm run build
TypeScript + Vite production build passed

npm run mobile:typecheck
passed

npx expo-modules-autolinking verify --platform android --project-root apps/mobile
Everything is fine

npx expo-modules-autolinking resolve --platform android --project-root apps/mobile
model-integrity -> expo.modules.modelintegrity.ModelIntegrityModule
```

## 검증 경계

- 모델 weight는 다운로드하지 않았습니다.
- generated `apps/mobile/android`가 없고 Task 7 manifest 경계를 지켜야 하므로 Gradle Kotlin compile과 실제 Android pause/resume는 이번 Task에서 실행하지 않았습니다.
- Task 7 dev client/AAB 빌드에서 Kotlin compile, crash-recovery, 실제 기기 pause/resume를 추가 확인해야 합니다.

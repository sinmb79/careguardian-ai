# Task 18 구현·검증 보고서

작성일: 2026-07-31
대상 브랜치: `codex/non-medical-local-ai-closed-test`

## 결론

Android 일반 생활 알림을 `expo-notifications`에서 앱 내부 `AlarmManager` 기반
Expo Module로 교체했다. 소스, resolved Gradle dependency, clean prebuild의 병합
매니페스트, 두 Kotlin 모듈, release Metro bundle 기준으로 FCM/FID/cloud messaging,
ShortcutBadger, C2DM, AD_ID, VIBRATE와 정시 알람 표면이 없는 계약을 통과했다.

단, Task 18은 실제 AAB와 universal APK를 만들지 않는다. 따라서 최종 배포 바이너리의
FCM 부재는 아직 확정하지 않으며, Task 14에서 정확한 AAB·APK 쌍에
`verify:no-remote-push:artifacts`를 실행해야 한다.

## 구현

- `apps/mobile/modules/life-local-notifications`
  - Android 전용 Expo Module, 두 개의 non-exported receiver
  - `setAndAllowWhileIdle` 기반 비정시 local-only alarm
  - private ledger와 PendingIntent 검증, process-wide lock
  - generic SECRET 알림, badge 비활성화, 메모·본문 비저장
  - POST_NOTIFICATIONS 권한을 JS와 네이티브 양쪽에서 fail-closed 확인
  - corrupt ledger, stale alarm, boot/package replacement 복원 처리
  - 이전 Expo alarm/store/files/installation UUID/channel의 제한된 일회성 정리
  - 전체 삭제 시 legacy/current alarm/표시 알림/ledger를 독립적으로 삭제하고
    `activeNotifications`와 ledger를 다시 확인
- 의존성·설정
  - `expo-notifications` 및 이전 config plugin 제거
  - `android.permission.VIBRATE`를 `blockedPermissions`에 명시
  - 스트리밍 ZIP 검사에 사용되는 `yauzl`을 정확히 `3.4.0`으로 고정
- 검증 도구
  - Gradle `releaseRuntimeClasspath`, 병합 매니페스트, autolink, Kotlin, Metro 검사
  - AAB/APK ZIP 안전성·크기·중복·암호화·DEX 문자열·패키지 검사를 fail-closed 적용
  - 실제 ZIP fixture와 금지 DEX/manifest/dependency 변이 테스트 추가
- 문서
  - Android-only, 기기 내 처리, 지연 가능성, iOS 미지원, 최종 바이너리 쌍 검사
    조건을 README와 배포·보안·스토어·비공개 테스트 문서에 반영

## 구현 커밋

| 커밋 | 내용 |
|---|---|
| `c83f22ef2445fcff94171ff52465a1276da9ad92` | 알림 스택을 로컬 전용 alarm과 검증 게이트로 교체 |
| `b32a1152a3075ef1ec01f03e30587cae3e58431d` | 네이티브 POST_NOTIFICATIONS 확인 추가 |
| `d49a17f0985c948018214fabd7460477ae1a55b9` | prebuild가 추가한 VIBRATE 권한 차단 |
| `eab154132fe6f2ba3eeb1f8fb4a9b1ce80ace078` | Expo Module 인자 없는 Coroutine 오버로드 명시 |

## 검증 결과

### 전체 소스 게이트

`npm run verify` 성공:

- Vitest: 30 files, 295 tests 통과
- 웹 production build 통과
- 모바일 TypeScript 통과
- Expo Doctor: 18/18 통과
- static security, non-medical policy, model registry, audit policy,
  release workflow 통과
- 정책 및 보안 gate tests: 183개 통과
- no-remote-push tests: 32개 통과
- source dependency gate: 통과, `releaseBinaryPair=false`

생산 의존성 감사 기준선은 Critical 0, High 19, Moderate 9이며 2026-08-13까지
명시적으로 제한 수용된 상태다. 이 결과는 실제 AAB reachability의 안전성을
주장하지 않는다.

### 정확한 커밋의 실제 Android 게이트

한글 경로의 도구 충돌을 배제하기 위해
`C:\codex-task18-native-eab1541`에 detached worktree를 만들고 `npm ci --ignore-scripts`
후 아래 환경을 명시했다.

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\sinmb\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
npm --workspace apps/mobile run verify:native-contracts -- all
```

결과:

- clean Expo prebuild: 통과
- autolink: `lifeLocalNotifications=1`, `expoNotifications=0`
- resolved release dependency no-remote-push: 통과
- release merged manifest: 통과
- `model-integrity:compileDebugKotlin`: 통과
- `life-local-notifications:compileDebugKotlin`: 통과
- `app:createBundleReleaseJsAndAssets`: 통과

검증 스크립트 종료 후 생성 Android tree는 삭제되었고 두 worktree 모두 clean이었다.

### 커밋 동일성

- source HEAD = native HEAD =
  `eab154132fe6f2ba3eeb1f8fb4a9b1ce80ace078`
- source tree = native tree =
  `814110370cbf8bcdb72c9c8f437c4eed1ec85021`
- 설치된 `yauzl`: source/native 모두 `3.4.0`

주요 Git blob도 양쪽에서 일치했다.

| 파일 | Git blob |
|---|---|
| `apps/mobile/app.json` | `1e2dc9c9dd139591e9ae7fbda0969c3ced7426e7` |
| `LifeLocalNotificationsModule.kt` | `7879ccf95fc3ab93dfc250c8c3ae3560b7541cca` |
| `NotificationScheduler.kt` | `9d0bef1ea4b2a454a7e0ff8dc69953360a2170e0` |
| `verify-no-remote-push.mjs` | `6a2cb67eb06c45381229d2914a1bf48af56a51bd` |
| `package-lock.json` | `eccea3dd3b403f03f799ee343724fc7797fe29b5` |

## 실패에서 확인한 결함과 보완

1. 최초 clean prebuild 병합 매니페스트에서 `VIBRATE`가 암시적으로 추가됨을
   실제 게이트가 탐지했다. `blockedPermissions`와 회귀 테스트를 추가했다.
2. 그 다음 실제 Kotlin compile에서 인자 없는 Expo `Coroutine` 오버로드 모호성이
   확인됐다. 빈 parameter list를 명시한 `Coroutine { -> ... }`로 수정했다.
3. 한글 경로에서 Expo prebuild 프로세스가 Windows 상태 코드 `3221226505`로
   종료되어 ASCII exact-commit worktree를 검증 경로로 사용했다.
4. 새 셸에서 JAVA_HOME 및 Android SDK 환경이 상속되지 않은 두 번의 환경 실패가
   있었다. 경로를 명시한 뒤 동일 커밋에서 전체 네이티브 게이트가 통과했다.

## 남은 인수 조건

Task 14가 다음을 완료해야 Play 업로드 가능 상태가 된다.

1. 위 source tree에서 release AAB와 universal APK를 한 쌍으로 생성
2. 두 파일을 동시에 `verify:no-remote-push:artifacts`에 입력해 통과
3. 서명, versionCode, 설치·실기기 reminder·삭제 동작을 별도로 확인
4. 검증한 바로 그 AAB만 비공개 테스트 트랙에 업로드

이 조건 전에는 “최종 바이너리에서 FCM 완전 제거” 또는 “Play 업데이트 완료”로
표현하지 않는다.

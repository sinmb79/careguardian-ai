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
  - 일상 조회·부팅 복원 전에 corrupt/stale ledger key를 실제 저장 key 기준으로
    한 번의 `commit()`에 제거하고, 제거 커밋 실패 시 alarm 복원을 시작하지 않음
  - 개별 미래 alarm 복원 실패는 다음 항목 복원을 계속한 뒤 집계 예외로 반환하며,
    유효한 미래 ledger는 다음 재시도를 위해 유지
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
  - AAB/APK ZIP의 모든 비디렉터리 entry에 declared uncompressed size 기준
    항목당 256 MiB·합계 512 MiB 예산을 적용
  - 비스캔 `assets/`·`.so`는 내용을 열지 않고 metadata만 예산에 포함하며,
    DEX와 제한된 Android metadata만 기존 scan scope대로 스트리밍 검사
  - ZIP 안전성·중복·암호화·DEX 문자열·패키지 검사를 fail-closed 적용
  - 실제 ZIP fixture와 금지 DEX/manifest/dependency 변이 테스트 추가
- JS 전체 삭제 경계
  - Android에서 `LifeLocalNotifications` native module이 없으면 명시적으로
    fail-closed하고, iOS와 기타 미지원 플랫폼에서는 no-op 유지
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
| `060a86e7f900d6108cf9f8b3d0aa365559b735a3` | ZIP 예산·Android 삭제·ledger 복원 독립 리뷰 보완 |

## 검증 결과

### 전체 소스 게이트

`npm run verify` 성공:

- Vitest: 30 files, 298 tests 통과
- 웹 production build 통과
- 모바일 TypeScript 통과
- Expo Doctor: 18/18 통과
- static security, non-medical policy, model registry, audit policy,
  release workflow 통과
- 정책 및 보안 gate tests: 188개 통과
- no-remote-push tests: 35개 통과
- source dependency gate: 통과, `releaseBinaryPair=false`

생산 의존성 감사 기준선은 Critical 0, High 19, Moderate 9이며 2026-08-13까지
명시적으로 제한 수용된 상태다. 이 결과는 실제 AAB reachability의 안전성을
주장하지 않는다.

### 정확한 커밋의 실제 Android 게이트

한글 경로의 도구 충돌을 배제하기 위해
`C:\codex-task18-fix-060a86e7f900d6108cf9f8b3d0aa365559b735a3`에
구현 커밋의 detached worktree를 만들고 `npm ci --ignore-scripts` 후 아래 환경을
명시했다.

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

검증 스크립트 종료 후 생성 Android tree는 삭제되었고 source와 detached
worktree 모두 clean이었다. `yauzl`은 `3.4.0`이었다. detached worktree 제거 중
Windows long-path 제한으로 Git의 파일 삭제가 한 번 실패했지만 worktree 등록은
이미 제거된 상태였고, 검증한 exact path만 long-path 방식으로 삭제해 최종적으로
경로와 worktree 등록이 모두 남지 않았음을 확인했다.

### 커밋 동일성

- 네이티브 검증 직전 source 구현 HEAD = native HEAD =
  `060a86e7f900d6108cf9f8b3d0aa365559b735a3`
- source 구현 tree = native tree =
  `c6560bf6f7cef39a1c69faf4d46385f9fd2467c5`
- 후속 evidence 커밋은 이 보고서와 brief만 갱신하며 검증한 구현 tree는
  변경하지 않는다.

주요 Git blob도 양쪽에서 일치했다.

| 파일 | Git blob |
|---|---|
| `apps/mobile/app.json` | `1e2dc9c9dd139591e9ae7fbda0969c3ced7426e7` |
| `LifeLocalNotificationsModule.kt` | `7879ccf95fc3ab93dfc250c8c3ae3560b7541cca` |
| `NotificationScheduler.kt` | `8447eef032b7528701f126bcbdf2ad669a6a57bf` |
| `verify-no-remote-push.mjs` | `deef4e121fe462ceb4054418ed4a8adc5d3b26e7` |
| `lifeNotifications.ts` | `21400750e090c548148af581d751b8ee493fecb1` |
| `package-lock.json` | `eccea3dd3b403f03f799ee343724fc7797fe29b5` |

## 독립 리뷰 RED → GREEN 증거

1. 실제 deflate ZIP에서 스캔하지 않는 단일 `assets/` entry가 256 MiB를 초과해도
   기존 검사가 성공하는 RED를 확인했다.
2. 실제 deflate ZIP에서 `assets/`와 `.so`의 declared size 합이 512 MiB를
   초과해도 기존 검사가 성공하는 RED를 확인했다.
3. Android native module 부재 시 전체 삭제가 성공으로 반환하고, iOS/web에서
   native 삭제를 호출하는 RED를 확인했다.
4. corrupt ledger 한 건이 일상 조회와 복원을 중단시키고, 첫 alarm 복원 실패가
   이후 항목 복원을 막는 RED를 확인했다.
5. 구현 후 ZIP 35/35, 알림 TypeScript 15/15, native module 계약 16/16이
   각각 통과했고 전체 `npm run verify`와 exact-SHA native `all`도 통과했다.

## 실패에서 확인한 결함과 보완

1. 최초 clean prebuild 병합 매니페스트에서 `VIBRATE`가 암시적으로 추가됨을
   실제 게이트가 탐지했다. `blockedPermissions`와 회귀 테스트를 추가했다.
2. 그 다음 실제 Kotlin compile에서 인자 없는 Expo `Coroutine` 오버로드 모호성이
   확인됐다. 빈 parameter list를 명시한 `Coroutine { -> ... }`로 수정했다.
3. 한글 경로에서 Expo prebuild 프로세스가 Windows 상태 코드 `3221226505`로
   종료되어 ASCII exact-commit worktree를 검증 경로로 사용했다.
4. 새 셸에서 JAVA_HOME 및 Android SDK 환경이 상속되지 않은 두 번의 환경 실패가
   있었다. 경로를 명시한 뒤 동일 커밋에서 전체 네이티브 게이트가 통과했다.

## corrupt/stale alarm의 정확한 안전 경계

- corrupt/stale ledger key는 process-wide lock 안에서 한 번의 durable commit으로
  먼저 제거된다. 이 commit이 실패하면 어떤 미래 alarm도 복원하지 않는다.
- 제거된 key에 대응하는 alarm token이 나중에 receiver를 호출해도 ledger 일치가
  없으므로 알림은 게시되지 않아 inert하다.
- API 34 이상에서는 전체 삭제가 `AlarmManager.cancelAll()`도 호출한다. API 34
  미만에서는 식별할 수 없는 corrupt/stale PendingIntent token 자체가 남을 수
  있지만, ledger 제거 후 receiver가 소비할 항목이 없어 알림을 게시할 수 없다.
- full deletion은 corrupt 값 하나 때문에 중단되지 않도록 기존
  `readValidEntriesForDeletion()` best-effort reader를 그대로 유지한다.

## 남은 인수 조건

Task 14가 다음을 완료해야 Play 업로드 가능 상태가 된다.

1. 위 source tree에서 release AAB와 universal APK를 한 쌍으로 생성
2. 두 파일을 동시에 `verify:no-remote-push:artifacts`에 입력해 통과
3. 서명, versionCode, 설치·실기기 reminder·삭제 동작을 별도로 확인
4. 검증한 바로 그 AAB만 비공개 테스트 트랙에 업로드

이 조건 전에는 “최종 바이너리에서 FCM 완전 제거” 또는 “Play 업데이트 완료”로
표현하지 않는다.

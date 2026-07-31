# Task 11 독립 보안 검토 — 로컬 알림 Android 매니페스트

## 판정

**전체: FAIL** — 보존된 실제 release 매니페스트는 원격 푸시 표면을 제거한
상태로 통과했지만, release verifier가 원시 문자열 정규식에 의존하여 의미상 같은
XML을 통과시키는 우회가 확인되었습니다. 이 결함을 고치기 전에는 verifier를
fail-closed 보안 게이트라고 단정할 수 없습니다.

검토 범위는 구현 커밋
`443351beb3e9707ca395e6bda3b2f486f683673c`, 실제 보고서 커밋
`5cbd60af92a50aa51b7a2bd8332f3059449b9c4b`, 그리고 아래 보존 매니페스트입니다.

```text
C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-ascii-manifest-20260731\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml
SHA-256: AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D
```

## Critical — PASS

### C-11-01 — 실제 release 산출물에는 FCM/C2DM 수신 시작점이 없음

**상태: PASS.** 지정 SHA-256을 독립 재계산하여 일치시켰고, 동일 파일에
`node apps/mobile/scripts/verify-android-release-manifest.mjs <manifest>`를 직접
실행해 `status: "pass", problems: []`를 확인했습니다. 원시 매니페스트 검색도
아래 항목에 대해 일치값 0건이었습니다.

- `com.google.android.c2dm.permission.RECEIVE`
- Expo `ExpoFirebaseMessagingService`
- Firebase Instance ID receiver, Messaging service, Init provider,
  ComponentDiscoveryService
- Messaging / Installations / DataTransport registrar
- 16개 ShortcutBadger launcher badge permission

세 disable metadata는 각각 정확히 한 번 존재하며 모두 `false`입니다. 이 검증은
`apps/mobile/scripts/verify-android-release-manifest.mjs:140-148`의 exact-one 검사와
실제 XML inventory로 교차 확인했습니다.

### C-11-02 — 로컬 알림 복구 표면은 유지됨

**상태: PASS.** 실제 manifest에 `POST_NOTIFICATIONS`, `VIBRATE`,
`RECEIVE_BOOT_COMPLETED`가 남아 있으며,
`expo.modules.notifications.service.NotificationsService` 및
`NotificationForwarderActivity`도 모두 `exported=false`로 남아 있습니다.
NotificationsService의 intent action에는 적어도 다음 세 항목이 존재합니다.

- `expo.modules.notifications.NOTIFICATION_EVENT`
- `android.intent.action.BOOT_COMPLETED`
- `android.intent.action.MY_PACKAGE_REPLACED`

따라서 이 실제 산출물에서 로컬 예약·부팅/교체 복구 계약을 제거하지 않고
원격 푸시 등록·수신 표면만 제거한 결과는 확인됩니다.

## Important — FAIL

### I-11-01 — XML 의미론을 해석하지 않는 verifier 우회

**상태: FAIL.** `apps/mobile/scripts/verify-android-release-manifest.mjs:58-87`은
`android:name`의 원시 텍스트 정규식과 부분 문자열 검색을 사용합니다.
`validateReleaseManifest()`에 hardened fixture를 다음과 같이 메모리상 변이해
각각 실행했을 때 세 경우 모두 `status: "pass"`였습니다.

1. C2DM permission의 마지막 `E`를 XML character reference로 치환:
   `RECEIV&#69;`. XML 파서는 `RECEIVE`로 해석하지만 line 58-61의 정규식은 탐지하지
   못합니다.
2. Android namespace에 별칭 `a`를 추가하고
   `<service a:name="com.google.firebase.messaging.FirebaseMessagingService" />`를
   추가. namespace URI는 동일하지만 verifier는 `android:name`만 찾습니다.
3. NotificationsService의 진짜 `BOOT_COMPLETED` `<action>`을 제거하고 receiver
   내부에 동명 `<meta-data>`를 넣음. line 127-130은 action tag가 아니라 해당 block
   안의 이름 문자열만 찾으므로 로컬 복구 action이 없는 XML도 통과합니다.

영향은 두 갈래입니다. 첫째, 비정규 XML 직렬화가 발생하면 금지된 FCM/C2DM 표면을
release gate가 탐지하지 못할 수 있습니다. 둘째, 로컬 알림의 필수 action 계약도
실제로는 사라질 수 있습니다. 현재 Gradle이 생성한 보존 매니페스트는 표준
`android:` 표기라서 이 문제가 현재 artifact의 원격 푸시 잔존을 뜻하지는 않지만,
향후 변경에 대한 fail-closed 보장은 깨집니다.

**권고:** XML parser를 사용해 Android namespace URI 기준으로 attributes를 읽고,
permission은 `uses-permission`, component는 정확한 element 종류, action은
`receiver > intent-filter > action`에서 각각 비교하십시오. character reference와
prefix alias, action 대신 meta-data를 넣는 세 mutation test를 추가해야 합니다.

## Minor — PASS

### M-11-01 — 잔존 Google Play services / DataTransport component의 해석

**상태: PASS (현 no-remote-push 계약 기준).** 실제 manifest에는
`com.google.android.gms.common.api.GoogleApiActivity`와 DataTransport의
`TransportBackendDiscovery`, `JobInfoSchedulerService`,
`AlarmManagerSchedulerBroadcastReceiver`가 남아 있습니다. 전자는
`exported=false` activity이고, DataTransport service/receiver도 모두
`exported=false`입니다. 동시에 Firebase Init provider, ComponentDiscoveryService,
Messaging/Installations/Transport registrar 및 FCM receive/service가 없습니다.

그러므로 이 잔존 항목들은 독립적으로 C2DM broadcast를 받거나 Expo FCM token을
등록하는 시작점이 아니며, Task 11의 **원격 푸시 부재** 주장을 뒤집는 Critical
finding은 아닙니다. 다만 DataTransport 클래스 자체가 APK에서 사라졌다는 주장은
할 수 없습니다. 제품 약속을 장래에 “어떠한 Google transport runtime도 없음”으로
확장한다면 dependency/APK class inventory를 별도 정책으로 만들어야 합니다.

## 구현 및 게이트 검토

- 플러그인은 `apps/mobile/plugins/with-local-only-notifications.js:3-31`에서 C2DM,
  16개 badge permission, Expo/Firebase component를 명시하고, line 49-60에서 같은
  이름의 기존 entry를 제거한 뒤 하나의 `tools:node="remove"` entry를 다시 넣습니다.
  unit test는 같은 manifest에 두 번 적용해 중복 없이 유지됨을 확인하므로
  idempotence와 manifest-merge remove 전략은 **PASS**입니다.
- 실제 release merge가 모든 제거를 반영했으므로 plugin 순서 및 manifest merger
  효과도 이 artifact에 대해서는 **PASS**입니다.
- `scripts/check-non-medical-release.mjs:1844-1849`는 plugin 존재를 확인하고,
  local hardening line-contract는 모든 remove 항목과 pure application line의 exact
  count를 검사합니다. 관련 mutation test가 각 remove line, plugin 등록, application
  호출을 제거하면 실패함을 확인하므로 source drift 억제는 **PASS**입니다.
- 다만 exact line policy는 source 변경 억제 장치일 뿐 final XML의 의미론적 검증을
  대체하지 못합니다. I-11-01 수정 전에는 두 계층을 모두 PASS로 판정할 수 없습니다.

## 재실행 증거

| 명령 | 결과 |
| --- | --- |
| `npm run release:policy-check:test` | PASS — 75 tests |
| `npm run release:policy-check` | PASS — 111 files, 0 problems |
| `npm run mobile:typecheck` | PASS |
| 보존 release manifest에 focused verifier 직접 실행 | PASS — 0 problems |
| `npm run verify:android-release -- manifest` | 환경 FAIL — Expo clean prebuild가 한글 worktree path에서 `0xC0000005` (3221226505)로 종료 |

마지막 실패는 source 또는 artifact 보안 실패로 분류하지 않았습니다. 구현 보고서에
기록된 동일한 Windows Unicode-path Expo prebuild 문제이며, verifier wrapper의
`finally` 복구 뒤 Android tree가 남지 않았고, audit 시작 전부터 있던 별도
uncommitted static-security 변경만 보존되어 있습니다. 이 검토에서는 제품 코드를
수정하지 않았습니다.

## 결론

실제 SHA-pinned release manifest는 Task 11의 remote-push surface 제거와 로컬 알림
보존을 충족합니다. 그러나 verifier의 raw-regex 구현은 보안 release gate로서
Important FAIL입니다. XML namespace/value decoding 및 element hierarchy 기반 parser로
교체하고 위 세 우회 mutation을 red/green test로 추가한 뒤, ASCII path에서 native
manifest contract를 다시 실행해야 전체 판정을 PASS로 올릴 수 있습니다.

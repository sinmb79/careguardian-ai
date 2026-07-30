# Task 11 독립 재검토 수정 보고서 — Fix round 3

## 상태

`DONE`

재검토 커밋 `b0f6a7a`의 `I-R2-01`과 `M-R2-01`을 수정했습니다.

- 구현 커밋:
  `001e8a5c75ccf02616390ba155b669d74a4647b1`
- 변경 범위: Task 11 verifier 및 해당 Node test 2개 파일
- Task 13b 및 review 문서는 수정, stage, commit하지 않았습니다.

## RED 증거

생산 verifier 변경 전에 Android permission element와 XML DTD 관련 테스트를
추가했습니다.

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

최종 RED 실행 결과: **95개 중 66개 통과, 29개 실패**.

29개 실패는 26개 leaf case와 실패한 세 parent group으로 구성됩니다.

1. `<uses-permission-sdk-23>`에 C2DM permission을 넣은 1개 case
2. 같은 element에 16개 ShortcutBadger permission을 각각 넣은 16개 case
3. element-scoped Android URI alias로 표현한 sdk-23 C2DM 1개 case
4. 필수 `VIBRATE`를 공식 sdk-23 element로 옮긴 정상 XML을 인식하지 못한
   positive 1개 case
5. application descendant의 sdk-23 C2DM declaration을 decoy로 무시한 1개 case
6. root의 `uses-permission-sdk-24`, descendant의
   `uses-permission-future`, 다른 namespace의
   `uses-permission-sdk-23`을 통과시킨 3개 case
7. benign, external SYSTEM, internal entity DOCTYPE을 통과시킨 3개 case

표준 XML declaration을 `standalone="yes"`와 함께 사용한 정상 XML은 RED
단계에서도 계속 통과했습니다.

## 구현

### Android permission inventory

- 공식 permission element를 정확히 다음 두 종류로 고정했습니다.
  - 빈 element namespace의 `uses-permission`
  - 빈 element namespace의 `uses-permission-sdk-23`
- 두 종류의 root 직계 element에서 Android namespace expanded-name
  `{http://schemas.android.com/apk/res/android}name`을 같은 permission
  inventory로 읽습니다.
- C2DM 및 16개 badge 금지 검사는 두 공식 element 종류에 동일하게 적용됩니다.
- 필수 로컬 permission도 두 공식 root element 종류 중 하나에 존재하면
  인정합니다.
- manifest 전체 descendant를 순회하여 local name이 `uses-permission`이거나
  `uses-permission-*`인 element를 모두 찾습니다.
- 공식 두 종류가 application 또는 다른 descendant에 있으면 Android
  `name`을 검사해 금지값을 탐지하는 동시에, root 직계가 아니라는 구조
  문제로 실패합니다.
- `uses-permission-sdk-24`, `uses-permission-future` 등 알 수 없는 변형과
  다른 element namespace에 있는 permission-like element는 fail-closed로
  거부합니다.
- attribute prefix 철자와 선언 위치는 계속 무관하며 parsed namespace URI를
  기준으로 판별합니다.

### DTD 및 entity lexical preflight

- namespace-aware SAX parser의 semantic tree가 만들어지기 전 lexical event에
  rejection handler를 연결했습니다.
- `ondoctype`에서 benign, SYSTEM/PUBLIC, internal subset을 포함한 모든
  DOCTYPE을 거부합니다.
- `onsgmldeclaration`에서도 DTD/entity 계열 선언을 거부합니다.
- XML declaration은 처리 대상에서 제외되며 정상적으로 허용됩니다.
- 원시 문자열 부분 검색이나 외부 DTD 접근에는 의존하지 않습니다.

## GREEN 검증

### 집중 verifier 테스트

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

결과: **95/95 통과**.

### 전체 관련 policy test

```powershell
npm run release:policy-check:test
```

결과: **120/120 통과**. 이전 90개와 신규 permission/DTD 검증 30개가 모두
통과했습니다.

### 전체 저장소 검증

```powershell
npm run verify
```

결과: 종료 코드 0, 전체 PASS.

- Vitest: 30개 파일, 280개 테스트 통과
- web TypeScript 및 Vite production build 통과
- static-security gate 통과
- mobile typecheck 통과
- Expo doctor 18/18 통과
- non-medical policy, model registry, audit policy, release workflow gate 및
  모든 gate test 통과
- production audit는 기존 승인된 baseline 상태를 그대로 확인했으며, 이
  작업이 dependency advisory를 제거했다고 주장하지 않습니다.

별도 재실행:

```powershell
npm run mobile:typecheck
npm run release:policy-check
git diff --check
```

결과:

- mobile TypeScript 검사 통과
- release policy: **111개 파일 검사, 문제 0개**
- Task 11 변경 파일 whitespace 문제 0개

## ASCII 실제 release 병합 검증

한글 경로의 기존 Expo prebuild 환경 문제를 피하기 위해 ASCII 작업트리에 구현
커밋을 detached checkout했습니다.

- 작업트리:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-final-android-v7-20260731`
- 검증 커밋:
  `001e8a5c75ccf02616390ba155b669d74a4647b1`
- 런타임: 휴대용 Node.js 22.23.2

`npm run verify:android-release -- manifest`는 종료 코드 0으로 완료됐습니다.
같은 SHA에서 clean Expo prebuild와 Gradle manifest merge를 직접 다시 실행해
결과를 명시적으로 확인했습니다.

- Expo clean Android prebuild: 성공
- Gradle `:app:processReleaseManifest`:
  **BUILD SUCCESSFUL in 41s**, 55개 task 실행
- verifier: `status: pass`
- `problems: []`

실제 병합 산출물 보존 경로:

`C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-permission-evidence-001e8a5\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml`

SHA-256:

`AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D`

보존 파일을 새 verifier에 직접 전달한 결과도 `pass`, 문제 0개입니다. SHA는
이전 보존 release manifest와 동일하므로 실제 생성 manifest와 로컬 알림
surface는 변경되지 않았습니다.

verifier 통과로 다음을 함께 확인했습니다.

- `uses-permission-sdk-23`을 포함한 공식 permission inventory에서 C2DM 및
  16개 badge permission 없음
- Expo/Firebase FCM receiver, service, provider, registrar 없음
- `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` 유지
- `NotificationsService`, `NotificationForwarderActivity` 유지
- `NOTIFICATION_EVENT`, `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED` 유지
- Firebase messaging/analytics/ad-ID disable metadata가 각각 정확히 한 번이며
  모두 `false`

검증 후 생성 Android 트리를 증거 경로로 이동하고 기존 ignored Android 트리를
원래 위치에 복원했습니다. ASCII 작업트리는 clean 상태였습니다. 주 작업트리의
Task 11 파일도 clean이며, 타 에이전트의 별도 unstaged static-security test는
그대로 보존하고 본 커밋에서 제외했습니다.

## 변경 파일

- `apps/mobile/scripts/verify-android-release-manifest.mjs`
- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs`
- 본 fix round 3 보고서

## 자체 검토

- 두 Android 공식 permission element가 동일 inventory와 denylist를
  공유합니다.
- nested 또는 알 수 없는 permission-like element는 decoy가 될 수 없습니다.
- scoped Android namespace alias는 URI 의미로 처리됩니다.
- XML declaration은 허용하지만 DOCTYPE, external subset, internal DTD/entity
  declaration은 semantic 검사 전에 거부됩니다.
- 실제 manifest 생성 결과와 로컬 예약 알림 기능은 변경하지 않았습니다.
- 최종 서명 APK의 예약·취소·부팅 복원 기기 smoke는 통합 컨트롤러 단계입니다.

## 커밋

- 구현 및 회귀 테스트:
  `001e8a5c75ccf02616390ba155b669d74a4647b1`
- 본 보고서: 후속 문서 전용 커밋

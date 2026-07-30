# Task 11 독립 재검토 수정 보고서 — Fix round 2

## 상태

`DONE`

독립 재검토 커밋 `6dcedc6`의 Important finding `I-RR-01`과
`I-RR-02`를 모두 수정했습니다.

- 구현 커밋:
  `cde907eaedf8f88e1886ef396a0c23eb3692954a`
- 변경 범위: Task 11 verifier와 해당 Node test 2개 파일
- Task 13b의 static-security 파일은 수정, stage, commit하지 않았습니다.

## RED 증거

생산 verifier 변경 전에 다음 8개 namespace·malformed XML 회귀 테스트를
추가했습니다.

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

결과: **65개 중 57개 통과, 8개 실패**.

1. `uses-permission` 자체에 선언한 Android URI alias의 C2DM permission을
   놓쳤습니다.
2. `service` 자체에 선언한 Android URI alias의 Firebase Messaging service를
   놓쳤습니다.
3. `application`에 선언해 descendant service가 상속한 Android URI alias를
   놓쳤습니다.
4. `application` scoped alias로 추가한 duplicate disable metadata를
   놓쳤습니다.
5. 필수 receiver에서 `android` prefix를 `urn:not-android`로 재바인딩한
   경우에도 필수 receiver가 있다고 오인했습니다.
6. 필수 action 자체에 선언한 올바른 Android URI alias를 인식하지 못했습니다.
7. 동일 element에 lexical `android:name`을 두 번 선언한 malformed XML을
   통과시켰습니다.
8. entity로 인코딩한 Android URI alias와 `android:` prefix가 같은 expanded
   `name` attribute를 중복 선언한 malformed XML을 통과시켰습니다.

이는 재검토에서 지적한 scoped namespace alias, descendant rebind, duplicate
lexical attribute, duplicate expanded-name attribute를 모두 RED로 재현한
결과입니다.

## 구현

- 현재 lock에 이미 포함된 `xml2js` parser를 `xmlns: true`, `strict: true`로
  사용했습니다. package 또는 lock 변경과 새 dependency 추가는 없습니다.
- 각 parsed attribute의 `uri`, `local`, `value`를 직접 사용합니다. prefix
  철자나 root namespace 선언 위치에 의존하지 않습니다.
- Android attribute는 expanded name
  `{http://schemas.android.com/apk/res/android}name` 및 `value`로
  의미적으로 판별합니다.
- element도 parsed namespace URI와 local name을 함께 확인합니다. Android
  manifest element 계약은 빈 namespace의 정확한 element 종류만 인정합니다.
- SAX `onattribute` 단계에서 같은 element의 모든 attribute expanded name을
  추적합니다. 동일 lexical attribute와 서로 다른 alias의 동일 expanded-name
  attribute를 parser map이 덮어쓰기 전에 거부합니다.
- namespace declaration의 URI도 character reference 해석 후 비교합니다.
- ancestor에서 이미 사용 중인 prefix를 descendant가 다른 URI로 재바인딩하면
  fail-closed parse problem으로 거부합니다. 새 scoped alias 또는 동일 URI의
  중복 없는 선언은 정상적으로 허용합니다.
- C2DM 및 badge permission은 root 직계 `uses-permission`, 금지 component는
  application 직계의 정확한 element 종류에서 검사합니다.
- local receiver action은 계속 정확히
  `receiver > intent-filter > action`에서만 인정합니다.
- 세 disable metadata는 application 직계 Android metadata로 정확히 한 번,
  값이 `false`일 때만 인정합니다.

## GREEN 검증

### 집중 verifier 테스트

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

결과: **65/65 통과**.

### 전체 관련 release policy 테스트

```powershell
npm run release:policy-check:test
```

결과: **90/90 통과**. 기존 82개와 신규 namespace·duplicate 회귀 8개가 모두
통과했습니다.

```powershell
npm run release:policy-check
```

결과: **111개 파일 검사, 문제 0개**.

### 타입 및 전체 회귀

```powershell
npm run mobile:typecheck
npm test -- --run
git diff --check
```

결과:

- mobile TypeScript 검사 통과
- Vitest 30개 파일, 280개 테스트 통과
- Task 11 변경 파일 whitespace 문제 0개

## ASCII 실제 release 병합 검증

한글 경로의 기존 Expo prebuild 환경 충돌을 피하기 위해 ASCII 작업트리에 구현
SHA를 detached checkout했습니다.

- 작업트리:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-final-android-v7-20260731`
- 검증 커밋:
  `cde907eaedf8f88e1886ef396a0c23eb3692954a`
- 런타임: 휴대용 Node.js 22.23.2

```powershell
npm run verify:android-release -- manifest
```

결과:

- Expo clean Android prebuild 성공
- Gradle `:app:processReleaseManifest` **BUILD SUCCESSFUL in 42s**
- namespace-aware verifier `status: pass`
- `problems: []`

같은 고정 커밋으로 생성한 실제 병합 파일을 다음 경로에 보존했습니다.

- 병합 매니페스트:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-scope-evidence-cde907e\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml`
- SHA-256:
  `AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D`
- 보존 파일 직접 verifier: `pass`, 문제 0개

SHA-256은 이전 두 번의 보존 release manifest와 동일합니다. 따라서 manifest
생성 결과는 바뀌지 않았으며 verifier의 namespace/malformed XML 방어만
강화되었습니다.

verifier 통과는 다음 계약을 함께 확인합니다.

- C2DM, FCM/Expo Firebase component, Firebase registrar/init provider,
  16개 badge permission: 0
- `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`: 유지
- `NotificationsService`, `NotificationForwarderActivity`: 유지
- `NOTIFICATION_EVENT`, `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`: 유지
- Firebase messaging/analytics/ad-ID disable metadata: 각각 정확히 한 번이며
  모두 `false`

검증 후 생성 Android 트리를 증거 경로로 이동하고 기존 ignored Android 트리를
원래 위치에 복원했습니다. ASCII 검증 작업트리와 주 작업트리 모두 clean
상태임을 확인했습니다.

## 변경 파일

- `apps/mobile/scripts/verify-android-release-manifest.mjs`
- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs`
- 본 fix round 2 보고서

## 자체 검토

- 정상 root alias, element-scoped alias, application-scoped alias를 Android URI
  의미로 동일하게 처리합니다.
- descendant prefix rebind와 duplicate expanded-name attribute는 parser 결과가
  만들어지기 전에 fail-closed로 차단합니다.
- 금지 component 이름이 다른 element 종류에 있는 decoy는 계속 오탐하지
  않습니다.
- 실제 release manifest와 로컬 알림 기능 surface는 변경하지 않았습니다.
- 최종 서명 APK의 예약·취소·부팅 복원 기기 smoke는 통합 컨트롤러 단계입니다.

## 커밋

- 구현 및 회귀 테스트:
  `cde907eaedf8f88e1886ef396a0c23eb3692954a`
- 본 보고서: 후속 문서 전용 커밋

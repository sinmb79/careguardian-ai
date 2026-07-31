# Task 11 Android 로컬 알림 하드닝 Fix round 3 독립 재검토

## 판정

**전체: PASS**

Fix round 3는 이전 독립 재검토의 Important finding인
`<uses-permission-sdk-23>` permission 우회와 Minor finding인 DOCTYPE 허용을
모두 닫았습니다. 새 Critical, Important, Minor finding은 없습니다.

| 심각도 | 판정 | 결과 |
| --- | --- | --- |
| Critical | PASS | 실제 release 병합 manifest의 identity, forbidden surface 0개, 필수 로컬 알림 surface 보존 확인 |
| Important | PASS | sdk23 C2DM+16 badge, 알 수 없는·중첩·접두사 permission 선언, 이전 namespace·중복 회귀 모두 차단 |
| Minor | PASS | benign, internal, external, entity 기반 DTD/SGML 선언을 모두 fail-closed 거부 |

검토 기준:

- Fix round 3 구현:
  `001e8a5c75ccf02616390ba155b669d74a4647b1`
- 구현 보고서:
  `1d9a5e60610392690010407cfe586b380556ba6e`
- 이전 독립 FAIL:
  `b0f6a7ab4437347c9ce98df9b524acdd47a66829`
- 현재 HEAD까지
  `apps/mobile/scripts/verify-android-release-manifest.mjs`와
  `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs`에 구현
  커밋 이후 변경이 없음을 path-limited `git diff --exit-code`로 확인

## Critical — PASS

### C-R3-01 — 실제 release 병합 manifest identity와 금지 surface

다음 보존 산출물을 직접 다시 검사했습니다.

```text
C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-permission-evidence-001e8a5\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml
```

SHA-256 재계산 결과:

```text
AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D
```

직접 verifier 실행 결과:

```json
{
  "gate": "android-release-manifest",
  "status": "pass",
  "problems": []
}
```

C2DM, 16개 launcher badge permission, Expo/Firebase FCM
receiver/service/provider, ComponentDiscovery 및
Messaging/Installations/DataTransport registrar의 exact denylist 전체를 raw
manifest와 verifier 양쪽에서 다시 검사했습니다.

```text
FORBIDDEN_SURFACE_HITS=0
```

실제 permission element와 값은 다음과 같습니다.

- `uses-permission`: 10개
- `uses-permission-sdk-23`: 0개
- `INTERNET`, `POST_NOTIFICATIONS`
- `USE_BIOMETRIC`, `USE_FINGERPRINT`
- `VIBRATE`, `RECEIVE_BOOT_COMPLETED`
- `DETECT_SCREEN_CAPTURE`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`
- 앱의 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

필수 로컬 알림 surface도 semantic XML inventory로 확인했습니다.

- `NotificationsService`: 정확히 1개, `enabled=true`, `exported=false`
- `NotificationForwarderActivity`: 정확히 1개, `exported=false`
- receiver action:
  `NOTIFICATION_EVENT`, `BOOT_COMPLETED`, `REBOOT`,
  Android/HTC `QUICKBOOT_POWERON`, `MY_PACKAGE_REPLACED`
- `firebase_messaging_auto_init_enabled=false`: 정확히 1개
- `firebase_analytics_collection_enabled=false`: 정확히 1개
- `google_analytics_adid_collection_enabled=false`: 정확히 1개

따라서 실제 병합 산출물에는 원격 push receive/registration 또는 badge
permission surface가 없고, 로컬 예약·표시·재부팅 복원에 필요한 manifest
surface는 보존되어 있습니다.

## Important — PASS

### I-R3-01 — sdk23 C2DM 및 16개 badge permission 공통 denylist

구현 위치:

- `apps/mobile/scripts/verify-android-release-manifest.mjs:67-70`
- `apps/mobile/scripts/verify-android-release-manifest.mjs:220-261`
- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs:489-546`

`uses-permission`과 `uses-permission-sdk-23`을 같은 공식 permission inventory에
넣고 같은 C2DM/badge denylist를 적용합니다. 독립 runner에서
`uses-permission-sdk-23`으로 C2DM 1개와 badge permission 16개를 각각 주입한
17개 변이가 모두 `status=fail`이었고 정확한 forbidden permission 문제를
보고했습니다.

추가로 다음 변이도 모두 올바르게 차단했습니다.

- element-scoped Android namespace alias의 sdk23 C2DM
- numeric character reference로 끝 글자를 표현한 sdk23 C2DM
- root `uses-permission-sdk-24`
- root `uses-permission-future`
- root `uses-permission-`
- application 아래에 중첩한 `uses-permission`
- application 아래에 중첩한 `uses-permission-sdk-23`
- application 아래에 중첩한 `uses-permission-future`
- foreign namespace prefix의 `uses-permission`
- foreign namespace prefix의 `uses-permission-sdk-23`
- Android URI로 namespace된 prefixed sdk23 element
- foreign default namespace 아래의 descendant sdk23 element

공식 두 element가 아닌 `uses-permission-*`, non-empty element namespace,
manifest root의 직계 자식이 아닌 선언을 fail-closed 거부하므로 permission
declaration을 decoy 구조로 숨길 수 없었습니다.

### I-R3-02 — 이전 namespace, duplicate, action, metadata 회귀

독립 변이 결과:

- 문서 전체 Android namespace alias: 정상 PASS
- element-scoped Android alias의 C2DM: 금지 탐지 FAIL
- descendant `android` prefix URI rebind: parse FAIL
- 같은 element의 duplicate lexical `android:name`: parse FAIL
- 별도 alias를 이용한 duplicate expanded `{Android URI}name`: parse FAIL
- foreign default namespace의 manifest root: parse/semantic FAIL
- namespaced required-action decoy: required action 누락 FAIL
- namespaced disable-metadata decoy: required metadata 누락 FAIL
- alias로 추가한 duplicate disable metadata: occurrence/value FAIL
- required permission의 foreign `name` attribute: required permission 누락 FAIL
- comment/CDATA 안 forbidden 문자열: inert decoy로 정상 PASS
- comment 안 required action: semantic action으로 인정하지 않고 FAIL

이전 namespace scope와 duplicate expanded attribute 수정도 회귀하지
않았습니다.

## Minor — PASS

### M-R3-01 — DOCTYPE, DTD 및 entity 선언 fail-closed

구현 위치:

- `apps/mobile/scripts/verify-android-release-manifest.mjs:126-168`
- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs:570-593`

SAX `ondoctype`와 `onsgmldeclaration` event가 선언을 semantic 검사 전에
parse failure로 바꿉니다. 다음 독립 변이를 모두 거부했습니다.

- benign `<!DOCTYPE manifest>`
- SYSTEM external subset
- PUBLIC external subset
- internal general entity
- internal external entity
- internal parameter entity
- external parameter entity
- PUBLIC general entity
- external subset과 internal subset의 결합
- standalone `ENTITY`, `ELEMENT` 선언
- internal `ATTLIST`, `ELEMENT`, `NOTATION` 선언
- nested entity expansion 선언
- BOM, comment 또는 processing instruction 뒤의 실제 DOCTYPE
- XML declaration이 없는 DOCTYPE
- 소문자 malformed doctype와 undeclared entity reference

반대로 표준 XML declaration과 `standalone="yes"` declaration은 PASS했고,
comment/CDATA 안의 DOCTYPE 문자열은 실행되지 않는 text로 정상 PASS했습니다.
numeric character reference는 XML parser가 decode한 뒤 C2DM denylist가
정상 탐지했습니다.

## 독립 pressure-test 결과

저장 파일을 만들지 않는 in-memory Node runner를 두 번 실행했습니다.

```powershell
@'
# hardened-local.xml을 읽고 validateReleaseManifest()에 변이별 전달
'@ | node --input-type=module -
```

결과:

```text
permission/namespace/duplicate/action/metadata/DTD matrix:
total=57, matched=57, mismatches=0

extended DTD/internal/external/entity matrix:
total=11, matched=11, mismatches=0

독립 변이 합계:
total=68, mismatches=0
```

각 공격 변이의 PASS가 아니라, 예상한 `status=fail`과 문제 유형까지 일치해야
`matched`로 계산했습니다. comment/CDATA 및 정상 XML alias처럼 안전한 대조군은
예상한 `status=pass`, `problems=[]`를 요구했습니다.

## 공식 회귀 및 정책 검증

실행:

```powershell
npm run release:policy-check:test
npm run release:policy-check
npm run mobile:typecheck
```

결과:

- `release:policy-check:test`: **120/120 PASS**
- sdk23 C2DM+16 badge 공식 mutation: **17/17 차단**
- unknown/nested/prefixed permission 및 DOCTYPE 공식 regression: 전부 PASS
- `release:policy-check`: **111개 파일 검사, 문제 0개**
- `mobile:typecheck`: PASS

실제 산출물 재검증:

```powershell
$manifest = 'C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-permission-evidence-001e8a5\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml'
Get-FileHash -LiteralPath $manifest -Algorithm SHA256
node apps/mobile/scripts/verify-android-release-manifest.mjs $manifest
```

결과는 기대 SHA와 동일하고 verifier `pass`, `problems=[]`입니다.

구현 identity 확인:

```powershell
git diff --exit-code 001e8a5c75ccf02616390ba155b669d74a4647b1..HEAD -- `
  apps/mobile/scripts/verify-android-release-manifest.mjs `
  apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

결과: 차이 없음.

## 범위와 잔여 확인

- 이 독립 재검토에서는 제품 코드와 verifier를 수정하지 않았습니다.
- 보고서 한 파일만 추가하며 다른 작업 흐름의 static-security 파일은
  stage 또는 commit하지 않았습니다.
- 최종 서명 APK에서 예약·취소·재부팅 복원을 확인하는 실제 기기 smoke는
  통합 컨트롤러의 별도 functional gate입니다. 이는 이번 source/verifier 및
  SHA-pinned merged-manifest 보안 판정의 finding이 아닙니다.

## 결론

Fix round 3는 이전 `uses-permission-sdk-23` 우회와 DOCTYPE 허용을 모두
해결했습니다. 실제 release 병합 산출물의 금지 surface는 0개이고 로컬 알림
surface는 유지됩니다. 68개 독립 변이와 120개 공식 회귀에서 새 우회가
재현되지 않았으므로 Task 11 Android local-notification-only hardening을
**Critical PASS / Important PASS / Minor PASS / 전체 PASS**로 판정합니다.

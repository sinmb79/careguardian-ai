# Task 11 Android 로컬 알림 하드닝 독립 재검토

## 판정

**전체: FAIL**

실제 SHA-pinned release 병합 매니페스트는 원격 푸시 표면 제거와 로컬 알림
표면 보존을 충족합니다. 최초 검토에서 지적한 XML character reference,
root-level Android namespace alias, action-to-metadata decoy도 수정되었습니다.
그러나 Android namespace binding을 manifest root에서만 수집하기 때문에 유효한
element/application-scoped alias가 검사를 우회하고, 사용 중인 XML parser가
중복 attribute가 있는 비정상 XML을 거부하지 않는 두 Important finding이
남아 있습니다.

| 심각도 | 판정 | 결과 |
| --- | --- | --- |
| Critical | PASS | 실제 release manifest에 원격 푸시 시작·수신·등록 표면 없음 |
| Important | FAIL | namespace scope 우회 1건, malformed duplicate attribute 우회 1건 |
| Minor | PASS | 추가 Minor finding 없음 |

검토 대상:

- parser 수정: `3215e51160f766e0f0e13788ff066623db306435`
- 수정 보고서: `87eb5859035712df9a3f7b32beb8d7c6f8866f6c`
- 이전 독립 검토: `78145bc93273b35d247748cee0939c54582aca53`
- 관련 verifier 파일은 수정 커밋 이후 현재 HEAD까지 변경되지 않았음을
  `git diff 3215e511..HEAD -- <four implementation files>`로 확인함

## Critical — PASS

### C-RR-01 — 실제 release 매니페스트 inventory

**상태: PASS.** 다음 보존 파일의 SHA-256을 직접 다시 계산했고 지정값과
일치했습니다.

```text
C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-parser-evidence-3215e51\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml
AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D
```

같은 파일을 현재 parser verifier에 직접 전달한 결과는
`status: pass`, `problems: []`입니다. namespace-aware .NET XML inventory로도
다음을 확인했습니다.

- C2DM receive permission, Expo FCM service, Firebase Instance ID receiver,
  Firebase Messaging service, Firebase Init provider 및
  ComponentDiscoveryService가 없음
- Messaging / Installations / DataTransport registrar가 없음
- 16개 ShortcutBadger badge permission이 없음
- `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`가 있음
- `NotificationsService`와 `NotificationForwarderActivity`가 모두
  `exported=false`로 있음
- `NotificationsService`에 `NOTIFICATION_EVENT`, `BOOT_COMPLETED`,
  `REBOOT`, 두 QUICKBOOT action, `MY_PACKAGE_REPLACED`가 있음
- `firebase_messaging_auto_init_enabled`,
  `firebase_analytics_collection_enabled`,
  `google_analytics_adid_collection_enabled`가 각각 정확히 한 번이며 `false`

실제 남은 component는 다음과 같습니다.

- activities: `MainActivity`, `NotificationForwarderActivity`,
  `GoogleApiActivity`
- receivers: `NotificationsService`, `ProfileInstallReceiver`,
  DataTransport `AlarmManagerSchedulerBroadcastReceiver`
- services: DataTransport `TransportBackendDiscovery`,
  `JobInfoSchedulerService`
- providers: AndroidX `InitializationProvider`, Expo FileSystem provider

GoogleApiActivity 및 DataTransport component는 모두 기존 검토와 같이 원격 FCM
수신·등록 시작점이 아니며, 관련 잔존 component는 `exported=false`입니다.
따라서 현 실제 artifact에 대한 Critical finding은 없습니다.

### C-RR-02 — 최초 세 우회 및 구조 검증

**상태: PASS.** `validateReleaseManifest()`에 메모리상 변이를 직접 전달하여
다음을 다시 확인했습니다.

- `RECEIV&#69;` C2DM permission: FAIL, C2DM 문제 보고
- manifest root에 선언한 Android URI alias의 FCM service: FAIL
- `BOOT_COMPLETED` action을 동명 `meta-data`로 교체: FAIL
- 닫는 manifest tag 제거: FAIL, XML parse 문제 보고
- application 중복: FAIL, exactly-one application 문제 보고
- root alias를 사용한 duplicate disable metadata: FAIL

`apps/mobile/scripts/verify-android-release-manifest.mjs:125-137`은 parse 예외와
manifest root 부재를 실패로 반환하고, line 203-226은 receiver 직계
`intent-filter > action`만 인정합니다. 기존 세 우회에 대한 수정은 유효합니다.

## Important — FAIL

### I-RR-01 — Android namespace의 XML scope를 해석하지 않아 scoped alias가 우회됨

**상태: FAIL.** 위치:
`apps/mobile/scripts/verify-android-release-manifest.mjs:86-110`.

`androidNamespacePrefixes()`는 `manifestRoot.$`에 직접 선언된 `xmlns:*`만
수집하고, `androidAttributeValues()`는 그 root prefix 철자만 모든 하위 element에
적용합니다. XML namespace binding은 각 element에서 선언·재바인딩될 수 있으므로
이는 namespace URI 의미 검증과 동일하지 않습니다.

다음 유효 XML 변이가 모두 `status: pass`, `problems: []`로 재현되었습니다.

1. root에는 기존 `android` binding을 둔 채 permission 자체에
   `xmlns:a="http://schemas.android.com/apk/res/android"`를 선언하고
   `a:name="com.google.android.c2dm.permission.RECEIVE"`를 사용
2. service 자체 또는 application에 같은 `xmlns:a`를 선언하고
   `a:name="com.google.firebase.messaging.FirebaseMessagingService"`를 사용
3. application 직계 duplicate disable metadata에만 같은 scoped alias를 사용
4. 필수 NotificationsService receiver에서 `android` prefix를
   `urn:not-android`로 재바인딩해 실제 Android namespace `name`을 없앰

1~3은 namespace-aware XML 해석상 금지 또는 중복된 Android attribute입니다.
4는 반대로 Android URI가 아닌 attribute를 필수 Android attribute로 오인합니다.
root-level alias 테스트가 통과하는 것만으로 element scope 의미론은 보장되지
않습니다.

**영향:** 유효하지만 다른 namespace 직렬화가 최종 manifest에 나타나면 C2DM/FCM
표면이나 duplicate disable metadata를 숨길 수 있고, 필수 로컬 component가 없는
manifest도 통과할 수 있습니다. 현재 Gradle 산출물은 canonical root binding을
사용하므로 이 finding이 보존 artifact의 오염을 뜻하지는 않지만, verifier의
fail-closed 변경 방어 계약은 충족하지 못합니다.

**기대 차단 조건:** parser가 각 element/attribute의 expanded name을
`{http://schemas.android.com/apk/res/android}name` 및 `value`로 직접 제공해야
합니다. 또는 element별 in-scope namespace map을 상속·재바인딩 규칙에 따라
해석해야 합니다. 위 네 변이를 회귀 테스트에 추가하고 각각 FAIL을 요구해야
합니다.

### I-RR-02 — duplicate lexical attribute가 parse failure 없이 금지값을 숨김

**상태: FAIL.** 위치:
`apps/mobile/scripts/verify-android-release-manifest.mjs:4-6,125-131`.

hardened fixture의 정상 permission을 다음처럼 변이했습니다.

```xml
<uses-permission
  android:name="android.permission.POST_NOTIFICATIONS"
  android:name="com.google.android.c2dm.permission.RECEIVE" />
```

XML 규격상 같은 attribute name의 중복은 well-formed XML이 아닙니다. 그러나
`@expo/config-plugins`의 기본 `XML.parseXMLAsync`는 예외를 내지 않고 첫 값을
보존했으며, verifier는 `status: pass`, `problems: []`를 반환했습니다. parser
결과의 attribute map은 다음 한 항목뿐이었습니다.

```json
{ "android:name": "android.permission.POST_NOTIFICATIONS" }
```

즉 “닫는 tag 누락” 한 종류의 malformed test는 통과하지만, malformed XML
전반을 fail-closed 처리하지는 않습니다.

**영향:** 금지값이 중복 attribute의 두 번째 값에 있으면 verifier가 이를 전혀
보지 못합니다. 정상 Gradle manifest merger는 이러한 XML을 생성하지 않을
가능성이 높아 Critical로 올리지는 않았지만, malformed 입력을 반드시 실패시킨다는
release gate 계약과 수정 보고서의 주장은 현재보다 넓습니다.

**기대 차단 조건:** 중복 lexical attribute와 동일 expanded name의 alias
attribute를 모두 거부하는 standards-compliant, namespace-aware XML validation을
semantic 검사 전에 수행해야 합니다. 위 변이를 별도 mutation test로 추가하고
parse failure 또는 명시적 duplicate-attribute failure를 요구해야 합니다.

## Minor — PASS

추가 Minor finding은 없습니다. component 종류를 정확히 구분하여 동명
`meta-data` decoy를 FCM service로 오탐하지 않는 동작과 application/receiver/
activity/metadata exact-count 검사는 의도대로 동작합니다.

## Source 및 policy gate 대조

- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs:297-385`의
  신규 7개 test는 character reference, root alias, action hierarchy,
  missing-close malformed XML, root-wide alias, alias duplicate metadata,
  element-kind decoy를 검증하며 모두 통과했습니다.
- 다만 element/application-scoped namespace binding, descendant prefix
  rebinding, duplicate lexical attribute는 test matrix에 없습니다.
- async validator에 맞춰 native contract가 result를 `await`하는 변경은 정확합니다.
- source policy는 Android namespace URI exact allowlist와 verifier line contract를
  유지하고 있고 정책·변이 test도 통과했습니다. 그러나 exact source line contract는
  위 semantic parser gap을 보완하지 못합니다.

## 독립 실행 결과

| 검증 | 결과 |
| --- | --- |
| `npm run release:policy-check:test` | PASS — 82/82 |
| `npm run release:policy-check` | PASS — 111 files, 0 problems |
| `npm run mobile:typecheck` | PASS |
| 보존 release manifest SHA-256 재계산 | PASS — 지정 SHA와 일치 |
| 보존 manifest에 parser verifier 직접 실행 | PASS — 0 problems |
| 기존 entity/root-alias/action-decoy/malformed/duplicate-app 변이 | PASS — 모두 차단 |
| scoped alias/rebinding 변이 | FAIL — verifier가 부적합 manifest를 통과시킴 |
| duplicate lexical Android attribute 변이 | FAIL — parser가 중복을 버리고 통과시킴 |

작업트리는 검토 시작 시 clean이었고, 이 재검토에서는 제품 코드를 수정하지
않았습니다.

## 결론

수정 커밋은 최초 I-11-01의 세 구체적 우회를 해결했고 실제 release artifact도
안전합니다. 하지만 namespace URI 의미 해석은 root prefix 목록 수준에 머물고,
parser가 모든 malformed XML을 fail-closed 처리하지 않습니다. I-RR-01과
I-RR-02를 수정하고 해당 변이를 red/green test에 추가하기 전까지 Task 11의
독립 재검토 최종 판정은 **FAIL**입니다.

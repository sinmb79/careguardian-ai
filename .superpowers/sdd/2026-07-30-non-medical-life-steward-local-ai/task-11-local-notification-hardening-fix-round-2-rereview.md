# Task 11 Android 로컬 알림 하드닝 Fix round 2 독립 재검토

## 판정

**전체: FAIL**

Fix round 2는 이전 Important finding `I-RR-01`의 scoped namespace alias 및
descendant prefix rebind와 `I-RR-02`의 duplicate lexical/expanded attribute를
해결했습니다. 실제 SHA-pinned release manifest도 계속 안전합니다.

그러나 Android가 공식 지원하는 `<uses-permission-sdk-23>`을 verifier가 전혀
검사하지 않아 C2DM permission과 16개 badge permission을 모두 숨길 수 있는 새
Important finding이 있습니다. 또한 parser가 benign/external DOCTYPE 선언을
허용하므로 deterministic fail-closed XML 계약 관점의 Minor finding이 있습니다.

| 심각도 | 판정 | 결과 |
| --- | --- | --- |
| Critical | PASS | 실제 release manifest에 원격 푸시·badge 표면 없음 |
| Important | FAIL | `<uses-permission-sdk-23>` 금지 permission 17개가 모두 verifier 통과 |
| Minor | FAIL | benign 및 external DOCTYPE 선언을 허용 |

검토 기준:

- Fix round 2 구현: `cde907eaedf8f88e1886ef396a0c23eb3692954a`
- 구현 보고서: `5065dffec831082bc9b18790256563068219336e`
- 이전 독립 FAIL: `6dcedc67d9282fe97f8a944d3b3205376b2ebb04`
- 현재 HEAD까지 verifier 및 해당 test에 후속 변경이 없음을 `git diff`로 확인

## Critical — PASS

### C-R2-01 — 실제 release manifest identity와 inventory

**상태: PASS.** 다음 보존 파일을 직접 검사했습니다.

```text
C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-scope-evidence-cde907e\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml
```

PowerShell SHA-256 재계산 결과:

```text
AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D
```

직접 실행 명령과 결과:

```powershell
$manifest = 'C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-scope-evidence-cde907e\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml'
Get-FileHash -LiteralPath $manifest -Algorithm SHA256
node apps/mobile/scripts/verify-android-release-manifest.mjs $manifest
rg -n '<uses-permission' $manifest
```

- verifier: `status: pass`, `problems: []`
- `<uses-permission-sdk-23>`: 0개
- C2DM/Expo FCM/Firebase receiver·service·provider·ComponentDiscovery: 0개
- Messaging/Installations/DataTransport registrar: 0개
- 16개 badge permission: 0개

실제 남은 permission은 다음 10개입니다.

- `ACCESS_NETWORK_STATE`, `DETECT_SCREEN_CAPTURE`, `INTERNET`
- `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK`
- `USE_BIOMETRIC`, `USE_FINGERPRINT`
- 앱의 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

필수 로컬 알림 surface도 보존되어 있습니다.

- `NotificationsService`: `enabled=true`, `exported=false`
- `NotificationForwarderActivity`: `exported=false`
- action: `NOTIFICATION_EVENT`, `BOOT_COMPLETED`, `REBOOT`, 두 QUICKBOOT,
  `MY_PACKAGE_REPLACED`
- messaging/analytics/ad-ID disable metadata: 각각 정확히 한 번이며 `false`

잔존 `GoogleApiActivity`와 DataTransport receiver/service는 모두
`exported=false`이며 FCM receive/registration component가 아닙니다. 실제 artifact에
대한 Critical finding은 없습니다.

### C-R2-02 — 이전 I-RR-01/I-RR-02 수정 확인

**상태: PASS.** 구현의 핵심 위치는
`apps/mobile/scripts/verify-android-release-manifest.mjs:103-156`입니다.

- `xml2js` strict parser를 `xmlns: true`로 실행
- attribute를 prefix 철자가 아니라 parsed `uri/local/value`로 판별
- same-element duplicate expanded name을 SAX attribute event에서 선제 거부
- ancestor prefix의 descendant URI rebind를 parse failure로 거부
- element도 빈 namespace의 정확한 local name만 인정

독립 변이에서 다음 결과를 재확인했습니다.

- root 전체 alias, action-scoped alias, multiple alias로 name/value 분리:
  정상 PASS
- element/service/application-scoped Android URI alias의 C2DM/FCM:
  금지 탐지 FAIL
- descendant `android` 또는 기존 alias prefix를 다른 URI로 rebind: parse FAIL
- 동일 URI의 중복 없는 descendant 선언: 정상 PASS
- duplicate lexical `android:name`: parse FAIL
- 서로 다른 alias의 duplicate expanded `{Android URI}name`: parse FAIL
- entity-encoded Android URI의 duplicate expanded name: parse FAIL
- Android URI가 아닌 동일 local-name attribute: 정상 decoy PASS

따라서 이전 두 Important finding 자체는 닫혔습니다.

## Important — FAIL

### I-R2-01 — `<uses-permission-sdk-23>`가 C2DM 및 badge permission 검사를 우회함

**상태: FAIL.** 위치:
`apps/mobile/scripts/verify-android-release-manifest.mjs:190-201`.

verifier는 root 직계 `<uses-permission>`만 수집합니다.
`<uses-permission-sdk-23>`은 수집하지 않습니다. Android 공식 문서는 이 element가
API 23 이상에서 앱이 특정 permission을 요청한다고 정의합니다:
[Android `<uses-permission-sdk-23>` 문서](https://developer.android.com/guide/topics/manifest/uses-permission-sdk-23-element?hl=en).

대표 변이:

```xml
<uses-permission-sdk-23
  android:name="com.google.android.c2dm.permission.RECEIVE" />
```

동일한 방식으로 C2DM 1개와 기존 `BADGE_PERMISSIONS` 16개를 각각 hardened
fixture에 추가해 `validateReleaseManifest()`를 호출했습니다.

```powershell
@'
import { readFileSync } from "node:fs";
import { validateReleaseManifest } from "./apps/mobile/scripts/verify-android-release-manifest.mjs";
const base = readFileSync("./apps/mobile/scripts/fixtures/android-manifests/hardened-local.xml", "utf8");
const xml = base.replace(
  "  <application>",
  '  <uses-permission-sdk-23 android:name="com.google.android.c2dm.permission.RECEIVE" />\n  <application>'
);
console.log(await validateReleaseManifest(xml));
'@ | node --input-type=module -
```

결과는 17/17 모두 `status: pass`, `problems: []`이었습니다. C2DM뿐 아니라
Samsung, HTC, Sony, Huawei, Oppo 및 EverythingBadger 등의 16개 badge permission도
같이 우회했습니다.

**영향:** API 23 이상 기기의 APK manifest에 Task 11이 명시적으로 금지한 C2DM
receive permission이나 launcher badge permission을 다시 넣어도 release gate가
통과합니다. FCM component가 별도로 없으면 이 permission 하나만으로 즉시 remote
push가 활성화되지는 않으므로 Critical로 올리지는 않았지만, no-remote-push 구조
계약과 exact badge allowlist의 fail-closed 보장은 깨집니다.

**기대 차단 조건:** root 직계 `uses-permission`과
`uses-permission-sdk-23`의 Android `name`을 모두 수집하여 동일한 C2DM/badge
금지 목록에 적용해야 합니다. C2DM 1개와 badge 16개를 각각 넣는 17개 mutation
test를 추가하고 모두 FAIL을 요구해야 합니다. 향후 dependency가 sdk-23 variant를
사용할 때 제거까지 자동화하려면 config plugin의 merge-removal contract도 같은
element 종류로 확장할 수 있습니다.

## Minor — FAIL

### M-R2-01 — DOCTYPE 선언을 명시적으로 거부하지 않음

**상태: FAIL (Minor).** 위치:
`apps/mobile/scripts/verify-android-release-manifest.mjs:103-138,171-177`.

다음 두 manifest가 모두 `status: pass`, `problems: []`이었습니다.

```xml
<!DOCTYPE manifest>
```

```xml
<!DOCTYPE manifest SYSTEM "file:///definitely-not-present.dtd">
```

내부 DTD에서 선언한 entity를 attribute value로 사용한 변이는 parser가
`Invalid character entity`로 FAIL 처리했습니다. 이번 실행에서 external subset
파일 읽기나 entity expansion은 관찰되지 않았습니다. 따라서 실제 XXE 또는 원격
푸시 우회 근거는 없으며 Important로 상향하지 않았습니다.

다만 Android release merged manifest에 DTD가 필요하지 않고, parser 동작이나
의존성 버전 변화에 따라 의미가 달라질 여지를 없애려면 deterministic security
gate가 DOCTYPE 자체를 거부하는 편이 안전합니다.

**기대 차단 조건:** SAX parser의 DOCTYPE event에서 즉시 parse failure를
발생시키고 benign/internal/external DOCTYPE 세 mutation을 모두 FAIL로 고정해야
합니다.

## 전체 pressure-test matrix

최종 독립 in-memory runner는 39개 case를 실행했습니다.

| 변이군 | 결과 |
| --- | --- |
| root/element/application/action prefix 및 URI alias | 기대대로 PASS/FAIL |
| descendant rebind와 multiple alias names | 기대대로 PASS/FAIL |
| default namespace root 및 namespaced decoy element | 기대대로 FAIL/PASS |
| duplicate lexical/expanded/encoded-URI attributes | 모두 FAIL |
| decimal/hex entity permission 및 registrar | 모두 금지 탐지 FAIL |
| missing/mismatched close, malformed comment | 모두 parse FAIL |
| CDATA/comment의 forbidden string decoy | 정상 PASS |
| CDATA/comment/metadata/다른 receiver의 action decoy | 모두 required-action FAIL |
| benign/external DOCTYPE | 부적합 PASS 2건 |
| `uses-permission-sdk-23` C2DM + 16 badge | 부적합 PASS 17건 |

요약: `total=39`, 기대 일치 20건, 보안 기대와 불일치 19건입니다. 불일치 19건은
I-R2-01의 permission 17건과 M-R2-01의 DOCTYPE 2건으로 정확히 설명됩니다.

## Source/policy test 대조

직접 실행 결과:

```powershell
npm run release:policy-check:test
npm run release:policy-check
npm run mobile:typecheck
git diff --check
```

- `release:policy-check:test`: PASS, 90/90
- `release:policy-check`: PASS, 111 files, 0 problems
- `mobile:typecheck`: PASS
- whitespace check: PASS

공식 test suite는 Fix round 2의 신규 namespace/duplicate 8개를 포함하지만,
`uses-permission-sdk-23` 및 DOCTYPE rejection mutation은 포함하지 않습니다.
따라서 90/90 GREEN은 새 두 finding을 반증하지 않습니다.

작업트리는 검토 시작 시 clean이었으며 이 재검토에서는 제품 코드와 verifier를
수정하지 않았습니다.

## 결론

Fix round 2는 이전 I-RR-01과 I-RR-02를 올바르게 수정했고 실제 release manifest도
안전합니다. 그러나 Android의 유효한 permission 요청 element인
`uses-permission-sdk-23`을 검사하지 않아 Task 11의 permission hardening gate는 아직
fail-closed가 아닙니다. I-R2-01을 해결하고, M-R2-01의 DTD rejection을 추가한 뒤
독립 재검토를 다시 수행해야 전체 판정을 PASS로 올릴 수 있습니다.

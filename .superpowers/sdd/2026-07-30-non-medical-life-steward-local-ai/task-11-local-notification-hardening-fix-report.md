# Task 11 독립 검토 I-11-01 수정 보고서

## 상태

`DONE`

독립 보안 검토의 Important finding `I-11-01`을 수정했습니다. 원시 정규식과
부분 문자열에 의존하던 release manifest verifier를 실제 XML 파서 및 Android
namespace URI 기반 의미 검증으로 교체했습니다.

- 최초 하드닝 구현:
  `443351beb3e9707ca395e6bda3b2f486f683673c`
- I-11-01 수정 구현:
  `3215e51160f766e0f0e13788ff066623db306435`

## RED 증거

생산 verifier 변경 전에 다음 7개 회귀·우회 테스트를 추가했습니다.

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

결과: **57개 중 50개 통과, 7개 실패**.

1. `RECEIV&#69;` character reference로 표현한 C2DM permission이 통과했습니다.
2. Android URI에 바인딩된 `a:name`의 FCM service가 통과했습니다.
3. `BOOT_COMPLETED` action을 제거하고 같은 이름의 `meta-data`를 넣은 decoy가
   통과했습니다.
4. 닫는 `manifest` 태그가 없는 malformed XML이 통과했습니다.
5. 전체 Android attribute prefix를 `android:`에서 `a:`로 바꾼 유효 XML을
   인식하지 못했습니다.
6. Android namespace alias로 추가한 duplicate disable metadata를 인식하지
   못했습니다.
7. 금지 component 이름을 관련 없는 `meta-data` element에 둔 경우에도 금지
   component로 오탐했습니다.

이는 리뷰의 세 우회와 malformed XML, duplicate/alias metadata, exact element
kind 요구를 모두 RED로 재현한 것입니다.

## 구현

- 이미 설치되어 있던 `@expo/config-plugins`의 `XML.parseXMLAsync`를
  사용했으며 새 의존성은 추가하지 않았습니다.
- XML parser가 character reference를 해석한 결과를 검사합니다.
- root `manifest.$`의 모든 `xmlns:*` mapping에서
  `http://schemas.android.com/apk/res/android`에 바인딩된 prefix를 찾아
  `${prefix}:name`, `${prefix}:value`를 읽습니다.
- permission은 root 직계 `uses-permission`, component는 application 직계의
  정확한 `service`/`receiver`/`provider`/`activity` 종류에서만 검사합니다.
- Firebase registrar는 파싱된 `meta-data` element의 Android `name` attribute를
  검사하며 원시 XML 부분 문자열은 사용하지 않습니다.
- 필수 local action은 정확히
  `receiver > intent-filter > action` 계층에서만 인정합니다.
- 세 disable metadata는 application 직계 `meta-data`에서 semantic name 기준
  정확히 한 번, value가 정확히 `false`인 경우에만 인정합니다.
- malformed XML 또는 manifest root 부재는 예외를 성공으로 누출하지 않고
  `status: fail`과 parse problem을 반환합니다.
- async validator에 맞춰 CLI와 native Android contract가 결과를 `await`하도록
  변경했습니다.
- Android namespace URI는 verifier 파일에만 허용되는 정확한 정책 링크 및
  line contract로 고정했습니다.

## GREEN 검증

### 집중 XML 의미 테스트

```powershell
node --test apps/mobile/scripts/verify-android-release-manifest.node-test.mjs
```

결과: **57/57 통과**.

### 전체 release 정책 테스트

```powershell
npm run release:policy-check:test
```

결과: **82/82 통과**. 기존 75개와 신규 XML 의미 변이 7개가 모두 통과했습니다.

```powershell
npm run release:policy-check
```

결과: **111개 파일 검사, 문제 0개**.

```powershell
npm run mobile:typecheck
git diff --check
```

결과: 모두 통과했습니다.

## 실제 release 병합 매니페스트 재검증

Unicode 경로에서 확인된 Expo prebuild의 Windows `0xC0000005` 환경 문제를
우회하기 위해 다음 ASCII 작업트리에서 구현 커밋을 detached checkout하여
검증했습니다.

- 작업트리:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-final-android-v7-20260731`
- 고정 커밋:
  `3215e51160f766e0f0e13788ff066623db306435`
- 런타임: 휴대용 Node.js `22.23.2`

```powershell
npm run verify:android-release -- manifest
```

결과:

- Expo clean Android prebuild 성공
- Gradle `:app:processReleaseManifest` **BUILD SUCCESSFUL in 44s**
- parser 기반 verifier `status: pass`
- `problems: []`

wrapper가 원본 Android 트리를 복원한 뒤, 같은 고정 커밋으로 clean prebuild와
Gradle manifest merge를 한 번 더 실행해 산출물을 다음 위치에 보존했습니다.

- 병합 매니페스트:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-parser-evidence-3215e51\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml`
- SHA-256:
  `AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D`
- 보존 파일 직접 verifier 결과: `pass`, 문제 0개

SHA-256은 최초 보존 release 매니페스트와 동일합니다. 즉 verifier 의미 검증만
강화되었고 실제 manifest 생성 결과나 로컬 알림 surface는 바뀌지 않았습니다.
검증 후 생성 Android 트리를 증거 경로로 이동하고 기존 ignored Android 트리를
원래 위치에 복원했습니다. ASCII 검증 작업트리와 주 작업트리 모두 clean
상태임을 확인했습니다.

## 변경 파일

- `apps/mobile/scripts/verify-android-release-manifest.mjs`
- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs`
- `apps/mobile/scripts/verify-native-android-contracts.mjs`
- `scripts/check-non-medical-release.mjs`
- 본 수정 보고서

## 자체 검토 및 남은 확인

- 원격 푸시·배지 제거 plugin 및 실제 생성 manifest는 변경하지 않았습니다.
- Android namespace의 prefix 철자에 의존하지 않고 namespace URI 의미를
  따릅니다.
- 필수 action의 이름이 다른 element나 다른 receiver에 존재하는 decoy는
  통과하지 않습니다.
- component 이름이 관련 없는 element에만 존재하는 경우는 오탐하지 않습니다.
- 새 runtime dependency는 없습니다.
- 서명 APK의 예약·취소·부팅 복원 device smoke는 기존 Task 11 보고서와 같이
  통합 컨트롤러의 별도 단계입니다.

## 커밋

- I-11-01 구현 및 회귀 테스트:
  `3215e51160f766e0f0e13788ff066623db306435`
- 본 수정 보고서: 후속 문서 전용 커밋

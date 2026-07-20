# CareGuardian AI 비공개 테스트 보안·안전 준비도 감사

- 감사일: 2026-07-20 (Asia/Seoul)
- 대상 저장소: `C:\Users\sinmb\workspace\돌봄후견-AI`
- 최초 대상 산출물: 폐기된 `versionCode 2` AAB, Expo 모바일 앱, 웹 PWA, 공통 care-core, Play 제출 문서
- 재검증 대상: Android `1.0.1` / `versionCode 6` EAS production 후보
- 감사 방식: 4개 독립 보조에이전트 감사(모바일/AAB, 웹 PWA, 공급망, 돌봄·복약 안전) 후 루트 에이전트 교차검증
- 변경 범위: 최초 읽기 전용 감사 후 차단 항목 보완, 회귀 테스트, 네이티브 정적·에뮬레이터 재검증

> 이 문서는 기술·제품·정책 준비도 검토이며 법률 또는 의료 자문이 아니다. 실제 테스트 참여자의 권리·동의와 국내 법적 의무는 개인정보·의료·연구윤리 전문가가 최종 확인해야 한다.

## 0. 보완 후 재검증 요약

### 현재 판정: 합성 데이터 Play 비공개 테스트는 `조건부 GO`, 실제 데이터는 `NO-GO`

최초 감사에서 확인한 구형 AAB는 로컬에서 삭제했고 Play 승격 대상에서 제외했다. 보완 후 후보에는 다음 통제가 적용됐다.

| 영역 | 적용 결과 |
|---|---|
| 저장 | SQLCipher 활성화, 256비트 무작위 키를 SecureStore/Android Keystore에 분리, Android 백업 비활성화 |
| 접근 | 저장 데이터 로드 전 기기 인증, 보호자 편집 재인증, 백그라운드 잠금, 화면 캡처 차단 |
| 삭제 | CareGuardian 예약 알림 취소·잔존 확인 후 DB·키·상태 삭제, 부분 실패 시 fail-closed |
| 알림 | 엄격한 `HH:mm`, 매일 로컬 반복, 잠금화면 `SECRET`, 약명 없는 일반 payload, 예약·취소 사후 확인 |
| 동의 | 복약 정보 별도 동의, 복약 필드 변경 시 동의 무효화 |
| 안전 문구 | 의료·복약 확인·응급 기능이 아님을 앱·정책·스토어 문서에 명시 |
| 입력 무결성 | 용량·시각·복용법·루틴 지시·가족관계를 앱이 자동 생성하지 않음 |
| 네이티브 표면 | dev-client·dev-menu·dev-launcher·ML Kit·expo-speech 제거, 외부저장소·overlay·광고 ID 권한 부재 |
| 원격 기능 | Firebase messaging/analytics/광고 ID 자동 초기화 비활성화, 앱 자체 계정·분석·광고·push-token 요청 없음 |

재검증 결과:

- `npm run verify`: **25 files / 66 tests**, 웹 production build, 모바일 typecheck, Expo Doctor **18/18** 통과
- `npm audit`와 `npm audit --omit=dev`: **Critical 0 / High 0**. Expo 54 전이 툴체인의 Moderate 항목은 SDK 57 대규모 업그레이드 없이 강제 변경하지 않음
- 로컬 production native AAB: package `com.sinmb.careguardianai`, targetSdk 36, `allowBackup=false`, SQLCipher 네이티브 심볼과 `libcrypto.so` 확인
- 로컬 release APK(Android 15 에뮬레이터): 설치·기동, 합성 프로필 저장, background·cold-start 잠금, PIN 기반 기기 인증 후 복호화, 전체 삭제까지 통과
- 저장 후 SQLCipher DB의 첫 32바이트가 무작위 형태였고 `SQLite format 3` 헤더와 합성 이름 `TEST_USER_A`가 앱 데이터 전체에서 검색되지 않았다. SecureStore 키·context도 AES 암호문으로 확인했다.
- 전체 삭제 후 전용 DB 파일이 사라지고 SecureStore가 빈 map이 되었으며 앱이 0% 새 프로필로 복귀했다. 활성 창에는 Android `SECURE` flag가 설정됐다.
- EAS production 후보: `1.0.1 (6)`, build `c4968750-6d8a-41a9-ab50-b4a55661623e` 완료. 크기 `63,532,732` bytes, SHA-256 `2E67A5011192EF22D3F3E4B406BCE5A6C685AAB2641F152006C960842D649AF0`
- Google Bundletool 1.18.3 검증: bundle valid, versionCode 6 / versionName 1.0.1 / minSdk 24 / targetSdk 36, upload 인증서 SHA-256 `4D:C9:3E:4A:5A:99:49:44:2C:12:47:03:5A:83:A0:B6:6E:03:B6:25:EC:DD:1D:11:84:D8:E4:49:6B:8D:CD:67`
- 최종 AAB에는 4개 ABI 모두 `libexpo-sqlite.so`와 `libcrypto.so`가 있고 `sqlcipher_version`, `cipher_version`, `exsqlite3_key` 심볼이 있다.
- 최종 AAB에서 AD_ID, 외부저장소, READ_MEDIA_IMAGES, SYSTEM_ALERT_WINDOW, install referrer, debuggable, devlauncher/devmenu/PreviewActivity/ML Kit/expo-speech가 검출되지 않았다.
- 최종 AAB에는 Firebase/FCM 서비스가 전이 의존성으로 남지만 자동 초기화·analytics·ad-id collection은 false이고 `google_app_id` 리소스가 없다.
- 최종 AAB에서 생성해 에뮬레이터에 설치한 universal APK는 약이 없는 합성 프로필 저장 시 알림 권한을 요청하지 않았고 POST_NOTIFICATIONS는 미허용 상태로 유지됐다.
- 설치·기동·저장 뒤 UID 네트워크 통계는 송수신 0바이트, 열린 TCP 소켓 0건이었다. Firebase 기본 앱은 옵션 부재로 초기화되지 않았음을 logcat에서 확인했다. 이는 단일 에뮬레이터의 제한된 관찰이며 모든 실기기·환경의 무전송 증명은 아니다.
- Play Closed Alpha에 동일한 SHA-256의 AAB를 업로드했고 Play가 `6 (1.0.1)`, minSdk 24+, targetSdk 36, ABI 4개로 인식했다. 출시 `1.0.1 (6) - 비공개 테스트`와 관련 변경사항을 합친 13개 변경사항을 2026-07-20 Google 검토로 전송했고, 게시 개요에서 `검토 중인 변경사항` 상태를 확인했다.

Google 검토 제출 후 현재 게이트:

1. **완료:** 개인정보처리방침 URL은 GitHub Pages 배포 후 2026-07-20 HTTP 200을 반환했고, 한국어 정책 본문·연락처·인앱 링크 대상이 일치했다.
2. **완료:** Play의 Health를 `Medication and Treatment Management`, 카테고리를 `Medical`, 광고 ID를 미사용으로 저장했다.
3. **완료:** Data safety의 “수집 없음/공유 없음” 답변과 공개 정책 URL을 확인했다. 비공개 테스트 중에도 실기기 네트워크 관찰을 계속한다.
4. **완료:** 검증된 `versionCode 6` AAB와 한국어 출시 노트를 Closed Alpha 초안으로 저장했다. R8/ProGuard 가독화 파일 권고 경고 1건 외에 차단 오류는 없었다.
5. **완료:** 보스의 최종 승인 후 `22B` 1명, `젤리테스터` 44명, `테스터` 8명 목록을 선택·저장하고 게시 개요의 13개 변경사항을 Google 검토에 제출했다.
6. **미완료:** Google 승인과 실제 opt-in 인원을 확인해야 한다. 목록 합계는 최대 53명이지만 중복과 미참여자를 제외한 실제 고유 opt-in 12명 이상을 14일 연속 유지해야 한다. 관리형 게시가 꺼져 있어 승인 후 선택된 테스터에게 자동 제공될 수 있다.

합성 데이터 비공개 테스트가 시작되더라도 실제 사람·약·연락처·건강정보 입력과 실제 복약 의존은 계속 금지한다. 실제 데이터 단계에는 Samsung/Pixel 실기기 포렌식·네트워크·알림·삭제 매트릭스, 사고 대응, 동의 이력과 공동설계가 추가로 필요하다.

## 1. 최초 감사 판정

### 최초 판정: 실제 개인정보·실제 복약정보를 사용하는 비공개 테스트는 `NO-GO`

현재 앱은 **가상 인물·가상 약 이름만 쓰는 개발/사용성 QA**에는 사용할 수 있다. 그러나 아래 조건의 테스트는 지금 시작하지 않는 것이 안전하다.

- 실명, 생년월일, 장애, 질환, 알레르기, 실제 약 이름·용법, 실제 연락처 입력
- 앱 알림을 실제 복약의 유일하거나 주요한 수단으로 사용
- 앱을 응급 호출, 119 연결, 보호자 자동 연락, 복약 완료 증명의 수단으로 이해하게 하는 테스트
- 공유 기기에서 보호자와 피돌봄자가 실제 데이터를 함께 사용하는 테스트
- 현재 AAB를 그대로 재사용한 Play 비공개 테스트

### 단계별 허용 범위

| 단계 | 판정 | 조건 |
|---|---|---|
| 로컬/에뮬레이터, 합성 데이터 | **GO** | 실제 사람·약·연락처 금지, 기능 신뢰성 주장 금지 |
| Play 비공개 테스트, 합성 데이터 | **조건부 GO** | 공개 개인정보처리방침 200 응답, 인앱 링크, Health 선언, 정확한 설명문, 새 production AAB 검증 후 |
| 감독하 사용성 테스트, 가명 데이터 | **NO-GO (현재)** | 앱 잠금·삭제·알림 비공개·동의/철회·사고 대응이 먼저 필요 |
| 실제 복약·응급 의사결정 | **NO-GO** | 임상적 안전성, 반복 알림, 복용/누락 기록, 실패 감지, 전문 검토 증거가 필요 |

## 2. 왜 이 앱은 필요한가, 어디를 지향해야 하는가

돌봄은 문서보다 사람의 기억과 관계에 의존하는 경우가 많다. 보호자가 알고 있는 생활 리듬, 불안 신호, 약, 안정화 방법을 구조화하면 돌봄 공백과 인수인계 부담을 줄일 수 있다. 이 제품의 핵심 가치는 “더 똑똑한 AI”가 아니라 **한 사람을 돌보며 축적된 지식을 안전하고 이해하기 쉽게 이어 주는 것**이다.

다만 피돌봄자가 보호의 대상이라는 이유만으로 데이터의 객체가 되어서는 안 된다. UN 장애인권리협약의 지원 의사결정 관점에 따르면 앱은 본인의 의사·선호·자율성을 대체하지 않고 이를 표현하고 존중하도록 도와야 한다. 따라서 다음 원칙을 제품의 상위 요구사항으로 삼아야 한다.

1. **지원하되 대체하지 않는다.** 앱의 알림·요약은 사람과 의료전문가의 판단을 대신하지 않는다.
2. **불확실성을 숨기지 않는다.** 알림 예약과 실제 표시, 알림 표시와 실제 복용은 서로 다른 사건이다.
3. **최소한만 저장한다.** 목적에 불필요한 건강·장애·연락처 데이터는 받지 않는다.
4. **당사자가 통제한다.** 쉬운 말·그림·음성으로 설명하고, 기능별 동의·거부·철회·삭제가 가능해야 한다.
5. **공유 기기를 기본 위협으로 본다.** 보호자·피돌봄자·교대 돌봄자의 역할과 화면 접근을 분리한다.
6. **실패 시 안전하게 멈춘다.** 앱이 모르면 아는 척하지 않고, 알림 실패를 성공처럼 표현하지 않는다.

연구와 실제 사용자 의견도 같은 방향을 지지한다.

- 2026년 재가 노인의 복약 알림 기술 체계적 문헌고찰은 일부 임상적 이득을 관찰했지만, 더 높은 질의 연구와 사용자 경험·비용·보건체계 영향의 검증이 필요하다고 결론냈다.
- 고령자 복약 순응도 연구는 다중질환, 인지 저하, 복잡한 처방, 여러 처방자, 약 보관·제형 문제를 주요 위험요인으로 제시한다. 단순 시간 알림만으로 해결되지 않는다.
- 치매 보조기술 윤리 연구는 자율성, 프라이버시, 형평성·접근성, 감시와 비인간화 위험을 핵심 쟁점으로 제시한다.
- 치매 당사자와 돌봄 파트너를 함께 참여시킨 공동설계 연구는 반복적 공동설계가 필요함을 보여 준다.
- Medisafe의 실제 Play 리뷰에는 저장한 복약 일정이 반영되지 않거나 “복용함” 표시 뒤에도 알림이 오는 상태 불일치, 격일 일정 오작동, 느린 지원이 보고됐다. DementiaCare 리뷰에는 유료 장벽, 화면 멈춤, 이미 지친 돌봄자에게 추가 스트레스가 된다는 의견이 있다. 이는 일화적 사례이지 전체 사용자의 대표 통계는 아니지만, **알림 상태의 정확성·지원 채널·단순성**이 안전 기능이라는 점을 보여 준다.

## 3. 확인한 현재 산출물

### Android AAB

| 항목 | 확인값 |
|---|---|
| 파일 | `apps/mobile/careguardian-ai.aab` |
| 크기 | 61,077,564 bytes |
| 수정 시각 | 2026-04-12 07:45:33 KST |
| SHA-256 | `C8F8368E623BBC8799F012DDE8622734704DEC17DAF1F44055CD58C55723733B` |
| package | `com.sinmb.careguardianai` |
| versionName / versionCode | `1.0.0` / `2` |
| minSdk / targetSdk / compileSdk | `24` / `36` / `36` |
| debuggable | 매니페스트에 미선언, 기본값 false |

target API 36은 2026-08-31부터 적용되는 Google Play의 신규 앱·업데이트 API 36 요구에 이미 부합한다. 따라서 target SDK는 현재 차단 사유가 아니다.

매니페스트와 권한은 BundleTool 1.18.1로 실제 AAB를 decode해 확인했고, DEX/assets는 개발용 모듈과 민감 문자열의 존재 여부를 정적으로 검사했다.

### 자동 검증

| 검증 | 결과 |
|---|---|
| `npm test -- --run` | 통과: 17 files, 24 tests |
| `npm run build` | 통과: PWA production build, 7 precache entries |
| `npm run mobile:typecheck` | 통과 |
| `npx expo-doctor` | 실패: 실행 위치에 따라 TypeScript 또는 Expo SDK 패치 정합성 1건 실패 |
| `npm audit --json` | 실패: Critical 1 / High 8 / Moderate 21 / Low 2 |
| `npm audit --omit=dev --json` | 실패: Critical 1 / High 4 / Moderate 18 / Low 1 |
| 공개 PWA 루트 | HTTP 200 |
| 공개 개인정보처리방침 | **최초 감사 시 HTTP 404** — 보완 배포 후 2026-07-20 HTTP 200 재확인 |

테스트·빌드·타입검사 통과는 코드의 기본 정합성을 보여 주지만, 네이티브 알림 도달성, 잠금화면 노출, 실제 사용자 안전성, 네트워크 무전송을 증명하지는 않는다.

## 4. 출시/테스트 차단 항목

### GATE-01 — 개인정보처리방침과 Play Health 선언이 현재 배포와 불일치

**심각도:** High / Play 비공개 테스트 차단

**증거**

- 문서는 개인정보처리방침이 배포됐다고 적지만(`docs/mobile-delivery.md:18-21`), 2026-07-20 확인 결과 `https://sinmb79.github.io/careguardian-ai/privacy-policy.html`은 HTTP 404이다.
- 모바일 앱 화면에는 개인정보처리방침 링크, 민감정보 처리 설명, 보존·삭제, 동의·철회 진입점이 없다(`MobileCaregiverScreen.tsx:47-268`, `MobileCompanionScreen.tsx:50-170`).
- Play 준비 문서는 Health를 `None`으로 기록한다(`docs/mobile-delivery.md:103-116`). 그러나 약 일정·복약 알림은 Google Play Health 선언의 **Medication and Treatment Management**에 명시적으로 포함된다. 돌봄 지원 기능에 따라 **Healthcare Services and Management**도 함께 검토해야 한다.
- 개인정보처리방침은 마이크를 “향후, 기기 내 처리”라고 설명하지만(`public/privacy-policy.html:38-43,88-92`), 웹 PWA는 현재 브라우저 SpeechRecognition을 실행한다(`src/features/voice/webSpeech.ts:33-69,99-116`). 브라우저에 따라 서버 기반 음성 인식이 가능하고 `processLocally=true`도 설정하지 않았다.
- 정책은 분석·추적·광고 SDK가 없고 서버 전송이 없다고 단정한다. 소스에는 앱 자체 API 호출이 없지만 AAB에는 Firebase/FCM/Installations 구성요소와 INTERNET 권한이 존재한다. 이것이 실제 사용자 데이터 전송을 입증하지는 않지만, 런타임 네트워크 관찰 전 “전송 없음”을 확정하면 안 된다.

**왜 위험한가**

Google Play는 폐쇄 테스트 앱도 Health 앱 선언을 요구한다. Health 앱은 활성 공개 URL과 인앱 개인정보처리방침, 건강 기능·위험·한계의 정확한 설명이 필요하다. 현재 상태는 심사 거절과 사용자 오인의 위험이 있다.

**필수 조치 및 완료 기준**

1. 모바일·웹의 실제 저장소, 알림, 음성, 내보내기, SDK, 삭제·보존 한계를 분리해 정책을 다시 작성한다.
2. 정책 URL이 로그인·지역 제한 없는 HTML로 HTTP 200을 반환하는지 CI에서 검사한다.
3. 앱 설정/첫 실행 화면에서 정책과 쉬운 말 요약을 열 수 있게 한다.
4. Play Health 선언에서 최소 `Medication and Treatment Management`를 정확히 선택한다.
5. Play “비공개 테스트(Closed testing)”라면 Data safety를 제출한다. “내부 테스트(Internal testing)만” 활성화된 앱은 Data safety 표시 예외가 있으나, 정책과 선언을 허위로 작성해도 된다는 뜻은 아니다.
6. 실제 AAB를 프록시·DNS 로그로 동적 검사한 뒤 SDK 포함 네트워크 동작을 정책과 Data safety에 반영한다.

### SEC-01 — 모바일 돌봄 매뉴얼에 앱 계층 암호화가 없음

**심각도:** High / 실제 데이터 테스트 차단

**증거**

- `saveMobileCareManual()`은 CareManual 전체를 JSON으로 직렬화해 `expo-sqlite/kv-store`에 저장한다(`apps/mobile/src/storage/mobileManualRepository.ts:13-21`).
- SecureStore에는 이름과 저장 시각만 보관한다. 매뉴얼 암호화 키 또는 암호문은 아니다.
- CareManual에는 이름, 생년월일, 장애, 질환, 긴급연락처, 약, 알레르기, 의사소통·감정·안정화 메모가 포함된다(`packages/care-core/src/manual/manualSchema.ts:28-69`).
- 앱 설정에 SQLCipher 또는 별도 AEAD 암호화가 없다.

**정확한 위협 해석**

SQLite 파일은 Android 앱 샌드박스와 기기 파일 기반 암호화의 보호를 받으므로 일반 앱이 곧바로 읽을 수 있다는 의미는 아니다. 그러나 앱 계층에서는 평문 JSON이며, 루팅·포렌식·디버그/취약 기기·탈취된 잠금 해제 기기에서 복구 가능하다. 더 큰 현실적 위험은 앱 자체 잠금이 없어 앱을 열기만 하면 모든 정보가 표시된다는 점이다.

AAB의 Auto Backup 규칙은 SecureStore를 제외하고 `sharedpref`만 포함한다. Android include 규칙상 SQLite DB는 현재 클라우드/기기 이전 백업 대상에서 제외되는 것으로 보인다. 이는 외부 백업 노출에는 긍정적이지만, 삭제·분실 시 모바일 데이터 복구가 불가능한 연속성 위험을 만든다.

**필수 조치 및 완료 기준**

- 단기: 전체 매뉴얼을 versioned AEAD로 암호화하고, 난수 데이터 키를 Android Keystore 기반 SecureStore에 보관한다. 키 무효화·손상·마이그레이션 실패 시 안전한 복구 화면을 제공한다.
- 장기: Expo SQLite의 SQLCipher 사용을 검토하되 Expo Go 제약, 키 회전, 마이그레이션, 성능을 실기기에서 검증한다.
- 암호화만으로 공유 기기 위험은 해결되지 않는다. SEC-02의 앱 잠금과 함께 완료해야 한다.
- 완료 기준: DB 파일에서 건강·약·연락처 평문이 검색되지 않고, 키 없이 복호화 불가하며, 키 무효화·업그레이드·복구 테스트가 통과한다.

### SEC-02 — 앱 잠금·역할 분리·삭제·철회가 없음

**심각도:** High / 공유 기기 및 실제 데이터 테스트 차단

**증거**

- 저장된 매뉴얼이 있으면 앱 시작 직후 companion 화면으로 전환한다(`apps/mobile/src/state/useMobileCareAppState.ts:25-45`).
- Companion 화면에서 인증 없이 보호자 편집으로 들어갈 수 있다(`apps/mobile/src/ui/MobileCompanionScreen.tsx:60-67`).
- PIN/biometric gate, background/idle lock, 최근 앱 화면 가림, caregiver/companion 역할 분리가 없다.
- 저장소에는 save/load만 있고 전체 삭제가 없다(`mobileManualRepository.ts:13-31`). 상태 action에도 clear/lock이 없다(`useMobileCareAppState.ts:58-93`).

**필수 조치 및 완료 기준**

- 보호자 편집과 민감한 상세정보에 PIN/생체인증 잠금을 적용하고 앱이 background로 가면 즉시 민감 화면을 가린다.
- companion 모드는 필요한 최소정보만 보이고 보호자 영역과 분리한다.
- “이 기기의 돌봄 정보 모두 삭제”에서 예약 알림 취소 → SQLite 삭제 → SecureStore 삭제 → 메모리 초기화를 원자적으로 수행하고 결과를 확인한다.
- 당사자·보호자·법적 권한자의 역할과 동의를 별도로 기록하며, 기능별 동의 철회가 핵심 기능을 불필요하게 막지 않도록 한다.
- Android `FLAG_SECURE` 또는 Expo 대응 기능으로 screenshot/recents 보호를 검토한다. 접근성·원격지원과 충돌하므로 사용자 선택과 운영정책이 필요하다.

### SAFE-01 — 현재 복약 알림은 “다음 1회 예약 시도”이며 복약 관리 기능이 아님

**심각도:** High / 실제 복약 의존 테스트 차단

**증거**

- 시간 정규식은 `/(\d{1,2}):(\d{2})/` 형태로 앵커와 0–23/0–59 범위 검사가 없다(`notificationSchedule.ts:16-27`).
- 각 약에 대해 가장 가까운 다음 시각 하나만 만들고(`notificationSchedule.ts:30-73`), Expo `DATE` trigger로 한 번 예약한다(`medicationNotifications.ts:58-67`). 반복 알림이 아니다.
- 알림을 예약하기 전 기존 앱 알림을 모두 취소한다. 중간 실패 시 일부만 예약될 수 있고 rollback·사후 검증·상세 오류 표시가 없다.
- AAB에는 exact alarm 권한이 없다. Expo SDK 54 구현은 권한이 없으면 Android의 inexact alarm으로 폴백할 수 있어 Doze·배터리 정책에서 늦어질 수 있다. 실패가 아니라 **정시 보장이 안 되는 것**이 핵심이다.
- 복용함/건너뜀/누락/재알림/투약 이력/처방 변경 검토/시간대·DST 이력이 없다.
- 약 이름 또는 시간만 입력해도 `1정`, `08:30`, `물과 함께`가 기본값으로 만들어진다(`MobileCaregiverScreen.tsx:119-163`). 의료적으로 검증되지 않은 기본값이다.
- 다섯 개 얕은 필드만 채우면 “매뉴얼 작성 완료”가 된다(`MobileCaregiverScreen.tsx:18-26,248-250`). 이는 임상적 완전성이나 복약 안전을 뜻하지 않는다.
- 현재 unit test는 다음 시점 객체 생성만 검사한다. 실기기 알림, 권한 거부/철회, Doze, 재부팅, 무음/DND, 시간대·DST, OEM 배터리 제한은 검증하지 않았다.

**필수 조치 및 완료 기준**

1. 제품 문구를 “저장 시 다음 1회 기기 내 알림 예약을 시도”로 제한한다.
2. 약 용량·복용법의 자동 기본값을 제거하고 사용자/보호자가 처방전과 대조해 명시적으로 확인하게 한다.
3. 엄격한 시간 파서와 runtime schema, 반복 규칙, 시작/종료일, 시간대 정책을 설계한다.
4. 예약 성공을 OS에서 다시 조회하고, 실패·권한 거부·지연 가능성을 사용자에게 분명히 보여 준다.
5. “알림 표시”, “복용함”, “건너뜀”, “누락”, “보호자 확인”을 별도 상태로 기록한다. 알림 표시를 복용 완료로 간주하지 않는다.
6. 복약 정보 변경 이력과 이중 확인을 추가한다. 앱은 처방·용량·상호작용을 검증하지 않는다고 명시한다.
7. 실제 약을 쓰는 파일럿 전 Android 13–16, Samsung/Pixel, 화면 잠금, DND, Doze, 재부팅, 시간대 이동, DST, 권한 거부/철회 매트릭스를 통과한다.

### SEC-03 — 알림이 잠금화면에 약명·복용법을 노출할 수 있음

**심각도:** High / 실제 데이터 테스트 차단

**증거**

- Android 알림 채널 중요도가 HIGH이고 잠금화면 가시성 설정이 없다(`medicationNotifications.ts:23-26`).
- 제목·본문·data payload에 약 이름, 복용법, 시각이 포함된다(`notificationSchedule.ts:59-68`).

잠금화면, 알림 목록, 연결된 웨어러블, 화면 공유에서 제3자가 질환을 추론할 수 있다. Android 최종 표시 정책은 사용자 설정에 달려 있지만 앱의 privacy-by-default가 없다.

**필수 조치 및 완료 기준**

- 기본 알림은 “돌봄 알림 — 앱에서 확인”처럼 일반화하고 data payload에서도 약명을 제거한다.
- 새 채널 ID에서 잠금화면 가시성을 `SECRET`로 설정한다. 기존 생성 채널은 일부 속성을 앱이 변경하지 못하므로 마이그레이션을 시험한다.
- 사용자가 명시적으로 상세 알림을 선택할 때만 약명을 표시한다.
- 잠금화면·웨어러블·Android Auto·화면 공유에서 민감정보가 노출되지 않는지 검사한다.

### BUILD-01 — 현재 AAB에 개발용 표면과 사용하지 않는 권한이 포함됨

**심각도:** High / 현재 AAB 재사용 차단

**증거**

- `apps/mobile/package.json:18-20`에 `expo-dev-client`가 중복 선언되고 production dependency에 남아 있다.
- 실제 AAB DEX/assets에서 expo-dev-client/dev-menu/dev-launcher, ML Kit barcode 관련 코드·asset, Compose `PreviewActivity`를 확인했다.
- 실제 매니페스트에는 앱 소스에서 사용하지 않는 `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, biometric/fingerprint 권한이 포함된다.
- AAB는 debuggable이 아니므로 “디버그 빌드”라고 단정할 수 없다. 다만 production artifact에 불필요한 개발·미리보기 구성요소와 권한이 포함된 것은 사실이다. `SYSTEM_ALERT_WINDOW`의 정확한 merge 경로는 새 빌드에서 manifest merger report로 확인해야 한다.
- `exp+careguardian-ai-mobile` browsable scheme도 포함된다. production에 dev scheme이 필요한지 검토가 없다.

**필수 조치 및 완료 기준**

- dev-client를 개발/preview 프로필에만 포함하고 production dependency/AAB에서 제거한다.
- Expo variants 방식으로 production에서는 generated dev scheme을 끈다.
- `android.blockedPermissions` 및 의존성 정리로 외부저장소·overlay·미사용 biometric 권한을 제거한다.
- 새 production AAB를 만들고 이전/새 매니페스트의 permission, exported component, intent filter를 diff한다.
- release AAB에 dev-menu/dev-launcher/ML Kit barcode/PreviewActivity와 SYSTEM_ALERT_WINDOW가 없음을 확인한다.
- 현재 `careguardian-ai.aab`는 테스트용으로 재사용하지 않는다.

### WEB-01 — 웹 로컬 암호화 키가 정적 번들에 고정됨

**심각도:** High / 웹에서 실제 데이터 사용 차단

**증거**

- `DEMO_PASSPHRASE = "careguardian-local-demo"`가 코드에 있고 모든 저장·복호화에 사용된다(`src/app/state/useCareAppState.ts:5,19,50`).
- 저장 구현의 AES-GCM-256, 16-byte salt, 12-byte IV 자체는 적절하지만, 공개된 고정 키는 같은 브라우저 사용자·악성 확장프로그램·향후 XSS에 대한 기밀성을 제공하지 않는다.

**필수 조치 및 완료 기준**

- 첫 저장 시 사용자가 정한 PIN/passphrase 또는 WebAuthn/플랫폼 인증으로 키를 감싸고, 고정 비밀을 번들에서 제거한다.
- 잠금 해제 전 민감 화면을 렌더링하지 않고 유휴/백그라운드 자동 잠금을 제공한다.
- 잘못된 암호, 손상 데이터, 키 분실의 복구·삭제 흐름을 제공한다.
- 빌드 산출물에서 고정 passphrase가 검색되지 않아야 한다.

### WEB-02 — 웹 음성인식은 원격 처리 가능성이 있고 정책과 불일치

**심각도:** High / 음성 기능 실제 데이터 테스트 차단

웹은 `SpeechRecognition`/`webkitSpeechRecognition`을 시작하지만 로컬 처리 강제와 지원 여부 확인이 없다. MDN은 Chrome 등에서 서버 기반 엔진이 오디오를 웹 서비스로 보낼 수 있다고 설명한다. 모바일 STT는 현재 비활성화되어 있으므로 이 finding은 **웹 PWA에 한정**된다.

**필수 조치 및 완료 기준**

- 로컬 처리를 검증할 수 없으면 웹 음성 입력을 기본 비활성화한다.
- 별도 동의 전에 음성 기능을 시작하지 않고, 브라우저/제3자 처리 가능성·보존·삭제를 알린다.
- 네트워크 차단·프록시 테스트로 브라우저별 동작을 확인한다.
- 개인정보처리방침의 “향후/기기 내 처리” 표현을 실제 동작과 일치시킨다.

### WEB-03 — 릴레이 파일이 건강정보를 평문 JSON으로 다운로드함

**심각도:** High / 실제 데이터 relay 테스트 차단

- 웹은 relayPackage를 `JSON.stringify()`해 즉시 다운로드한다(`src/features/ui/CompanionHome.tsx:42-50`).
- 파일에는 이름, 일과, 약 이름·시간·복용법, 안정화 방법이 포함된다(`packages/care-core/src/relay/relayPackage.ts:24-44`).
- 평문 경고, 최소화, 수신자 확인, 만료, 암호화가 없다.

**필수 조치 및 완료 기준**

- 기본 내보내기는 암호화하고 평문은 민감정보를 최소화한 뒤 별도 재확인으로만 허용한다.
- 수신자·목적·포함 항목 미리보기와 “다운로드/클라우드 동기화 폴더 노출” 경고를 제공한다.
- 모바일 UI의 “릴레이 준비도”는 현재 실제 전송 기능이 아님을 명시한다.

### SUPPLY-01 — 취약 의존성과 Expo 정합성 실패

**심각도:** 공급망 도구상 Critical 1 / High 4 이상, 제품 도달성 미확정 / 테스트 전 조치 필요

**증거**

- production graph 감사: Critical 1, High 4, Moderate 18, Low 1.
- Critical은 `react-native → react-devtools-core → shell-quote@1.8.3` 명령 주입 advisory이다.
- High에는 `@xmldom/xmldom@0.8.12`, `fast-uri@3.1.0`, `ws`가 포함되며 전체 감사에는 Windows Vite 7.3.2 개발서버 filesystem deny 우회도 포함된다.
- 실제 앱 코드에서 공격자 입력이 `shell-quote` 취약 API에 도달한다는 증거는 찾지 못했다. 따라서 “설치된 앱의 원격 명령 실행”으로 과장해서는 안 된다. 그러나 dev-client가 AAB에 포함되고 빌드/개발 도구가 테스트 파이프라인에 있으므로 무시할 수도 없다.
- `expo-dev-client`가 JSON에 두 번 선언되어 파서별 재현성을 낮춘다.
- Expo doctor는 SDK 54 호환 패치(`expo 54.0.36`, `expo-dev-client 6.0.21`, `expo-notifications 0.32.17`) 또는 TypeScript 버전 불일치를 보고했다.
- 루트 TypeScript 6.0.2와 mobile 요구 `~5.9.2`가 충돌해 `npm ls --all`도 `ELSPROBLEMS`를 반환한다.

**필수 조치 및 완료 기준**

- 중복 JSON 키를 제거하고 Expo SDK 54 호환 최신 패치를 함께 적용한다.
- Vite를 advisory가 해결된 패치 이상으로 갱신한다.
- Expo/RN 호환성을 확인하면서 audit를 재실행한다. 해결 불가 항목은 “영향 경로, 도달 불가 근거, 만료일, 담당자”가 있는 서면 risk acceptance 없이는 넘기지 않는다.
- Node/npm/TypeScript 버전을 root, workspace, CI, EAS에서 단일화한다.
- CI에 mobile typecheck, expo-doctor, audit policy, production AAB build/manifest 검사를 추가한다.
- GitHub Actions는 검증된 commit SHA 고정을 검토한다.

## 5. 중요 개선 항목

### INPUT-01 — 런타임 데이터 검증과 오류 복구가 없음

**심각도:** Medium

- `CareManual`은 TypeScript interface뿐이며 실행 시 schema 검증이 없다.
- 모바일 SQLite load와 웹 backup import는 JSON을 곧바로 `CareManual`로 cast한다.
- 웹 import는 파일 크기, envelope 필드 길이, 버전, 배열 개수, 문자열 길이, 시간 형식 제한과 `try/catch`가 없다(`CaregiverEditor.tsx:162-175`, `secureLocalStore.ts:86-100`).
- 손상된 localStorage도 앱 시작 실패를 만들 수 있다.
- 현재 병합·동적 속성 쓰기가 없어 확인된 prototype pollution 경로는 없었다.

**권고:** strict runtime schema(Zod/Valibot 등), 파일 크기 상한, 문자열/배열/시간 제한, unknown key 제거, versioned migration, 사용자 복구/삭제 UI를 추가한다.

### WEB-04 — 웹 보안 헤더가 없음

**심각도:** Medium / 방어 심층화

실제 GitHub Pages 응답에는 HSTS만 있고 CSP, `X-Content-Type-Options`, frame protection, Referrer-Policy, Permissions-Policy가 없다. 현재 코드에서 `dangerouslySetInnerHTML`, `innerHTML`, `eval`, 외부 script/fetch 같은 명확한 XSS sink는 찾지 못했으므로 즉시 exploitable XSS를 의미하지 않는다.

**권고:** 헤더를 제어할 수 있는 CDN/edge를 사용해 CSP와 `frame-ancestors 'none'`, nosniff, Referrer/Permissions Policy를 설정한다. Pages만 유지하면 meta CSP를 쓸 수 있으나 frame-ancestors와 report-only 등 한계를 문서화한다.

### CONT-01 — 모바일 데이터 연속성과 복구 경로가 없음

**심각도:** Medium–High / 돌봄 연속성 위험

현재 AAB backup 규칙상 SQLite 매뉴얼은 백업 대상이 아닌 것으로 보이고 모바일에는 export/import가 없다. 개인정보 노출은 줄지만 기기 고장·분실·삭제 때 돌봄 매뉴얼을 잃는다.

**권고:** 사용자가 명시적으로 생성하는 end-to-end 암호화 백업, 복구 키/암호 안내, 내보내기 전 포함 항목 확인, 테스트 복원, 보존·삭제 정책을 설계한다. 자동 클라우드 백업을 암묵적으로 켜서는 안 된다.

### CLAIM-01 — 기능 설명이 현재 구현보다 강함

**심각도:** High / 안전·심사 위험

- Store 설명의 “복약 시간에 맞춰 자동 예약”, “플랫폼 수준 암호화”, “다음 돌봄자에게 전달”은 구현 한계를 충분히 밝히지 않는다(`docs/store-listing.md:10-24`). 전체 매뉴얼은 Keystore에 저장되지 않는다.
- 모바일 문구 “실제 돌봄이 이어지는”과 100% 완료 표시는 기술적 프로토타입을 안전성이 확인된 돌봄 시스템처럼 보이게 할 수 있다.
- 현재 앱에는 SOS, 119 자동 연락, 보호자 자동 연락, 복약 완료 증명, 처방 검증, 의료적 판단이 없다.
- 말벗은 규칙 기반 응답이며 위기·자해·학대·의학적 응급 escalation이 없다. “AI 동반자”가 전문 상담처럼 이해되지 않도록 한계를 밝혀야 한다.

**권고:** 모든 UI·Store·테스터 안내에서 구현된 기능과 미래 계획을 분리하고, health disclaimer와 의료전문가 상담 안내를 넣는다.

## 6. 확인된 긍정적 통제

다음은 유지해야 할 좋은 출발점이다.

- Android target/compile SDK 36, debuggable false, cleartext opt-in 없음.
- 모바일에는 RECORD_AUDIO 권한이 없고 STT가 비활성화되어 있다.
- 앱 소스에서 자체 API endpoint, fetch/axios, analytics/ads, console logging을 찾지 못했다.
- SecureStore Auto Backup 제외 규칙이 존재하며 매뉴얼 SQLite도 현재 include 규칙상 backup 대상이 아닌 것으로 보인다.
- 웹 암호화 backup은 AES-GCM-256, 랜덤 salt/IV를 사용한다. 문제는 암호 알고리즘보다 고정 앱 저장 키와 입력 검증이다.
- 웹에서 위험한 HTML 주입 API, eval, 외부 script, 동적 원격 URL을 찾지 못했다.
- PWA service worker는 정적 app-shell precache이며 사용자 데이터 runtime cache는 확인되지 않았다.
- 24개 단위 테스트, 웹 production build, 모바일 typecheck가 통과한다.

## 7. 개인정보·동의·권리 설계 요구사항

대한민국 개인정보 보호법 제23조는 건강정보를 민감정보로 보고, 원칙적으로 다른 개인정보 동의와 **별도 동의** 또는 법률상 근거를 요구하며 안전성 확보 조치를 요구한다. 특히 테스트 참여자가 다른 가족의 건강정보를 입력하는 경우 정보주체와 입력자의 권한이 다를 수 있다.

비공개 테스트 전에 최소 다음을 마련한다.

1. **당사자용 쉬운 설명:** 무엇을 왜 저장하는지, 무엇을 하지 않는지, 알림이 실패할 수 있음을 13세 수준의 쉬운 말·그림·음성으로 설명.
2. **역할별 동의:** 피돌봄 당사자, 보호자/돌봄자, 법정대리·후견 권한을 구분. 후견이 곧 모든 데이터 처리 동의를 자동으로 뜻한다고 가정하지 않음.
3. **기능별 선택:** 건강 메모, 알림, 음성, 내보내기, 오류 보고를 따로 선택. 거부해도 가능한 기능은 계속 사용 가능.
4. **철회와 삭제:** 앱 안에서 즉시 철회·삭제하고, 삭제 범위와 기술적 한계(이미 내보낸 파일, OS backup 등)를 설명.
5. **최소 보존:** 비공개 테스트 종료일, 보존기간, 자동 만료, 폐기 확인을 사전에 정함.
6. **사고 대응:** 잘못된 복약 알림, 중복/누락 알림, 데이터 노출, 앱 멈춤의 신고 채널·중단 기준·연락 담당자를 정함.
7. **민감정보 없는 버그 리포트:** screenshot, DB, 알림 payload가 자동 첨부되지 않게 하고 참여자가 직접 확인 후 전송.

## 8. 비공개 테스트 실행 마스터플랜

### Gate A — 정책·표현 정합성

- [x] 개인정보처리방침 URL 200 및 인앱 링크
- [x] 모바일/웹 실제 데이터 흐름과 정책 일치
- [x] Play Health 선언 최소 Medication and Treatment Management
- [x] Closed testing Data safety 답변 작성 및 저장
- [x] 게시 개요의 13개 변경사항을 Google 검토에 제출
- [ ] Google 승인 후 실제 고유 opt-in 12명 이상을 확인하고 14일 연속 유지
- [x] 의료기기가 아니며 진단·치료·처방 검증을 하지 않는다는 disclaimer
- [x] 실제 구현만 말하는 Store/UI/테스터 설명

### Gate B — 민감정보 보호

- [ ] 전체 매뉴얼 앱 계층 암호화 및 키 수명주기
- [ ] 앱 launch/foreground/idle 잠금
- [ ] 보호자/동반자 역할 분리
- [ ] 잠금화면 알림 비공개 기본값
- [ ] 전체 삭제·동의 철회·예약 알림 취소
- [ ] runtime schema와 손상 데이터 복구

### Gate C — production AAB 정화

- [x] dev-client 중복·production 포함 제거
- [x] Expo 호환 patch 및 Critical/High 의존성 advisory 처리
- [x] 사용하지 않는 권한·exported component 제거
- [x] 새 AAB manifest/dex diff
- [ ] 실제 기기 네트워크 capture에서 선언과 동작 일치
- [x] AAB hash와 감사 결과 보관
- [ ] SBOM 생성 및 보관

### Gate D — 합성 데이터 기기 시험

- [ ] Android 13, 14, 15, 16
- [ ] Pixel + Samsung 최소 각 1대
- [ ] 권한 허용/거부/철회
- [ ] 잠금화면, recents, screenshot, 화면 공유, 웨어러블
- [ ] DND/무음/Doze/배터리 최적화/OEM 강제 종료
- [ ] 재부팅, 앱 업데이트, 시간대 변경, DST 경계, 수동 시계 변경
- [ ] 손상 DB, 키 무효화, 저장공간 부족, 강제 종료 중 저장
- [ ] 삭제 후 DB/SecureStore/예약 알림/캐시가 남지 않음

### Gate E — 감독하 사용성 파일럿

- [ ] 실제 약 대신 가명·가상 시간 사용
- [ ] 피돌봄 당사자와 돌봄 파트너가 함께 공동설계 세션 참여
- [ ] 앱이 실제 복약·응급 판단에 쓰이지 않도록 종이/기존 절차 병행
- [ ] 잘못된 알림·데이터 노출·혼란 발생 시 즉시 중단 가능한 담당자
- [ ] 동의 이해도, 데이터 최소화, 삭제 성공, 접근성, 알림 오해를 측정

### 실제 데이터로 넘어갈 수 있는 최소 수용 기준

- P0/High 차단 항목 0건 또는 문서화된 독립 검토 승인
- 개인정보처리방침/Play 선언/실제 네트워크 동작 일치
- 7일 이상 다기기 반복 알림 soak test에서 중복·누락·잘못된 시각 0건
- 알림 실패가 “성공”으로 표시되는 경우 0건
- 약 정보 변경 전후 이력·이중확인·되돌리기 통과
- 공유 기기에서 무권한 보호자 화면 접근 0건
- 삭제 후 앱 데이터와 예약 알림 잔존 0건
- 심각 사건 대응 연습과 테스트 중단 절차 통과

### 즉시 중단 조건

- 잘못된 약·용량·시간을 앱이 생성하거나 실제 복약으로 오인하게 함
- 중복 복용 또는 누락 복용에 기여할 가능성이 있는 알림 상태 불일치
- 민감정보가 잠금화면, 로그, bug report, 평문 파일, 다른 사용자 화면에 노출
- 응급 상황에서 앱이 자동 연락·전문 판단을 제공하는 것처럼 오인
- 동의를 철회했는데 저장·알림·공유가 계속됨

## 9. 비공개 테스트용 안전 문구 초안

> CareGuardian AI는 한 대의 기기에서 보호자가 돌봄 메모와 하루 일정을 정리해 보는 초기 비공개 테스트 앱입니다. 저장 시 입력한 복약 시각의 다음 1회 기기 내 알림 예약을 시도합니다. 알림은 권한, 절전 상태, 기기 설정에 따라 늦거나 표시되지 않을 수 있습니다. 이 앱은 복약 사실을 확인하지 않으며 처방·용량을 검증하지 않습니다. 진단·치료·응급 호출·119 또는 보호자 자동 연락 기능도 제공하지 않습니다. 약의 변경과 복용 여부는 반드시 본인, 보호자 및 의료전문가가 확인해 주세요. 비공개 테스트 중에는 실제 응급·복약 판단의 유일한 수단으로 사용하지 마세요.

“서버 전송 없음”, “추적 SDK 없음”, “완전 암호화” 문구는 새 production AAB의 네트워크·SDK·저장 검증이 끝난 뒤에만 확정한다.

## 10. 재검증 명령과 증거 묶음

```powershell
# 공통 품질
npm ci
npm test -- --run
npm run build
npm run mobile:typecheck

# Expo/공급망
npm --workspace apps/mobile run doctor
npm audit --omit=dev --json
npm ls --all

# 공개 정책
curl.exe -sS -D - -o NUL https://sinmb79.github.io/careguardian-ai/
curl.exe -sS -D - -o NUL https://sinmb79.github.io/careguardian-ai/privacy-policy.html

# 민감한 고정값·위험 API 회귀
rg -n "careguardian-local-demo|dangerouslySetInnerHTML|innerHTML|eval\(|new Function|console\.log" src apps/mobile packages

# production AAB 생성 후 필수 확인
# 1) SHA-256 보관
# 2) manifest permissions/exported components/intent filters dump
# 3) dev-client/dev-menu/dev-launcher/PreviewActivity/ML Kit 문자열 검색
# 4) 실제 기기 프록시/DNS 네트워크 관찰
# 5) DB 파일 평문 검색 및 delete/lock/notification privacy 검증
```

감사 증거는 다음을 한 묶음으로 보존한다.

- production AAB와 SHA-256
- source commit SHA, Node/npm/Expo/EAS 버전
- `npm audit`, `expo-doctor`, test/build/typecheck 결과
- AAB permission/exported component diff
- Play Health/Data safety 답변 export
- 개인정보처리방침 HTTP 확인 결과
- 합성 데이터 테스트 매트릭스와 실패·수정·재시험 기록
- 참여자 동의서 버전, 철회·삭제 증거, 사고 대응 훈련 기록

## 11. 감사 한계

- 최초 감사에서는 Play Console을 열지 않았으나 후속 준비 과정에서 비공개 Alpha, tester/country 설정과 Health·Data safety·광고 ID·카테고리·게시 상태를 직접 확인했다. 저장된 값과 제출 상태를 구분했고, 최종 승인 후 13개 변경사항이 `검토 중인 변경사항`으로 전환된 것까지 확인했다. Google의 최종 승인과 실제 테스터 opt-in 수는 아직 확인하지 않았다.
- iOS/TestFlight artifact는 감사하지 않았다.
- Android AAB는 정적 분석했다. 실제 기기의 런타임 network capture, root/forensic extraction, penetration test는 수행하지 않았다.
- dependency advisory의 실제 코드 도달성은 일부 미확정이다. audit 심각도를 그대로 제품 exploitability로 등치하지 않았다.
- 사용자 리뷰는 개별 경험의 예시이며 전체 사용자를 대표하는 통계가 아니다.
- 개인정보보호법 적용 주체, 후견 권한, 인간대상연구 여부는 테스트 운영 방식에 따라 달라질 수 있다.

## 12. 주요 근거

### 공식 정책·기술 문서

- [Google Play Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
- [Google Play Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en)
- [Google Play Health app categories and best practices](https://support.google.com/googleplay/android-developer/answer/13996367?hl=en)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google Play prominent disclosure and consent](https://support.google.com/googleplay/android-developer/answer/11150561?hl=en)
- [Google Play permissions declaration](https://support.google.com/googleplay/android-developer/answer/9214102?hl=en)
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=ko)
- [Android alarm scheduling](https://developer.android.com/develop/background-work/services/alarms)
- [Android Auto Backup](https://developer.android.com/identity/data/autobackup)
- [Expo SDK 54 notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)
- [Expo SDK 54 platform reference](https://docs.expo.dev/versions/v54.0.0/)
- [Expo SDK 54 SQLite and SQLCipher](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo permission removal](https://docs.expo.dev/guides/permissions/)
- [Expo development build variants](https://docs.expo.dev/build-reference/variants/)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [MDN SpeechRecognition.processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally)
- [개인정보 보호법 제23조 민감정보의 처리 제한](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027416043)
- [UN CRPD General Comment No. 1 — 지원 의사결정](https://uhr.humanrights.go.kr/pub/uhrstd/365)

### 연구·사용자 경험

- [Effects of using medication reminder technologies by home-dwelling older citizens: systematic review (2026)](https://pubmed.ncbi.nlm.nih.gov/41642177/)
- [Factors associated with medication adherence in older patients: systematic review](https://pubmed.ncbi.nlm.nih.gov/31410389/)
- [Ethical issues associated with assistive technologies for persons living with dementia](https://pubmed.ncbi.nlm.nih.gov/40372198/)
- [Co-design of a Smartphone App for People Living With Dementia](https://pubmed.ncbi.nlm.nih.gov/35029539/)
- [Medisafe — Google Play listing and verified reviews](https://play.google.com/store/apps/details?id=com.medisafe.android.client)
- [DementiaCare — Google Play listing and verified reviews](https://play.google.com/store/apps/details?id=app.dementiacare)

## 13. 우선순위 요약

1. **현재 AAB 사용 중지, 합성 데이터만 허용**
2. **정책 URL·인앱 링크·Health 선언·정확한 Store 문구 수정**
3. **약 기본값 제거, 다음 1회 알림이라는 한계 명시, 잠금화면 민감정보 제거**
4. **앱 잠금·역할 분리·전체 삭제·동의 철회 구현**
5. **전체 매뉴얼 암호화와 runtime schema/오류 복구 구현**
6. **dev-client·불필요 권한 제거 및 공급망 패치 후 새 AAB 생성**
7. **실기기 네트워크·알림·삭제·공유기기 매트릭스 통과**
8. **당사자+돌봄 파트너 공동설계 파일럿 후에만 실제 데이터 단계 검토**

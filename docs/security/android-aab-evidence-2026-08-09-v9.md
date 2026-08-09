# Android 1.1.2 (9) 안전한 기기 인증 복구 후보 증거

- 검증일: 2026-08-09 (Asia/Seoul)
- 대상 소스: `b17a36bf3b61bf9a3dcbbe5ad49a031fcca1768c`
- 앱: `생활후견 AI` / `com.sinmb.careguardianai`
- 판정: **합성 데이터 Alpha 교체 업로드 후보 PASS**
- 이전 후보: `1.1.1 (8)`은 후속 P1 인증 경합 발견으로 Google 검토 변경사항을 회수했으며 테스터 제공 후보로 사용하지 않음
- 현재 제공 중: Play Alpha `1.1.0 (7)`, 2026-08-09 확인 기준 참여자 12명·운영 8일째

이 판정은 앱 종료 후 재실행한 뒤 `기기 인증으로 열기`를 눌러 인증해도 잠금 화면을 벗어나지 못하던 결함과, 인증 화면 복귀 뒤 앱이 다시 백그라운드로 가면 늦은 인증 성공이 소비될 수 있던 P1 경합을 함께 차단한 소스에서 생성한 AAB에 적용합니다. 승인 전까지 `1.1.2 (9)`의 테스터 제공 완료를 주장하지 않습니다.

## 1. EAS production 빌드

| 항목 | 확인값 |
|---|---|
| EAS build ID | `3d292e10-2ab3-4225-8e8b-152b0f566aaf` |
| 상태 | `FINISHED` |
| source SHA | `b17a36bf3b61bf9a3dcbbe5ad49a031fcca1768c` |
| EAS fingerprint | `1d4047b55e63a6e2fe3c491f98104e8f1de9c61a` |
| versionName / versionCode | `1.1.2` / `9` |
| 생성 / 완료 시각 | `2026-08-09T02:04:42.899Z` / `2026-08-09T02:13:29.422Z` |
| AAB 크기 | `98,668,452` bytes |
| AAB SHA-256 | `8fa05cd8bcda839983a9a33c630ad76df5a6649862c42f8e7062889381492916` |
| EAS 기록 | [production build](https://expo.dev/accounts/sinmb79/projects/careguardian-ai-mobile/builds/3d292e10-2ab3-4225-8e8b-152b0f566aaf) |

`jarsigner -verify -verbose -certs`는 `jar verified`를 반환했습니다. bundletool universal APK는 로컬 QA 전용 debug key로 서명했으며 Play에 업로드하거나 배포하지 않습니다.

감사 산출물은 `C:\Users\sinmb\workspace\release-artifacts\careguardian-ai\1.1.2-9`에 보관했습니다.

| 산출물 | 크기 | SHA-256 |
|---|---:|---|
| `life-steward-ai-1.1.2-vc9.aab` | `98,668,452` bytes | `8fa05cd8bcda839983a9a33c630ad76df5a6649862c42f8e7062889381492916` |
| `life-steward-ai-1.1.2-vc9-universal.apks` | `167,665,144` bytes | `297c84eb8445790ab61b012ad24e159c8c9e9847066489ecad9bc51a654ad232` |
| `life-steward-ai-1.1.2-vc9-universal.apk` | `167,664,835` bytes | `596eb2d60c8f415ae1c3384493a4332f1a8953763dc7db33dc937f16a5626cec` |
| `cpu-only-aab-b17a36b-evidence.json` | `131,157` bytes | `f67c3c09506301d656b33e2f8032be5225fc0a04a70d78e961eb463043c7a930` |

## 2. AAB 정적·네이티브 계약 검사

| 검사 | 결과 |
|---|---|
| package / version | `com.sinmb.careguardianai` / `1.1.2 (9)` |
| minSdk / targetSdk / compileSdk | `24` / `36` / `36` |
| Android 백업 | `android:allowBackup="false"` |
| debug surface | AAB manifest에 `android:debuggable` 없음 |
| autolinking | `life-local-notifications` 1개, `expo-notifications` 0개 |
| 원격 푸시 부재 | AAB `776` entries + universal APK `728` entries, DEX package gate 포함 `PASS` |
| 원격 푸시 스캔 바이트 | AAB `15,871,533`, universal APK `15,759,151` |
| CPU ABI | arm64 JNI `6`, x86_64 JNI `2` |
| 가속기 산출물 | Hexagon·OpenCL·HTP·Vulkan·GPU 관련 AAB entry `0` |
| 로컬 알림·모델 무결성 | Kotlin compile 계약 `PASS` |
| Metro release bundle | `PASS` |
| 전체 저장소 게이트 | `npm run verify` — Vitest `311`, mutation `202`, Expo Doctor `18/18`, build·typecheck·정책·감사 기준 모두 `PASS` |

동일 source SHA의 영문 전용 clean checkout `C:\cg-release-v9`에서 clean prebuild부터 네이티브 계약 전체를 재실행했습니다. CPU-only 증거의 생성 Gradle SHA-256은 `4d9235fe4a7ef267a0d99633d0b3bc201cbce1c80bfa63f4c8c932c56d91211a`이며 AAB SHA-256은 위 final AAB와 일치합니다.

AAB가 선언한 권한은 아래뿐입니다.

- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`
- `android.permission.RECEIVE_BOOT_COMPLETED`
- Android 14 이상의 `android.permission.DETECT_SCREEN_CAPTURE`
- 앱 전용 `com.sinmb.careguardianai.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

카메라, 마이크, 연락처, 위치, 외부 저장소, Health Connect, `AD_ID`, 정확 알람 권한은 없습니다.

## 3. 인증 순서 회귀 검사

인증 성공과 앱 활성화 이벤트의 순서가 달라도 안전하게 처리하고, 인증 화면에서 복귀한 뒤 다시 백그라운드로 가면 이전 인증 성공을 폐기하도록 검사했습니다. 관련 workspace/auth 테스트 21개와 mobile typecheck가 통과했습니다.

| 이벤트 순서 | 기대·확인 결과 |
|---|---|
| `background → active → background → auth success → active` | 늦은 성공 폐기, 잠금 유지, 저장소 추가 load 없음 |
| `background → auth success → active` | active까지 load 보류 후 정상 잠금 해제 |
| `background → active → auth success` | 인증 성공 후 정상 잠금 해제 |

첫 번째 순서가 회수된 `1.1.1 (8)`에서 추가로 발견한 P1을 재현하는 CT-13입니다.

## 4. universal APK 네이티브 CT-12

bundletool로 final AAB에서 만든 universal APK의 v2/v3 서명을 검증한 뒤 Android API 35 x86_64 에뮬레이터에 설치했습니다.

1. 설치된 패키지가 `1.1.2 (9)`, min SDK `24`, target SDK `36`인지 확인했습니다.
2. 임시 PIN을 설정하고 합성 작업 `SYNTHETIC-CT12-V9`을 저장했습니다.
3. 앱을 강제 종료하고 cold start하여 잠금 화면을 확인했습니다.
4. UI tree에서 계산한 좌표로 `기기 인증으로 열기`를 누르고 Android 시스템 PIN 인증을 완료했습니다.
5. 잠금 화면을 벗어났고 저장한 합성 작업이 그대로 보이는 것을 `qa-ui-05-unlocked.xml`에서 확인했습니다.
6. crash buffer는 `0` byte였습니다. 화면 캡처는 앱의 `FLAG_SECURE` 정책대로 검은 화면으로 저장되어 캡처 차단도 유지됐습니다.
7. 검증 후 임시 PIN을 지우고 앱 패키지를 제거했습니다.

결과는 **PASS**입니다. 사용자가 신고한 앱 종료·재실행 후 인증 정지 결함을 final AAB 파생 APK에서 재현 절차로 확인했습니다.

## 5. 잔여 한계와 다음 게이트

React Native `AppState`만으로 최초 비활성화가 시스템 인증 Activity 때문인지 Home·다른 앱 전환 때문인지 완전히 구분할 수 없습니다. 인증 Activity가 이미 background인 상태에서 Home 이동이 추가 non-active 이벤트를 만들지 않는 기기에서는 이전 성공 토큰이 다음 active에서 소비될 가능성을 물리 기기에서 탐색해야 합니다. 이는 이번 CT-13 수정으로 새로 생긴 회귀는 아니지만 인증 provenance의 잔여 설계 한계입니다.

따라서 CT-14는 Samsung·Pixel 물리 기기 필수 항목입니다. 이전 인증 결과로 자동 잠금 해제가 한 번이라도 관찰되면 테스트를 즉시 중단하고 native 인증 provenance 경계를 구현하기 전까지 실제 개인정보·민감정보 사용과 정식 출시를 차단합니다. 그 전까지 합성 데이터 비공개 테스트만 허용하며 실제 개인정보·민감정보 사용과 정식 출시는 `NO-GO`입니다.

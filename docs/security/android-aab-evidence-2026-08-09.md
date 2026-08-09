# Android 1.1.1 (8) 기기 인증 복구 후보 증거

- 검증일: 2026-08-09 (Asia/Seoul)
- 대상 소스: `7570901b80d2e357274e6b7bb5a7e54bdddfe8a3`
- 앱: `생활후견 AI` / `com.sinmb.careguardianai`
- 판정: **합성·비민감 데이터 비공개 테스트 Alpha 업데이트 후보 PASS**
- Play 업로드 전 상태: `1.1.0 (7)` 활성, 참여자 12명, 운영 8일째

이 판정은 앱 종료 후 재실행한 뒤 기기 인증 성공 시 작업공간으로 복귀하는 수정과 동일한 source SHA에서 생성한 AAB에 적용합니다. Samsung/Pixel 물리 기기 증거와 발견사항 처리가 끝나기 전까지 실제 개인정보·민감정보 사용과 정식 출시는 `NO-GO`입니다.

## 1. EAS production 빌드

| 항목 | 확인값 |
|---|---|
| EAS build ID | `6e77fa1e-f8dc-48a6-ac6e-269795c9360f` |
| 상태 | `FINISHED` |
| source SHA | `7570901b80d2e357274e6b7bb5a7e54bdddfe8a3` |
| EAS fingerprint | `18edeec84a07453f71921252176eed46f1deed09` |
| versionName / versionCode | `1.1.1` / `8` |
| 생성 / 완료 시각 | `2026-08-09T01:18:35.553Z` / `2026-08-09T01:27:50.959Z` |
| AAB 크기 | `98,668,393` bytes |
| AAB SHA-256 | `69c6a7f1dd62a4e47291c9c7cce76e32eca6909fcdf2144d2f33ad6c09dc2575` |
| EAS 기록 | [production build](https://expo.dev/accounts/sinmb79/projects/careguardian-ai-mobile/builds/6e77fa1e-f8dc-48a6-ac6e-269795c9360f) |

AAB JAR 서명은 `jarsigner -verify -verbose -certs`에서 `jar verified`로 확인했습니다. 로컬 universal APK는 AAB 검증과 에뮬레이터 설치를 위해 bundletool이 QA 전용 debug key로 서명한 파생물이며 Play에 업로드하거나 배포하지 않습니다.

감사 산출물은 `C:\Users\sinmb\workspace\release-artifacts\careguardian-ai\1.1.1-8`에 보관했습니다.

| 산출물 | 크기 | SHA-256 |
|---|---:|---|
| `life-steward-ai-1.1.1-vc8.aab` | `98,668,393` bytes | `69c6a7f1dd62a4e47291c9c7cce76e32eca6909fcdf2144d2f33ad6c09dc2575` |
| `life-steward-ai-1.1.1-vc8-universal.apks` | `167,665,144` bytes | `149be2fc3c164a1e23c1aead264cd086036875115a4d5d8dd1069271e0143c16` |
| `life-steward-ai-1.1.1-vc8-universal.apk` | `167,664,835` bytes | `67281806af4343e220e65e9dfaa3c3c7df0d3b4af3175c344ba5499c51ccf019` |
| `cpu-only-aab-7570901-evidence.json` | `131,157` bytes | `2c7efd481a85c4a4810d0be4077da750562dafa365eeb867653e9eab6310c1a0` |

## 2. AAB 정적·네이티브 계약 검사

| 검사 | 결과 |
|---|---|
| package / version | `com.sinmb.careguardianai` / `1.1.1 (8)` |
| minSdk / targetSdk / compileSdk | `24` / `36` / `36` |
| Android 백업 | `android:allowBackup="false"` |
| debug surface | AAB manifest에 `android:debuggable` 없음 |
| autolinking | `life-local-notifications` 1개, `expo-notifications` 0개 |
| 원격 푸시 부재 | AAB `776` entries + universal APK `728` entries, DEX package gate 포함 `PASS` |
| 원격 푸시 스캔 바이트 | AAB `15,871,533`, universal APK `15,759,151` |
| CPU ABI | arm64 JNI `6`, x86_64 JNI `2` |
| 가속기 산출물 | Hexagon·OpenCL·HTP·Vulkan·GPU 관련 AAB entry `0` |
| 모델 무결성 / 로컬 알림 | Kotlin compile 계약 `PASS` |
| Metro release bundle | `PASS` |

Windows 한글 경로에서 Expo native subprocess가 종료되는 도구 제약을 분리하기 위해 동일 source SHA의 영문 절대 경로 clean checkout에서도 prebuild부터 release 계약 전체를 다시 실행했고 모두 통과했습니다. 생성 Gradle 파일 SHA-256은 `f1e01490e08b79fa8ba1cb2df8d5d749c4a2542dc92fd2190d91b39ec492329b`이며 CPU-only 증거의 AAB SHA-256은 위 final AAB와 일치합니다.

AAB가 선언한 권한은 아래뿐입니다.

- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`
- `android.permission.RECEIVE_BOOT_COMPLETED`
- Android 14 이상용 `android.permission.DETECT_SCREEN_CAPTURE`
- 앱 전용 `com.sinmb.careguardianai.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

카메라, 마이크, 연락처, 위치, 외부 저장소, Health Connect, `AD_ID`, 정확 알람 권한은 없습니다.

## 3. universal APK 설치·기기 인증 회귀 QA

bundletool로 final AAB에서 만든 universal APK의 v2/v3 서명을 검증했습니다. QA 인증서 SHA-256은 `112e6b928c7b567fd0d66cfcc6063e230dd42f0dcbe49fc042338e0da7522ac0`입니다.

| 항목 | 확인값 |
|---|---|
| 대상 | Android API 35 x86_64 emulator |
| 설치 | `Success`, `1.1.1 (8)`, min SDK `24`, target SDK `36` |
| cold launch | `MainActivity` 354ms, top-resumed, process 유지 |
| 첫 화면 | 빈 개인 생활 작업공간과 오늘·목록·기능 만들기·로컬 AI·설정 탭 |
| 치명적 예외 | crash buffer `0` |

신고된 결함은 아래 합성 데이터 CT-12 시나리오로 직접 확인했습니다.

1. QA 기기에 임시 PIN을 설정했습니다.
2. 합성 작업을 저장하고 `생활 작업공간을 저장했습니다.` 메시지를 확인했습니다.
3. 앱을 강제 종료한 뒤 cold start하여 잠금 화면을 확인했습니다.
4. `기기 인증으로 열기`를 누르고 Android PIN 인증을 완료했습니다.
5. 잠금 화면에서 작업공간으로 이동하고 `인증되었습니다.` 메시지와 저장된 합성 작업이 보이는 것을 확인했습니다.
6. 앱 process가 유지되고 crash buffer가 비어 있음을 확인했습니다.

결과는 **PASS**입니다. 인증 성공과 React Native `AppState=active` 이벤트의 도착 순서가 달라도 같은 인증 작업의 활성화 신호를 기다린 뒤 열리며, 그 사이 추가 비활성화 이벤트가 발생하면 안전하게 잠금 상태를 유지하는 단위 회귀 테스트도 통과했습니다.

검증 뒤 임시 PIN을 지우고 QA 앱과 합성 데이터를 제거했으며, 기기에 잠금 자격 증명과 앱 package가 남지 않았음을 다시 확인했습니다.

## 4. 범위와 다음 게이트

이 AAB는 기존 Alpha의 문안·자산·Data safety·네트워크 경계를 변경하지 않는 인증 복구 업데이트입니다. Play Console에는 AAB SHA-256과 `versionCode 8`을 대조해 업로드하고, 기존 참여자 수와 14일 운영 진행이 유지되는지 확인합니다.

비공개 테스트 중 Samsung·Pixel 물리 기기에서 잠금·PIN fallback·삭제·로컬 알림·모델 설치·네트워크 관찰 증거를 계속 수집합니다. 이 증거와 중대한 발견사항 해소가 끝나기 전까지 실제 개인정보·민감정보 사용과 정식 출시는 허용하지 않습니다.

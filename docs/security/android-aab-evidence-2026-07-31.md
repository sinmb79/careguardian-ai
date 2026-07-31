# Android 1.1.0 (7) 비공개 테스트 후보 증거

- 검증일: 2026-07-31 (Asia/Seoul)
- 대상 소스: `d990c4784526f9eccc33ee558579dc806b9bbaea`
- 앱: `생활후견 AI` / `com.sinmb.careguardianai`
- 판정: **합성·비민감 데이터 비공개 테스트용 AAB 후보 PASS**
- 남은 외부 단계: 이 AAB와 아래 Android-native 자산을 Play Console 문안·선언·Data safety에 대조하고 기존 비공개 테스트 release를 교체

이 판정은 합성 데이터 비공개 테스트 후보에만 적용합니다. Samsung/Pixel 물리 기기 증거와 발견사항 처리가 끝나기 전에는 실제 개인정보·민감정보 사용과 정식 출시를 허용하지 않습니다.

## 1. EAS production 빌드

| 항목 | 확인값 |
|---|---|
| EAS build ID | `28f9bafa-73a7-4316-a1d5-1764ef6dd516` |
| 상태 | `FINISHED` |
| source SHA | `d990c4784526f9eccc33ee558579dc806b9bbaea` |
| EAS fingerprint | `49fad510f2d57623475a94331872c1366a34f531` |
| versionName / versionCode | `1.1.0` / `7` |
| 완료 시각 | `2026-07-31T04:05:19.396Z` |
| AAB 크기 | `98,668,069` bytes |
| AAB SHA-256 | `e29047be5302bb99e009bd2e1dd27d89ba246712b507f7ad084ef8623d6430c8` |

EAS의 AAB JAR 서명은 `jarsigner -verify -verbose -certs`에서 `jar verified`로 확인했습니다. 로컬 universal APK는 AAB 검증과 에뮬레이터 설치를 위해 bundletool이 별도 디버그 키로 서명한 QA 파생물이며 Play에 업로드하거나 배포하지 않습니다.

앞선 원격 실패의 원인은 Windows에서 생성된 `apps/mobile/android`와 절대 경로 기반 stale autolinking 파일이 EAS archive에 포함된 것이었습니다. `.easignore` 출시 게이트와 fresh archive 검사로 생성 Android 트리를 제외한 뒤 같은 production 흐름이 성공했습니다. 상세 원인과 archive 검사는 [EAS archive 검사 증거](./eas-archive-inspection-2026-07-31.md)에 기록했습니다.

## 2. AAB 정적 검사

bundletool manifest, 저장소의 CPU-only 검사기, AAB와 universal APK 쌍의 원격 푸시 부재 검사로 다음을 확인했습니다.

| 검사 | 결과 |
|---|---|
| package | `com.sinmb.careguardianai` |
| version | `1.1.0 (7)` |
| minSdk / targetSdk / compileSdk | `24` / `36` / `36` |
| Android 백업 | `android:allowBackup="false"` |
| debug surface | AAB manifest에 `android:debuggable` 없음 |
| CPU ABI | `arm64-v8a`, `x86_64` CPU rnllama JNI 확인 |
| 가속기 산출물 | Hexagon, OpenCL, HTP, Vulkan, GPU 관련 AAB entry `0` |
| 원격 푸시 | AAB `776` entries + universal APK `728` entries, DEX package gate 포함 `PASS` |
| 광고·분석 | Firebase Messaging/Installations, Cloud Messaging/DataTransport, ShortcutBadger, 광고 ID namespace `0` |
| AAB CPU-only 증거 | `cpu-only-aab-d990c47-evidence.json`, AAB SHA와 일치 |

AAB가 선언한 권한은 아래뿐입니다.

- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`
- `android.permission.RECEIVE_BOOT_COMPLETED`
- Android 14 이상용 `android.permission.DETECT_SCREEN_CAPTURE`
- 앱 전용 `com.sinmb.careguardianai.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

카메라, 마이크, 연락처, 위치, 외부 저장소, Health Connect, `AD_ID`, 정확 알람 권한은 없습니다. Android release merged manifest 계약 검사도 `PASS`했습니다.

## 3. universal APK 설치·실행

bundletool `1.18.3`으로 위 AAB에서 universal APK를 만들었습니다.

| 항목 | 확인값 |
|---|---|
| universal APK 크기 | `167,664,835` bytes |
| universal APK SHA-256 | `6dfc3aad1fbd9e2ffcb67029efe9dfbad90ae4cf85fb971211df41e062dbad9b` |
| 서명 | QA 전용 debug certificate, SHA-256 `112e6b928c7b567fd0d66cfcc6063e230dd42f0dcbe49fc042338e0da7522ac0` |
| 설치 대상 | Android x86_64 emulator `emulator-5554` |
| 설치 결과 | `Success`, `1.1.0 (7)`, target SDK `36` |
| 실행 결과 | `com.sinmb.careguardianai/.MainActivity`가 top-resumed, 앱 process 유지, 치명적 예외 없음 |
| 첫 화면 | 빈 개인 생활 작업공간, 오늘·목록·기능 만들기·로컬 AI·설정 탭 확인 |

검증 후 QA 앱 데이터와 앱을 제거했습니다. 임시 기기 PIN을 삭제하고 화면 크기·밀도와 animation scale을 기본값으로 복원했으며 Wi-Fi와 mobile data를 활성 상태로 확인했습니다.

같은 source SHA에서 만든 x86_64 로컬 release QA APK도 설치·실행과 manifest 검사를 통과했습니다. 이 APK는 디버그 인증서로 서명된 비배포 QA 산출물입니다.

| 항목 | 확인값 |
|---|---|
| x86_64 QA APK 크기 | `52,159,310` bytes |
| x86_64 QA APK SHA-256 | `3b719a1d649120b2f600632ce7d279e4b98b71fb7bb760d00942ce88383efe34` |
| merged manifest SHA-256 | `5d3a5c38ba21cfa5a1df36b2bdc5f1a150d7ca7d9633f4c79e85558e183f66d5` |

## 4. Android-native Play 스크린샷

합성·비민감 생활 데이터만 사용한 Android 앱 화면 8장을 `docs/screenshots/`에 반영했습니다. 모든 PNG는 8-bit opaque RGB, 8MB 미만, 장변/단변 비율 2:1 이하입니다.

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| `phone-screenshot-1.png` | 1080×1920 | `6d4f5e83116b315884c520a9686cae0a1405df0600df1a3e2e8ae127cc6cc56b` |
| `phone-screenshot-2.png` | 1080×1920 | `2b791a0838fc0f0d0603dc8317664a6cf52781129eaea3d8aa6a4a92a555388f` |
| `phone-screenshot-3.png` | 1080×1920 | `6eca1ab8fdc3cf55dbddde0ec74eac03fd5b0e883938d6e5250a5a4f00772f3c` |
| `phone-screenshot-4.png` | 1080×1920 | `5f132cb35d2f42dedd125d50533c0302adc0fefb7c9bab09a9351a986cf5904d` |
| `tablet7-screenshot-1.png` | 900×1536 | `0030bc9d59c73407c7c7e593ed22fa97a6a648c1755e964f95ca63ff53312083` |
| `tablet7-screenshot-2.png` | 900×1536 | `6802c64c635ecbe34dcf398d28187c8062de5b71e208ef5b08e4fc89cced0bc2` |
| `tablet10-screenshot-1.png` | 1600×2560 | `be7a31a52ef17b3d07bd7327c5b4344d76b19e12dd86d268504b9e4ec19c5db9` |
| `tablet10-screenshot-2.png` | 1600×2560 | `b42d5d6eee4a5e5054ca316e585e9e6370e7f425d0ef1782b624b49ccbd036b2` |

Production 앱은 `usePreventScreenCapture("life-steward-personal-workspace")`를 유지하므로 Android screencap으로 등록 이미지를 만들 수 없습니다. 캡처에는 production과 기능·화면 소스가 같은 격리 복제본을 사용하고 캡처 차단 hook 두 줄만 일시적으로 제거했습니다. 이 캡처용 코드는 커밋·AAB·QA 설치 후보에 포함하지 않았고, production `App.tsx`의 hook 존재를 다시 확인했습니다.

Windows Korean OCR 보조 게이트는 8장 모두에서 지정 금칙어 정확 일치 `0`건이었습니다. OCR 로그 SHA-256은 `f6569dbb45d77997bed298f9e4e5f9aacf749a6553b843b40ed2baa528da24b8`입니다. OCR에는 오인식과 미인식 가능성이 있으므로 의미상 안전성을 증명하는 단독 근거로 사용하지 않았고, 별도의 수동 시각 검토로 의료·건강·위험 문구가 없는 후보만 남겼습니다.

## 5. 로컬 AI 대표 합성 QA 범위

UI와 로컬 AI 기능 소스가 같은 exact-source 후보에서 HyperCLOVA X SEED Text Instruct 0.5B의 고정 revision, byte size, SHA-256 검증과 CPU load를 확인했습니다. 원문 발췌는 통과했고 문장부호 정리·제목·체크리스트 시도는 엄격한 출력 검증으로 `output_blocked`되어 결과가 저장되지 않았습니다. 차단 후 모델 재로딩과 전체 삭제는 통과했습니다.

오프라인 창에서는 설치 모델 재로딩은 통과했지만 70초 안에 추론 결과가 나오지 않아 성공으로 주장하지 않습니다. Samsung/Pixel의 arm64 성능·품질·알림·삭제·네트워크 관찰은 합성 데이터 비공개 테스트 중 계속 수집합니다.

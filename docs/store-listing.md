# Google Play 스토어 등록 문안 — 생활후견 AI 비공개 테스트

이 문서는 `생활후견 AI 1.1.0 (7)`의 현재 Console 입력 기준입니다. 실제 Console 저장 전에는 새 AAB와 고정 Hugging Face HTTPS 요청 경로 2개를 다시 대조합니다. IARC 등급은 실제 Console 설문 응답으로만 확정하며 이 문서는 임의 등급을 만들지 않습니다.

## 제출·검증 단계

- 합성·비민감 데이터만 사용하는 Play 비공개 테스트는 현재 버전 최종 AAB, AAB 정적 검사, Android-native 스크린샷, Console 문안·선언·Data safety 대조가 완료된 뒤 제출·운영을 시작할 수 있습니다.
- Samsung/Pixel 물리 기기 검증은 비공개 테스트 중 합성 데이터로 수집하는 증거이며, 위 제출·운영 시작의 절대 선행 조건은 아닙니다.
- Samsung/Pixel 증거와 발견사항 처리가 끝나기 전에는 실제 개인정보·민감정보 사용과 정식 출시를 허용하지 않습니다.

## 한국어 (기본 언어)

### 앱 이름

생활후견 AI

### 짧은 설명 (80자 이내)

일정·메모·체크리스트를 정리하고 선택형 한국어 AI를 기기에서 실행하는 로컬 우선 작업공간

### 전체 설명

생활후견 AI는 일정, 할 일, 메모, 체크리스트와 사용자가 만든 개인 기능을 한 기기에서 정리하는 로컬 우선 작업공간입니다.
일반 개인 생산성 앱이며 건강·의료 기능이나 건강 데이터를 다루지 않습니다.

주요 기능
• 오늘의 작업과 개인 목록을 만들고 정리할 수 있습니다.
• 이름을 정해 선언형 개인 기능 항목을 추가할 수 있습니다. 임의 코드·URL·플러그인은 실행하지 않습니다.
• 사용자가 선택한 날짜의 오전 9시를 기준으로 앱이 Android 로컬 알림을 직접 예약합니다. 원격 푸시는 사용하지 않으며, 배터리 절전이나 Android 시스템 정책에 따라 알림이 정확한 시각보다 늦게 표시될 수 있습니다.
• 현재 버전의 로컬 알림은 Android에서만 지원하며 iOS에서는 사용할 수 없습니다.
• 알림 제목은 일반 문구로 표시되고 알림 데이터에는 작업 식별자만 포함됩니다.

선택형 기기 내 한국어 AI
• 사용자가 설치를 선택한 경우에만 승인·고정된 NAVER HyperCLOVA X GGUF 2개 중 선택한 모델 하나를 Hugging Face에서 내려받습니다.
• 다운로드 전에 출처, 파일 크기, SHA-256, 라이선스를 확인하고 동의할 수 있습니다.
• 0.5B 모델은 기기 CPU에서만 실행되며 기존 텍스트의 요약, 문장 다듬기, 제목 제안, 체크리스트 초안을 best-effort 방식으로 시도합니다.
• 모든 결과는 엄격한 정책·원문 근거 검증을 거치며, 통과하지 못하면 원문을 변경하지 않고 폐기되며 같은 동작을 다시 시도할 수 있습니다.
• 비공개 테스트에서는 네 동작의 성공률과 기기별 결과 품질을 평가합니다.
• 자유 대화형 기능이 아니며 결과는 사용자가 승인하기 전까지 작업공간에 저장되지 않습니다.
• 모델 설치를 거부하거나 삭제해도 일반 작업 기능은 계속 사용할 수 있습니다.

데이터와 외부 연결
• 계정, 광고, 분석 SDK, 클라우드 AI, 원격 푸시를 사용하지 않습니다.
• 작업, 목록, 메모, 사용자 기능, AI 입력과 결과는 기기 안에서 처리됩니다.
• 모델 설치를 시작하면 고정된 HTTPS 주소로 Hugging Face 파일 요청이 발생합니다. 이 과정에서 IP 주소와 일반 네트워크 메타데이터가 Hugging Face에 기록될 수 있지만, 작업 내용과 AI 입력·결과는 전송하지 않습니다.
• 연락처, 위치, 마이크, 카메라, 외부 저장소 권한을 요청하지 않습니다.

보호와 삭제
• 모바일 작업공간은 SQLCipher와 Android Keystore 경계를 사용하며 Android 백업과 화면 캡처를 차단합니다.
• '이 기기의 모든 데이터 삭제'를 실행하면 진행 중인 AI 작업과 예약 알림을 중단하고, 설치 모델, 부분 다운로드, 작업공간과 기기 내 키를 삭제합니다.
• Hugging Face가 독립적으로 보관할 수 있는 외부 기록은 앱의 삭제 기능으로 지울 수 없으며 해당 서비스의 정책과 삭제 요청 절차가 적용됩니다.
• 자세한 내용은 앱 설정과 Play 등록정보에 연결된 개인정보처리방침에서 확인할 수 있습니다.

비공개 테스트에서는 합성된 비민감 일정과 메모만 사용해 주세요.

### 출시 노트

일반 생활 작업 중심으로 앱을 전면 재구성했습니다.
• 일정·목록·메모·개인 기능을 한 기기에서 정리할 수 있습니다.
• 앱이 직접 예약하는 Android 로컬 알림과 선택형 기기 내 한국어 AI를 추가했습니다.
• 0.5B 로컬 AI 결과는 best-effort이며, 엄격한 검증에 통과하지 못하면 원문 변경 없이 폐기되고 다시 시도할 수 있음을 명확히 했습니다.
• 로컬 저장 보호, 전체 삭제, 외부 모델 다운로드 고지를 강화했습니다.

### Play Console 적용값

| 항목 | Console 입력값 | 확인/제한 |
|---|---|---|
| 카테고리 | `Productivity` | 현재 제품 범위 |
| 타깃 연령 | 18세 이상 | 현재 제품 범위 |
| App access | 제한 없음 / 로그인 없음 | 앱 계정·공용 암호·리뷰 계정 없음 |
| 광고 | 없음 | 광고 SDK·광고 ID 사용 없음 |
| Health apps declaration | `My app doesn't provide any health features` | 건강·피트니스 데이터 접근 없음 |
| IARC 콘텐츠 등급 | 실제 Console 설문 답변으로 확정 | 임의 등급 금지 |
| 스크린샷 | Android 앱 화면 재캡처본만 업로드 | phone 4장·7-inch 2장·10-inch 2장 검증 완료. 해시와 캡처 경계는 `docs/security/android-aab-evidence-2026-07-31.md` 참조 |

### Data safety Console 입력 기준

선택형 모델 다운로드 때문에 **앱이 데이터를 수집/공유하는가**에는 `예`로 시작합니다. 일반 작업공간·프롬프트·출력은 기기 안에서만 처리되며 원격 수집/공유하지 않습니다.

| Data type | 수집 | 처리 기간 | 목적 | 공유 | Console 확인 메모 |
|---|---|---|---|---|---|
| 대략적인 위치 | 선택적 수집 | 비일시적 | 앱 기능, 분석, 사기 방지·보안·규정 준수 | 아니요* | Hugging Face가 IP 주소에서 추정할 수 있는 위치 |
| 앱 상호작용 | 선택적 수집 | 비일시적 | 앱 기능, 분석, 사기 방지·보안·규정 준수 | 아니요* | 선택한 모델 요청 경로와 서비스 이용 기록 |
| 기기/기타 ID | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 최종 AAB와 그 AAB에서 만든 universal APK 모두에서 Firebase Messaging/Installations, FCM/FID, Cloud Messaging/DataTransport, ShortcutBadger 및 광고 ID 패키지가 없고 실기기 네트워크 관찰이 일치할 때만 이 값을 사용 |
| 건강정보 | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 원격 수집/공유 없음 |
| 캘린더 | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 원격 수집/공유 없음 |
| 연락처 | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 원격 수집/공유 없음 |
| 파일/문서 | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 원격 수집/공유 없음 |
| 사용자 생성 콘텐츠 | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 일반 작업·목록·메모·프롬프트·출력은 기기 내 처리 |

`*` 공유는 강화된 설치 직전 고지와 사용자 시작 다운로드 예외를 적용하여 `아니요`로 제출하는 기준입니다. 실제 Console 문구 또는 검토 결과가 이 예외의 조건과 다르면 보수적으로 `공유`로 변경합니다.

- 전송 암호화: `예` — 고정 HTTPS 모델 경로를 최종 AAB에서 검증한 경우
- 계정 생성·로그인: 없음
- 삭제: 기기 내 전체 삭제 제공. Hugging Face 외부 기록은 해당 서비스 정책과 `privacy@huggingface.co` 절차를 안내

### 개인정보처리방침

https://sinmb79.github.io/careguardian-ai/privacy-policy.html

### 문의 이메일

sinmb79@naver.com

## English (reference translation)

### App name

Life Steward AI

### Short description

A local-first workspace to organize schedules, notes, and checklists and run optional Korean AI on device.

### Full description

Life Steward AI is a local-first workspace for organizing schedules, tasks, notes, checklists, and user-created personal tools on one device. It is a general personal-productivity app and does not handle health or medical functions or health data.

Main features
• Create and organize today's tasks and personal lists.
• Add named, declarative personal-tool entries. The app does not run arbitrary code, URLs, or plug-ins.
• The app directly schedules an Android local notification for 9:00 a.m. on the date selected by the user. There is no remote push, and Android power-saving or system policy may make delivery inexact or delayed.
• Local notifications are currently supported only on Android and are unavailable on iOS.
• A generic notification title is shown, and notification data contains only a task identifier.

Optional on-device Korean AI
• Only when the user chooses to install it, the app downloads one selected model from two approved, pinned NAVER HyperCLOVA X GGUF files on Hugging Face.
• Before download, the user can review and consent to the source, file size, SHA-256, and license.
• The 0.5B model runs only on the device CPU and makes best-effort attempts to summarize existing text, polish sentences, suggest titles, and draft checklists.
• Every result must pass strict policy and source-grounding checks. If a result does not pass, the app discards it without changing the source and the user can retry the same action.
• The closed test evaluates success rates for all four actions and result quality across devices.
• It is not a free-form chat feature, and results are not saved to the workspace until the user approves them.
• Declining or deleting the model does not disable the general workspace features.

Data and external connections
• There are no accounts, ads, analytics SDKs, cloud AI, or remote push.
• Tasks, lists, notes, personal tools, AI input, and AI results are processed on device.
• Starting model installation requests the file from a pinned Hugging Face HTTPS address. Hugging Face may log an IP address and ordinary network metadata, but workspace content, AI input, and AI results are not sent.
• The app does not request contacts, location, microphone, camera, or external-storage permissions.

Protection and deletion
• The mobile workspace uses SQLCipher and an Android Keystore boundary, and Android backup and screen capture are blocked.
• “Delete all data on this device” stops active AI work and scheduled notifications, then deletes the installed model, partial downloads, workspace, and on-device key.
• External records independently retained by Hugging Face cannot be erased by the app; that service's policy and deletion-request procedure apply.
• More information is available in the privacy policy linked from app settings and the Play listing.

Use only synthetic, non-sensitive schedules and notes during closed testing.

### Release notes

Rebuilt the app around ordinary personal tasks.
• Organize schedules, lists, notes, and personal tools on one device.
• Added app-scheduled Android local notifications and optional on-device Korean AI.
• Clarified that 0.5B local-AI results are best-effort; results that fail strict checks are discarded without changing the source and can be retried.
• Strengthened local-storage protection, full deletion, and external-model download disclosure.

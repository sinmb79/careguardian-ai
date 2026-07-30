# Google Play 스토어 등록 문안 — 생활후견 AI 비공개 테스트

이 문서는 `생활후견 AI 1.1.0 (7)`의 현재 Console 입력 기준입니다. 실제 Console 저장 전에는 새 AAB와 고정 Hugging Face HTTPS 요청 경로를 다시 대조합니다. IARC 등급은 실제 Console 설문 응답으로만 확정하며 이 문서는 임의 등급을 만들지 않습니다.

## 한국어 (기본 언어)

### 앱 이름

생활후견 AI

### 짧은 설명 (80자 이내)

기기 안에서 일정·메모·체크리스트를 정리하고 나만의 기능을 만드는 개인 작업공간

### 전체 설명

생활후견 AI는 일반 생활 작업, 일정, 할 일, 메모, 체크리스트와 사용자가 만든 선언형 기능을 한 기기에서 정리하는 개인 생산성·로컬 우선 도구입니다. 의료·복약·진단·치료·응급 기능은 제공하지 않습니다.

- 오늘과 목록: 일반 일정, 할 일, 개인 목록을 정리합니다.
- 나만의 기능 만들기: 선언형 필드와 제한된 자동화로 생활 기능을 추가합니다. 임의 URL·코드·플러그인을 실행하지 않습니다.
- 기기 내 일반 알림: 표시 제목은 일반 문구이며 data payload에는 `taskId`만 사용합니다. 일정 제목과 메모 본문은 payload에 넣지 않습니다.
- 선택 설치 로컬 AI: 사용자가 고정된 한국어 GGUF 파일의 출처·크기·SHA-256·라이선스를 확인하고 동의하면 기기 CPU에서 기존 텍스트의 요약, 문장 다듬기, 제목 제안, 체크리스트 초안만 제공합니다. 자유 대화형 기능이 아니며 결과는 승인 전 저장되지 않습니다.
- 로컬 저장과 삭제: 모바일은 SQLCipher와 SecureStore/Android Keystore 경계를 사용합니다. 기기 인증, 백그라운드 잠금, 화면 캡처 차단, Android 백업 차단을 적용하며, 전체 삭제는 추론·일반 알림·모델·부분 다운로드·작업공간·키·메모리 상태를 삭제합니다.

중요한 안내: 계정, 광고, 분석 SDK, 클라우드 AI, 원격 푸시를 사용하지 않습니다. 연락처·위치·마이크·카메라·외부 저장소 권한도 요청하지 않습니다. 모델 설치를 사용자가 명시적으로 선택하면 고정된 Hugging Face GGUF 파일 요청이 발생할 수 있습니다. 이 요청에서 IP 주소와 일반 네트워크 메타데이터는 Hugging Face에 기록될 수 있지만, 프롬프트·출력·작업 내용은 전송하지 않습니다. 비공개 테스트에는 합성·비민감 생활 일정과 메모만 사용하세요.

### 출시 노트

- 일반 생활 작업·목록·메모·사용자 기능 중심으로 전면 개편했습니다.
- 건강·복약 기능을 제거했습니다.
- 선택형 기기 내 한국어 문서 정리 도구를 추가했습니다.
- 로컬 저장·전체 삭제·개인정보 고지를 강화했습니다.

### Play Console 적용값

| 항목 | Console 입력값 | 확인/제한 |
|---|---|---|
| 카테고리 | `Productivity` | 현재 제품 범위 |
| 타깃 연령 | 18세 이상 | 현재 제품 범위 |
| App access | 제한 없음 / 로그인 없음 | 앱 계정·공용 암호·리뷰 계정 없음 |
| 광고 | 없음 | 광고 SDK·광고 ID 사용 없음 |
| Health apps declaration | `My app doesn't provide any health features` | 건강·피트니스 데이터 접근 없음 |
| IARC 콘텐츠 등급 | 실제 Console 설문 답변으로 확정 | 임의 등급 금지 |
| 스크린샷 | Android 앱 화면 재캡처본만 업로드 | 현재 웹 PWA 렌더 PNG는 검토용이며 업로드 금지 |

### Data safety Console 입력 기준

선택형 모델 다운로드 때문에 **앱이 데이터를 수집/공유하는가**에는 `예`로 시작합니다. 일반 작업공간·프롬프트·출력은 기기 안에서만 처리되며 원격 수집/공유하지 않습니다.

| Data type | 수집 | 처리 기간 | 목적 | 공유 | Console 확인 메모 |
|---|---|---|---|---|---|
| 대략적인 위치 | 선택적 수집 | 비일시적 | 앱 기능, 분석, 사기 방지·보안·규정 준수 | 아니요* | Hugging Face가 IP 주소에서 추정할 수 있는 위치 |
| 앱 상호작용 | 선택적 수집 | 비일시적 | 앱 기능, 분석, 사기 방지·보안·규정 준수 | 아니요* | 선택한 모델 요청 경로와 서비스 이용 기록 |
| 기기/기타 ID | 아니요 | 해당 없음 | 해당 없음 | 아니요 | 최종 AAB·네트워크 검증에서 FID·FCM 토큰 등 지속 식별자가 없을 때만 이 값을 사용 |
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

### Short description

A local-first workspace for schedules, notes, checklists, and personal tools.

### Full description

Life Steward AI is a general personal-productivity, local-first tool for ordinary life tasks, schedules, tasks, notes, checklists, and user-created declarative features. It does not provide medical, medication, diagnostic, treatment, or emergency functions.

It keeps workspace data on device. Mobile storage uses SQLCipher and a SecureStore/Android Keystore boundary, device authentication, background locking, screen-capture blocking, and disabled Android backup. Notifications are local only, use a generic title, and contain only a task ID in their payload.

Optional local AI runs on device CPU after the user reviews a pinned Korean GGUF file’s source, size, SHA-256, and license. It only summarizes or rewrites existing text, suggests a title, or drafts a checklist; it is not a free-form chat feature. Results are not saved until the user approves them. Installing a model is optional and may request the pinned file from Hugging Face. The host may log IP-derived metadata and the model request, but prompts, outputs, and workspace content are not sent with that request.

There are no accounts, ads, analytics SDKs, cloud AI, or remote push. Use only synthetic, non-sensitive schedules and notes during closed testing.

### Release notes

- Rebuilt around general life tasks, lists, notes, and user-created features.
- Removed health and medication features.
- Added an optional on-device Korean document-organizing tool.
- Strengthened local storage, full deletion, and privacy disclosure.

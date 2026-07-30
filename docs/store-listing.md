# Google Play 스토어 등록 문안 — 생활후견 AI 비공개 테스트

## 한국어 (기본 언어)

### 앱 이름

생활후견 AI

### 짧은 설명 (80자 이내)

기기 안에서 일정·메모·체크리스트를 정리하고 나만의 기능을 만드는 로컬 AI 도구

### 전체 설명

생활후견 AI는 일정, 할 일, 메모, 체크리스트와 사용자가 만든 개인 기능을 한 기기에서 정리하는 비의료·로컬 우선 도구입니다.

주요 기능

- 오늘과 목록: 일반 일정, 할 일, 개인 목록을 정리합니다.
- 나만의 기능 만들기: 선언형 필드와 제한된 자동화로 생활 기능을 추가합니다. 임의 URL·코드·플러그인을 실행하지 않습니다.
- 기기 내 일반 알림: 일정 제목이나 메모를 알림에 넣지 않고 일반 제목과 task ID만 사용합니다.
- 선택 설치 로컬 AI: 사용자가 고정된 한국어 GGUF 파일의 출처·크기·SHA-256·라이선스를 확인하고 동의하면 기기 CPU에서 텍스트를 요약하거나 다듬고, 제목 또는 체크리스트 초안을 제안합니다. 결과는 사용자가 승인하기 전 저장되지 않습니다.
- 로컬 저장과 삭제: 모바일은 SQLCipher와 SecureStore/Android Keystore 경계를 사용합니다. 기기 인증, 백그라운드 잠금, 화면 캡처 차단을 적용하며, 전체 삭제는 일반 알림·모델·부분 다운로드·작업공간·키를 삭제합니다.

중요한 안내

- 계정, 광고, 분석 SDK, 원격 푸시를 사용하지 않습니다. 연락처·위치·마이크·카메라·외부 저장소 권한도 요청하지 않습니다.
- 모델 설치를 선택하면 고정된 Hugging Face GGUF 파일 요청이 발생하며, IP 주소와 일반 네트워크 메타데이터는 호스트에 보일 수 있습니다. 프롬프트·출력은 모델 다운로드 요청으로 전송하지 않습니다.
- 비공개 테스트에는 합성·비민감 생활 일정과 메모만 사용하세요. 실제 개인정보나 민감정보는 입력하지 마세요.
- Data safety의 최종 답변은 production AAB와 실기기 네트워크 관찰을 완료한 뒤 다시 확인합니다.

### Play Console 적용값

| 항목 | 적용값 | 확인 시점 |
|---|---|---|
| 카테고리 | Productivity | 새 AAB와 문안 적용 시 |
| 콘텐츠 등급 | 18+ | 설문과 최종 스토어 설정 시 |
| 제품 위치 | 기능 제한형 로컬 문서 정리 도구 | 현재 구현 기준 |
| Health apps declaration | 비건강 앱 상태 | 새 AAB 정적 검사 뒤 |
| Ads / Advertising ID | 광고 없음 / 광고 ID 사용 안 함 | 새 AAB 정적 검사 뒤 |
| Data safety | Task 10의 네트워크 관찰 후 확정 | 아직 최종값 아님 |

### 개인정보처리방침

https://sinmb79.github.io/careguardian-ai/privacy-policy.html

### 문의 이메일

sinmb79@naver.com

## English (reference translation)

### Short description

An on-device AI tool for organizing schedules, notes, checklists, and personal features.

### Full description

Life Steward AI is a non-health, local-first tool for schedules, tasks, notes, checklists, and user-created personal features. It has no accounts, ads, analytics SDKs, or remote push. Mobile storage uses SQLCipher and a SecureStore/Android Keystore boundary. Generic local notifications contain only a task ID, never a title or note body.

Optional local AI runs on device CPU after the user reviews a pinned Korean GGUF file’s source, size, SHA-256, and license. Installing that file requests it from Hugging Face; the host may see the device IP address and ordinary network metadata. Prompts and outputs are not sent with the download request. Results are not saved until the user approves them.

Use only synthetic, non-sensitive schedules and notes during closed testing. Final Data safety values remain pending production-AAB and real-device network observation.

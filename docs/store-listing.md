# Google Play 스토어 등록 문안 — 비공개 테스트

## 한국어 (기본 언어)

### 앱 이름
CareGuardian AI

### 짧은 설명 (80자 이내)
보호자의 돌봄 일상과 등록한 복약 정보를 DAILY 화면에서 함께 정리하는 로컬 보조 도구

### 전체 설명
CareGuardian AI는 보호자가 돌봄에 필요한 일상, 의사소통 방법, 안정화 메모와 등록한 복약 정보를 한곳에 정리하고, DAILY 화면에서 오늘의 흐름으로 함께 살펴보도록 돕는 로컬 우선 보조 도구입니다.

주요 기능

- 돌봄 매뉴얼 작성: 돌봄 대상의 일상, 의사소통 방식, 안정화 방법, 연락처와 복약 정보를 구조화해 기록합니다.
- DAILY 통합 화면: 일상 일정과 등록한 복약 정보를 하나의 오늘 흐름으로 보여 줍니다.
- 기기 내 알림 시도: 등록한 시간에 맞춰 로컬 알림을 예약합니다. 기기 권한과 상태에 따라 지연되거나 누락될 수 있습니다.
- 돌봄 동반 화면: 오늘의 돌봄 흐름과 간단한 감정 확인을 돕습니다.
- 기기 인증과 로컬 암호화: 저장된 프로필은 기기 인증 후에만 열리며, CareManual은 앱 전용 SQLCipher 데이터베이스에 암호화되어 저장됩니다.
- 전체 삭제: 앱이 예약한 알림을 확인해 취소한 뒤 이 기기의 암호화 데이터와 키를 삭제할 수 있습니다.

중요한 안내

- CareGuardian AI는 의료기기가 아닙니다. 진단, 치료, 처방, 약물 상호작용, 용량 또는 실제 복용 여부를 검증하지 않습니다.
- 알림 표시는 실제 복용 확인이 아니며, 응급 호출·119 연결·보호자 자동 연락 기능을 제공하지 않습니다.
- 비공개 테스트에서는 가상의 인물·약·연락처만 사용하세요. 실제 개인정보·건강정보는 입력하지 마세요.
- 비공개 테스트 후보는 SQLCipher 암호화 데이터베이스, Android Keystore 기반 키 보호, 백그라운드 잠금과 화면 캡처 차단을 적용했습니다. 다양한 실제 기기의 포렌식·네트워크 검증은 계속 진행 중이므로 합성 데이터 제한은 유지됩니다.
- 앱이 약 이름·용량·복용법을 임의로 정하거나 검증하지 않습니다. 사용자가 입력하지 않은 복약 정보를 자동으로 만들지 않습니다.

### 카테고리 및 Health 선언 검토

- 앱 카테고리: Medical (Play Console에서 최종 적합성 확인)
- Health apps declaration: 최소 **Medication and Treatment Management** 선택
- 현재 기능은 의료 서비스 제공·예약·청구가 아니므로 **Healthcare Services and Management**는 선택하지 않음
- 광고 ID: 사용하지 않음(AAB에서 `com.google.android.gms.permission.AD_ID` 부재 확인)
- Data safety: 앱 자체 계정·광고·분석·서버 업로드 없음. 다만 최종 production AAB의 SDK·실기기 네트워크 검증 결과와 반드시 대조한 뒤 제출

### 콘텐츠 등급
전체이용가

### 개인정보처리방침
https://sinmb79.github.io/careguardian-ai/privacy-policy.html

### 문의 이메일
sinmb79@naver.com

## English (reference translation)

### Short description
A local care companion that organizes daily routines and entered medication information in one DAILY view.

### Full description
CareGuardian AI helps caregivers organize care routines, communication and calming notes, contacts, and entered medication information. The DAILY view brings routines and entered medication information together for the day. It can attempt to schedule local device notifications, which may be delayed or missed depending on permissions and device state. Stored mobile profiles use an app-specific SQLCipher database and open only after device authentication.

It is not a medical device. It does not diagnose, treat, prescribe, validate medicines or doses, or confirm that medicine was taken. It does not provide emergency calls, 119 calling, or automatic caregiver contact. Closed-test participants must use fictional data only. Exported relay files may be plaintext and should be shared only through a safe channel.

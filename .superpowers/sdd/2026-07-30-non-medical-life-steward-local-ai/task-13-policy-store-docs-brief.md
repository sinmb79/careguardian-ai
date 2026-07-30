# Task 13 — 공개 정책·스토어 문안·현재 문서 정합성

## 목표

생활후견 AI `1.1.0 (7)`의 비의료 개인 생산성 범위, 선택형 Hugging Face 모델 다운로드, 기기 내 저장·삭제 경계를 공개 정책과 현재 배포 문서에 동일하게 반영한다. 과거 건강·복약 제품 문서는 역사 자료임을 눈에 띄게 표시한다.

## 허용 파일

- `public/privacy-policy.html`
- `README.md`
- `README.en.md`
- `CLAUDE.md`
- `docs/store-listing.md`
- `docs/mobile-delivery.md`
- `docs/private-test-operations.md`
- `docs/security/private-test-readiness-2026-07-30.md`
- `docs/2026-04-12-ux-and-playstore.md`
- `docs/google-play-organization-account-remediation-2026-07-22.md`
- `docs/security/private-test-readiness-2026-07-20.md`
- `CareGuardian_AI_Spec_v0.1 (1).md`
- 필요 시 위 문서가 직접 연결하는 새 한국어/영문 배포 문서
- 이 작업의 SDD 보고서

코드, 패키지, 잠금파일, Android 구성, 스크린샷 PNG, `scripts/`는 수정하지 않는다.

## 현재 제품 사실

- 표시명: `생활후견 AI` / `Life Steward AI`
- package `com.sinmb.careguardianai`; Expo/EAS 식별자는 유지
- 버전 `1.1.0`, versionCode `7`
- Play 위치: `Productivity`, 18세 이상, 로그인 없음, 광고 없음
- 일반 생활 작업·목록·메모·사용자 정의 선언형 기능
- 의료·복약·진단·치료·응급 기능 없음. 차단 규칙의 건강 관련 단어는 기능이 아니라 사용 범위 거부 규칙
- 작업공간과 프롬프트·결과는 기기 내에 저장/처리
- 모바일 저장: SQLCipher, SecureStore/Android Keystore, 백업 차단, 기기 인증, 백그라운드 잠금, 화면 캡처 차단
- 로컬 알림 전용. 원격 푸시 구성은 Task 11에서 제거·게이트되며 표시 제목은 일반 문구, payload는 `taskId`만 포함
- 선택형 로컬 AI: 고정 NAVER HyperCLOVA X GGUF, CPU 추론, SHA-256·크기·고정 URL 검증, 승인 전 결과 미저장
- Kakao 모델은 승인된 고정 GGUF가 없어 다운로드/실행 불가로 표시
- 전체 삭제: 추론 중지, 로컬 알림 취소, 모델·부분 파일, SQLCipher DB, 키, 메모리 상태 삭제
- 모델 설치 외 네트워크 경로 없음. 설치를 명시적으로 선택한 경우에만 Hugging Face 고정 HTTPS 모델 요청
- 비공개 테스트는 합성·비민감 데이터만 허용. 실제 개인정보·민감정보 단계는 NO-GO
- x86_64 에뮬레이터 검증은 진행됐으나 최종 새 APK/AAB 재검증과 Samsung/Pixel 물리 기기 검증은 별도 증거 문서가 완료할 때까지 주장하지 않는다.

## 공개 개인정보처리방침 필수 내용

한국어를 먼저 쓰고 영문을 이어 쓴다.

1. 제목은 `생활후견 AI 개인정보처리방침 / Life Steward AI Privacy Policy`.
2. 운영자 식별: Google Play 개발자 `22B`, 프로젝트/EAS 소유자 `sinmb79`, 문의 `sinmb79@naver.com`. 확인되지 않은 법인명이나 주소는 만들지 않는다.
3. 계정·광고·분석 SDK·클라우드 AI가 없고, 일반 작업·목록·사용자 기능·프롬프트·출력은 기기 안에서만 처리한다고 명시한다.
4. 선택형 Hugging Face 모델 다운로드는 다음을 정확히 고지한다.
   - 수신자/외부 서비스: Hugging Face
   - IP 주소, IP 기반 대략적 위치, 기기 유형·모델·운영체제·브라우저/네트워크 정보, 선택한 모델 요청 경로와 서비스 이용 기록이 자동 기록될 수 있음
   - 파일 제공, 서비스 운영·개선·분석, 보안 및 법적 의무 목적
   - 미국 등 다른 국가에서 처리될 수 있고 필요한 기간 보존
   - Hugging Face 정책 `https://huggingface.co/privacy`, 권리·삭제 문의 `privacy@huggingface.co`
   - 앱 개발자는 Hugging Face 로그에 직접 접근하거나 사용자를 계정으로 식별하지 않음
   - 프롬프트·결과·작업 내용은 Hugging Face에 보내지 않음
   - 설치는 선택 사항이고 거부해도 일반 기능 사용 가능
5. 기기 내 전체 삭제 범위와 외부 Hugging Face 기록은 앱 삭제 버튼으로 지울 수 없음을 구분한다.
6. Android 로컬 알림, 권한, 백업 차단 경계를 정확히 설명한다.
7. `Data safety는 나중에 확정` 같은 잠정 문구를 제거한다.
8. 사실과 다른 건강·복약·FCM 문구를 넣지 않는다.

## Play Data Safety 문서화

최종 Console 입력용으로 `docs/store-listing.md`에 명시한다.

- 앱이 데이터를 수집/공유하는가: `예` — 선택형 모델 다운로드 때문에
- 대략적인 위치: 선택적 수집, 비일시적; 목적 앱 기능, 분석, 사기 방지·보안·규정 준수
- 앱 상호작용: 선택적 수집, 비일시적; 같은 목적
- 공유: 강화된 설치 직전 고지와 사용자 시작 다운로드 예외를 적용해 `아니요`로 제출하되, Console 문구가 이 예외 조건과 다르면 보수적으로 `공유`로 바꿔야 한다는 검증 메모를 둔다.
- 기기/기타 ID: 최종 AAB/네트워크 검증에서 FID·FCM 토큰 등 지속 식별자가 없을 때만 `아니요`
- 건강정보·캘린더·연락처·파일/문서·사용자 생성 콘텐츠: 원격 수집/공유 `아니요`
- 전송 암호화: 고정 HTTPS 경로 검증 후 `예`
- 계정 생성·로그인: 없음
- 기기 내 삭제 제공. Hugging Face 외부 기록은 해당 서비스 정책과 `privacy@huggingface.co` 절차를 안내
- Health apps declaration: `My app doesn't provide any health features`
- 건강·피트니스 데이터 접근: 없음
- 광고: 없음
- App access: 제한 없음/로그인 없음
- 타깃 연령: 18세 이상
- IARC는 실제 Console 설문 답변으로 확정하며 문서에서 임의 등급을 만들지 않는다.

## 스토어 문안

- 현재 한국어·영문 설명의 비의료 범위를 유지한다.
- 출시 노트 추가:
  - 일반 생활 작업·목록·메모·사용자 기능 중심으로 전면 개편
  - 건강·복약 기능 제거
  - 선택형 기기 내 한국어 문서 정리 도구
  - 로컬 저장·전체 삭제·개인정보 고지 강화
- 현재 스크린샷은 Android 재캡처 완료 전 업로드 금지임을 유지하되, `Task 10`처럼 오래된 번호 대신 명확한 미완료 게이트로 표현한다.

## 역사 문서

다음 파일 첫머리에 굵고 명확한 배너를 추가한다. 삭제하거나 현재 제출 근거로 다시 쓰지 않는다.

- `docs/2026-04-12-ux-and-playstore.md`
- `docs/google-play-organization-account-remediation-2026-07-22.md`
- `docs/security/private-test-readiness-2026-07-20.md`
- `CareGuardian_AI_Spec_v0.1 (1).md`

배너 요지: 이전 CareGuardian 건강·복약 구현의 역사 기록이며, 현재 `생활후견 AI 1.1.0 (7)`의 기능·Play 선언·Data Safety·개인정보처리방침 근거가 아니다.

## CLAUDE.md

현재 `web PWA + Expo mobile + packages/life-core` 구조와 실제 명령/상태로 완전히 교체한다. 조직 계정 전환, Medical 선언 유지, version 6 재제출을 현재 다음 단계라고 안내하지 않는다. 역사적 거부 사유는 짧은 배경으로만 남긴다.

## 검증

- 모든 현재 문서에서 `Task 10`, 잠정 Data Safety, 조직계정 전환을 현재 다음 단계로 말하는 문구를 제거
- 역사 문서에는 배너가 있는지 검사
- 공개 정책의 한·영 필수 섹션과 정확한 HTTPS 링크 검사
- `npm run release:policy-check`
- `git diff --check`
- 가능하면 문서 계약 테스트 또는 명시적인 `rg` 증거를 보고서에 남긴다.

구현 커밋과 별도 검증 보고서 커밋을 만든다.

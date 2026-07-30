# Task 13 — 공개 정책·스토어 문안·현재 문서 정합성 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 구현 결과

- `public/privacy-policy.html`을 한국어 우선·영문 후속의 `생활후견 AI 개인정보처리방침 / Life Steward AI Privacy Policy`로 교체했다.
- 운영자(Play 개발자 `22B`), 프로젝트/EAS 소유자(`sinmb79`), 문의(`sinmb79@naver.com`)를 명시했다.
- 기기 내 처리·저장, Android 로컬 알림·권한·백업 차단, 전체 삭제의 기기 내 범위를 현재 구현 계약으로 기록했다.
- 사용자가 시작한 선택형 Hugging Face 모델 설치만 외부 요청이 될 수 있음을 고지하고, Hugging Face가 자동 기록할 수 있는 항목·목적·국외 처리·보존, 정책 URL, 권리/삭제 연락처를 한국어·영문으로 모두 추가했다.
- 앱의 전체 삭제와 Hugging Face가 독립 보관할 수 있는 외부 설치 요청 기록의 삭제 절차를 구분했다. 프롬프트·AI 결과·작업 내용은 Hugging Face에 보내지지 않는다고 명시했다.
- `docs/store-listing.md`에 Productivity, 18+, 로그인·광고 없음, Health apps declaration, Data safety 입력 기준, 공유 예외 검증 메모, HTTPS·기기/기타 ID 조건, IARC 비임의 확정 원칙, 출시 노트를 기록했다.
- 현재 운영·배포 문서에서 오래된 작업 번호, 잠정 Data safety 문구, 과거 조직 계정 전환을 현재 다음 단계로 안내하는 내용을 제거했다.
- 과거 CareGuardian 건강·복약 자료 네 개의 첫머리에 현재 `생활후견 AI 1.1.0 (7)`의 기능·Play 선언·Data safety·개인정보처리방침 근거가 아니라는 굵은 역사 배너를 넣었다.

## 정적 검증

| 검사 | 결과 | 근거 |
|---|---|---|
| 현재 문서의 `Task 10`·잠정 Data safety·조직 계정 전환 잔존 검색 | 통과 | 대상 현재 문서에 `Task 10` 및 해당 현재 단계 안내 없음 |
| 역사 배너 | 통과 | 지정된 4개 역사 문서 모두 `역사 기록 전용 — 현재 제출 근거 아님` 포함 |
| 공개 정책 필수 고지 | 통과 | 제목, `22B`, `sinmb79`, `privacy@huggingface.co`, `https://huggingface.co/privacy`, IP 기반 대략 위치, 전체 삭제, 로컬 알림 경계를 검색으로 확인 |
| `git diff --check` | 통과 | 문서 변경에 공백 오류 없음 |
| `npm run release:policy-check` | 보류 | 병행 중인 알림/매니페스트/정책 검사기 변경이 아직 작업 트리에 있어 gate가 실패함. 필수 Hugging Face 정책·메일 URL의 허용목록 반영은 Task 11 통합 후 전체 gate에서 재검증 필요 |

## 확인하지 않은 외부 게이트

- 새 production APK/AAB의 매니페스트, 지속 식별자, 고정 HTTPS 모델 요청 경로 재검증
- Samsung·Pixel 물리 기기에서 잠금, PIN fallback, 전체 삭제, 로컬 알림, 모델 설치와 네트워크 관찰의 증거 기록
- Android-native Play 스크린샷 재캡처 및 Play Console 업로드 전 확인
- 실제 Play Console Data safety 응답이 강화된 설치 직전 고지·사용자 시작 다운로드 예외에 맞는지 확인; 다르면 공유값을 보수적으로 변경
- 비공개 테스트의 실제 opt-in 수와 14일 운영

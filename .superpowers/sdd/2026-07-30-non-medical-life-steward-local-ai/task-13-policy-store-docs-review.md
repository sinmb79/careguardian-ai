# Task 13 독립 정책·스토어 문서 검토

- 검토일: 2026-07-31 (Asia/Seoul)
- 검토 대상 구현: `c73e4fc73ac61a56a36f2a02b8366dc10cc08ad3`
- 검토 대상 구현 보고서: `8a23e72dfb1ea0fc982dbf1b609bb8b8cbf85b52`
- 범위: 공개 개인정보처리방침, Play 스토어 문안·Data safety, 현재 운영 문서와 역사 문서의 경계

## 판정: **FAIL**

공개 정책과 스토어 문안의 사실 고지는 대부분 충족합니다. 그러나 구현 커밋 단독으로는 자신이 요구한 정책 게이트를 통과할 수 없고, 현재 문서는 Samsung·Pixel 물리기기 검증을 합성·비민감 비공개 테스트의 시작/제출보다 앞선 절대 게이트로 만들어 제품 목표를 불필요하게 막습니다. 또한 현재 문서에 제거 대상인 `Task 10` 표기가 남아 있습니다.

## Critical

- 없음.

## Important

### I1. `c73e4fc` 단독 상태에서는 `release:policy-check` 검증 주장이 성립하지 않습니다

`c73e4fc`는 `public/privacy-policy.html`에 Hugging Face 정책/문의 링크와 `analytics SDK` 부정 고지를 추가·교체했지만, 같은 커밋의 `scripts/check-non-medical-release.mjs`에는 그 링크 허용목록이나 새 영문 정책 문장의 exact-contract가 없습니다. 이 스크립트의 기존 contract는 이미 제거된 영문 문장만 허용하고, `analytics`는 금지 cloud surface로 검사합니다. 따라서 구현 보고서의 “병행 Task 11 변경 때문에 보류” 설명은 이 문서 커밋 자체의 검증 결손을 빠뜨립니다.

검토 중 다른 작업의 **미커밋** `scripts/check-non-medical-release.mjs` 보완이 들어온 뒤에는 `npm run release:policy-check`와 `npm run release:policy-check:test`가 모두 통과했습니다. 이는 최종 통합에는 유효한 회복 근거이지만, `c73e4fc`와 `8a23e72`만으로 통과했다고 해석할 수는 없습니다. 해당 스크립트·테스트 보완을 함께 커밋한 뒤 최종 보고서의 검증 결과를 갱신해야 합니다.

### I2. 합성 데이터 비공개 테스트까지 물리기기 검증을 막는 절대 게이트가 남아 있습니다

`docs/security/private-test-readiness-2026-07-30.md`는 첫머리에서 “합성·비민감 데이터에 한해 조건부 준비, production AAB·실기기 검증 전 실제 데이터는 NO-GO”라고 올바르게 구분합니다. 그러나 같은 문서의 “출시 전 필수 게이트”는 Samsung·Pixel 합성-data smoke, 실기기 네트워크 관찰, Console 저장을 출시 전 의무로 두고, `docs/private-test-operations.md`는 실기기 네트워크 관찰을 “테스트 시작 전제”로 규정합니다. `CLAUDE.md`와 `docs/mobile-delivery.md`도 Samsung·Pixel 및 AAB 검증을 비공개 테스트 opt-in 운영보다 앞선 외부 게이트로 나열합니다.

이는 “실제 개인정보·민감정보는 NO-GO”라는 현행 계약 및 합성 데이터 비공개 테스트 제출 목표와 충돌합니다. 스크린샷의 Android 재캡처·업로드 금지, 최종 AAB의 선언값 대조는 유지하되, 문서를 다음 둘로 분리해야 합니다.

1. 합성·비민감 비공개 테스트 제출/운영의 시작 조건
2. Samsung·Pixel 물리기기 증거가 필요한 실제 개인정보·민감정보 단계와 정식 출시 단계

물리기기 결과는 비공개 테스트 중 검증 항목으로 계속 수집하고, 이를 완료 전제로 하여 합성 비공개 테스트 자체를 막지는 않아야 합니다.

### I3. 현재 문서에 `Task 10` 제거 요구를 충족하지 못한 참조가 남아 있습니다

`docs/security-release-gate.md`는 역사 문서가 아니라 현재 `docs/security/private-test-readiness-2026-07-30.md`에서 직접 연결하는 release gate입니다. 여기에 `Task 10`이 4회 남아 있으며, private test/release 직전 AAB·실기기 검증으로 표현됩니다. Task 13 브리프의 “모든 현재 문서에서 `Task 10` 제거” 조건을 충족하지 못합니다.

`Task 10`을 “production AAB 및 실기기 검증” 같은 제품 상태 표현으로 바꾸고, I2의 두 단계 게이트 분리와 같은 의미로 정렬해야 합니다. 역사 문서에 남은 Task 10은 역사 배너로 격리되어 있으므로 이 지적의 대상이 아닙니다.

## Minor

- 없음.

## 통과한 항목

- 공개 방침은 한국어 우선·영문 후속 구조, 정확한 제목, Play 개발자 `22B`, EAS 소유자 `sinmb79`, 문의 메일을 포함합니다.
- 비의료 개인 생산성 범위와 계정·광고·분석 SDK·원격 푸시·외부 AI 처리 서비스 부재를 명시하고, 일반 작업공간·프롬프트·결과의 기기 내 처리 경계를 고지합니다.
- 선택 설치 Hugging Face 경계에 IP/대략 위치/기기·OS·브라우저·네트워크/선택 모델 요청·서비스 사용 기록, 목적, 미국 등 국외 처리·보존, `https://huggingface.co/privacy`, `privacy@huggingface.co`, 로컬 본문 미전송·선택성·거부 가능성을 한·영으로 포함합니다. 링크의 현재 공개 Hugging Face 정책은 IP·세션 위치·기기/OS/브라우저 자동 기록, 서비스 운영·개선·분석·보안·법적 목적, 필요한 기간 보존, 미국 등 처리, `privacy@huggingface.co` 절차를 확인합니다.
- 앱의 전체 삭제 범위와 Hugging Face 외부 설치 요청 기록의 별도 삭제 절차를 분명히 구분하며, 로컬 알림·`taskId` 전용 payload·Android 백업 차단도 설명합니다.
- `docs/store-listing.md`의 Data safety 표는 선택형 설치로 인한 수집을 `예`로 시작하고, 대략 위치·앱 상호작용의 선택/비일시 처리와 목적을 명시합니다. 공유 `아니요`는 설치 직전 강화 고지와 사용자가 시작한 다운로드 예외가 실제 Console 조건과 다르면 보수적으로 바꿔야 한다고 제한하며, FID/FCM 등 지속 식별자 부재의 최종 AAB·네트워크 검증 조건도 기록합니다.
- Productivity, 18세 이상, Health apps declaration, 로그인·광고 없음, IARC 비임의 확정, 출시 노트, Android 재캡처 전 현재 PNG 업로드 금지의 현재 문안은 요구와 맞습니다.
- 지정된 네 역사 문서 모두 첫머리에 굵은 역사 배너가 있으며, 조직 계정 전환·Medical/version 6 재제출 내용은 역사 문서 또는 짧은 역사 배경으로만 남습니다.
- 문서는 새 AAB·Samsung/Pixel 물리기기 검증을 완료했다고 주장하지 않습니다. 이 증거는 아직 없다는 경계를 유지합니다.

## 검증 증거

| 확인 | 결과 |
|---|---|
| `git diff --check c73e4fc^ c73e4fc` | PASS |
| `c73e4fc`의 정책 게이트 contract와 새 공개 정책 대조 | FAIL — I1 |
| 현재 worktree의 `npm run release:policy-check` | PASS — 병행 미커밋 script 보완 포함 |
| 현재 worktree의 `npm run release:policy-check:test` | PASS (75 tests) — 병행 미커밋 script 보완 포함 |
| 현재 문서의 `Task 10` 검색 | FAIL — `docs/security-release-gate.md` 4건 |
| 지정 역사 문서 4개의 배너 검색 | PASS |
| 새 AAB/Samsung·Pixel 완료 주장 검색 | PASS — 완료 주장 없음 |

## 최종 조치

I1~I3을 해결하고, 실제 최종 커밋 집합에서 정책 게이트를 다시 실행한 뒤에만 Task 13을 PASS로 바꿀 수 있습니다. 이 검토는 제품 코드·패키지·Android 구성·기존 병행 변경을 수정하거나 stage하지 않았습니다.

# Task 13 독립 검토 FAIL 수정 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 수정한 문제

독립 검토에서 합성·비민감 데이터 Play 비공개 테스트 제출 조건과 실제 개인정보·민감정보 단계/정식 출시 조건이 같은 게이트로 섞여 있던 문제를 수정했다.

| 단계 | 필수 조건 |
|---|---|
| 합성 데이터 비공개 테스트 제출·운영 시작 | 현재 버전 final AAB, AAB 정적 검사, Android-native 스크린샷, Play Console 문안·선언·Data safety 대조 |
| 합성 데이터 비공개 테스트 중 | Samsung/Pixel의 잠금·PIN fallback·삭제·로컬 알림·모델 설치·네트워크 증거를 합성 데이터로 수집; 불일치 시 운영 중단·보정 |
| 실제 개인정보·민감정보 단계 또는 정식 출시 | Samsung/Pixel 증거 완료, 중대한 발견사항 해소, 남은 출시 승인 기록 완료 전까지 `NO-GO` |

Samsung/Pixel 물리 기기 증거는 합성 데이터 비공개 테스트 제출·운영 시작의 절대 선행 조건이 아니라 테스트 중 수집할 항목으로 통일했다. 확인하지 않은 새 APK/AAB, 물리 기기, Play 제출·승인 완료 사실은 주장하지 않았다.

## 변경 범위

- `README.md`, `README.en.md`
- `CLAUDE.md`
- `public/privacy-policy.html`
- `docs/store-listing.md`
- `docs/mobile-delivery.md`
- `docs/private-test-operations.md`
- `docs/security/private-test-readiness-2026-07-30.md`
- `docs/security-release-gate.md`

`docs/security-release-gate.md`의 `Task 10` 네 곳은 final AAB 정적 검사, synthetic closed test, Samsung/Pixel 증거, real-data/general-release 상태 표현으로 교체했다. 코드·스크립트와 다른 에이전트 파일은 수정하거나 stage하지 않았다.

## 검증

| 검사 | 결과 |
|---|---|
| 현재 문서 9개의 `Task 10` 검색 | 통과 — 0건 |
| 단계·Samsung/Pixel·실데이터/정식 출시 표현 교차 검색 | 통과 — 제출 시작, 테스트 중 수집, 실데이터·정식 출시 게이트가 분리됨 |
| `git diff --check` | 통과 |
| `npm run release:policy-check` | 통과 — `status: pass`, 111 files, 0 problems |

## 재검토 조건

위 policy gate 통과는 현재 작업 트리의 단일 gate 결과다. Task 11의 exact 정책 계약을 포함한 최종 통합 gate 전체가 통과한 뒤 독립 검토자가 이 단계 분리와 공개 문안 정합성을 다시 확인해야 한다. 이 보고서는 최종 AAB·물리 기기·Play Console 완료 증거를 대신하지 않는다.

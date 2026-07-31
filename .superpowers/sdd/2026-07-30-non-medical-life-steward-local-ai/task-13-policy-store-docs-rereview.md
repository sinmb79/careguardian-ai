# Task 13 독립 정책·스토어 문서 재검토

- 재검토일: 2026-07-31 (Asia/Seoul)
- 문서 수정: `0a3685c49656cf2aa7ccba6f8db5035c573cce67`
- 수정 보고서: `a93f5ea25e453640d2404192f6098a92dceaaff6`
- 정책 gate 통합: `443351beb3e9707ca395e6bda3b2f486f683673c`
- 이전 독립 검토: `3c453d2`

## 판정: **PASS**

이전 검토의 Important 세 건(I1~I3)이 모두 실제 문서, gate 구현, 변이 테스트와 실행 결과에서 해소되었습니다. Task 13 범위에서 새 Critical, Important, Minor 발견사항은 없습니다.

## Critical

- 없음.

## Important

- 없음.

## Minor

- 없음.

## 이전 지적 해소 확인

### I1 — exact 정책 URL·연락처·analytics 계약: PASS

`443351b`는 파일별 exact allowlist에 다음 항목을 고정했습니다.

- 앱 개인정보처리방침: `https://sinmb79.github.io/careguardian-ai/privacy-policy.html`
- Hugging Face 정책: `https://huggingface.co/privacy`
- Hugging Face 권리·삭제 문의: `mailto:privacy@huggingface.co`
- 운영자 문의: `mailto:sinmb79@naver.com`

공개 정책의 두 영문 `analytics SDKs` 부정 고지 문장은 exact line contract로 고정되어 있습니다. URL·메일 스캐너는 허용된 파일과 정확한 값의 조합만 인정하고, 그 밖의 URL·메일은 `unapproved external link`로 거부합니다.

공식 mutation suite의 `allows only exact public policy and privacy contact links`가 변조된 Hugging Face host/path, 앱 정책 host, Hugging Face 연락처를 거부했습니다. 재검토자는 별도로 공개 HTML의 Hugging Face URL, 운영자 메일, analytics exact 문장을 인메모리에서 각각 변조했으며 세 경우 모두 gate가 `fail`과 기대 오류를 반환함을 확인했습니다.

### I2 — 합성 closed test와 물리기기/실데이터 단계 분리: PASS

현재 문서는 다음 세 단계로 일관되게 분리됩니다.

1. **합성 데이터 비공개 테스트 제출·운영 시작:** 현재 버전 final AAB, AAB 정적 검사, Android-native 스크린샷, Play Console 문안·선언·Data safety 대조가 필요합니다.
2. **합성 데이터 비공개 테스트 중:** Samsung/Pixel에서 잠금, PIN fallback, 삭제, 로컬 알림, 모델 설치, 네트워크 증거를 합성 데이터로 수집합니다. 물리기기 증거는 제출·운영 시작의 절대 선행 조건이 아닙니다.
3. **실제 개인정보·민감정보 단계 또는 정식 출시:** Samsung/Pixel 증거 완료, 중대한 발견사항 해소, 남은 출시 승인 기록 전까지 `NO-GO`입니다.

이 구분은 `README.md`, `README.en.md`, `CLAUDE.md`, 공개 개인정보처리방침, 스토어 문안, 모바일 배포·비공개 테스트·준비도·release gate 문서에 같은 의미로 반영되었습니다. 새 AAB, 물리기기 검증, Play 제출·승인을 이미 완료했다고 주장하는 문구는 없습니다.

### I3 — 현재 문서의 `Task 10`: PASS

현재 운영 근거인 다음 9개 문서를 직접 검색한 결과 `Task 10`은 0건입니다.

- `README.md`, `README.en.md`, `CLAUDE.md`
- `public/privacy-policy.html`
- `docs/store-listing.md`, `docs/mobile-delivery.md`, `docs/private-test-operations.md`
- `docs/security/private-test-readiness-2026-07-30.md`, `docs/security-release-gate.md`

저장소 전체 Markdown 검색에서는 구현 순서를 보존하는 `docs/superpowers/plans/2026-07-30-non-medical-life-steward-local-ai.md`에 계획 단계명으로 2건이 남습니다. 이 파일은 현재 제출·운영 근거나 사용자 안내 문서가 아닌 구현 계획 기록이므로 I3의 잔존 문제에 해당하지 않습니다.

## 실행 증거

| 검사 | 결과 |
|---|---|
| `npm run release:policy-check` | PASS — 111 files, 0 problems |
| `npm run release:policy-check:test` | PASS — 75 tests, 0 failures |
| 공개 HF URL·운영자 메일·analytics line 추가 변이 3건 | PASS — 세 변이 모두 gate가 거부 |
| `git diff --check` | PASS |
| `git diff --check 443351b^ 443351b` | PASS |
| `git diff --check 0a3685c^ 0a3685c` | PASS |
| `git diff --check a93f5ea^ a93f5ea` | PASS |
| 현재 운영 문서 9개의 `Task 10` 검색 | PASS — 0건 |
| 단계·Samsung/Pixel·실데이터/정식 출시 교차 검색 | PASS — 세 단계 분리 일치 |

## 범위 경계

이 PASS는 Task 13의 공개 정책·스토어 문안·현재 문서 정합성과 이를 보호하는 정책 gate에 대한 판정입니다. final AAB 생성·정적 검사, Android-native 스크린샷, 실제 Play Console 입력은 여전히 합성 비공개 테스트 제출 전 외부 작업이며, Samsung/Pixel 증거는 테스트 중 수집해야 합니다. 이 재검토는 그 외부 작업의 완료 증거를 대신하지 않습니다.

제품 코드·정책 문서·다른 에이전트 변경은 수정하거나 stage하지 않았습니다.

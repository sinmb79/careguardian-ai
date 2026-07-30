# Task 13b 정적 정책 링크 게이트 재검토 Round 2 수정 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 수정 결과

재검토 `3353673`의 Important·Minor를 해결했다.

- CSS 함수명을 개별 나열하던 검사를 제거했다.
- CSS source의 comment 제거, CSS escape 복호화, character reference 복호화 후 정규화된 CSS 전체에서 모든 외부 HTTP(S)·protocol-relative 후보를 검사한다.
- 따라서 표준 `image-set`, `-webkit-image-set`, 다중 candidate, quoted/unquoted `url`, nested `url`, 대소문자·comment·whitespace·CSS escape 변형 및 일반 CSS string/token의 외부 URL이 모두 실패 폐쇄된다.
- HTML 정책 링크 허용은 DOM 값뿐 아니라 raw source가 정확히 `href="https://huggingface.co/privacy"`이고 직접 text source가 정확한 URL인 경우로 제한했다.
- 세미콜론 없는 decimal/hex numeric character reference는 DOM에서 정확 URL로 복호화되더라도 raw source 계약을 충족하지 않아 차단된다.

## TDD 증거

구현 전에 적대적 fixture를 추가해 RED를 확인했다.

| RED fixture | 기존 결과 |
|---|---|
| `image-set("https://…" 1x)`, `-webkit-image-set` 및 배포 CSS | 무문제 통과 |
| 다중 candidate, quoted/string/case/comment/whitespace/CSS escape 변형 | 함수명 기반 추출에서 누락 |
| 세미콜론 없는 decimal/hex exact policy URL source | 정확 정책 링크로 허용 |

추가 직후 집중 테스트는 19개 중 3개가 실패했다. 정규화된 CSS 전체 검사와 raw HTML source 계약 적용 후 19/19 GREEN을 확인했다.

## 검증

| 검사 | 결과 |
|---|---|
| `npm run release:static-security-check:test` | 통과 — 19 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — production HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | 통과 — Vitest 30 files / 280 tests, policy gate tests 90/90, mobile doctor 18/18, 모든 release gate 통과 |
| `git diff --check` | 통과 |

## 커밋

- 수정 구현: `a1602014f8cfd7fe2ff028afa7409f9a1e1cfdd5` (`fix(security): scan normalized CSS remote tokens`)

Task 11·Task 14 및 제품 정책·앱 기능 파일은 수정하거나 stage하지 않았다.

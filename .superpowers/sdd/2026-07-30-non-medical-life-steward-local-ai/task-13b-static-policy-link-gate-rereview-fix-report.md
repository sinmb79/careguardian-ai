# Task 13b 정적 정책 링크 게이트 재검토 수정 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 수정 결과

재검토에서 발견된 URL 정규화 및 CSS escaped identifier 우회를 정적 게이트에서 실패 폐쇄하도록 수정했다.

- HTML attribute·직접 텍스트 URL 후보는 리터럴 `://`만 찾지 않고, ASCII control 문자를 제거하고 역슬래시를 slash로 정규화한 뒤 HTTP(S) special scheme으로 URL parser에 전달한다.
- 따라서 `https:\\host`, `\\host`, `https:/TAB/host`, `https:/LF/host`와 `meta refresh`·script·stylesheet 변형은 외부 URL로 판정되어 차단된다.
- CSS는 `url()`·`@import` 추출 전에 CSS escape를 복호화한다. `u\72l`, `@\69mport`, 인용된 역슬래시 URL도 모두 차단한다.
- 정확한 `privacy-policy.html`의 실제 `a[href]` 및 직접 visible text `https://huggingface.co/privacy` 예외 계약은 유지했다.

## TDD 증거

먼저 아래 적대적 fixture를 자동화 테스트에 추가했다.

| RED fixture | 기존 결과 |
|---|---|
| HTML `https:\\attacker`, `\\attacker`, `https:/&#x09;/`, `https:/&#x0A;/` | 통과 (우회 재현) |
| backslash·TAB·LF `meta refresh`, backslash script/link | 통과 (우회 재현) |
| CSS `u\72l(...)`, `@\69mport`, quoted backslash URL | 통과 (우회 재현) |

추가 직후 정적 게이트 테스트는 16개 중 2개가 실패했다. 정규화·CSS escape 복호화 구현 후 16/16 GREEN을 확인했다.

## 검증

| 검사 | 결과 |
|---|---|
| `npm run release:static-security-check:test` | 통과 — 16 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | 통과 — Vitest 30 files / 280 tests, mobile doctor 18/18, 모든 release gate 통과 |
| `git diff --check` | 통과 |

## 커밋

- 수정 구현: `9eaf4e01346602bd7ed5f02a31dfada5c5bdae46` (`fix(security): normalize static remote URL escapes`)

이 결과는 정적 HTML/CSS URL surface의 fail-closed 검사 결과이며, 외부 서비스 처리나 실제 개인정보 데이터 사용 승인을 뜻하지 않는다.

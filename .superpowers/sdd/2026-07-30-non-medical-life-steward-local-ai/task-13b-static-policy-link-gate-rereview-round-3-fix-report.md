# Task 13b 정적 정책 링크 게이트 재검토 Round 3 수정 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 수정 결과

독립 재검토 `b0cf7ab`의 encoded `data:text/css` 우회를 실패 폐쇄하도록 수정했다.

- `data:`, `blob:`, `javascript:`, `file:`, `filesystem:` 및 임의의 비상대 URI scheme을 CSS string·URL token에서 차단한다.
- percent/base64 payload를 개별 해독해 허용하지 않는다. `data:` scheme 자체를 거부하고 `%HH` 형태는 unsafe CSS encoding으로 차단한다.
- CSS comment, CSS escape, HTML character reference를 최대 8회 고정점 정규화한다.
- malformed escape 또는 고정점 한도 초과는 각각 명시적 문제로 실패 폐쇄한다.
- 기존 HTTP(S)·protocol-relative 전체 검사와 image-set, exact raw policy anchor 계약은 유지했다.
- Tailwind의 로컬 escaped selector와 media feature는 network-capable string/URL token이 아니므로 허용되며 production CSS 오탐을 만들지 않는다.

## TDD 증거

구현 전 다음 fixture를 추가해 RED를 확인했다.

| RED fixture | 기존 결과 |
|---|---|
| percent-encoded `data:text/css` nested HTTPS import | 무문제 통과 |
| base64 `data:text/css` nested HTTPS import | 무문제 통과 |
| `data/blob/javascript/file/filesystem` 및 encoded/escaped scheme | 무문제 통과 |
| 다중 escape, normalization limit, malformed trailing escape | 무문제 통과 |
| 배포 CSS의 encoded data stylesheet | static gate 통과 |

지정 fixture 추가 직후 집중 테스트는 23개 중 4개가 실패했다. production CSS에서 발견한 로컬 selector/media 오탐도 별도 RED fixture로 고정했다. 수정 후 24/24 GREEN을 확인했다.

## 검증

| 검사 | 결과 |
|---|---|
| `npm run release:static-security-check:test` | 통과 — 24 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — production HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | 통과 — Vitest 30 files / 280 tests, policy gate tests 120/120, mobile doctor 18/18, 모든 release gate 통과 |
| `git diff --check` | 통과 |

## 커밋 및 index 보호

- 수정 구현: `8327d4465a8f1cead800a38d7284c47c66eb7522` (`fix(security): reject encoded CSS URI schemes`)
- 구현 커밋은 `git commit --only -- scripts/check-static-security.mjs scripts/check-static-security.node-test.mjs` 경로 제한으로 생성했다.
- 커밋 직전·직후 `git diff --cached --name-only`는 모두 비어 있었다. Task 11 Android 파일을 수정·stage·unstage·commit하지 않았다.

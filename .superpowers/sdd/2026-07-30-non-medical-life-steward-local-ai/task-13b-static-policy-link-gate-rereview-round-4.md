# Task 13b 정적 정책 링크 게이트 재검토 — 수정 Round 4/5

검토일: 2026-07-31 (Asia/Seoul)

검토 대상:

- 구현: `8327d44` (`fix(security): reject encoded CSS URI schemes`)
- 구현 보고서: `541c53f`
- 이전 FAIL 검토: `b0cf7ab`

## 최종 판정: PASS

이전 Important인 percent/base64 `data:text/css` 중첩 외부 참조는 정적 검사기 자체에서 실패 폐쇄됩니다. 기존 URL·image-set·정확 HTML 링크 계약에도 회귀가 없고, 실제 production Tailwind CSS를 포함한 HTML 2개/CSS 2개는 오탐 없이 통과했습니다.

보안 검토 기준에 따라 CSP를 정적 allowlist의 대체로 간주하지 않았습니다. 이번 PASS는 CSP 방어와 별개로 지정된 악성 fixture가 정적 게이트에서 직접 거부됨을 근거로 합니다.

## Critical

- 없음.

## Important

- 없음.

## Minor

- 없음.

## 독립 회귀 검증

### Encoded data stylesheet

아래 네 fixture를 독립 실행했고 모두 `validateCssSecurity`에서 문제를 반환했습니다.

1. percent-encoded `data:text/css` nested HTTPS import
2. percent-encoded `data:text/css;charset=utf-8` nested HTTPS import
3. percent-encoded `data:application/css` nested HTTPS import
4. base64 `data:text/css` nested HTTPS import

percent fixture는 `unsafe CSS encoding is present`와 `unexpected remote CSS URL is present: data:`를 모두 반환했고, base64 fixture도 `unexpected remote CSS URL is present: data:`를 반환했습니다.

관련 구현:

- `scripts/check-static-security.mjs:160` — bounded CSS normalization
- `scripts/check-static-security.mjs:177` — non-relative URI scheme extraction
- `scripts/check-static-security.mjs:188` — CSS security validation

### 기존 회귀 계약

| 검사 | 결과 |
| --- | --- |
| 표준 `image-set("https://…")` | 차단 |
| `-webkit-image-set("https://…")` | 차단 |
| 세미콜론 없는 decimal/hex numeric exact-policy reference | 차단 |
| 정확한 `<a href="https://huggingface.co/privacy">`와 직접 visible text | 허용 |
| CSP comment, `<area>`, remote resource, entity/backslash/control URL | 기존 24-test 회귀 매트릭스에서 차단 |

직접 확인한 semicolonless fixture는 `unexpected remote URL` 문제 2개를 반환했습니다. 정확한 계약 fixture는 문제 0개였습니다.

### Production policy raw 계약

`public/privacy-policy.html`에서 정확 정책 anchor는 2개이며 각각 다음 원문만 사용합니다.

```html
href="https://huggingface.co/privacy"
```

직접 visible text도 두 곳 모두 정확한 `https://huggingface.co/privacy`입니다. 전체 URL 원문 출현 수는 href 2회와 visible text 2회인 4회이며, production policy 검사는 문제 0개였습니다.

## Production build 및 전체 검증

| 명령 또는 gate | 독립 실행 결과 |
| --- | --- |
| `npm run verify` | 통과 — exit 0 |
| Vitest | 30 files / 280 tests 통과 |
| `npm run release:static-security-check:test` | 24 tests, 0 failures |
| policy gate tests | 120 tests, 0 failures |
| mobile doctor | 18/18 통과 |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | PASS, 0 problems |
| `git diff --check` | 통과 |

정적 gate가 확인한 production 파일:

- HTML: `index.html`, `privacy-policy.html`
- CSS: `assets/index-V6-KtScf.css`, `privacy-policy.css`

정상 Tailwind escaped selector와 media condition을 포함한 생성 CSS에서 오탐이 없었습니다.

## 결론

지정된 Round 4 회귀 범위에서 보안 결함이나 기능 회귀를 발견하지 못했습니다. 구현 `8327d44`는 이전 data URI 중첩 CSS 우회를 실패 폐쇄하면서 정확한 공개 정책 링크와 정상 production CSS를 유지하므로 PASS입니다.

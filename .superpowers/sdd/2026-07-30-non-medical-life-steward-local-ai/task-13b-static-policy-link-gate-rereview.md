# Task 13b 공개 정책 링크 정적 게이트 재검토

검토일: 2026-07-31 (Asia/Seoul)

검토 대상:

- 수정 구현: `c6a737890b5679ded0582c94335283417b7358b4`
- 수정 보고서: `24f7393496704f62d0d0433cbb34bbe58c796775`

## 최종 판정: FAIL

DOM 파싱과 기본 CSS URL 검사를 추가하여 이전 검토의 CSP comment, `<area>`, HTML entity, 기본 protocol-relative, `meta refresh`, `srcset`, 로컬 CSS `@import`/`url()` 우회는 차단되었습니다. 그러나 원격 URL 탐지는 여전히 원문 `https?://` 또는 `//` 정규식으로 시작합니다. 브라우저 URL 표준이 원격 HTTPS URL로 정규화하는 역슬래시와 ASCII 탭/개행 분리 slash form을 발견하지 못하며, CSS escape를 포함한 `url`/`@import` 식별자는 CSS 검사 정규식 자체를 우회합니다.

따라서 브리프의 모든 HTTP(S) URL을 fail-closed로 열거하고, entity·공백·대소문자·resource surface 우회를 차단한다는 요구를 충족하지 못합니다.

## Critical

- 없음. 현재 실제 정책 페이지의 strict CSP와 `img-src`/`style-src`는 일반적인 외부 이미지와 stylesheet load를 차단합니다. 다만 아래 `meta refresh` navigation은 이 CSP로도 차단되지 않았습니다.

## Important

### 1. URL 정규화 전 탐지 때문에 역슬래시·제어 공백 URL이 정적 게이트를 통과합니다

`findRemoteUrls`는 문자열 안의 리터럴 `https?://` 또는 `//`만 `new URL`에 전달합니다. 특별 URL scheme의 역슬래시 정규화와 URL parser가 제거하는 탭/개행은 그보다 먼저 처리되어야 하지만, 아래 mutation은 모두 `validateHtmlSecurity(..., "privacy-policy.html")`에서 `problems: []`으로 통과했습니다.

```html
<img src="https:\\attacker.example/two.png">
<img src="\\attacker.example/protocol.png">
<img src="https:/&#x09;/attacker.example/tab.png">
<img src="https:/&#x0A;/attacker.example/newline.png">
<meta http-equiv="refresh" content="0;url=https:\\attacker.example/next">
<meta http-equiv="refresh" content="0;url=https:/&#x09;/attacker.example/next">
<script src="https:\\attacker.example/x.js"></script>
<link rel="stylesheet" href="https:\\attacker.example/x.css">
```

기대 차단 조건은 각 mutation마다 `unexpected remote URL` 문제가 적어도 하나 생기고 gate가 fail이 되는 것입니다. 실제로는 모두 무문제 통과했습니다.

headless Chrome 146에서 외부 요청을 interception 후 즉시 abort하는 방식으로 URL 해석만 확인했습니다. `https:\\attacker…`, `https:/&#x09;/…`, `https:/&#x0A;/…`는 각각 `https://attacker.example/...` image request로, `script`와 `link` form은 각각 script/stylesheet request로 정규화되었습니다. 더 중요한 것은 exact production CSP를 함께 둔 두 `meta refresh` form이 CSP 오류 없이 `https://attacker.example/next`에 document navigation request를 시작했다는 점입니다. 요청은 interception에서 중단했으므로 외부 서버와 통신하지 않았습니다.

### 2. CSS escape로 `url()`·`@import`와 URL 값을 우회할 수 있습니다

CSS 검사는 리터럴 `@import`와 `url(`만 찾은 후에 참조 값을 decode합니다. 따라서 CSS 식별자 자체가 escape된 경우에는 URL 값을 보지 못합니다. 아래 CSS는 모두 `validateCssSecurity(..., "site.css")`에서 빈 문제 목록으로 통과했습니다.

```css
body { background-image: u\72l("https://attacker.example/function.png"); }
@\69mport "https://attacker.example/import.css";
body { background-image: url("https:\\attacker.example/backslash.png"); }
```

기대 차단 조건은 각각 `unexpected remote CSS URL` 문제와 빌드 디렉터리 gate fail입니다. headless Chrome 146 CSSOM은 이를 각각 `url("https://attacker.example/function.png")`, `@import url("https://attacker.example/import.css")`, 외부 image URL로 해석했고, 세 사례 모두 attacker URL 요청을 시작했습니다. 요청은 interception에서 즉시 abort했습니다.

현재 생산 CSP는 일반 CSS import/background image load를 제한하지만, 정적 검사 자체는 브리프에 따라 CSP와 독립적으로 모든 remote surface를 fail-closed해야 합니다.

## Minor

### 1. 새 적대적 정규화 fixture가 자동화 테스트에 없습니다

`scripts/check-static-security.node-test.mjs`는 entity와 `https\3a //`처럼 URL value 내부의 기본 CSS escape를 다루지만, 위의 HTML 역슬래시·slash 사이 탭/개행, CSS escaped function name `u\72l`, escaped at-keyword `@\69mport`, CSS quoted backslash URL은 다루지 않습니다. Important 결함이 향후 재발하지 않도록 각 fixture가 strict CSP 하에서 정적 gate fail을 요구하는 RED test로 추가되어야 합니다.

## 재검토에서 통과한 항목

| 표면 | 결과 |
| --- | --- |
| 실제 `public/privacy-policy.html` | 통과 |
| CSP meta를 주석에만 둔 mutation | 차단 |
| `<area href="정확 정책 URL">` | 차단 |
| HTML entity/hex/decimal URL, 리터럴 `//`, `meta refresh`, `srcset` | 차단 |
| 기본 CSS `@import`, `url()`, HTML entity, value CSS escape, 리터럴 protocol-relative | 차단 |
| 다른 HTML 파일의 정확 정책 링크 | 차단 |
| 정확 정책 URL의 `script`, `link`, `img`, `form`, `iframe`, `source`, `video`, `audio`, `object`, `embed`, `base`, `meta refresh`, `srcset`, CSS `url`/`@import` | 모두 차단 |
| direct inline style/script/event handler | 차단 |

## 검증 증거

| 명령 또는 검사 | 결과 |
| --- | --- |
| 이전 벡터 + 새 DOM/CSS adversarial in-memory matrix | 이전 벡터는 차단, 위 Important fixture는 정적 gate 우회 재현 |
| headless Chrome 146 request-interception fixture | 위 Important fixture의 실제 외부 URL 정규화·request 시작 확인 후 abort |
| `npm run release:static-security-check:test` | 통과 — 14 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | 통과 — Vitest 30 files / 280 tests, mobile doctor 18/18, 모든 release gate 통과 |
| `git diff --check` (검토 문서 작성 전) | 통과 |

## 수정 권고

URL-bearing DOM attribute와 `meta refresh` URL을 source 정규식 발견 여부와 무관하게 URL parser 기준으로 판정하고, special-scheme 역슬래시와 ASCII 탭/개행 정규화 뒤의 외부 origin을 차단해야 합니다. CSS는 정규식이 아니라 CSS tokenizer/parser를 이용해 escaped function/at-keyword를 해석한 뒤 모든 `url()` 및 `@import` 참조를 검사해야 합니다. 위 7개 HTML mutation과 3개 CSS mutation을 먼저 RED test로 고정하고, 각 입력이 반드시 정적 gate fail이 된 뒤에만 PASS로 재검토할 수 있습니다.

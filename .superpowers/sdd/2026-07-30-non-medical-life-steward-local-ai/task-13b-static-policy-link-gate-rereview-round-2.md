# Task 13b 정적 정책 링크 게이트 재검토 — 수정 Round 2/5

검토일: 2026-07-31 (Asia/Seoul)

검토 대상:

- 구현: `9eaf4e0` (`fix(security): normalize static remote URL escapes`)
- 구현 보고서: `0d22d17`
- 이전 FAIL 검토: `4d84a76`

## 최종 판정: FAIL

이번 수정은 이전 역슬래시, TAB/LF/CR character reference, `meta refresh`, script/link 및 CSS escaped `url`/`@import` 우회를 차단했습니다. 하지만 CSS 정적 검사는 여전히 `url()`과 `@import`만 URL surface로 추출합니다. Chromium이 원격 이미지로 해석하는 `-webkit-image-set("https://…" 1x)` string source는 검사기를 통과하므로, 모든 CSS remote URL을 fail-closed하라는 계약을 충족하지 못합니다.

## Critical

- 없음. 실제 strict CSP의 `img-src 'self' data:`는 검토 fixture의 외부 image load를 런타임에서 차단했습니다. 다만 정적 remote-resource gate 자체는 우회됩니다.

## Important

### CSS `image-set` string source가 정적 검사와 build-directory gate를 우회합니다

다음 유효 CSS mutation은 `validateCssSecurity(..., "site.css")`에서 `problems: []`으로 통과했습니다.

```css
body { background: -webkit-image-set("https://attacker.example/webkit.png" 1x); }
```

같은 CSS를 임시 배포 디렉터리의 `site.css`에 넣고 `validateBuiltHtmlDirectory`를 호출해도 `status: "pass"`, `problems: []`였습니다. 기대 차단 조건은 `site.css: unexpected remote CSS URL` 문제와 static-security gate fail입니다.

headless Chrome 146에서 CSP 없는 의미 검증 fixture로 위 CSS를 적용하고 `attacker.example` request를 interception한 결과, browser는 `https://attacker.example/webkit.png` image request를 시작했습니다. 요청은 interception에서 즉시 abort하여 외부 서버와 통신하지 않았습니다. CSSOM도 이 값을 `image-set(url("https://attacker.example/webkit.png") 1x)`로 정규화했습니다.

동일 CSS를 same-origin external stylesheet로 제공하고 실제 `EXPECTED_CSP`를 적용하면 Chrome console은 `img-src 'self' data:` 위반으로 load를 차단했습니다. 이는 현재 runtime 완화책일 뿐이며, 브리프의 CSP와 독립적인 정적 원격 URL fail-closed 요구를 충족하지 못합니다.

표준 `image-set("https://…" 1x)`도 CSSOM에서 `image-set(url("https://…") 1x)`로 정규화됐고 정적 검사는 통과했습니다. 이번 headless 환경에서는 해당 standard form의 request dispatch가 관찰되지 않았지만, Chromium-specific `-webkit-image-set` form은 실제 request 시작까지 확인됐습니다.

## Minor

### 세미콜론 없는 numeric character reference가 정확 정책 URL 허용을 우회합니다

`sourceContainsCharacterReference`는 semicolon을 필수로 요구합니다. 따라서 다음 source form은 `problems: []`으로 통과했습니다.

```html
<a href="https&#58//huggingface.co/privacy">https&#58//huggingface.co/privacy</a>
```

Chrome은 `href`와 표시 text를 모두 정확한 `https://huggingface.co/privacy`로 복호화합니다. 공격자 URL은 DOM 복호화 뒤 원격 URL로 판정되어 차단되므로 새로운 외부 목적지로 이어지지는 않습니다. 다만 raw source의 정확한 direct `a[href]`/visible text만 허용한다는 더 엄격한 계약 및 entity 우회 차단 요구에는 맞지 않아, semicolon-less numeric reference도 source-level reject하는 test가 필요합니다.

## 통과한 재검토 항목

| 검사 | 결과 |
| --- | --- |
| 실제 production policy의 정확 `a[href]`와 직접 표시 text | 통과 |
| CSP comment, `<area>` 오인식 | 차단 |
| HTML entity/hex/decimal, literal protocol-relative, query/fragment/port/userinfo/유사 도메인 | 차단 |
| `https:\\…`, `\\…`, slash 사이 TAB/LF/CR entity | 차단 |
| `meta refresh`, script, link, `src`, `srcset`, iframe, source, video, audio, area, object, embed, base, form/action/formaction | 차단 |
| 16개 HTML URL surface × 7개 (literal/entity/protocol/backslash/TAB/LF/CR) mutation | 112/112 차단 |
| 정확 정책 URL의 원격 resource 표면 14개 | 14/14 차단 |
| CSS plain `url`/`@import`, entity, hex escape terminator, 대소문자, 주석, nested `image-set(url(...))` | 차단 |
| CSS `u\72l`, `@\69mport`, quoted backslash URL | 차단 |
| direct inline style/script/event handler | 차단 |

## 빌드 및 전체 검증

| 명령 | 결과 |
| --- | --- |
| `npm run release:static-security-check:test` | 통과 — 16 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — production HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | 통과 — Vitest 30 files / 280 tests, mobile doctor 18/18, 모든 release gate 통과 |
| `git diff --check` (보고서 작성 전) | 통과 |

## 수정 권고

CSS regex만으로 URL-bearing value를 완전하게 열거하지 말고 CSS parser/tokenizer가 해석한 `<image>` source와 `image-set`/`-webkit-image-set` string source를 포함해 remote reference를 검사해야 합니다. 우선 위 Chromium fixture를 RED test로 고정하고, 표준·webkit `image-set`의 remote string source가 모두 `unexpected remote CSS URL`과 gate fail을 내도록 한 뒤에만 PASS로 재검토할 수 있습니다. 세미콜론 없는 numeric character reference도 exact policy allowance 전에 source-level reject해야 합니다.

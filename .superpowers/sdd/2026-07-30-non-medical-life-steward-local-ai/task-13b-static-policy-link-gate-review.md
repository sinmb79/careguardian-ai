# Task 13b 공개 정책 링크 정적 게이트 독립 보안 검토

검토일: 2026-07-31 (Asia/Seoul)
검토 대상: 구현 `4c4a89e23d9b1ae13e0d732ff37b3d9d721f017c`, 작업 보고서 `0364d554a24195b370e6efd9878ce42d7340ad45`

## 최종 판정: FAIL

현재 실제 `privacy-policy.html`은 통과하며, 리터럴 HTTP(S) URL과 리터럴 프로토콜 상대 resource의 기본 변이는 차단합니다. 그러나 검사기는 HTML을 파싱하거나 URL을 정규화하지 않고 원문 정규식만 검사합니다. 그 결과 브리프가 명시한 HTML 엔티티, `meta refresh` 프로토콜 상대 URL, CSS URL 우회를 놓칩니다. 따라서 “`privacy-policy.html`의 정확한 `<a href>`와 직접 표시 텍스트만 허용” 및 “발견한 모든 HTTP(S) URL을 파일+정확 URL 허용목록으로 판정” 요구를 충족하지 못합니다.

## Critical

- 없음.

## Important

### 1. HTML 문자 참조로 모든 원격 URL 검사를 우회할 수 있습니다

`HTTP_URL_PATTERN`은 원문 `https?://`만 찾습니다. 브라우저가 attribute value에서 복호화하는 `https&#x3A;//` 또는 `https&colon;//`는 URL로 인식되지만 검사기는 URL을 발견하지 못합니다.

다음 검증 입력들은 모두 `validateHtmlSecurity(..., "privacy-policy.html")`에서 빈 문제 목록으로 통과했습니다.

```html
<a href="https&#x3A;//attacker.example/steal">click</a>
<script src="https&#58;//attacker.example/x.js"></script>
<link rel="stylesheet" href="https&#58;//attacker.example/payload.css">
<img src="https&#x3a;//attacker.example/pixel.png">
<img srcset="https&#x3A;//attacker.example/pixel.png 1x" src="/safe.png">
<object data="https&#x3A;//attacker.example/payload"></object>
<meta http-equiv="refresh" content="0;url=https&#x3A;//attacker.example/next">
```

이는 anchor, script/link/img/form/iframe/source/video/audio/object/embed/base/meta refresh/srcset에서 같은 방식으로 적용될 수 있습니다. 현재 CSP는 대부분의 subresource를 방어하지만, 정적 게이트는 CSP와 별개로 모든 원격 URL을 실패 폐쇄해야 한다는 브리프 요구를 충족해야 합니다. 특히 refresh navigation은 현재 CSP에 `navigate-to`가 없으므로 이 정적 검사에 의존해야 합니다.

### 2. `meta refresh`의 프로토콜 상대 외부 이동이 통과합니다

프로토콜 상대 정규식은 `href`, `src`, `srcset`, `action` 등 attribute만 확인하며 `meta[http-equiv=refresh]`의 `content`를 해석하지 않습니다. 다음 입력은 빈 문제 목록으로 통과했습니다.

```html
<meta http-equiv="refresh" content="0;url=//attacker.example/next">
<img src="&#47;&#47;attacker.example/pixel.png">
<img srcset="&#47;&#47;attacker.example/pixel.png 1x" src="/safe.png">
<meta http-equiv="refresh" content="0;url=&#47;&#47;attacker.example/next">
```

이는 브리프가 명시적으로 요구한 `meta refresh` 및 프로토콜 상대 우회 차단을 위반합니다.

### 3. 로컬로 연결된 CSS의 원격 URL은 검사 대상이 아닙니다

`validateBuiltHtmlDirectory`는 HTML 파일만 열거합니다. 임시 dist fixture에서 아래 HTML과 로컬 CSS를 함께 두었을 때 결과는 `status: "pass"`, `problems: []`였습니다.

```html
<link rel="stylesheet" href="privacy-policy.css">
```

```css
@import url("https://attacker.example/payload.css");
```

브리프의 CSS URL 차단을 충족하지 못합니다. 배포 산출물에서 참조되는 CSS까지 검사하거나, HTML 검사 범위를 CSS URL까지 확장해야 합니다.

## Minor

### 1. `<area>`가 `<a>`로 오인되어 정확 URL의 허용 위치가 넓어집니다

`isAllowedHttpUrl`의 `lastIndexOf("<a", index)`는 tag name 경계를 확인하지 않습니다. 따라서 아래 유효 링크 표면은 앵커 `<a>`가 아닌데도 통과합니다.

```html
<map name="m"><area href="https://huggingface.co/privacy"></map></a>
```

검사기는 `privacy-policy.html`에서 빈 문제 목록을 반환했습니다. 허용 위치를 실제 `a` element의 정확한 `href` 또는 직접 text node로 제한해야 합니다.

### 2. CSP 존재 검사가 주석의 문자열에도 통과합니다 (기존 검사 한계)

`html.includes(expectedMeta)`는 HTML 구조를 확인하지 않습니다. 실제 CSP meta가 없어도 아래 입력은 검사기를 통과했습니다.

```html
<!-- <meta http-equiv="Content-Security-Policy" content="...expected CSP..."> -->
<script src="/same-origin.js"></script>
```

이 동작은 이번 커밋 이전부터 존재한 한계로 보이지만, “strict CSP가 유지된다”는 정적 게이트 주장에는 충분하지 않습니다. 실제 `<meta http-equiv="Content-Security-Policy">` element와 단일 정확 content를 구조적으로 검증해야 합니다.

## 통과한 항목

- 실제 `public/privacy-policy.html`은 strict CSP와 리터럴 정확 링크를 포함한 상태로 통과했습니다.
- 리터럴 `http`, query, fragment, trailing slash, port, userinfo, 유사 도메인, 하위 도메인, 추가 경로와 제3 HTTPS URL은 차단됩니다.
- 리터럴 정확 URL을 `script`, `link`, `img`, `form`, `iframe`, `source`, `video`, `audio`, `object`, `embed`, `base`, `meta refresh`, `srcset`, inline CSS URL에 둔 경우는 차단됩니다.
- 리터럴 `//`를 `href`/`src` 등 현재 정규식이 다루는 resource attribute에 둔 경우는 차단됩니다.
- direct inline style/script/event handler 차단의 기존 node test는 통과했습니다.

## 실행 증거

| 명령 | 결과 |
| --- | --- |
| `npm run release:static-security-check:test` | 통과 — 8 tests, 0 failures |
| 적대적 in-memory URL matrix | 실패 — entity URL, entity resource, protocol-relative meta refresh, CSS fixture, `<area>`가 모두 무문제 통과 |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — 현재 `index.html`, `privacy-policy.html`에 0 problems |
| `git diff --check` | 통과 |

## 수정 권고

HTML parser 기반으로 attribute/text node를 해석하고 character reference를 복호화한 뒤, URL parser가 정규화한 결과를 **파일명 + element명 + attribute명 + 정확한 원문/정규 URL** 허용목록과 비교해야 합니다. `a[href]`의 정확한 URL과 직접 text node만 예외로 두고, `meta refresh`, `srcset`, `style`/CSS `url()` 및 배포 CSS asset을 별도로 해석해야 합니다. 이를 재현하는 RED test를 먼저 추가한 후 본 검토의 모든 Important 항목이 차단됨을 확인해야 합니다.

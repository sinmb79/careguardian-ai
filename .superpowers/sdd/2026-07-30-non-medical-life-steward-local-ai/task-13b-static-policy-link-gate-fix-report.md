# Task 13b 정적 정책 링크 게이트 독립 검토 수정 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 수정 결과

독립 검토 FAIL을 해결하기 위해 정적 HTML 검사를 `jsdom` DOM 파싱 기반으로 교체했다. `new JSDOM(html)`은 외부 resource를 가져오지 않으며, 기존 root devDependency `jsdom@29.0.2`만 사용했다.

- CSP는 주석 문자열이 아닌 실제 `meta[http-equiv="Content-Security-Policy"]` 요소 한 개의 정확한 content로 검사한다.
- 모든 DOM 요소 attribute와 텍스트 node에서 복호화된 HTTP(S)·protocol-relative URL을 찾고 URL parser로 확인한다.
- `privacy-policy.html`의 실제 `a[href]` 정확 값 및 직접 text node의 정확 표시 주소만 허용한다. `area`, resource attribute, 중첩 요소, 다른 파일은 허용하지 않는다.
- `src`, `srcset`, `href`, `action`, `formaction`, `poster`, `data`, `cite`, `background`, `meta refresh` 및 기타 attribute의 외부 URL은 실패 폐쇄한다.
- 배포 디렉터리의 모든 CSS를 추가 검사해 `@import`와 `url()`의 HTTPS, protocol-relative, HTML entity, CSS escape 우회를 차단한다. 로컬 CSS 참조는 허용한다.

## TDD 증거

검토 재현을 먼저 테스트로 추가한 뒤 RED를 확인했다.

| RED 재현 | 기존 결과 |
|---|---|
| CSP meta를 주석 안에 둔 입력 | 무문제 통과 |
| `<area href="정확 정책 URL">` | 무문제 통과 |
| HTML entity/hex/decimal URL, `meta refresh`, `srcset`, protocol-relative URL | 무문제 통과 |
| 배포 CSS의 `@import`, `url()`, entity, escape, protocol-relative URL | 무문제 통과 |

테스트 추가 직후 정적 게이트 테스트는 14개 중 4개가 실패했다. DOM·CSS 구현 후 14/14 GREEN을 확인했다.

## 검증

| 검사 | 결과 |
|---|---|
| `npm run release:static-security-check:test` | 통과 — 14 tests, 0 failures |
| `npm run build` | 통과 |
| `npm run release:static-security-check` | 통과 — HTML 2개, CSS 2개, 0 problems |
| `npm run verify` | 통과 — Vitest 30 files / 280 tests, mobile doctor 18/18, 모든 release gate 통과 |
| `git diff --check` | 통과 |

## 커밋

- 수정 구현: `c6a737890b5679ded0582c94335283417b7358b4` (`fix(security): parse static policy links with DOM`)

이 정적 게이트 통과는 공개 문서와 배포 artifact의 URL surface 검증 결과이며, 외부 서비스의 실제 처리 또는 실제 개인정보 데이터 사용 승인을 의미하지 않는다.

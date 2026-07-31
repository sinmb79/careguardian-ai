# Task 13b 공개 정책 링크 정적 게이트 보고서

기준일: 2026-07-31 (Asia/Seoul)

## 결과

`privacy-policy.html`에서만 정확한 `https://huggingface.co/privacy`를 허용한다. 허용 위치는 앵커의 정확한 `href` 값과 태그 없이 직접 표시된 앵커 텍스트뿐이다. 검사기는 HTML에서 발견한 모든 HTTP(S) URL을 열거하고 파일·정확 URL 허용목록과 허용 위치로 판정한다.

다음은 모두 실패 폐쇄된다.

- 같은 정확 URL의 다른 HTML 파일 사용
- HTTP, query, fragment, 끝 슬래시, 포트, userinfo, 유사·하위 도메인, 추가 경로, 제3 URL
- 정확 허용 URL을 `script`, stylesheet link, `img`, `form`의 원격 resource 속성으로 사용
- HTTPS 원격 resource 및 protocol-relative 원격 resource

기존 strict CSP, inline style/script/event handler 차단은 변경하거나 약화하지 않았다.

## TDD 증거

1. 정책 페이지 허용, 다른 파일 거부, URL 변이 거부, 원격 resource 거부 테스트를 먼저 추가했다.
2. RED: 기존 전역 `https://` 차단 때문에 정책 페이지 허용 테스트가 실패했고, protocol-relative resource는 통과해 총 7개 중 5개가 실패했다.
3. 파일별 정확 URL 허용목록과 URL 열거 검사를 구현했다.
4. 추가 RED: 정확 허용 URL을 원격 resource 속성에 둔 테스트가 빈 문제 목록으로 실패해 우회를 재현했다.
5. `<a href>`의 정확 값과 직접 표시 텍스트로 허용 위치를 제한했다.
6. GREEN: `npm run release:static-security-check:test`는 8/8 통과했다.

## 검증

| 검사 | 결과 |
|---|---|
| `npm run release:static-security-check:test` | 통과 — 8 tests, 0 failures |
| `npm run build` | 통과 — TypeScript 검사 및 Vite production build 완료 |
| `npm run release:static-security-check` | 통과 — `index.html`, `privacy-policy.html`, 0 problems |
| `git diff --check` | 통과 |

## 커밋

- 구현: `4c4a89e23d9b1ae13e0d732ff37b3d9d721f017c` (`fix(security): constrain static privacy policy link`)

이 결과는 정적 HTML 게이트 검증 결과이며, 외부 Hugging Face 서비스의 실제 동작이나 실제 개인정보 데이터 사용 승인을 뜻하지 않는다.

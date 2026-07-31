# Task 13b — 공개 정책 외부 링크 정적 HTML 게이트

## 문제

공개 개인정보처리방침은 사용자가 Hugging Face의 실제 개인정보처리방침을 확인할 수 있도록 정확한 링크 `https://huggingface.co/privacy`를 포함한다. 기존 `scripts/check-static-security.mjs`는 모든 `https://` 문자열을 일괄 차단하여 새 정책 페이지와 전체 `npm run verify`를 실패시킨다.

## 허용 파일

- `scripts/check-static-security.mjs`
- `scripts/check-static-security.node-test.mjs`
- 이 작업의 SDD 보고서

다른 에이전트 파일은 수정·stage하지 않는다.

## 요구사항

1. `privacy-policy.html`에서 정확히 `https://huggingface.co/privacy`인 링크만 허용한다.
2. 해당 주소는 앵커의 `href`와 표시 텍스트에 각각 존재할 수 있다.
3. 다른 HTML 파일에서는 같은 주소도 허용하지 않는다.
4. 다음은 모두 계속 차단한다.
   - HTTP
   - 쿼리, fragment, 끝 슬래시, 포트, userinfo
   - 유사 도메인, 하위 도메인, 추가 경로
   - 제3 HTTPS URL
   - 원격 script/style/img/form 또는 다른 remote resource
5. 기존 CSP·inline script/style/event 차단을 약화하지 않는다.
6. 단순 문자열 제거 뒤 검사하지 말고 HTML 안에서 발견한 모든 HTTP(S) URL을 열거해 파일+정확 URL 허용목록으로 판정한다.

## TDD·검증

- 먼저 현재 정책을 통과시키는 기대와 위 변이 차단 테스트를 작성해 RED를 확인한다.
- `npm run release:static-security-check:test`
- `npm run build`
- `npm run release:static-security-check`
- `git diff --check`

구현 커밋과 별도 보고서 커밋을 만든다.

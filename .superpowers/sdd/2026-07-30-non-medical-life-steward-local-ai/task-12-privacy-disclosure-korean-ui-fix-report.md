# Task 12 개인정보 고지·한국어 UI 수정 보고서

- 상태: `DONE`
- 독립 검토 결과: `FAIL` 수정 완료
- 구현 수정 커밋: `4c84462ec4605f05c2d743516ade5ca6746b4ebf`

## 수정 내용

설정 화면의 데이터 처리 경계를 더 명확히 전달하기 위해 `클라우드 AI`를 `외부 AI 처리 서비스`로 바꾼 UX·정밀도 수정입니다. 기존 한국어 표현 자체는 `FORBIDDEN_CLOUD` 예외가 필요하지 않았습니다. 같은 문구를 검증하는 소스 계약 테스트도 함께 수정했습니다.

고정 개인정보처리방침 URL 두 개의 출시 검사 허용 목록은 Task 11 통합 범위이므로 스크립트와 출시 검사 파일은 수정하지 않았습니다.

## TDD 증빙

### RED

계약 테스트의 기대 문구를 먼저 바꾼 뒤 실행했습니다.

```powershell
npm test -- --run apps/mobile/src/legal/privacyDisclosureUi.test.ts
```

결과: 종료 코드 `1`, 2개 중 1개 테스트 실패. 기존 화면에 `클라우드 AI`가 남아 있어 새 `외부 AI 처리 서비스` 계약을 만족하지 못했습니다.

### GREEN

```powershell
npm test -- --run apps/mobile/src/legal/externalLinks.test.ts apps/mobile/src/legal/privacyDisclosureUi.test.ts apps/mobile/src/ui/workspaceEntry.test.ts
```

결과: 종료 코드 `0`, 3개 테스트 파일·18개 테스트 통과.

```powershell
npm run mobile:typecheck
git diff --check
```

결과: 모두 종료 코드 `0`.

## 변경 파일

- `apps/mobile/src/ui/LifeWorkspaceScreen.tsx`
- `apps/mobile/src/legal/privacyDisclosureUi.test.ts`

다른 에이전트의 플러그인·Android 검증·출시 검사 미커밋 변경은 stage하거나 커밋하지 않았습니다.

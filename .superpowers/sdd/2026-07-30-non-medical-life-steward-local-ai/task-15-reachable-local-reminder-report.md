# Task 15 보고 — 도달 가능한 기기 내 생활 알림

## RED → GREEN

- RED: 날짜 입력 UI, `dueDate` 저장, 엄격한 실제 날짜 검증, 현지 오전 9시 과거 차단, 과거 트리거의 네이티브 예약 미시도 테스트가 기존 구현에서 실패했다.
- GREEN: `apps/mobile/src/reminders/localReminderTime.ts`에 기기 현지 시각 기준의 순수 날짜 변환을 두고, 작업 입력과 알림 동기화가 같은 검증을 사용하도록 구현했다.

## 구현 결과

- 오늘 작업 폼에만 `알림 날짜 (선택, 오전 9시)`와 `YYYY-MM-DD` 입력, 접근성 설명을 추가했다. 목록 폼은 변경하지 않았다.
- 빈 날짜는 저장하지 않고, 공백은 제거한다. 형식 오류·존재하지 않는 날짜·현지 오전 9시 기준 과거 날짜는 한국어 오류로 실패하며 원본 작업공간을 변경하지 않는다.
- 성공 시 `dueDate`가 작업과 오늘 목록에 보존되고, 제목·날짜 입력은 성공 후에만 비운다.
- 저장 시 미래의 열린 작업만 일반 본문 및 `taskId`로 예약한다. 과거 트리거는 권한 요청과 네이티브 예약 이전에 제외한다.
- 의료 문구, 클라우드 AI, 계정, 분석 기능을 추가하지 않았다.

## 검증

- 대상: `npm test -- --run apps/mobile/src/ui/workspaceEntry.test.ts apps/mobile/src/notifications/lifeNotifications.test.ts apps/mobile/src/state/useLifeWorkspace.test.ts` — 3 파일, 41 통과
- 모바일 타입: `npm run mobile:typecheck` — 통과
- 전체: `npm run verify` — 30 파일, 289 통과; 웹 빌드, Expo Doctor 18/18, 정적 보안·비의료·모델·워크플로 게이트 통과
- Git 공백: `git diff --check` — 통과. 별도 `diff-check` npm 스크립트는 정의되어 있지 않음을 확인했다.

## 커밋

- 제품 구현: `aa7bd25 fix(mobile): enable local task reminders`

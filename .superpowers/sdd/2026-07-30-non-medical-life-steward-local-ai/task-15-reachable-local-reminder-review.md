# Task 15 독립 검토 — 도달 가능한 기기 내 생활 알림

- 검토 대상: `aa7bd25 fix(mobile): enable local task reminders`, `f5cb3be fix(mobile): inject local reminder clock`
- 참고 보고: `3b2ff9d`, `81fa3fa`
- 범위: 명세 준수, 입력/시간 경계, 개인정보 노출, 저장·알림·삭제 회귀
- 판정: **FAIL — Important 1건**

## Important

### I1 — 유효하지 않은 주입 시계가 과거 날짜 검증을 fail-open 합니다

`apps/mobile/src/ui/workspaceEntry.ts`는 `nowDate()`의 반환값 유효성을 검사하지 않은 채 `trigger.getTime() <= now.getTime()`만 비교합니다. 다음 최소 fixture에서 `now.getTime()`은 `NaN`이고 모든 수치 비교가 `false`가 되므로, 과거 `dueDate`가 오류 없이 새 작업에 저장됩니다.

```ts
const before = structuredClone(fixtureWorkspace);
const result = addWorkspaceTask(fixtureWorkspace, "과거 작업", "2026-07-30", {
  now: () => "2026-07-31T09:00:00+09:00",
  nowDate: () => new Date(Number.NaN),
  createId: () => "task-past"
});
// 현재 결과: { ok: true, workspace: ...dueDate: "2026-07-30" }
// 요구 결과: { ok: false, error: <명확한 한국어 시간 오류> }, fixtureWorkspace === before
```

이는 명세의 “기기 현지 시각 오전 9시 기준 과거 날짜는 실패하고 입력 작업공간을 바꾸지 않는다” 및 압박 범위의 “invalid dependencies”를 충족하지 못합니다. `nowDate()`와 `new Date(dependencies.now())` 모두 `Number.isFinite(date.getTime())`를 확인해 오류를 반환하고, 위 fixture를 회귀 테스트로 추가해야 합니다. `syncLifeNotifications`의 `now()`도 같은 검증 또는 `try/catch`가 필요합니다. 현재는 Invalid Date에서 예약은 생략되지만 기존 알림을 먼저 취소하는 실패-폐쇄와는 다른 상태가 됩니다.

## 통과한 확인

- 작업 폼에만 한국어 선택 날짜 입력·자리표시·접근성 레이블/설명이 있고 목록 폼에는 추가되지 않았습니다.
- 공백 날짜는 제거하고, 빈 값은 `dueDate` 없이 기존 오버로드 호출 호환성을 유지합니다. 성공 시에만 제목·날짜를 비웁니다.
- `localNineAmForDate`는 정규식, `setFullYear`, 현지 `setHours(9,0,0,0)` 및 역검증으로 존재하지 않는 날짜를 거부합니다. `2026-02-29`는 거부되고, `2024-02-29`는 허용되며 `0000`은 거부·`0099`는 `setFullYear(99,...)`로 올바르게 처리됩니다. ISO 문자열을 UTC로 파싱하지 않으므로 시간대 오프셋 드리프트가 없습니다. 오전 09:00 정확히는 `<=`로 거부되고 그 직전은 허용됩니다. 09:00은 DST 전환의 모호한 시간대가 아닙니다.
- 미래·유효·열린 작업만 `buildLifeNotification`까지 도달합니다. 과거 작업은 권한 요청과 `scheduleNotificationAsync` 이전에 제외됩니다. 제목/메모는 본문에 없고 일반 제목, 빈 본문, `taskId`만 사용합니다.
- 저장 후 새 `dueDate`가 동기화 인자에 전달됩니다. 기존 권한, 예약 롤백, 전체 삭제·모델 삭제 순서는 Task 15 변경에서 수정되지 않았습니다.
- 의료 기능, 클라우드 AI, 계정, 분석 표면은 이번 diff에 추가되지 않았습니다.

## 실행 검증

- 대상 테스트: `npm test -- --run apps/mobile/src/ui/workspaceEntry.test.ts apps/mobile/src/notifications/lifeNotifications.test.ts apps/mobile/src/state/useLifeWorkspace.test.ts` — **3 파일 / 41 통과**
- 타입 검사: `npm run mobile:typecheck` — **통과**
- 전체 릴리스 검증: `npm run verify` — **30 파일 / 289 통과**, 웹 빌드, Expo Doctor 18/18, 정적 보안·비의료·모델·워크플로 게이트 통과
- `git diff --check` — **통과**

기존 테스트는 유효한 `nowDate`만 사용하므로 I1을 포착하지 못합니다. 제품 파일은 이 검토에서 수정하지 않았습니다.

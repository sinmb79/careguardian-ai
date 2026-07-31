# Task 15 재검토 1차 — 무효 시계 fail-closed

- 기준 제품: `81c396f fix(mobile): fail closed on invalid reminder clocks`
- 기준 보고: `966f67f`
- 이전 검토: `c8e8467` (Important: Invalid Date fail-open)
- 판정: **PASS**

## 이전 Important 해결 확인

`addWorkspaceTask`는 날짜가 존재할 때만 주입 `nowDate()` 또는 fallback `now()`를 읽고 `Number.isFinite(now.getTime())`를 검사합니다. 따라서 `Invalid Date`, `Infinity`, `-Infinity`, `NaN` 및 파싱 불가 fallback 문자열은 모두 명확한 한국어 오류를 반환하며 작업공간을 변경하지 않습니다. `new Date(Infinity)`, `new Date(-Infinity)`, `new Date(NaN)`은 모두 `getTime() === NaN`이므로 같은 `Number.isFinite` 경로로 fail-closed 됩니다.

날짜 없는 기존 오버로드 호출은 시계를 읽지 않으므로 무효 시계에서도 정상 작업 생성과 하위 호환성을 유지합니다. 이번 수정은 유효 시계의 오류 조건이나 기존 검증을 약화하지 않았습니다.

## 압박 확인

- 현지 시간 정확히 09:00은 `<=`로 거부하고 그 직전은 허용합니다. `nowDate`를 우선 사용하므로 `now` 문자열과 `nowDate`가 서로 다른 시간대여도 비교 기준이 결정적입니다.
- `localNineAmForDate`는 `setFullYear`와 현지 `setHours`를 사용합니다. `2026-02-29`는 거부, `2024-02-29`는 허용, `0000`은 거부, `0099`는 99년으로 처리합니다. UTC ISO 파싱이 없어 기기 시간대 오프셋 드리프트가 없습니다.
- 작업 입력에만 선택형 한국어 날짜 UI와 접근성 정보가 있고, 오류 시 상태를 비우지 않습니다. 성공 시 `dueDate`가 저장·동기화 인자로 전달됩니다.
- 알림 동기화는 미래의 유효한 열린 작업만 네이티브 예약으로 보냅니다. 과거 작업은 권한 요청 및 `scheduleNotificationAsync` 전에 제외됩니다. 제목·메모는 알림 본문에 없고 일반 제목, 빈 본문, `taskId`만 사용합니다.
- 권한 요청, 예약 롤백, 전체 삭제 시 알림 취소·검증과 모델/저장소 삭제 순서는 변경되지 않았습니다.

## 검증

- 대상: `npm test -- --run apps/mobile/src/ui/workspaceEntry.test.ts apps/mobile/src/notifications/lifeNotifications.test.ts apps/mobile/src/state/useLifeWorkspace.test.ts` — **3 파일 / 45 통과**
- 타입 검사: `npm run mobile:typecheck` — **통과**
- 전체: `npm run verify` — **30 파일 / 293 통과**, 웹 빌드, Expo Doctor 18/18, 정적 보안·비의료·모델·워크플로 게이트 통과
- `git diff --check` — **통과**

Critical 0, Important 0, Minor 0. 제품 파일은 이 재검토에서 수정하지 않았습니다.

# Task 12 개인정보 고지·한국어 UI 독립 보안 검토

- 검토 대상 구현: `e05b6614faffe65df8148a26a237303669c45e90`
- 구현 검증 보고서: `d6269446e9725110ee33398f13a3dec497f8809f`
- 검토 상태: **FAIL** — 제품 코드의 개인정보 경계 구현에는 Critical/Important 취약점이 없지만, 현행 비의료 출시 게이트와의 필수 통합이 완료되지 않아 출시 검증을 통과할 수 없습니다.
- 검토 범위: Task 12 커밋만 대조했습니다. 워크트리에 있던 다른 에이전트의 미커밋 변경은 수정·stage·판정 대상에 포함하지 않았습니다.

## 결론

외부 정책 링크는 호출자가 URL을 제공할 수 있어도 `Set`의 정확 문자열 비교를 통과한 두 HTTPS 상수만 열 수 있습니다. HTTP, 쿼리·프래그먼트·경로 변조, 대소문자 차이, 사용자 정보, 포트, 유사 도메인 및 `javascript:` 스킴은 모두 일치하지 않아 `blocked` typed 결과가 됩니다. 실제 UI는 상수만 전달하며, `Linking.openURL` 거부도 `open-failed` typed 결과로 바뀌고 화면 안의 한국어 오류와 오프라인 고지는 유지됩니다.

모델 설치 고지는 체크박스 바로 앞에 있으며, UI 비활성화뿐 아니라 설치 action 자체도 `acceptedLicenseModelIds.has(model.id)`를 재확인합니다. 고지에는 수신자, IP/대략 위치/기기·운영체제·브라우저·네트워크/모델 요청 경로·이용 기록, 목적, 국외 처리·보존, 권리·문의처, 프롬프트·결과·생활 작업의 비전송 및 선택권이 포함됩니다. 새 작업·목록 폼의 라벨·자리표시자·접근성 이름·모든 반환 오류도 한국어입니다.

## Critical

없음.

## Important

### I-12-01 — 새 고정 정책 URL이 현행 비의료 출시 게이트를 실패시킴

- 위치: `apps/mobile/src/legal/externalLinks.ts:1-3`, `scripts/check-non-medical-release.mjs:1622-1629,1839-1843` (Task 12 이전의 현행 게이트)
- 증거: `node scripts/check-non-medical-release.mjs`의 진단 결과에 `apps/mobile/src/legal/externalLinks.ts: unapproved remote URL` 2건과 `statically computed remote URL surface` 4건이 포함되었습니다. 구현은 두 URL을 정확히 고정합니다.
- 영향: Task 12의 보안 설계는 올바르지만, 현재의 fail-closed 출시 게이트는 새 앱 내 정책 링크를 허용하지 않아 출시 검증이 실패합니다. 게이트를 임의 URL에 대해 넓게 완화하면 로컬 전용 데이터 경계가 약화될 수 있습니다.
- 필요한 통합: Task 11 또는 통합 담당자는 다음만 허용해야 합니다.
  - 파일을 `apps/mobile/src/legal/externalLinks.ts`로 제한합니다.
  - URL을 `https://sinmb79.github.io/careguardian-ai/privacy-policy.html` 및 `https://huggingface.co/privacy`와 정확히 일치할 때만 허용합니다.
  - 일반 `https:`/Hugging Face 호스트/경로 접두사/정규식 와일드카드/파일 전체 예외를 만들지 않습니다.
  - 일반 원격 URL 검사와 TypeScript의 `statically computed remote URL surface` 검사 양쪽에 동일한 정확 계약을 적용합니다.
  - HTTP, 쿼리·프래그먼트·포트·사용자 정보·대소문자·유사 도메인·추가 경로 및 제3 URL을 거부하는 출시 게이트 회귀 테스트를 추가합니다.
- `클라우드 AI를 사용하지 않습니다` 고지 평가: 현행 `FORBIDDEN_CLOUD`는 영문 `firebase|sentry|amplitude|mixpanel|analytics|openai|anthropic|generative-ai`만 검사하므로 한국어 고지 문구는 현재 충돌하지 않습니다. 따라서 이 문구를 위한 별도 예외나 금칙어 완화는 필요하지 않습니다.

## Minor

없음.

## 확인한 보안·UX 계약

- 정확 HTTPS 허용목록과 typed 실패: `apps/mobile/src/legal/externalLinks.ts:1-29`, `apps/mobile/src/legal/externalLinking.ts:9-17`
- 설정의 오프라인 본문과 링크 실패 시 화면 내 오류: `apps/mobile/src/ui/LifeWorkspaceScreen.tsx:31-37,57-61`
- Hugging Face 전체 수신·목적·국외 처리·보존·권리/문의·비전송·선택 고지 및 실패 시 화면 내 오류: `apps/mobile/src/ui/LocalAiScreen.tsx:371-379,442-479`
- 체크 전 UI 차단: `apps/mobile/src/ui/LocalAiScreen.tsx:495-519`
- 체크 전 action 차단(방어 심층): `apps/mobile/src/local-ai/useLocalAssistant.ts:630-643`
- 한국어 폼·오류: `apps/mobile/src/ui/LifeWorkspaceScreen.tsx:78-83`, `apps/mobile/src/ui/workspaceEntry.ts:60-73`

## 검증 실행

통과:

```powershell
npm test -- --run apps/mobile/src/legal/externalLinks.test.ts apps/mobile/src/legal/privacyDisclosureUi.test.ts apps/mobile/src/ui/workspaceEntry.test.ts
# 3 files, 18 tests passed
npm run mobile:typecheck
git diff --check
```

현재 워크트리에서 `npm test -- --run` 전체 실행은 Task 12와 무관한 동시 미커밋 작업 때문에 통과 증빙으로 사용할 수 없었습니다. 실패 원인은 미추적 Android 검증 파일 두 개가 Vitest suite가 아니었던 점과 `src/app/App.test.tsx`의 기존 웹 동기화 경쟁 조건 테스트 1건이며, Task 12는 `src/app/`을 수정하지 않았습니다. 이 검토에서는 해당 파일들을 변경하거나 stage하지 않았습니다.

## 재검토 조건

I-12-01의 정확 계약 통합 후 `npm run release:policy-check`와 그 회귀 테스트가 통과하면, Task 12의 제품 코드 보안·고지 검토는 PASS로 전환할 수 있습니다.

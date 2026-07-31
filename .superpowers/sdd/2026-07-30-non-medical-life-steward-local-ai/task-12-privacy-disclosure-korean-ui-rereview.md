# Task 12 개인정보 고지·한국어 UI 재검토

- 수정 구현: `4c84462ec4605f05c2d743516ade5ca6746b4ebf`
- 수정 보고서: `3a99e342c3bb7049747d0474593529eb2c893d2f`
- 정확 출시 게이트 통합: `443351beb3e9707ca395e6bda3b2f486f683673c`
- 최종 판정: **PASS**
- 범위: 위 세 커밋과 Task 12 관련 최종 통합만 검토했습니다. Task 13 문서는 수정하거나 stage하지 않았습니다.

## 결론

이전 Important `I-12-01`은 해소되었습니다. 출시 게이트는 정책 링크를 호스트나 접두사로 허용하지 않고 `파일 경로 → 정확 링크 집합`으로 제한합니다. Task 12의 두 링크는 `apps/mobile/src/legal/externalLinks.ts`에서만 정확 값으로 허용되며, 일반 외부 링크 검사와 TypeScript 정적 계산 URL 검사 모두 같은 `isApprovedReleaseLink(file, link)` 계약을 사용합니다.

앱 자체의 `Set` 정확 비교와 typed `blocked`/`open-failed` 처리, 화면 내 오프라인 고지, Hugging Face 전체 처리 고지, 체크 전 UI 및 설치 action 차단, 한국어 입력 폼·오류는 그대로 유지되었습니다. 수정 커밋은 설정의 `클라우드 AI` 문구를 더 구체적인 `외부 AI 처리 서비스`로 바꾸고 계약 테스트를 함께 갱신했으며, 개인정보 경계를 약화하지 않습니다.

## Critical

없음.

## Important

없음.

## Minor

### M-12-01 — 수정 보고서의 문구 변경 사유가 실제 게이트 규칙과 다름

- 위치: `.superpowers/sdd/2026-07-30-non-medical-life-steward-local-ai/task-12-privacy-disclosure-korean-ui-fix-report.md:9`
- 내용: 보고서는 한국어 `클라우드 AI` 문구가 출시 정책 검사에서 별도 예외를 필요로 했다고 설명합니다. 그러나 현행 `FORBIDDEN_CLOUD`는 `firebase|sentry|amplitude|mixpanel|analytics|openai|anthropic|generative-ai`만 검사하므로 해당 한국어 문구는 원래도 일치하지 않습니다 (`scripts/check-non-medical-release.mjs:39`).
- 영향: 제품 동작과 출시 게이트에는 영향이 없고, `외부 AI 처리 서비스`라는 수정 문구도 정확합니다. 검증 기록의 변경 사유만 “외부 처리 경계를 더 명확히 표현하기 위해”로 이해하는 것이 정확합니다.

## 정확 URL 게이트 검증

관련 계약:

- 파일별 정확 링크 집합: `scripts/check-non-medical-release.mjs:19-29`
- 공통 판정 함수: `scripts/check-non-medical-release.mjs:488-501`
- 정적 계산 URL 검사: `scripts/check-non-medical-release.mjs:1709-1719`
- 일반 외부 링크 검사: `scripts/check-non-medical-release.mjs:1935-1943`
- 커밋된 mutation 테스트: `scripts/check-non-medical-release.node-test.mjs:587-625`

읽기 전용 인메모리 mutation으로 두 Task 12 URL 각각에 다음 변이를 적용했습니다.

| 변이 | 일반 외부 링크 검사 | 정적 계산 URL 검사 |
|---|---|---|
| HTTP | 차단 | 차단 |
| 쿼리 추가 | 차단 | 차단 |
| fragment 추가 | 차단 | 차단 |
| 포트 추가 | 차단 | 차단 |
| userinfo 추가 | 차단 | 차단 |
| 유사 도메인 | 차단 | 차단 |
| 추가 경로 | 차단 | 차단 |

추가로 확인한 결과:

- `externalLinks.ts`에 제3 URL 리터럴 추가: 일반 외부 링크 검사 차단
- 제3 URL을 문자열 결합으로 구성: 정적 계산 URL 검사 차단
- 허용된 정확 Hugging Face URL을 다른 파일로 이동: 일반 검사와 정적 계산 검사 모두 차단
- 최종 결과: `adversarial-policy-link-matrix: PASS`

따라서 HTTP/쿼리/fragment/포트/userinfo/유사 도메인/추가 경로/제3 URL이나 다른 파일로의 이동으로 허용 계약을 우회할 수 없습니다.

## 검증 실행

```powershell
npm test -- --run apps/mobile/src/legal/externalLinks.test.ts apps/mobile/src/legal/privacyDisclosureUi.test.ts apps/mobile/src/ui/workspaceEntry.test.ts
# 3개 파일, 18개 테스트 통과

npm run mobile:typecheck
# 통과

npm run release:policy-check:test
# 75개 테스트 통과

npm run release:policy-check
# status: pass, checkedFiles: 111, problems: []

git diff --check
# 통과
```

## 최종 판정

Task 12의 제품 보안·개인정보 고지 요구사항과 정확 출시 게이트 통합은 **PASS**입니다. M-12-01은 문서 설명의 정밀도 문제일 뿐 출시 차단 사유가 아닙니다.

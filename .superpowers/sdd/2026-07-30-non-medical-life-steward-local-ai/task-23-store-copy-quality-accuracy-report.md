# Task 23 Play 문안 품질 정확성 보완 보고서

작성일: 2026-07-31
대상 브랜치: `codex/non-medical-local-ai-closed-test`

## 결론

NAVER HyperCLOVA X 0.5B Android exact-source QA 결과에 맞춰 Play 한국어·영문
전체 설명과 출시 노트의 기능 보장형 표현을 best-effort 표현으로 정정했다.
모든 결과가 엄격한 정책·원문 근거 검증을 통과해야 하고, 통과하지 못하면
원문을 변경하지 않고 폐기되며 같은 동작을 다시 시도할 수 있다는 한계를
명시했다. 비공개 테스트에서는 네 동작의 성공률과 기기별 결과 품질을
평가한다.

구현 커밋:

- `5b2d7f2165a3c07fcc28729e81995eed0f0410a7`
- 구현 tree: `b72c4671c3752acd5772bf2b63a3383551b2800e`

## 근거가 된 Android QA

동일한 대표 합성 원문을 사용한 NAVER 0.5B exact-source QA 결과:

- 요약: 원문 발췌 결과 통과
- 문장 다듬기: strict `output_blocked`
- 제목 제안: strict `output_blocked`
- 체크리스트 초안: strict `output_blocked`
- 모델 재로딩: 통과
- 무결성 검사: 통과

따라서 네 동작을 일관되게 성공하는 기능으로 보장할 수 없고, 현재
비공개 테스트 문안은 결과 품질과 성공률을 측정하는 best-effort 기능으로
설명해야 한다.

## 승인 문안의 정확한 변경 내용

### 한국어 전체 설명

> • 0.5B 모델은 기기 CPU에서만 실행되며 기존 텍스트의 요약, 문장 다듬기,
> 제목 제안, 체크리스트 초안을 best-effort 방식으로 시도합니다.
>
> • 모든 결과는 엄격한 정책·원문 근거 검증을 거치며, 통과하지 못하면 원문을
> 변경하지 않고 폐기되며 같은 동작을 다시 시도할 수 있습니다.
>
> • 비공개 테스트에서는 네 동작의 성공률과 기기별 결과 품질을 평가합니다.

기존 `지원합니다` 표현은 제거했다.

### 한국어 출시 노트

> • 0.5B 로컬 AI 결과는 best-effort이며, 엄격한 검증에 통과하지 못하면 원문
> 변경 없이 폐기되고 다시 시도할 수 있음을 명확히 했습니다.

### English full description

> • The 0.5B model runs only on the device CPU and makes best-effort attempts
> to summarize existing text, polish sentences, suggest titles, and draft
> checklists.
>
> • Every result must pass strict policy and source-grounding checks. If a
> result does not pass, the app discards it without changing the source and
> the user can retry the same action.
>
> • The closed test evaluates success rates for all four actions and result
> quality across devices.

기존 `supports summaries ...` 표현은 제거했다.

### English release notes

> • Clarified that 0.5B local-AI results are best-effort; results that fail
> strict checks are discarded without changing the source and can be retried.

## 비공개 테스트 운영 QA

`docs/private-test-operations.md`에는 현재 대표 원문 QA의 통과·차단 결과와
다음 운영 계약을 함께 기록했다.

- 0.5B 결과는 best-effort다.
- 모든 결과는 엄격한 정책·원문 근거 검증을 거친다.
- 실패 결과는 원문을 바꾸지 않고 폐기하며 같은 동작을 재시도할 수 있다.
- 요약·문장 다듬기·제목 제안·체크리스트 초안의 성공률과 Samsung/Pixel 등
  기기별 결과 품질을 기록한다.

## RED → GREEN 증거

Korean exact-copy gate에 보장형 표현의 복귀와 한계 문구 삭제를 차단하는
테스트를 먼저 추가했다.

```powershell
node --test --test-name-pattern "guaranteed 0.5B claims" scripts/check-non-medical-release.node-test.mjs
```

RED 결과:

- 1개 테스트 실패
- 새 0.5B best-effort 기준 문장이 승인 문안에 없어 baseline 계약 누락으로 실패

문안과 `EXPECTED_PLAY_STORE_KO_COPY`를 함께 갱신한 뒤 같은 명령은 1/1로
통과했다. 이 회귀 테스트는 다음 네 변경을 각각 실패시킨다.

- best-effort 시도 문장을 기존 `지원합니다` 문장으로 되돌림
- strict 정책·원문 근거 검증 및 원문 보존·재시도 문장 삭제
- 네 동작 성공률·기기별 품질 평가 문장 삭제
- 출시 노트의 best-effort 한계 문장 삭제

## Play 한국어 필드 길이와 불변식

`node scripts/check-non-medical-release.mjs` 결과:

| 필드/계약 | 변경 전 | 변경 후 | 제한/조건 |
|---|---:|---:|---:|
| 앱 이름 | 7자 | 7자 | 30자 이하 |
| 짧은 설명 | 50자 | 50자 | 80자 이하 |
| 전체 설명 | 1,394자 | 1,538자 | 4,000자 이하 |
| 출시 노트 | 160자 | 246자 | 500자 이하 |
| 필수 비의료 고지 문장 | 1회 | 1회 | 정확히 1회 |
| 고지 문장 밖 `건강\|의료` | 0건 | 0건 | 0건 |
| 전체 설명 `복약\|진단\|치료` | 0건 | 0건 | 0건 |
| 출시 노트 의료 관련 금지어 | 0건 | 0건 | 0건 |
| 한국어 네 섹션 제목 | 각각 1회 | 각각 1회 | 각각 정확히 1회 |

게이트는 124개 파일을 검사해 `pass`, 문제 0건을 반환했다. Data safety 표와
입력 기준은 수정하지 않았다.

## 전체 검증

최종 구현 상태에서 다음 명령을 실행했다.

```powershell
npm run verify
```

종료 코드 0으로 성공했다.

- Vitest: 31개 파일, 308개 테스트 통과
- 웹 production build 통과
- 모바일 TypeScript 검사 통과
- Expo Doctor: 18/18 통과
- static security 통과, 전용 테스트 24개 통과
- non-medical release 정책 통과, 통합 정책 게이트 테스트 200개 통과
- no-remote-push 검사 통과, 전용 테스트 35개 통과
- model registry 검사와 전용 테스트 10개 통과
- production audit 정책 테스트 6개 및 승인 기준선 통과
- release workflow 테스트 9개 및 실제 워크플로 검사 통과

`verify:no-remote-push`의 `releaseBinaryPair`는 `false`다. 이 Task는 문안과
소스 게이트의 정확성을 증명하며 최종 Android 바이너리 검사를 주장하지 않는다.

## 변경 금지 경계

- 앱 코드는 변경하지 않았다.
- `public/privacy-policy.html`은 변경하지 않았고 구현 전후 Git blob hash는
  `d2aee7fb43bd81914110df72044a512dc78b8df5`로 동일하다.
- 건강·의료 고지와 Data safety 입력값을 변경하지 않았다.
- Play Console, GitHub Pages, AAB를 변경·생성·업로드하지 않았다.

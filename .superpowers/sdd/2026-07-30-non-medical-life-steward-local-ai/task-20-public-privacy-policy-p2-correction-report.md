# Task 20 공개 개인정보처리방침 P2 정정 보고서

작성일: 2026-07-31
대상 브랜치: `codex/non-medical-local-ai-closed-test`

## 결론

Task 20 독립검토에서 공개 개인정보처리방침에 로컬 AI 결과의 실제 저장
수명주기가 빠진 P2를 확인했다. 공개 정책의 한국어와 영문 참고 번역에
`승인 전 기기 메모리 → 승인 후 현재 작업공간 반영 → 변경 사항 저장 동작에서만
로컬 영구 저장` 경계를 추가했다.

같은 검토에서 승인 상태문이 실제 UI에 없는 `전체 저장 버튼`을 안내하는
불일치도 발견했다. 상태문을 실제 버튼 라벨인 `변경 사항 저장 버튼`으로
정정하고 exact 테스트를 추가했다.

구현 커밋:

- `315f8372c189b9e52a7ab934bfd0bb99c795ee5d`
- 구현 tree: `0d26cc619f8a6f5939a42a220f81eb1d6b05cae7`

## 최종 공개 계약

한국어:

> 로컬 AI 결과는 사용자 승인 전까지 기기 메모리에만 유지되며 작업공간에
> 저장되지 않습니다. 승인 후 현재 작업공간에 반영되고, 변경 사항 저장 버튼을
> 누른 경우에만 로컬 저장소에 영구 저장됩니다.

영문 참고 번역:

> Local AI results remain only in device memory and are not saved to the
> workspace before user approval. After approval, a result is applied to the
> current workspace and is persisted to local storage only when the user
> selects the Save changes action.

두 문장은 `public/privacy-policy.html`에 각각 정확히 한 번 존재해야 한다.
`POLICY_LINE_CONTRACTS`가 누락과 중복을 모두 차단한다.

## 3면 정합성

- 공개 정책은 승인 전 메모리 보존, 승인 후 현재 작업공간 반영, 실제
  `변경 사항 저장` 동작에서만 영구 저장되는 전체 수명주기를 설명한다.
- 모바일 설정 UI는 AI 결과가 사용자 승인 후에만 작업공간에 저장된다는
  조건과 실제 `변경 사항 저장` 버튼을 노출한다.
- Play Store 한국어·영문 문안은 사용자 승인 전에는 결과를 작업공간에
  저장하지 않는다는 조건을 유지한다.
- `useLocalAssistant` 승인 상태문은
  `승인한 초안을 작업공간에 반영했습니다. 변경 사항 저장 버튼으로 확정할 수 있습니다.`
  로 실제 UI 라벨과 일치한다.

## RED → GREEN 증거

### 최초 누락 재현

공개 정책과 정책 검사기 테스트를 먼저 추가했다.

```powershell
npm test -- --run src/test/privacyPolicy.test.ts
node --test --test-name-pattern "approval-only AI result retention" scripts/check-non-medical-release.node-test.mjs
```

RED 결과:

- Vitest: 신규 정합성 테스트 1개 실패, 기존 4개 통과
- 공개 정책의 한국어 계약 발생 횟수: 기대 1, 실제 0
- 정책 mutation 테스트: 필수 한국어 기준 문장 누락으로 1개 실패

독립검토가 전체 수명주기와 실제 버튼 라벨을 추가로 확정한 뒤 최종 기대값으로
테스트를 먼저 교체했다.

```powershell
npm test -- --run src/test/privacyPolicy.test.ts apps/mobile/src/local-ai/useLocalAssistant.test.ts
node --test --test-name-pattern "approval-only AI result retention" scripts/check-non-medical-release.node-test.mjs
```

최종 RED 결과:

- Vitest: 2개 파일, 23개 중 2개 실패·21개 통과
- 공개 정책에 장문 수명주기 계약이 없어 발생 횟수 0
- 승인 상태문의 실제값은 `전체 저장 버튼`, 기대값은 `변경 사항 저장 버튼`
- 정책 mutation 테스트는 장문 한국어 기준 문장 누락으로 1개 실패

### GREEN

공개 KO/EN 문장, exact 단일 발생 정책 계약, 상태문을 구현한 뒤 다음 집중
범위를 실행했다.

```powershell
npm test -- --run src/test/privacyPolicy.test.ts apps/mobile/src/legal/privacyDisclosureUi.test.ts apps/mobile/src/local-ai/useLocalAssistant.test.ts
node --test --test-name-pattern "approval-only AI result retention|public privacy scope" scripts/check-non-medical-release.node-test.mjs
```

GREEN 결과:

- Vitest: 3개 파일, 25개 테스트 통과
- 정책 mutation: 필수 공개 범위와 수명주기 제거·중복 테스트 2개 통과

## Play Store 한국어 필드 불변식

공개 정책과 앱 상태문만 정정했으므로 승인 Play 문안의 길이는 Task 20 구현
상태와 동일하다.

| 필드/계약 | 정정 전 | 정정 후 | 제한/조건 |
|---|---:|---:|---:|
| 앱 이름 | 7자 | 7자 | 30자 이하 |
| 짧은 설명 | 50자 | 50자 | 80자 이하 |
| 전체 설명 | 1,394자 | 1,394자 | 4,000자 이하 |
| 출시 노트 | 160자 | 160자 | 500자 이하 |
| 필수 비의료 고지 문장 | 1회 | 1회 | 정확히 1회 |
| 고지 문장 밖 `건강\|의료` | 0건 | 0건 | 0건 |
| 전체 설명 `복약\|진단\|치료` | 0건 | 0건 | 0건 |
| 출시 노트 의료 관련 금지어 | 0건 | 0건 | 0건 |
| 한국어 네 섹션 제목 | 각각 1회 | 각각 1회 | 각각 정확히 1회 |

`node scripts/check-non-medical-release.mjs`는 124개 파일을 검사해 `pass`,
문제 0건을 반환했다.

## 전체 검증

최종 diff에서 다음 명령을 다시 실행했다.

```powershell
npm run verify
```

종료 코드 0으로 성공했다.

- Vitest: 31개 파일, 303개 테스트 통과
- 웹 production build 통과
- 모바일 TypeScript 검사 통과
- Expo Doctor: 18/18 통과
- static security 통과, 전용 테스트 24개 통과
- non-medical release 정책 통과, 통합 정책 게이트 테스트 199개 통과
- no-remote-push 검사 통과, 전용 테스트 35개 통과
- model registry 검사 및 설치 가능 모델 2개 확인, 전용 테스트 10개 통과
- production audit 정책 테스트 6개 및 승인 기준선 통과
- release workflow 테스트 9개 및 실제 워크플로 검사 통과

`verify:no-remote-push`의 `releaseBinaryPair`는 `false`다. 이 정정은
소스·정책·문안 게이트를 증명하며 최종 AAB/universal APK 검사를 주장하지
않는다.

## 운영 경계

이 정정에서는 GitHub Pages 배포, Play Console 변경, AAB 생성·업로드를 하지
않았다. 검증된 동일 커밋에서 새 정책을 배포하고 실제 공개 URL의 내용과 HTTP
200을 재확인하기 전까지 공개 정책 P0는 운영상 남아 있다.

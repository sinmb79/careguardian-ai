# Task 12 개인정보 고지·외부 링크·한국어 UI 검증 보고서

- 상태: `DONE`
- 구현 커밋: `e05b6614faffe65df8148a26a237303669c45e90`

## TDD 증빙

### RED

새 외부 링크 허용 목록과 한국어 입력 오류·화면 고지 계약 테스트를 먼저 추가한 뒤 다음을 실행했습니다.

```powershell
npm test -- --run apps/mobile/src/legal/externalLinks.test.ts apps/mobile/src/legal/privacyDisclosureUi.test.ts apps/mobile/src/ui/workspaceEntry.test.ts
```

결과는 종료 코드 `1`이었습니다. `externalLinks.ts`가 아직 없어 import 해석에 실패했고, 기존 영문 입력 오류와 영어 폼 문구·개인정보 고지 누락 때문에 계약 테스트가 실패했습니다.

### GREEN

```powershell
npm test -- --run apps/mobile/src/legal/externalLinks.test.ts apps/mobile/src/legal/privacyDisclosureUi.test.ts apps/mobile/src/ui/workspaceEntry.test.ts
```

결과: 종료 코드 `0`, 3개 테스트 파일·18개 테스트 통과.

```powershell
npm test -- --run
```

결과: 종료 코드 `0`, 30개 테스트 파일·280개 테스트 통과.

```powershell
npm run mobile:typecheck
git diff --check
```

결과: 모두 종료 코드 `0`.

## 구현 확인

- 앱이 소유한 정확한 두 HTTPS URL만 허용 목록으로 열며, HTTP·유사 도메인·쿼리/경로 변조는 typed `blocked` 결과로 차단합니다. 플랫폼 링크 열기 실패도 typed `open-failed` 결과로 호출자가 한국어 안내를 표시합니다.
- 설정 화면에는 오프라인 저장 경계, 선택형 Hugging Face 모델 설치 연결, 고정 개인정보처리방침 버튼과 실패 후에도 남는 안내를 추가했습니다.
- 설치 동의 체크박스 바로 앞에 Hugging Face 수신자·자동 기록 가능 정보·목적·국외 처리/보존·문의처·프롬프트/결과 비전송·선택권을 고지하고, 고정 Hugging Face 개인정보처리방침 버튼을 추가했습니다. 기존 체크 전 설치 비활성화 조건은 유지했습니다.
- 새 작업/새 개인 목록의 라벨, 자리표시자, 접근성 라벨, 버튼 및 검증 오류를 한국어로 바꿨습니다.
- 비의료 차단, 모델 레지스트리/무결성 검증, 다운로드 동의 상태, 전체 삭제 로직은 변경하지 않았습니다.

## 범위와 남은 위험

- Task 11의 플러그인·Android 검증 스크립트 변경 및 Task 13의 `public/privacy-policy.html` 변경은 이 작업에 포함하거나 stage/commit하지 않았습니다.
- React Native 실제 단말에서 브라우저가 개인정보처리방침 URL을 열 수 있는지는 Android/Play 폐쇄 테스트에서 별도 확인이 필요합니다. 실패 시에도 앱은 종료되지 않고 화면 내 한국어 안내와 오프라인 고지를 유지합니다.

# Task 12 — 앱 내 개인정보 고지·외부 링크·한국어 UI

## 목표

비의료 생활후견 AI의 실제 Android 화면 안에서 개인정보처리방침과 선택형 Hugging Face 모델 다운로드의 데이터 경계를 명확히 알리고, 남아 있는 영문 사용자 문구를 한국어로 정리한다.

## 허용 파일

- `apps/mobile/src/ui/LifeWorkspaceScreen.tsx`
- `apps/mobile/src/ui/LocalAiScreen.tsx`
- `apps/mobile/src/ui/workspaceEntry.ts`
- `apps/mobile/src/ui/workspaceEntry.test.ts`
- 필요 시 `apps/mobile/src/legal/` 아래의 새 고정 링크 모듈과 테스트
- 이 작업의 SDD 보고서

Task 11과 충돌을 피하기 위해 플러그인, `app.json`, Android 매니페스트, `scripts/check-non-medical-release*`, 루트 문서는 수정하지 않는다.

## 필수 동작

1. 설정 화면에 다음을 모두 제공한다.
   - `개인정보처리방침` 제목
   - 로그인·광고·분석 SDK·클라우드 AI가 없고, 작업·목록·사용자 기능·프롬프트·결과가 기기 안에 저장된다는 짧은 오프라인 본문
   - 모델 설치를 사용자가 선택한 경우에만 Hugging Face에 네트워크 요청이 발생한다는 본문
   - 고정 공개 URL `https://sinmb79.github.io/careguardian-ai/privacy-policy.html`을 여는 버튼
   - 링크 열기 실패 시 앱이 종료되거나 무시되지 않고, 오프라인 본문은 계속 보이며 한국어 오류 안내를 표시

2. 외부 링크는 사용자 입력을 절대 받지 않는 정확한 HTTPS 허용 목록으로 제한한다.
   - 위 개인정보처리방침 URL
   - `https://huggingface.co/privacy`
   - 임의 호스트, HTTP, 유사 도메인, 경로 변조는 열지 않는다.
   - 실패를 호출자가 처리할 수 있는 typed 결과 또는 typed 오류를 사용한다.

3. 로컬 AI 모델 설치 체크박스 바로 앞 또는 체크박스 본문에 다음을 눈에 띄게 고지한다.
   - 수신자: Hugging Face
   - 전송/자동 기록 가능 정보: IP 주소, IP 기반 대략적 위치, 기기·운영체제·브라우저/네트워크 정보, 선택한 모델 요청 경로와 서비스 이용 기록
   - 목적: 파일 제공, 서비스 운영·개선·분석, 보안 및 법적 의무
   - 처리 지역·보존: 미국 등 다른 국가에서 처리될 수 있고 필요한 기간 보존
   - 권리/문의: Hugging Face 정책과 `privacy@huggingface.co`
   - 프롬프트·AI 결과·생활 작업 내용은 Hugging Face에 보내지지 않음
   - 설치는 선택 사항이며 거부해도 일반 생활 기능은 사용 가능
   - Hugging Face 개인정보처리방침 고정 링크 버튼
   - 사용자가 명시적으로 체크하기 전에는 설치 불가

4. 현재 영문으로 남은 새 작업/새 목록 폼의 라벨, 자리표시자, 접근성 라벨, 버튼, 검증 오류를 자연스러운 한국어로 변경한다.

5. 기존 비의료 차단 규칙, 모델 무결성 검증, 다운로드 동의 상태, 전체 삭제 동작은 약화하지 않는다.

## TDD 및 검증

먼저 실패 테스트를 작성하고 RED를 확인한 뒤 구현한다.

- 외부 링크 정확 허용 목록의 허용/차단/열기 실패 테스트
- 설정 화면과 모델 동의 고지의 필수 문자열을 확인하는 소스 계약 또는 렌더링 가능한 테스트
- 작업/목록 입력 검증의 한국어 오류 테스트
- `npm test -- --run`
- `npm run mobile:typecheck`
- `git diff --check`

완료 후 구현 커밋과 별도 검증 보고서 커밋을 만든다.

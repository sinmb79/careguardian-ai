# Task 7 구현 보고서 — Android 온디바이스 한국어 AI

- 작업 브랜치: `codex/non-medical-local-ai-closed-test`
- 기준 커밋: `110f783`
- 구현일: 2026-07-30
- 범위: `llama.rn` CPU 전용 런타임, 모델 재검증, 제한형 문서 정리 UI, 안전한 수명주기 및 승인 흐름

## 완료 사항

### 네이티브 런타임과 공급망 경계

- `llama.rn`을 `0.12.8`로 정확히 고정하고 lockfile에도 같은 버전을 기록했다.
- Expo config plugin에서 `enableOpenCLAndHexagon`, deprecated `enableOpenCL`, entitlement를 명시적으로 비활성화했다.
- 런타임 초기화는 `n_gpu_layers: 0`, `no_gpu_devices: true`, 빈 `devices`, `n_parallel: 1`, `use_mlock: false`로 고정했다.
- `llama.rn`의 Adreno/Hexagon 자동 JNI 선택이 JS 옵션과 독립적임을 검토한 뒤, 별도 Expo config plugin에서 `*hexagon*`, `*_opencl*`, `libOpenCL`, `cdsprpc`, HTP JNI를 패키징 제외하고 HTP asset sync를 비활성화했다.
- 생성 Gradle과 최종 AAB 파일 목록을 fail-closed 검사하는 `apps/mobile/scripts/verify-cpu-only-llama.mjs`를 추가했다. 최종 archive 검사는 Task 10에서 반드시 실행한다.
- Android `arm64-v8a` 또는 `x86_64`가 확인되지 않으면 모델 설치와 실행을 차단한다.
- `expo-device`를 통해 production ABI를 확인하며, Expo Go가 아닌 development/production native build만 지원한다고 UI에 표시한다.
- `expo-device.totalMemory`가 없거나 모델별 최소 4GB/6GB보다 작으면 설치와 로드를 모두 차단한다.
- npm 설치 결과에 `arm64-v8a`와 `x86_64`용 `llama.rn` JNI 자산 및 `.llama-rn.sha256` 표지가 존재함을 확인했다.

### 설치 모델 재검증

- 앱 시작 시 고정 레지스트리의 완성 파일만 탐색한다.
- 각 파일을 모델 로드 직전에 앱 전용 경로, 리비전, 바이트 크기, SHA-256으로 다시 검증한다.
- 손상·누락·경로 변조·레지스트리 불일치 파일은 native context에 전달하지 않는다.
- 모델 설치·검사·삭제는 기존 Task 6 직렬화 경계 안에서 수행한다.

### 단일 컨텍스트와 수명주기

- 한 번에 하나의 모델 컨텍스트와 하나의 generation만 허용한다.
- 사용자 취소, 화면 unmount, Android `AppState.blur`, background/lock, 모델 삭제, 전체 데이터 삭제에서 동일한 stop/release 진입점을 사용한다.
- generation 중에는 `stopCompletion()` 요청, completion Promise settle 대기, `release()` 순서를 보장한다.
- 스트리밍 출력 정책 차단에서도 stop Promise 완료 전에 context를 해제하지 않도록 보강했다.
- native completion 호출이 동기 예외를 던져도 런타임이 `ready` 상태로 복구되어 이후 명시 해제가 가능하다.
- native stop의 동기 throw와 비동기 reject를 Promise 경계 안에 격리하고, completion resolve/reject 조합 모두 제한 결과를 `output_blocked`로 유지한 채 context를 해제한다.
- native release 실패 또는 중단된 load context 해제 실패는 terminal `faulted`로 승격한다. 이 상태에서는 프로세스를 재시작하기 전 어떤 새 context도 로드할 수 없다.

### 정책과 메모리 전용 승인 흐름

- 자유 대화 대신 `요약`, `문장 다듬기`, `제목 제안`, `체크리스트 초안` 네 가지 동작만 제공한다.
- Unicode NFKC 뒤 `Cf`, bidi/default-ignorable 문자를 제거하고, 한국어·영문 의약품명·투여·질환·credential stuffing·prompt injection 적대 corpus를 입력과 출력 양쪽에서 차단한다.
- 정식 llama chat `messages` API로 system과 untrusted user document를 역할 분리하고, user document를 JSON data-only envelope로 직렬화해 제어 구획을 닫을 수 없게 했다.
- denylist 통과만으로 결과를 승인하지 않는다. 제목은 40자·한 줄·원문 근거, 체크리스트는 `- ` 행 형식·각 항목 원문 근거, 요약·다듬기는 길이와 원문 token grounding을 추가로 검증한다.
- native token은 전량 메모리 버퍼에만 두며, 전체 결과가 정책과 동작별 validator를 모두 통과한 뒤 UI callback을 정확히 한 번 호출한다.
- 프롬프트와 최종 결과는 승인 전 React 메모리에만 유지한다.
- 사용자가 미리보기를 명시적으로 승인한 뒤에만 작업공간 draft 레코드로 반영하며, 디스크 확정은 기존 `변경 사항 저장`을 다시 눌러야 한다.
- 취소·폐기·문제 표시·background·blur·unmount 시 입력과 미리보기를 비우고 외부 신고나 전송을 수행하지 않는다.

### 실제 제품 UI 연결

- 기존 모바일 `로컬 AI` 탭에 모델 목록과 상태를 production 연결했다.
- 모델별 오프라인 라이선스·NOTICE·금지 사용 정책 보기, 외부 다운로드 동의, 다운로드, 일시정지, 이어받기, 취소, SHA-256 검증, 로드, 삭제를 제공한다.
- 생성 중 action·모델 상세·설치·삭제로 이동하는 버튼을 비활성화하고 생성 취소 버튼을 유지한다. 탭 이탈은 context stop/release로 처리한다.
- 화면 unmount 시 active 대용량 다운로드를 취소하고 terminal settle을 기다린다. 재진입 검사도 먼저 orphan download 취소를 완료하며, mounted guard가 모든 늦은 진행·검사 callback의 React state 갱신을 막는다.
- NAVER 화면에 `Powered by HyperCLOVA X`를 지속 표시한다.
- Kakao 모델은 승인된 GGUF가 없으므로 다운로드 버튼 없이 `검증 준비 중`으로만 표시한다.
- 전체 데이터 삭제는 active inference 중지 후 알림, 모델·부분 파일, workspace와 SecureStore 키를 순서대로 제거하고 메모리를 마지막에 초기화한다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| Task 7 승인 차단 집중 테스트 | 4 files, 37 tests PASS |
| 전체 Vitest | 20 files, 182 tests PASS |
| 웹 production build | PASS |
| 모바일 TypeScript | PASS |
| Expo Doctor | 18/18 PASS |
| Expo modules Android autolinking verify | PASS |
| Expo public config resolution | PASS |
| `git diff --check` 및 staged diff check | PASS |

추가된 회귀 테스트는 의료·위해·Unicode·prompt injection corpus, 역할 분리, action별 결과 grounding, 최종 1회 공개, sync/async stop 오류와 completion resolve/reject 조합, release terminal fault, load-interrupt release 실패, 모델별 RAM, unmount download 취소·late update 차단, CPU-only Gradle plugin을 포함한다.

## 독립 검토 승인 조건 대응

| 조건 | 대응 |
| --- | --- |
| 1. 정책 우회·동작별 validator | Unicode 정규화, 적대 corpus, message 역할 분리, data-only 직렬화, action별 shape·grounding으로 대응 |
| 2. CPU-only native 근거 | JS CPU 옵션 + Gradle JNI/asset 배제 plugin + Task 10 archive 검사 스크립트로 대응 |
| 3. release 불확실 재진입 금지 | terminal `faulted` 및 이후 `runtime_faulted`로 대응 |
| 4. active download와 unmount | unmount cancel/settle, remount orphan cancel, mounted callback guard로 대응 |
| 5. 모델별 RAM gate | `Device.totalMemory` 기반 install/load hard gate로 대응 |
| 6. streaming·stop 오류 fail-closed | 최종 buffer 1회 공개와 stop throw/reject 조합 테스트로 대응 |
| 7. 통합 검증·native gate | 정적/JS 검증 통과, 실제 prebuild·기기·AAB는 아래 Task 10 gate로 명시 보류 |

## 이번 Task에서 실행하지 않은 native 게이트

아래는 Task 10의 검증 범위이므로 이번 커밋에서는 실행하지 않았다.

- `expo prebuild --clean`
- Android Gradle assemble/bundle
- x86_64 emulator dev-client smoke
- arm64 실기기 모델 다운로드·생성·중단 smoke
- production EAS AAB와 bundletool 분석
- `npm --workspace apps/mobile run verify:cpu-only -- --archive-list <bundletool-list.txt>`

따라서 TypeScript·Expo 구성·autolinking과 config-plugin 단위 검증은 통과했지만, 실제 생성 Gradle·JNI 로딩 결과·AAB 내 금지 library 0개·peak RSS·R8/패키징·실기기 추론은 아직 Task 10 native gate 전이다. 이 native 증거 전에는 CPU-only 최종 승인을 완료로 간주하지 않는다. 모델 weight와 Google Play Console은 변경하지 않았다.

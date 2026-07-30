# Task 7 구현 보고서 — Android 온디바이스 한국어 AI

- 작업 브랜치: `codex/non-medical-local-ai-closed-test`
- 보완 기준 커밋: `f624027`
- 구현일: 2026-07-30
- 범위: `llama.rn` CPU 전용 런타임, 앱 소유 소스만 사용하는 추출형 문서 도구, 실제 AAB 구조 검증, 안전한 수명주기 및 승인 흐름

## 완료 사항

### 네이티브 런타임과 공급망 경계

- `llama.rn`을 `0.12.8`로 정확히 고정하고 lockfile에도 같은 버전을 기록했다.
- Expo config plugin에서 `enableOpenCLAndHexagon`, deprecated `enableOpenCL`, entitlement를 명시적으로 비활성화했다.
- 런타임 초기화는 `n_gpu_layers: 0`, `no_gpu_devices: true`, 빈 `devices`, `n_parallel: 1`, `use_mlock: false`로 고정했다.
- `llama.rn`의 Adreno/Hexagon 자동 JNI 선택이 JS 옵션과 독립적임을 검토한 뒤, 별도 Expo config plugin에서 `*hexagon*`, `*_opencl*`, `libOpenCL`, `cdsprpc`, HTP JNI를 패키징 제외하고 HTP asset sync를 비활성화했다.
- `apps/mobile/scripts/verify-cpu-only-llama.mjs`는 production `--aab`, 실제 `android/app/build.gradle`, `--evidence` 세 경로를 모두 필수로 받는다. 임의 `archive-list`, `package.json`, 가짜·빈 ZIP, 빈 필수 항목은 통과할 수 없다.
- AAB ZIP local header·central directory·EOCD를 직접 읽고 필수 payload의 실제 크기·CRC를 확인한다. `base/manifest/AndroidManifest.xml`, arm64-v8a `librnllama_jni.so` 계열과 x86_64 `librnllama_jni_x86_64.so` 계열이 각각 비어 있지 않아야 하며 Hexagon·HTP·OpenCL·CDSPRPC·GPU·Vulkan 항목은 0개여야 한다.
- 검증 성공 시 AAB와 생성 Gradle의 SHA-256, 크기, 전체 archive entry와 ABI별 CPU JNI를 JSON 증거로 기록한다. 증거 경로가 AAB나 Gradle 파일을 덮어쓰는 것도 차단한다. 실제 production AAB 검사는 Task 10에서 반드시 실행한다.
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
- native release 실패 또는 중단된 load context 해제 실패는 terminal `faulted`로 승격한다. 진행 중 load가 자체 context 해제에 실패한 경우 load Promise뿐 아니라 동시에 기다리던 stop/release Promise도 `release_failed`를 반환한다. 이 상태에서는 프로세스를 재시작하기 전 어떤 새 context도 로드할 수 없다.
- 컨트롤러는 민감한 선택·미리보기를 먼저 지우되 native release가 성공한 뒤에만 “비웠습니다”를 게시한다. 실패하면 성공 문구 대신 앱 완전 종료·재시작 안내를 게시하며 사용자 취소, 출력 정책 폐기, 모델 삭제, 전체 데이터 삭제가 같은 계약을 사용한다.

### 정책과 메모리 전용 승인 흐름

- 자유 입력창과 자유 대화를 제거했다. 현재 `PersonalWorkspace`의 할 일, 목록, 사용자 기능 레코드에서만 소스를 선택하며 런타임 요청은 `{ action, source: { kind, id, text } }` 형식만 허용한다.
- 실행 직전에 선택된 `{kind,id,text}`를 최신 작업공간에서 다시 생성해 완전히 일치할 때만 native runtime에 전달한다. 저장된 레코드 안에 의료 요청이나 프롬프트 제어 문구가 있더라도 동일한 AI 경계에서 차단한다.
- Unicode NFKC 기반 위해 탐지는 `Cf`, bidi/default-ignorable 문자를 제거하고, 게보린·metformin·Tylenol뿐 아니라 `2알 먹어`, `몇 cc 맞아`, `take 500mg`, `administer 10 units` 같은 숫자·단위·복용/투여 방향 우회와 `Forget everything`, `### System`, `<system>`, role header 변형을 입력과 출력 양쪽에서 차단한다.
- 정식 llama chat `messages` API로 system과 untrusted user source를 역할 분리하고, 앱 소유 source envelope만 JSON data로 직렬화해 제어 구획을 닫을 수 없게 했다.
- denylist나 비율형 token grounding은 승인 근거로 사용하지 않는다. 요약은 원문의 정확한 연속 구절, 제목은 원문의 정확한 40자 이하 연속 구절, 문장 다듬기는 공백·문장부호를 제외한 모든 원 코드포인트와 숫자 순서의 완전 일치, 체크리스트는 원문 순서의 중복 없는 비중첩 연속 구절만 허용한다. 단일 문자·숫자·공백 분할·중복·재조합의 허용치는 0이다.
- native token은 전량 메모리 버퍼에만 두며, 전체 결과가 정책과 동작별 validator를 모두 통과한 뒤 UI callback을 정확히 한 번 호출한다.
- 프롬프트와 최종 결과는 승인 전 React 메모리에만 유지한다.
- 사용자가 미리보기를 명시적으로 승인한 뒤에만 작업공간 draft 레코드로 반영하며, 디스크 확정은 기존 `변경 사항 저장`을 다시 눌러야 한다.
- 취소·폐기·문제 표시·background·blur·unmount 시 입력과 미리보기를 비우고 외부 신고나 전송을 수행하지 않는다.

### 실제 제품 UI 연결

- 기존 모바일 `로컬 AI` 탭에 모델 목록과 상태를 production 연결했다.
- 모델별 오프라인 라이선스·NOTICE·금지 사용 정책 보기, 외부 다운로드 동의, 다운로드, 일시정지, 이어받기, 취소, SHA-256 검증, 로드, 삭제를 제공한다.
- 생성 중 action·모델 상세·설치·삭제로 이동하는 버튼을 비활성화하고 생성 취소 버튼을 유지한다. 탭 이탈은 context stop/release로 처리한다.
- 화면 unmount 시 active 다운로드를 취소하고 paused resume token이 남은 경우에도 partial 파일을 삭제한다. 재진입 검사는 먼저 active/paused orphan 정리를 완료하며, lifecycle epoch가 unmount 이전 callback의 remount 후 React state 반영을 차단한다.
- NAVER 화면에 `Powered by HyperCLOVA X`를 지속 표시한다.
- Kakao 모델은 승인된 GGUF가 없으므로 다운로드 버튼 없이 `검증 준비 중`으로만 표시한다.
- 전체 데이터 삭제는 active inference 중지 후 알림, 모델·부분 파일, workspace와 SecureStore 키를 순서대로 제거하고 메모리를 마지막에 초기화한다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| Task 7 승인 차단 집중 테스트 | 앱 소유 source, 정책, runtime, lifecycle, model store, 전체 삭제, CPU AAB verifier PASS |
| 전체 Vitest | 22 files, 225 tests PASS |
| 웹 production build | PASS |
| 모바일 TypeScript | PASS |
| Expo Doctor | 18/18 PASS |
| Expo modules Android autolinking verify | PASS |
| Expo public config resolution | PASS |
| `git diff --check` 및 staged diff check | PASS |

추가된 회귀 테스트는 앱 소유 source의 canonical 재해석, 의료·위해·Unicode·prompt injection corpus, 원 코드포인트 추출 계약, 최종 1회 공개, sync/async stop 오류와 completion resolve/reject 조합, release terminal fault 전파, 모델별 RAM, active/paused partial 정리와 remount epoch, 실제 ZIP payload·ABI·CRC·SHA-256 CPU-only AAB 검증을 포함한다.

## 독립 검토 승인 조건 대응

| 조건 | 대응 |
| --- | --- |
| 1. 정책 우회·동작별 validator | 앱 소유 source 선택·실행 직전 재해석, 적대 corpus, typed data envelope, 0-허용 extractive contract로 대응 |
| 2. CPU-only native 근거 | JS CPU 옵션 + Gradle JNI/asset 배제 + production AAB 직접 ZIP/payload/ABI/SHA 검사로 대응 |
| 3. release 불확실 재진입 금지 | 성공 게시 지연, terminal `faulted`, pending-load stop 전파 및 이후 `runtime_faulted`로 대응 |
| 4. active/paused download와 unmount | unmount cancel/settle, paused partial 삭제, remount lifecycle epoch로 대응 |
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
- `node apps/mobile/scripts/verify-cpu-only-llama.mjs --aab <production.aab> --gradle apps/mobile/android/app/build.gradle --evidence <json>`
- 실제 0.5B 모델 대상으로 의료·prompt injection·추출 계약 red-team corpus 실행

따라서 TypeScript·Expo 구성·autolinking과 config-plugin 단위 검증은 통과했지만, 실제 생성 Gradle·JNI 로딩 결과·AAB 내 금지 library 0개·peak RSS·R8/패키징·실기기 추론은 아직 Task 10 native gate 전이다. 이 native 증거 전에는 CPU-only 최종 승인을 완료로 간주하지 않는다. 모델 weight와 Google Play Console은 변경하지 않았다.

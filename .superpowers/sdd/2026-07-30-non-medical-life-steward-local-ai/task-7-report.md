# Task 7 구현 보고서 — Android 온디바이스 한국어 AI

- 작업 브랜치: `codex/non-medical-local-ai-closed-test`
- 기준 커밋: `110f783`
- 구현일: 2026-07-30
- 범위: `llama.rn` CPU 전용 런타임, 모델 재검증, 제한형 문서 정리 UI, 안전한 수명주기 및 승인 흐름

## 완료 사항

### 네이티브 런타임과 공급망 경계

- `llama.rn`을 `0.12.8`로 정확히 고정하고 lockfile에도 같은 버전을 기록했다.
- Expo config plugin에서 `enableOpenCLAndHexagon`, deprecated `enableOpenCL`, entitlement를 명시적으로 비활성화했다.
- 런타임 초기화는 `n_gpu_layers: 0`, `n_parallel: 1`, `use_mlock: false`로 고정했다.
- Android `arm64-v8a` 또는 `x86_64`가 확인되지 않으면 모델 설치와 실행을 차단한다.
- `expo-device`를 통해 production ABI를 확인하며, Expo Go가 아닌 development/production native build만 지원한다고 UI에 표시한다.
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

### 정책과 메모리 전용 승인 흐름

- 자유 대화 대신 `요약`, `문장 다듬기`, `제목 제안`, `체크리스트 초안` 네 가지 동작만 제공한다.
- 건강·약물·증상·진단·치료·응급 요청과 위해·착취·사기·괴롭힘·악성 코드·불법행위 요청·출력을 입력과 스트리밍 출력 양쪽에서 차단한다.
- 프롬프트, 스트리밍 결과, 최종 결과는 승인 전 React 메모리에만 유지한다.
- 사용자가 미리보기를 명시적으로 승인한 뒤에만 작업공간 draft 레코드로 반영하며, 디스크 확정은 기존 `변경 사항 저장`을 다시 눌러야 한다.
- 취소·폐기·문제 표시·background·blur·unmount 시 입력과 미리보기를 비우고 외부 신고나 전송을 수행하지 않는다.

### 실제 제품 UI 연결

- 기존 모바일 `로컬 AI` 탭에 모델 목록과 상태를 production 연결했다.
- 모델별 오프라인 라이선스·NOTICE·금지 사용 정책 보기, 외부 다운로드 동의, 다운로드, 일시정지, 이어받기, 취소, SHA-256 검증, 로드, 삭제를 제공한다.
- NAVER 화면에 `Powered by HyperCLOVA X`를 지속 표시한다.
- Kakao 모델은 승인된 GGUF가 없으므로 다운로드 버튼 없이 `검증 준비 중`으로만 표시한다.
- 전체 데이터 삭제는 active inference 중지 후 알림, 모델·부분 파일, workspace와 SecureStore 키를 순서대로 제거하고 메모리를 마지막에 초기화한다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| Task 7 집중 테스트 | 5 files, 40 tests PASS |
| 전체 Vitest | 19 files, 169 tests PASS |
| 웹 production build | PASS |
| 모바일 TypeScript | PASS |
| Expo Doctor | 18/18 PASS |
| Expo modules Android autolinking verify | PASS |
| Expo public config resolution | PASS |
| `git diff --check` 및 staged diff check | PASS |

추가된 수명주기 회귀 테스트는 제한 출력 stop 완료 전 release 금지, 동기 native completion 예외 복구, background/blur/unmount 정리, 모델 삭제 전 stop/release, 전체 삭제 전 inference 중지를 포함한다.

## 이번 Task에서 실행하지 않은 native 게이트

아래는 Task 10의 검증 범위이므로 이번 커밋에서는 실행하지 않았다.

- `expo prebuild --clean`
- Android Gradle assemble/bundle
- x86_64 emulator dev-client smoke
- arm64 실기기 모델 다운로드·생성·중단 smoke
- production EAS AAB와 bundletool 분석

따라서 TypeScript·Expo 구성·autolinking은 통과했지만, 실제 JNI 로딩·메모리 사용량·R8/패키징·실기기 추론은 아직 Task 10 native gate 전이다. 모델 weight와 Google Play Console은 변경하지 않았다.

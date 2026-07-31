# Task 10 Native Fix 독립 검토

- 검토 대상: `codex/task10-native-fix` / `1bf1045f8a9331857cba9978781abcf0d431e2d4`
- 검토 방식: 구현 파일 미수정, Node `v22.23.2` portable PATH로 독립 재현
- 판정: **PASS — Critical 0 / Important 0 / Minor 0**

## 1. `ModelIntegrityModule.kt` 무결성·원자성·취소 의미

`syncDirectory`는 대상이 실제 디렉터리임을 먼저 `require(directory.isDirectory)`로 확인한 뒤 `Os.open(path, O_RDONLY, 0)`으로 FD를 열고, `Os.fsync` 후 항상 `Os.close`합니다. SDK 36에서 불필요하거나 이식성 문제를 만들 수 있는 `O_DIRECTORY` 비트를 제거한 변경이며, 디렉터리가 아닌 대상은 fsync 전에 거부합니다.

모델 교체의 같은 파일시스템 `rename`·백업·검증·디렉터리 fsync 순서는 유지됩니다. `Coroutine` import는 Expo `AsyncFunction` 본문을 `withContext(Dispatchers.IO)`에서 실행하기 위한 것이며, 새 병렬 쓰기나 취소 시 중간 상태를 노출하는 경로를 추가하지 않습니다. SDK 36 `:model-integrity:compileDebugKotlin`을 실제 통과했습니다.

## 2. Mobile React root 플러그인과 clean prebuild

`with-mobile-react-root`는 Groovy `app/build.gradle`의 전용 마커와 네 필수 설정을 함께 검사합니다.

- `root = file(projectRoot)`
- `entryFile = file(new File(projectRoot, "index.ts"))`
- `bundleConfig = file(new File(projectRoot, "metro.config.js"))`
- `EXPO_NO_METRO_WORKSPACE_ROOT='1'`를 설정하는 Node 실행 인자

마커가 완전하면 재삽입하지 않고, 마커가 불완전하거나 Expo 템플릿 위치를 찾지 못하면 명시적으로 실패합니다. `mobileReactRootPlugin.test.ts`의 중복 적용·불완전 마커·Gradle 계약 검사를 포함해 관련 테스트 46개가 통과했습니다. clean prebuild 후 실제 `:app:createBundleReleaseJsAndAssets`가 `index.ts (777 modules)`를 번들링해 생성 Gradle 계약도 확인했습니다.

## 3. Git-ignored Android 원본 보존과 중단 위험

`verify-native-android-contracts` 정상 경로를 `all`로 재현했습니다. 실행 전후 Android 원본의 모든 파일을 상대 경로·길이·SHA-256으로 비교했고 완전히 일치했으며 `.native-contract-backup-*` 잔여 디렉터리는 없었습니다.

실패 경로는 의도적으로 존재하지 않는 `JAVA_HOME`을 주어 Kotlin 컴파일에서 실패시켰습니다. 이 경우에도 원본 Android 트리의 바이트 지문이 동일하고 임시 백업이 남지 않았습니다. 스크립트의 `finally` 복구 및 실패 시 백업 위치 안내가 동작합니다.

SIGKILL처럼 프로세스가 `finally`를 실행할 수 없는 외부 강제 종료에서는 원본 트리가 임시 백업 디렉터리에 남을 수 있습니다. 다만 이동(삭제가 아님) 후속 복구가 가능한 로컬 검증 작업의 잔여물이며, 데이터 무결성 손실이나 릴리스 산출물 손상으로 이어지지 않습니다. 따라서 출시 차단급 결함으로 분류하지 않습니다. 운영자는 강제 종료 뒤 `.native-contract-backup-*`를 원래 `android`로 되돌린 뒤 검증을 재실행하면 됩니다.

## 4. 빌드·설치·콜드 스타트 및 APK 선언값

다음 검증을 완료했습니다.

| 검증 | 결과 |
| --- | --- |
| `npm run verify:android-release` | 통과: 전체 테스트 229개, 빌드, typecheck, Expo Doctor 18/18, clean prebuild, SDK 36 Kotlin 컴파일, release Metro bundle |
| 관련 단위 테스트 | 통과: 2 파일 / 46 테스트 (`modelStore`, mobile React root 플러그인) |
| `gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64` | 통과: 새 아키텍처 autolinking과 x86_64 CMake/네이티브 빌드 포함 |
| x86_64 에뮬레이터 설치·콜드 스타트 | 통과: `emulator-5554`에 APK 설치 후 force-stop, `monkey` 시작, `com.sinmb.careguardianai/.MainActivity` top-resumed 및 앱 PID 확인 |
| APK `aapt dump badging` | `com.sinmb.careguardianai`, versionCode `7`, versionName `1.1.0`, compileSdk/targetSdk `36` |
| `git diff --check 1bf1045^ 1bf1045` | 통과 |

Gradle/의존성의 기존 deprecation 경고와 CPU-only llama 빌드 안내는 있었으나, 이번 네이티브 계약·무결성·릴리스 검증의 실패나 회귀는 확인되지 않았습니다.

## Findings

없음. **Critical 0 / Important 0 / Minor 0**.

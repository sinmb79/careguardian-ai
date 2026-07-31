# Task 10 모델 루트 Android 별칭 수정 독립 리뷰

- 대상 커밋: `e75c13bf0906ece022f14a36ffc1ef458bff93df`
- 검토 범위: Android app-private 모델 루트 정규화, 모델 루트 및 하위 artifact 경로 격리, 검증 후 교체 경계
- 판정: **PASS — Critical 0 / Important 0 / Minor 0**

## 요약

수정은 `reactContext.filesDir`를 먼저 canonicalize한 `documentsRoot`에서
`models` 자식을 구성하도록 바꾼 한 줄에 한정됩니다. 따라서 Android가 같은
app-private 저장소를 `/data/user/0/...`와 `/data/data/...`로 표현하는 정상
별칭은 허용하면서도, 모델 루트 자체가 심볼릭 링크인 경우와 모델 artifact가
모델 디렉터리 밖으로 canonicalize되는 경우는 기존과 동일하게 거부합니다.

교체 로직의 canonical parent 일치, 단일 파일시스템, 검증·백업·rename·fsync
순서는 변경되지 않았습니다. 이번 부모 경로 정규화가 기존 경로 기반 TOCTOU
경계를 넓히거나 우회 경로를 추가하지 않았습니다.

## 경계별 검토

### 1. 정상 Android 저장소 별칭

`ModelIntegrityModule.kt:32-33`에서 `filesDir.canonicalFile`을
`documentsRoot`로 확정한 뒤 `File(documentsRoot, "models")`를 만듭니다.
따라서 이후 `modelsRoot.absolutePath == canonicalModelsRoot.path` 비교의 양쪽이
동일한 canonical app-files 부모를 사용하고, 정상 `/data/user/0` 대
`/data/data` 별칭을 심볼릭 링크로 오인하지 않습니다.

### 2. 모델 루트 및 하위 artifact 탈출 차단

- `ModelIntegrityModule.kt:34-40`: 모델 루트의 canonical 부모가 canonical
  app-files 루트인지 확인하고, 모델 루트의 absolute 경로와 canonical 경로가
  다르면 계속 거부합니다. `models` 자식 심볼릭 링크 탈출은 허용되지 않습니다.
- `ModelIntegrityModule.kt:44-58`: 로컬 `file://` URI만 허용하고 query와
  fragment를 거부한 뒤 artifact를 canonicalize합니다. 최종 경로는 모델 루트
  자체이거나 `root.path + File.separator` 접두사 안에 있어야 하므로,
  sibling-prefix 혼동과 하위 심볼릭 링크의 외부 탈출이 계속 차단됩니다.

### 3. 검증 후 교체와 TOCTOU 경계

`ModelIntegrityModule.kt:126-133`의 partial/completed canonical parent 일치와
동일 파일시스템 검사는 그대로입니다. `ModelIntegrityModule.kt:135-203`의
SHA-256·크기 선검증, 기존 파일 백업, 원자적 rename, 파일 및 디렉터리 fsync,
교체 후 재검증, 실패 시 복원 순서에도 변경이 없습니다.

이번 변경은 path validation 이후의 파일 연산 방식이나 검증과 rename 사이의
시간 간격을 변경하지 않고, 오직 신뢰 루트의 두 Android 별칭을 하나의 canonical
표현으로 통일합니다. 따라서 기존 app-private 저장소 경계 및 교체 경계가
약화되지 않습니다.

## 독립 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm test -- --run apps/mobile/src/local-ai/modelStore.test.ts` | 통과: 1개 파일 / 42개 테스트 |
| `npm run verify` | 통과: 26개 파일 / 254개 Vitest 테스트, 웹 빌드, 정적 보안, 모바일 typecheck, Expo Doctor 18/18, 비의료·모델·감사·워크플로 출시 게이트 |
| ASCII 임시 worktree에서 `npm --workspace apps/mobile run verify:native-contracts -- kotlin` | 통과: Expo clean prebuild 및 SDK 36 `:model-integrity:compileDebugKotlin`, `BUILD SUCCESSFUL` |
| `git diff --check e75c13b^ e75c13b` | 통과 |

원본 한글 경로에서는 Expo clean prebuild가 Windows 종료코드
`3221225477`로 Kotlin 단계 전에 중단되었지만, 동일 커밋의 ASCII 임시
worktree에서 Node `v22.23.2`, JBR 21, Android SDK 36으로 네이티브 컴파일을
완료했습니다. 이 경로 의존적 도구 충돌은 대상 수정의 제품 결함이 아닙니다.

검토 중 제품 파일은 수정하지 않았습니다.

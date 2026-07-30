# Task 9 보안 출시 게이트 독립 재검토 4차 보고서

- 고정 검토 커밋: `3984e65c02c9e3fe82a2ab021d17e942a7b9560a`
- 검토 일자: 2026-07-31
- 검토 범위: 사용자 소유 로컬 저장소의 방어적 품질 재검토
- 최종 판정: **FAIL**
- 발견 사항: **Critical 0 / Important 1 / Minor 0**

`task-9-rereview-3.md`에서 지적한 직접 `expo-file-system` 업로드 표면은 크게 보완됐습니다. 설치 버전과 main/legacy 공개 선언 인벤토리, 세 승인 파일의 정확한 legacy importㆍ멤버ㆍ인수, resumable download task의 생성ㆍ콜백ㆍ반환 그래프가 고정됐고, 직접 업로드 APIㆍ새 다운로드 APIㆍ추가 importㆍ구조분해ㆍnamespace 별칭ㆍ계산 멤버 변이는 기존 회귀 테스트에서 모두 실패 폐쇄로 통과했습니다.

그러나 `require` 함수 자체를 먼저 별칭으로 만든 뒤 호출하는 정적 import 경로는 추적하지 않습니다. 따라서 “추가 import와 별칭을 모두 기본 거부한다”는 종료 조건은 아직 충족되지 않습니다.

## Important

### R10 (I-03 잔존). `require` 함수 별칭을 통한 추가 `expo-file-system` import가 기본 거부 검사 밖에 있습니다

**위치**

- `scripts/check-non-medical-release.mjs:1046-1170`
- `scripts/check-non-medical-release.mjs:1155-1167`
- `scripts/check-non-medical-release.mjs:1285-1343`
- `scripts/check-non-medical-release.mjs:1499-1505`
- `scripts/check-non-medical-release.node-test.mjs:231-272`

`scanImports()`의 CommonJS 분기는 호출식의 callee가 문자 그대로 `require` 식별자인 경우에만 module specifier를 검사합니다. `require` 식별자를 다른 상수에 담은 뒤 그 별칭을 호출하면 이 분기에 들어가지 않습니다. 정적 evaluator도 module loader 별칭을 추적하지 않습니다.

그 호출 결과를 `FileSystem` 또는 `ExpoFileSystem`이 아닌 이름으로 받으면 `scanMembers()`의 두 고정 root 이름 검사에도 들어가지 않습니다. 일반 네트워크 검사기는 `NETWORK_CAPABILITIES`에 열거된 멤버 이름만 별도로 잡으므로, import 자체와 열거되지 않은 파일시스템 멤버 사용은 정확한 세 파일ㆍ멤버ㆍ인수 계약의 적용을 받지 않습니다.

기존 별칭 회귀 테스트는 승인된 namespace 객체를 다른 변수에 대입하는 경우를 다루지만, module loader인 `require`의 별칭과 그 결과의 비표준 binding 이름은 다루지 않습니다. 외부 접근이나 공격 실행 없이 AST 분기와 회귀 테스트 범위를 정적으로 대조해 확인했습니다.

**영향**

승인되지 않은 파일에서 legacy namespace를 획득하거나, 승인된 파일의 정확한 importㆍbinding 계약 밖에서 파일시스템 기능을 사용할 수 있습니다. 현재 열거된 업로드 멤버는 별도 이름 검사에도 걸리지만, 기본 거부 보장이 import graph 전체에 적용되지 않으므로 향후 공개 API 또는 열거되지 않은 멤버가 추가될 때 같은 공백이 원격 전송ㆍ개인 파일 접근 경로가 될 수 있습니다.

**필수 조치**

`require` 식별자의 모든 값 참조와 별칭 전파를 추적하거나, 더 단순하게 승인된 정확한 `require("...")` 호출 외에는 `require`의 저장ㆍ전달ㆍ별칭화를 전부 거부해야 합니다. module specifier에서 시작해 반환 binding과 멤버 접근까지 이름과 무관하게 연결하고, loader 별칭ㆍ비표준 namespace bindingㆍ구조분해를 각각 실패시키는 회귀 테스트를 추가해야 합니다.

## 통과한 종료 조건

| 항목 | 판정 | 근거 |
|---|---|---|
| 설치 버전 고정 | 통과 | 앱 선언 `~19.0.23`, 설치 버전 `19.0.23`, lockfile 버전ㆍintegrity 존재를 확인했습니다. 설치 버전 변이 테스트도 실패합니다. |
| main/legacy 공개 선언 변화 | 통과 | 8개 선언 파일의 value surface를 정확한 다중집합으로 비교하며 main/legacy 신규 공개 API 변이 테스트가 실패합니다. |
| 승인 파일 제한 | 부분 통과 | 정상 경로는 세 파일만 정확히 고정되지만 R10의 loader 별칭 경로가 남습니다. |
| legacy importㆍ정확 멤버ㆍ인수 | 통과 | 현재 승인 binding의 직접ㆍ동적 import와 local filesystem 멤버 인수 모양이 고정됐습니다. |
| resumable download task | 통과 | `createDownloadResumable`의 5개 인수, progress callback, `download/pause/cancel` 반환 그래프가 정확히 고정됐습니다. |
| 업로드ㆍ새 APIㆍ일반 별칭ㆍ계산 접근 | 직접 회귀 통과 | `uploadAsync`, `createUploadTask`, `UploadTask`, `downloadFileAsync`, 추가 static/dynamic import, 구조분해, namespace 별칭, 계산 멤버 테스트가 모두 실패 폐쇄로 통과했습니다. |
| R5 반사ㆍ동적 호출 | 종료 유지 | `Reflect`, 동적 코드, 계산 호출과 전역 능력 획득 회귀가 통과했습니다. |
| R6 모델 재귀 동결 | 종료 유지 | 캡처한 intrinsics, 실제 deep freeze와 React Native facade 변이 회귀가 통과했습니다. |
| R7 CI 실패 전파 | 종료 유지 | workflow/job/step override와 실패 무시 회귀 및 독립 YAML 구조 검사가 통과했습니다. |
| R8 IndexedDB 손실 없는 토큰 | 종료 유지 | `Map`, `Set`, `Date`, typed array, 순환 객체 보존 및 stale conflict 회귀가 통과했습니다. |

기존 Task 9 문서에서 정의된 식별자는 I-01~I-06이며 I-07~I-10 정의는 저장소에서 확인되지 않았습니다. I-01, I-02, I-04, I-05, I-06은 종료 상태를 유지하지만 I-03은 R10 때문에 종료할 수 없습니다.

## 검증 증거

- `npm ci`: **PASS**
  - 1,048개 패키지 설치
  - 전체 개발 트리: High 25 / Moderate 10 / Low 1
- `npm run verify`: **PASS**
  - Vitest 21개 파일 / 189개 테스트
  - 웹 build와 배포 HTML 2개 CSP
  - 모바일 TypeScript
  - Expo Doctor 18/18
  - 정책ㆍ모델ㆍ감사ㆍ워크플로 검사
  - 게이트 회귀 44개: static 3 / policy 16 / model 10 / audit 6 / workflow 9
  - 승인된 프로덕션 감사 기준: Critical 0 / High 19 / Moderate 10, 패키지 29개, GHSA 6개
- 정책ㆍ모델ㆍ워크플로 방어 회귀 직접 실행: **PASS — 35/35**
- 웹 저장소ㆍ모델 런타임ㆍ모바일 삭제 직접 실행: **PASS — 5개 파일 / 52개 테스트**
- 독립 YAML 파싱: **PASS**
  - root 키: `env`, `jobs`, `name`, `on`, `permissions`
  - job: `verify`, `deploy`
  - `verify` 키: `permissions`, `runs-on`, `steps`
  - `deploy.needs`: `verify`
- `git diff --check`: **PASS**

자동 검증은 현재 포함된 변이의 방어를 증명하지만, 검사기가 추적하지 않는 module loader 별칭의 부재까지 증명하지는 않습니다.

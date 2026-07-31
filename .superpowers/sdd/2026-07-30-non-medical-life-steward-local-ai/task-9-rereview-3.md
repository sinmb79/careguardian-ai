# Task 9 보안 출시 게이트 독립 재검토 3차 보고서

- 고정 검토 커밋: `80926d74800470e964fa07bee4b822b535647d48`
- 검토 일자: 2026-07-31
- 검토 범위: 로컬 저장소의 방어적 품질 검토 및 기존 자동 테스트 실행
- 최종 판정: **FAIL**
- 발견 사항: **Critical 0 / Important 1 / Minor 0**

`task-9-rereview-2.md`의 R5~R8 재현 사례를 직접 겨냥한 코드와 회귀 테스트는 모두 보완됐습니다. 반사 APIㆍ동적 코드ㆍ계산 호출 차단, 실제 모바일 모델 레지스트리의 재귀 동결, CI 실패 전파, 비표준 IndexedDB 값의 손실 없는 격리와 동시성 토큰은 현재 구현과 테스트에서 확인됐습니다.

다만 I-03의 상위 보안 주장인 “승인된 두 네트워크 호출 그래프 외에는 기본 거부”는 아직 코드와 일치하지 않습니다. 따라서 비공개 테스트용 출시 게이트를 최종 통과로 판정할 수 없습니다.

## Important

### R9 (I-03 잔존). 네트워크 검사가 열거된 API 이름만 차단하여 승인 그래프 밖 전송 API를 기본 거부하지 않습니다

**위치**

- `scripts/check-non-medical-release.mjs:23-31`
- `scripts/check-non-medical-release.mjs:90-98`
- `scripts/check-non-medical-release.mjs:175-241`
- `scripts/check-non-medical-release.mjs:382-443`
- `scripts/check-non-medical-release.mjs:542-550`
- `apps/mobile/package.json:22`

정책 검사기는 `NETWORK_CAPABILITIES`에 열거한 `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `createDownloadResumable`, `downloadAsync`만 네트워크 기능으로 분류합니다. 이 중 정확한 두 다운로드ㆍ오프라인 라이선스 호출 모양만 예외로 승인합니다. 그러나 목록에 없는 정적 프로퍼티 호출은 네트워크 호출로 분류하지 않으므로, 검사 구조는 “허용 그래프 외 기본 거부”가 아니라 “알려진 이름 일부 거부”입니다.

모바일 의존성 허용 목록에는 `expo-file-system`이 포함되어 있고 현재 고정 버전 `19.0.23`의 설치된 타입 선언은 원격 파일 전송용 `uploadAsync(url, fileUri, ...)`와 `createUploadTask(url, fileUri, ...)`를 제공합니다. 두 API는 `NETWORK_CAPABILITIES`와 승인 그래프 검사에 없습니다. 관련 정책 회귀 테스트도 `fetch` 계열, 반사 API, 계산 호출과 기존 다운로드 API만 다루며 이 허용 의존성의 업로드 API를 다루지 않습니다.

이는 구현 변이나 외부 시스템 접근 없이 다음 정적 사실만으로 확인했습니다.

1. 허용된 모바일 의존성이 실제 원격 업로드 API를 노출합니다.
2. 해당 API 이름은 네트워크 기능 집합에 없습니다.
3. 분류기는 집합에 없는 일반 프로퍼티 호출을 승인 여부 검사로 보내지 않습니다.
4. 따라서 해당 호출은 승인된 두 호출 그래프 밖이어도 네트워크 게이트의 기본 거부 대상이 아닙니다.

**영향**

향후 릴리스 소스에 허용된 의존성의 다른 전송 API가 추가되면, 로컬 전용 정책과 달리 앱 소유 파일 또는 개인 데이터가 원격으로 전송될 수 있는데도 정책 게이트가 이를 네트워크 호출로 인식하지 못할 수 있습니다. 웹 CSP는 React Native 네트워크 계층을 제한하지 않으므로 별도 방어선이 되지 않습니다.

**필수 조치**

네트워크 API 이름을 계속 추가하는 방식 대신, 릴리스 TypeScript의 importㆍ객체 획득ㆍ호출 그래프를 실패 폐쇄형으로 제한해야 합니다. 승인된 `modelStore` 다운로드와 번들 라이선스 자산 처리만 정확한 파일ㆍ함수ㆍ인수 출처 계약으로 허용하고, `expo-file-system` 업로드 계열과 그 밖의 네트워크 가능 API는 명시적으로 거부해야 합니다. 허용 의존성의 미승인 전송 멤버, 별칭, 동적 endpoint를 포함한 방어 회귀 테스트를 추가해야 합니다.

## 이전 네 결함 재검토

| 항목 | 판정 | 근거 |
|---|---|---|
| R5 / I-03 반사ㆍ동적 네트워크 호출 | **직접 재현은 종료** | `Reflect`, `eval`, `Function`, `Proxy`, 계산 호출, 전역 객체 능력 획득과 내장 facade 변조를 AST에서 거부합니다. `Reflect.get`과 문자 코드 복원 회귀 테스트가 실패 폐쇄로 통과했습니다. 다만 R9 때문에 I-03 전체는 종료할 수 없습니다. |
| R6 / I-04 모바일 모델 재귀 동결 | **종료** | `Object.freeze`, `Object.isFrozen`, `Object.values`를 레지스트리 작업 전에 캡처하고, 실제 `MODEL_REGISTRY`와 하위 배열ㆍ객체를 재귀 동결합니다. React Native 조건 활성화, facade 교체, 구조분해 별칭, no-op 동결, 중첩 변조 회귀가 모두 통과했습니다. |
| R7 / I-06 CI 실패 전파 | **종료** | 워크플로ㆍjobㆍstep의 정확한 키 허용 목록이 `defaults.run.shell`, `env`, `working-directory`, `shell`, `continue-on-error`, `if`와 실패 무시 명령을 거부합니다. 독립 YAML 파싱에서도 `verify` job은 `runs-on`, `permissions`, `steps`만 보유합니다. |
| R8 / I-02 IndexedDB 손실 없는 동시성 토큰 | **종료** | 미지원 structured-clone 값을 `quarantinedValue`로 그대로 보존하고 128비트 난수 확인 토큰을 함께 저장합니다. `Map`, `Set`, `Date`, typed array, 순환 객체의 값ㆍ형식ㆍ순환 참조 보존과 stale 삭제 충돌 테스트가 통과했습니다. |

## 기존 항목 회귀 판정

저장소의 기존 Task 9 검토 문서에서 정의된 식별자는 I-01~I-06입니다. 전체 저장소 검색에서 I-07~I-10의 정의는 확인되지 않아 임의로 항목을 만들지 않았습니다.

| 항목 | 판정 |
|---|---|
| I-01 모바일 전체 삭제 실패 처리 | 종료 유지 |
| I-02 웹 현재ㆍ레거시 삭제 | 종료 유지 |
| I-03 정적ㆍ정책ㆍ네트워크 게이트 | **R9로 종료 불가** |
| I-04 모델 공급망 게이트 | 종료 유지 |
| I-05 프로덕션 감사 정확성 | 종료 유지. 수용 기준 만료일은 2026-08-13이며 AAB 도달 가능성은 Task 10 전까지 미입증입니다. |
| I-06 단일 SHA 검증ㆍ배포 워크플로 | 종료 유지 |

## 검증 증거

- `npm ci`: **PASS**
  - lockfile 기준 1,048개 패키지 설치
  - 전체 개발 트리 감사 출력: High 25 / Moderate 10 / Low 1
- `npm run verify`: **PASS**
  - Vitest 21개 파일 / 189개 테스트
  - 웹 production build 및 배포 HTML 2개 CSP 검사
  - 모바일 TypeScript
  - Expo Doctor 18/18
  - 정책ㆍ모델ㆍ감사ㆍ워크플로 검사
  - 게이트 회귀 40개
  - 승인된 프로덕션 감사 기준: Critical 0 / High 19 / Moderate 10, 패키지 29개, GHSA 6개
- 정책ㆍ모델ㆍ워크플로 Node 회귀 직접 실행: **PASS — 31/31**
- 웹 저장소ㆍ모델 런타임ㆍ모바일 삭제 직접 실행: **PASS — 5개 파일 / 52개 테스트**
- 독립 YAML 파싱: **PASS**
  - root 키: `env`, `jobs`, `name`, `on`, `permissions`
  - job: `verify`, `deploy`
  - `verify` 키: `permissions`, `runs-on`, `steps`
  - `deploy.needs`: `verify`
- `git diff --check`: **PASS**

자동 검증의 성공은 R5~R8의 직접 회귀가 닫혔다는 근거이지만, R9처럼 네트워크 분류 범위 밖인 실제 허용 의존성 API의 부재를 증명하지는 않습니다.

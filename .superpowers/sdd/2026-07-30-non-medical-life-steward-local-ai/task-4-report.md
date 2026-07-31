# Task 4 완료 보고서: health-shaped care core 제거

## 상태

완료. `@careguardian/care-core`와 `packages/care-core`를 제거하고, 루트와 모바일 워크스페이스가 `@life-steward/life-core`만 참조하도록 전환했습니다.

커밋 SHA: 이 보고서는 단일 최종 커밋에 포함되므로 SHA는 커밋 직후 `git rev-parse HEAD`로 확정됩니다. 작업 인계 시 해당 SHA를 함께 보고합니다.

## 변경 사항

- 루트 `package.json`에서 `@careguardian/care-core` file dependency를 제거했습니다.
- `apps/mobile/package.json`에서 `@careguardian/care-core` dependency를 제거했습니다.
- `packages/care-core` 전체(24개 소스/테스트 파일과 manifest)를 제거했습니다.
- `npm install`로 `package-lock.json`을 재생성하여 `@careguardian/care-core`와 `packages/care-core` lock entry를 제거했습니다.

## 기준선과 회귀 검사

마이그레이션 전 명령:

```powershell
rg -n "@careguardian/care-core|packages/care-core" package.json apps/mobile src packages --glob "!packages/care-core/**"
```

결과: 루트 `package.json`과 `apps/mobile/package.json`에서 각각 legacy dependency가 검출되었습니다.

마이그레이션 후 같은 명령은 종료 코드 1(검출 결과 없음)이었고, `package-lock.json` 대상 검사도 종료 코드 1이었습니다.

## 실제 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npm install` | PASS — 1,048 packages audited |
| `npm ls --all` | PASS (exit 0, ELSPROBLEMS 없음); life-core만 루트/모바일에 dedupe됨 |
| `npm test -- --run` | PASS — 13 files, 79 tests |
| `npm run build` | PASS — TypeScript 검사 및 Vite/PWA build 완료 |
| `npm run mobile:typecheck` | PASS |

## 우려 사항

- `npm install`은 기존 의존성 감사 결과로 36개 취약점(1 low, 10 moderate, 25 high)을 보고합니다. 이번 core 전환에서 새로 발생한 오류는 아니며, 별도 의존성 보안 정리 작업이 필요합니다.
- `npm ls --all`의 플랫폼별 optional dependency `UNMET OPTIONAL DEPENDENCY` 표시는 정상이며, 명령은 exit 0으로 완료되었습니다.

## Fix round 1: lockfile 공급망 메타데이터 보존

검토에서 지적된 대량 lockfile 메타데이터 제거를 수정했습니다. `e8d0137:package-lock.json`을 JSON으로 읽은 후 다음 네 변경만 기계적으로 적용하여 다시 작성했습니다.

1. `packages[""].dependencies`의 `@careguardian/care-core` 제거
2. `packages["apps/mobile"].dependencies`의 같은 항목 제거
3. `packages["node_modules/@careguardian/care-core"]` 제거
4. `packages["packages/care-core"]` 제거

### 무관 entry 보존 증거

`e8d0137`의 packages 객체와 변환본을 JSON 값 단위로 비교했습니다. 두 care-core package entry를 제외한 package key 집합은 일치했고(1,131개), root와 mobile workspace entry는 care-core dependency 한 항목 제거 외에 동일했습니다. 따라서 `resolved`, `integrity`, `deprecated`를 포함한 무관 package entry diff는 **0건**입니다.

manifest-lock consistency 검사도 PASS했습니다. 루트 `file:packages/life-core`와 모바일 `file:../../packages/life-core` 요청은 각각 manifest와 동일했고, legacy workspace dependency 및 두 package key는 존재하지 않았습니다.

### Fix round 1 검증

| 명령 | 결과 |
| --- | --- |
| `npm ci` | PASS — 1,045 packages added, 1,048 audited |
| npm ci 전후 `package-lock.json` SHA-256 | 동일: `532B0DB086DD94C2A4D45928B5DFCCC295787D7631D8A87C33E54ABBFD2963AC` |
| `npm ls --all` | PASS (exit 0, ELSPROBLEMS 없음) |
| legacy `rg` (manifest/source/packages/lockfile) | PASS — exit 1, 검출 없음 |
| `npm test -- --run` | PASS — 13 files, 79 tests |
| `npm run build` | PASS |
| `npm run mobile:typecheck` | PASS |

Fix round 1 커밋 SHA: 이 보고서는 해당 단일 후속 커밋에 포함되므로, 확정 SHA는 커밋 직후 인계에 기록합니다.

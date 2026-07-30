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

# Task 9 security and release gate evidence

- Date: 2026-07-30 (Asia/Seoul)
- Scope: source-level non-medical local-first security/release gates
- Audit baseline: `npm audit --omit=dev` — Critical 0, High 19, Moderate 10, Low 0

## Implemented controls

1. Full deletion enumerates current and legacy CareGuardian SQLite/SQLCipher, SecureStore, and Expo SQLite KV namespaces; it stops inference, cancels every scheduled notification, removes models/partials, verifies deletion, and reports typed namespace failures.
2. Device credential authentication no longer rejects PIN-only Android devices based on biometric hardware preflight; unsuccessful native authentication remains locked.
3. The Vite document has a strict self-only CSP and the generated `dist/index.html` is checked after each production build.
4. The non-medical release checker uses `git ls-files`, verifies exact mobile identity/linkage and minimal permission set, rejects deprecated care-core/cloud services and unapproved runtime URLs, with narrow documented policy/legacy-cleanup exceptions.
5. The model checker accepts only two pinned HyperCLOVA X artifacts with exact repository/revision/GGUF filename/bytes/SHA-256/RAM/context and offline license files. Kakao remains blocked.
6. CI uses full-SHA pins for all third-party Actions, Node 22 (within the repository `>=20.19.4 <25` engine range and the Expo 54-supported Node LTS line), and runs reproducible install, tests, build, CSP, mobile typecheck/doctor, policy/model gates, and baseline-aware audit policy under least `contents: read` privilege.

## Verification

| Command | Result |
|---|---|
| `npm run verify` | PASS — 20 Vitest files / 175 tests; build, static CSP, mobile typecheck, Expo doctor, policy/model/audit gates |
| `npm run release:model-check:test` | PASS — 3 mutation tests |

## Remaining release blockers

Task 10 must still provide real Android AAB dependency/manifest inspection and Samsung/Pixel PIN-only tests. The audit baseline is a time-bounded exception, not an assertion that the accepted findings are harmless or AAB-unreachable.

# Task 9 security and release gate evidence

- Date: 2026-07-30 (Asia/Seoul)
- Scope: source-level non-medical local-first security/release gates
- Audit baseline: `npm audit --omit=dev` — Critical 0, High 19, Moderate 10, Low 0

## Implemented controls

1. Full deletion enumerates current and legacy CareGuardian SQLite/SQLCipher, SecureStore, Expo SQLite KV, browser IndexedDB, and browser localStorage namespaces. Mobile failures publish typed failed domains, leave the UI locked, and are observed by the Alert Promise handler without a false success message. Web deletion retains only a data-free tombstone, verifies both app-owned legacy keys are absent, retries cleanup on reload, and leaves unrelated origin data/caches untouched.
2. Device credential authentication no longer rejects PIN-only Android devices based on biometric hardware preflight; unsuccessful native authentication remains locked.
3. Every deployed HTML document has the same strict self-only CSP. The privacy page uses external self-hosted CSS, and `dist/**/*.html` is checked for CSP, inline execution/style, event handlers, and remote URLs.
4. The non-medical release checker inventories tracked and non-ignored untracked release files. Whole-file exceptions were replaced by exact single-line policy/legacy/cloud-disable/network contracts plus AST checks for computed/template/concatenated endpoints.
5. The model registry is strict JSON with exact schema/value comparison. Runtime validation and deep-freezing occur before export; AST mutation tests reject duplicate declarations, URL construction, filter bypasses, and getter bypasses. Only two pinned HyperCLOVA X artifacts remain installable; Kakao remains blocked.
6. The production audit gate uses exact sorted equality for counts, packages, and GHSA IDs, validates acceptance dates/order, and fails closed on command, parser, network, signal, or exit-status errors.
7. `.github/workflows/ci.yml` is the single full-SHA-pinned `verify -> deploy` chain. The exact checked-out SHA is tested, built, statically checked, mobile-checked, policy/model mutation-tested, audited, and workflow-checked before its artifact can be uploaded. Only the deploy job receives Pages/OIDC write permissions.

## Verification

| Command | Result |
|---|---|
| `npm run verify` | PASS — 21 Vitest files / 181 tests; build; all generated HTML CSP; mobile typecheck; Expo doctor; policy/model; 24 mutation/contract tests; exact audit; workflow contract |
| `npm run release:gate-tests` | PASS — 24 Node mutation/contract tests (3 static + 5 policy + 5 model + 6 audit + 5 workflow) |
| `npm run release:audit-policy` | PASS — exact accepted baseline: Critical 0, High 19, Moderate 10, 29 packages, 6 GHSA IDs |

## Remaining release blockers

Task 10 must still provide real Android AAB dependency/manifest inspection and Samsung/Pixel PIN-only tests. The audit baseline is a time-bounded exception, not an assertion that the accepted findings are harmless or AAB-unreachable.

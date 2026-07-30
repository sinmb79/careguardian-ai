# Task 9 security and release gate evidence

- Date: 2026-07-30 (Asia/Seoul)
- Scope: source-level non-medical local-first security/release gates
- Audit baseline: `npm audit --omit=dev` — Critical 0, High 19, Moderate 10, Low 0

## Implemented controls

1. Full deletion enumerates current and legacy CareGuardian SQLite/SQLCipher, SecureStore, Expo SQLite KV, browser IndexedDB, and browser localStorage namespaces. Mobile failures publish typed failed domains, leave the UI locked, and are observed by the Alert Promise handler without a false success message. Web deletion replaces valid, malformed, unknown-schema, and legacy records with a data-free tombstone only after the confirmed revision or invalid raw value is rechecked inside the write transaction. It verifies both app-owned legacy keys are absent, retries cleanup on reload, rejects stale multi-tab confirmation, and leaves unrelated origin data/caches untouched.
2. Device credential authentication no longer rejects PIN-only Android devices based on biometric hardware preflight; unsuccessful native authentication remains locked.
3. Every deployed HTML document has the same strict self-only CSP. The privacy page uses external self-hosted CSS, and `dist/**/*.html` is checked for CSP, inline execution/style, event handlers, and remote URLs.
4. The non-medical release checker inventories tracked and non-ignored untracked release files. Whole-file exceptions were replaced by exact single-line policy/legacy/cloud-disable/network contracts plus TypeScript AST constant folding for split names, templates, concatenation, array `join`, aliases, computed global access, and fail-closed dynamic calls.
5. The model registry is strict JSON with exact schema/value comparison. Runtime validation, recursive freezing, and deep-frozen assertions occur before consumption; runtime tests check every nested object and array with `Object.isFrozen`. AST mutation tests reject duplicate declarations, `deepFreeze` no-ops, removed assertions, literal or split URL construction, conditional nested assignment, mutating methods, `Object`/`Reflect` mutation helpers, filter bypasses, and getter bypasses. Only two pinned HyperCLOVA X artifacts remain installable; Kakao remains blocked.
6. The production audit gate uses exact sorted equality for counts, packages, and GHSA IDs, validates acceptance dates/order, and fails closed on command, parser, network, signal, or exit-status errors.
7. `.github/workflows/ci.yml` is the single full-SHA-pinned `verify -> deploy` chain. The release gate parses YAML structure and requires every exact verify command to run once, unconditionally, in fail-fast order before artifact upload. It rejects `if`, every form of `continue-on-error`, shell overrides, success-masking commands, moved steps, unknown commands/actions, and deploy-side checkout or rebuild. Only the deploy job receives Pages/OIDC write permissions.

## Verification

| Command | Result |
|---|---|
| `npm run verify` | PASS — 21 Vitest files / 187 tests; build; all generated HTML CSP; mobile typecheck; Expo doctor 18/18; policy/model; 33 mutation/contract tests; exact audit; YAML workflow contract |
| `npm run release:gate-tests` | PASS — 33 Node mutation/contract tests (3 static + 8 policy + 8 model + 6 audit + 8 workflow) |
| `npm run release:audit-policy` | PASS — exact accepted baseline: Critical 0, High 19, Moderate 10, 29 packages, 6 GHSA IDs |

## Remaining release blockers

Task 10 must still provide real Android AAB dependency/manifest inspection and Samsung/Pixel PIN-only tests. The audit baseline is a time-bounded exception, not an assertion that the accepted findings are harmless or AAB-unreachable.

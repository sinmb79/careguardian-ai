# Task 10 Native Android Entry Review

- Reviewed commit: `e1eb199ae7fb7967a50d735c3a97705a3d08cfd3`
- Review scope: Expo Android entry resolver invocation, its regression contract, and the `all` native-contract path.
- Result: **PASS — Critical 0 / Important 0 / Minor 0**

## Findings

None.

## Review evidence

1. `expo/scripts/resolveAppEntry.js` reads `projectRoot`, `platform`, and `absolute` from `process.argv[1]`, `[2]`, and `[3]`. The new invocation uses Node's `-e` mode with `require('expo/scripts/resolveAppEntry')` as the evaluated program and then passes exactly `mobileRoot`, `android`, and `absolute`. On Node `v22.23.2`, a direct argv probe produced `[node executable, project-root, android, absolute]`, so the resolver receives its documented values instead of receiving its own script path as the project root.
2. `verifyAndroidEntry()` is the sole implementation of that invocation. The focused `entry` contract calls it directly; the default `all` path calls the same helper after clean prebuild and before either Kotlin or release-Metro Gradle work. This keeps the fast regression contract and the release path on one code path.
3. The helper checks process status, writes resolver stderr on failure, normalizes the resolver output, and compares it to `apps/mobile/index.ts`. It therefore fails closed if Expo selects a different native entry.
4. The code change is minimal: it removes the direct-script execution, introduces one reusable helper plus the `entry` selector, and adds one process-level regression test. No product/runtime feature code changed.

## Fresh verification

- Portable Node `v22.23.2`: `npm exec vitest run apps/mobile/src/local-ai/nativeAndroidEntryVerifier.test.ts apps/mobile/src/local-ai/mobileReactRootPlugin.test.ts` — 2 files, 5 tests passed.
- Portable Node `v22.23.2`: `node apps/mobile/scripts/verify-native-android-contracts.mjs entry` — resolved the real `apps/mobile/index.ts` path.
- Portable Node `v22.23.2`: `npm run verify` — 26 test files, 254 tests passed; web build, static-security check, mobile typecheck, Expo Doctor, policy/model/mutation/audit/workflow gates completed. The production-audit gate reported its existing accepted baseline (29 dependency findings, 0 critical) and did not report gate problems.
- `git diff --check` — passed.

## Windows note

The reviewed invocation is Windows-safe because `spawnSync(process.execPath, ["-e", ...])` avoids shell quoting for the resolver arguments. The existing Gradle command remains the only Windows shell execution and is outside this entry-resolution change.

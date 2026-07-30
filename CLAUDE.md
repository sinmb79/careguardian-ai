# Claude Code Handoff

This repository is a `web PWA + Expo mobile app + packages/life-core` project for **생활후견 AI / Life Steward AI**. It is a general, local-first personal-productivity tool for ordinary tasks, lists, notes, and user-created declarative features.

## Read first

1. `README.md`
2. `docs/mobile-delivery.md`
3. `docs/store-listing.md`
4. `public/privacy-policy.html`
5. `docs/private-test-operations.md`

Past CareGuardian material is historical only. Do not use it as evidence for the current release: `docs/2026-04-12-ux-and-playstore.md`, `docs/google-play-organization-account-remediation-2026-07-22.md`, `docs/security/private-test-readiness-2026-07-20.md`, and `CareGuardian_AI_Spec_v0.1 (1).md`.

## Key paths

| Path | Role |
|---|---|
| `packages/life-core` | Shared life-workspace domain logic and restricted-use policy |
| `apps/mobile` | Expo Android/iOS/iPad app |
| `src` | Web PWA (Vite + React + Tailwind) |
| `public/privacy-policy.html` | Public Korean-first privacy policy |
| `docs/store-listing.md` | Current Play listing and Data safety entry guide |
| `docs/mobile-delivery.md` | Local development and mobile delivery guide |
| `docs/private-test-operations.md` | Synthetic-data closed-test operation guide |

## Current product contract

- Display name: `생활후견 AI` / `Life Steward AI`
- Android: `1.1.0` / `versionCode 7`; package `com.sinmb.careguardianai`
- EAS: owner `sinmb79`, slug `careguardian-ai-mobile`, project ID `15b9e293-b631-4b77-8cfc-9937cd604dd4`
- Play positioning: Productivity, 18+, no login, no ads
- Mobile workspace: SQLCipher with SecureStore/Android Keystore boundary, device authentication, background lock, screenshot blocking, and Android backup disabled
- Notifications: local only; generic title and `taskId`-only payload
- Optional local AI: pinned NAVER HyperCLOVA X GGUF download over fixed HTTPS after explicit user choice, SHA-256 and size verification, CPU inference, and no result storage before user approval. Kakao has no approved pinned GGUF and must remain unavailable for download/run.
- No network path exists except the user-initiated model installation request to Hugging Face. Prompts, outputs, and workspace content are not sent with that request.
- Closed testing uses synthetic, non-sensitive data only. Real personal or sensitive data remains NO-GO.

## Recommended commands

```powershell
npm test -- --run
npm run build
npm run mobile:typecheck
npm run release:policy-check
```

`npm run mobile:android:go` is only a quick Expo Go UI check. Validate native boundaries in a development build or production AAB. Windows has no iOS simulator; use an EAS iOS build and TestFlight as a separate path.

## Remaining external gates

1. Rebuild and inspect a fresh production APK/AAB for the current version and manifest/network contract.
2. Record Samsung and Pixel physical-device validation, including lock, deletion, local notifications, model installation, and network observation.
3. Recapture Android-native Play screenshots before any upload; the current web-rendered PNGs are review assets only.
4. Enter the current listing and Data safety answers in Play Console, verify every answer against the final AAB and observed request path, then operate the closed test with real opt-in counts.

The 2026-07-20 organization-account rejection concerned the retired health-oriented product and is retained only as historical background; it is not a next step for this release.

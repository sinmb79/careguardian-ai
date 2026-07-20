# Claude Code Handoff

This repository uses a `web demo + Expo mobile app + shared care core` structure.
The hardened Android `1.0.1` (`versionCode 6`) bundle and 12 related Play changes were submitted together as 13 changes for Google review on 2026-07-20.

## Read First

1. `README.md`
2. `docs/mobile-delivery.md`
3. `docs/2026-04-12-ux-and-playstore.md` — UX overhaul + Play Store registration summary
4. `docs/store-listing.md` — Play Store metadata (descriptions, category, contact)

## Key Paths

| Path | Role |
|---|---|
| `packages/care-core` | Shared caregiving domain logic (web + mobile) |
| `apps/mobile` | Expo Android/iOS/iPad app |
| `src` | Web PWA (Vite + React + Tailwind) |
| `public/privacy-policy.html` | Privacy policy page (deployed on GitHub Pages) |
| `docs/screenshots/` | Play Store screenshots and feature graphic |
| `docs/store-listing.md` | Play Store listing text |
| `docs/mobile-delivery.md` | Local dev, Android, iOS delivery guide |

## Recommended Commands

```powershell
npm test -- --run
npm run build
npm run mobile:typecheck
npm run mobile:android:go
```

## Current State (2026-07-20)

| Item | Status |
|---|---|
| Web PWA | Deployed on GitHub Pages |
| Mobile app (Expo) | Hardened `1.0.1 (6)` AAB submitted from Closed Alpha |
| Play Console setup | 13 changes submitted; currently under Google review |
| Closed-test access | `22B` (1), `젤리테스터` (44), `테스터` (8) selected; listed capacity up to 53 |
| UX accessibility overhaul | Completed (15 files, both web + mobile) |
| Tablet 2-column layout | Completed (web sm:grid-cols-2, mobile flexWrap) |
| App icons | Generated from SVG (1024, 512, adaptive) |
| Feature graphic | `docs/screenshots/feature-graphic.png` (1024x500) |
| Phone screenshots | 4 screenshots in `docs/screenshots/` |
| Tablet screenshots | 7-inch (2) + 10-inch (2) in `docs/screenshots/` |
| Privacy policy | Deployed; public URL returned HTTP 200 |
| EAS project | `@sinmb79/careguardian-ai-mobile` (ID: 15b9e293-b631-4b77-8cfc-9937cd604dd4) |
| Security gate | Synthetic data only; real personal/health/medication data remains NO-GO |

## Warnings

- `mobile:android:go` is for quick Expo Go UI verification only.
- `expo-notifications` requires dev client build (`npm run mobile:android:dev`) or EAS build.
- iOS simulator is not available on Windows; use `eas build --platform ios`.
- Selected Play tester lists contain up to 53 listed users, but duplicates and non-participants may reduce the actual unique opt-in count. At least 12 actual opt-ins are required for 14 consecutive days.
- The Closed Alpha release has one non-blocking deobfuscation mapping warning; code shrinking is not enabled.
- Managed publishing is off, so an approved release may become available to the selected testers automatically.

## Next Steps

1. Monitor Google review and verify when `1.0.1 (6)` becomes available to the selected testers.
2. Confirm at least 12 unique testers have actually opted in; list membership alone does not start the 14-day requirement.
3. Run the 14-day synthetic-data test plan in `docs/private-test-operations.md` while maintaining at least 12 opt-ins.
4. Complete Samsung/Pixel real-device network, forensic, deletion and notification-matrix validation before any real-data phase.
5. Build and validate iOS through EAS/TestFlight as a separate workstream.

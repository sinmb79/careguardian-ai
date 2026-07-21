# Claude Code Handoff

This repository uses a `web demo + Expo mobile app + shared care core` structure.
The hardened Android `1.0.1` (`versionCode 6`) bundle and 12 related Play changes were submitted together as 13 changes on 2026-07-20, then rejected because a health/medical app must be submitted from an organization developer account.

## Read First

1. `README.md`
2. `docs/mobile-delivery.md`
3. `docs/2026-04-12-ux-and-playstore.md` — UX overhaul + Play Store registration summary
4. `docs/store-listing.md` — Play Store metadata (descriptions, category, contact)
5. `docs/google-play-organization-account-remediation-2026-07-22.md` — rejection cause and compliant recovery path

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

## Current State (2026-07-22)

| Item | Status |
|---|---|
| Web PWA | Deployed on GitHub Pages |
| Mobile app (Expo) | Hardened `1.0.1 (6)` AAB retained in the Closed Alpha changes |
| Play Console setup | Rejected on 2026-07-20; 13 changes are pending resubmission |
| Developer account | Personal; organization conversion required for this health/medical app |
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
- Do not change the accurate `Medical` / `Medication and Treatment Management` declarations to bypass the organization-account requirement.
- The account-type change is disabled until an official organization website is added and verified. Organization conversion also requires a D-U-N-S-backed organization profile.
- After conversion completes, wait at least 72 hours before resubmitting to avoid a redundant account-type rejection.

## Next Steps

1. Confirm the legal organization, D-U-N-S number and official website to use for account conversion.
2. Add and verify the organization website, then convert the existing personal developer account to an organization account.
3. Wait at least 72 hours after conversion, then resubmit the 13 pending changes without weakening the Health/Medical declarations.
4. After approval, confirm at least 12 unique testers have actually opted in and run the 14-day synthetic-data plan.
5. Complete Samsung/Pixel real-device validation before any real-data phase; keep iOS/TestFlight separate.

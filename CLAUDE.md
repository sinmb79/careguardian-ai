# Claude Code Handoff

This repository uses a `web demo + Expo mobile app + shared care core` structure.
The Android app has been built, submitted to Google Play Console internal testing, and the UI was redesigned for accessibility.

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

## Current State (2026-04-12)

| Item | Status |
|---|---|
| Web PWA | Deployed on GitHub Pages |
| Mobile app (Expo) | AAB built, uploaded to Play Console internal test |
| Play Console setup | 8/11 completed (data security, store listing, app category remain) |
| UX accessibility overhaul | Completed (15 files, both web + mobile) |
| Tablet 2-column layout | Completed (web sm:grid-cols-2, mobile flexWrap) |
| App icons | Generated from SVG (1024, 512, adaptive) |
| Feature graphic | `docs/screenshots/feature-graphic.png` (1024x500) |
| Phone screenshots | 4 screenshots in `docs/screenshots/` |
| Tablet screenshots | 7-inch (2) + 10-inch (2) in `docs/screenshots/` |
| Privacy policy | `public/privacy-policy.html` |
| EAS project | `@sinmb79/careguardian-ai-mobile` (ID: 15b9e293-b631-4b77-8cfc-9937cd604dd4) |

## Warnings

- `mobile:android:go` is for quick Expo Go UI verification only.
- `expo-notifications` requires dev client build (`npm run mobile:android:dev`) or EAS build.
- iOS simulator is not available on Windows; use `eas build --platform ios`.
- Play Console still needs: data security form, app category + contact, store listing + screenshots upload.

## Next Steps

1. Complete remaining 3 Play Console items (data security, app category, store listing)
2. Upload AAB to internal test track (file: `apps/mobile/careguardian-ai.aab`)
3. iOS build via EAS (`eas build --platform ios --profile preview`)
4. Voice input (STT) — select native plugin
5. AES encryption layer for mobile storage
6. E2E tests for caregiver-to-companion flow

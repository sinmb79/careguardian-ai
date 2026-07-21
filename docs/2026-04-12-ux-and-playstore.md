# 2026-04-12 UX Overhaul + Play Store Registration

> **역사 문서:** 이 문서는 2026-04-12 당시 상태를 기록한 것으로, Health `None`, 임시 카테고리 후보 및 초기 Data safety 메모는 현재 선언이 아닙니다. 현행 값과 2026-07-20 거부 보완 상태는 `docs/store-listing.md`, `docs/mobile-delivery.md`, `docs/google-play-organization-account-remediation-2026-07-22.md`를 따르세요.

This document summarizes the work done on April 12, 2026 to make the app user-friendly and prepare it for Android Play Store release.

## 1. UX Accessibility Overhaul (15 files modified)

### Design Principles Applied
- Minimum 48px touch targets (WCAG recommendation)
- 18px base font size (up from 16px)
- Thicker input borders (2px) with visible focus rings
- High contrast text (#1a2626 on #f7f2e8, ratio 12.8:1)
- Emoji icons for visual cues
- Time-of-day personalized greeting
- Emotion check-in (5 emoji buttons)
- Progress bar for manual completion

### Phase 1: Shared Core (`packages/care-core`)

| File | Changes |
|---|---|
| `src/manual/manualSections.ts` | Added `icon`, `step`, `totalSteps` fields to each section |
| `src/companion/companionEngine.ts` | Added `getTimeOfDayGreeting()`, `getEmotionOptions()`, warmer fallback reply |
| `src/companion/dailySchedule.ts` | Added period emoji to labels (morning/afternoon/evening/night) |
| `src/companion/index.ts` | Re-exported new functions |
| `src/companion/dailySchedule.test.ts` | Updated assertions for emoji labels |

### Phase 2: Web PWA (`src/`)

| File | Changes |
|---|---|
| `tailwind.config.ts` | Darker ink color (#1a2626), semantic font size tokens |
| `src/styles/index.css` | 18px base font, focus-visible ring, min-height 48px |
| `src/features/ui/SectionCard.tsx` | Icon prefix, step progress bar, larger text |
| `src/features/ui/CaregiverEditor.tsx` | Larger fonts/inputs, progress summary bar, 2-column tablet layout |
| `src/features/ui/CompanionHome.tsx` | Greeting, emotion check-in, larger text, 2-column tablet layout |
| `src/app/App.tsx` | Warmer loading screen, ARIA landmarks |
| `src/app/App.test.tsx` | Updated assertion for dynamic greeting |

### Phase 3: Mobile App (`apps/mobile/`)

| File | Changes |
|---|---|
| `src/ui/ScreenCard.tsx` | Icon prefix, step progress bar, larger text, `style` prop for tablet |
| `src/ui/MobileCaregiverScreen.tsx` | Larger fonts/inputs, progress bar, accessibility labels, tablet 2-column grid |
| `src/ui/MobileCompanionScreen.tsx` | Greeting, emotion check-in, larger text, accessibility labels, tablet 2-column grid |
| `App.tsx` | Warmer loading screen with emoji, accessibility label |

## 2. Tablet Layout

- Web: `sm:grid-cols-2` on card containers, hero/progress/button span full width
- Mobile: `useWindowDimensions()` detects tablet (width >= 600), `flexDirection: "row"` + `flexWrap: "wrap"` with `flexBasis: "48%"` on cards
- ScreenCard component accepts optional `style` prop for responsive overrides

## 3. App Icons Generated

Source: `public/favicon.svg` (heart + star icon)

| File | Size | Purpose |
|---|---|---|
| `apps/mobile/assets/icon.png` | 1024x1024 | App icon (dark bg + heart) |
| `apps/mobile/assets/adaptive-icon.png` | 1024x1024 | Android adaptive icon (transparent bg) |
| `apps/mobile/assets/splash-icon.png` | 200x200 | Splash screen icon |
| `docs/screenshots/icon-512.png` | 512x512 | Play Store high-res icon |
| `docs/screenshots/feature-graphic.png` | 1024x500 | Play Store feature graphic (banner) |

`app.json` updated: splash background `#f4ecde`, adaptive icon background `#1F2A2A`.

## 4. Play Store Screenshots

Captured via Puppeteer at device-accurate viewports from local build (`dist/`).

| File | Device | Content |
|---|---|---|
| `phone-screenshot-1.png` | Phone (412x915 @2.625x) | Caregiver mode empty |
| `phone-screenshot-2.png` | Phone | Caregiver mode with data |
| `phone-screenshot-3.png` | Phone | Companion mode (top) |
| `phone-screenshot-4.png` | Phone | Companion mode (scrolled) |
| `tablet7-screenshot-1.png` | 7" tablet (600x1024 @1.5x) | Caregiver filled |
| `tablet7-screenshot-2.png` | 7" tablet | Companion mode |
| `tablet10-screenshot-1.png` | 10" tablet (800x1280 @2x) | Companion 2-column |
| `tablet10-screenshot-1-companion.png` | 10" tablet | Companion 2-column |

Screenshot script: `scripts/capture-screenshots.mjs`

## 5. Privacy Policy

Created `public/privacy-policy.html` (bilingual Korean/English).
URL: `https://sinmb79.github.io/careguardian-ai/privacy-policy.html`

Key points:
- No data collection, no server transmission
- All data stored locally (SQLite + SecureStore)
- No analytics, tracking, or ad SDKs
- Notifications are local only

## 6. Play Store Registration

### Google Play Console

- Developer account: **22B** (sinmb82@gmail.com)
- App name: **CareGuardian AI**
- Package: `com.sinmb.careguardianai`
- Language: Korean (ko-KR)
- Type: App (not game), Free

### Completed (8/11)

1. Privacy policy URL
2. App access (no restrictions)
3. Ads (none)
4. Content rating (IARC: Everyone / all "No")
5. Target audience (18+)
6. Government app (No)
7. Financial features (None)
8. Health (None)

### Remaining (3/11)

1. **Data security** — "No data collection" selected, needs final save
2. **App category** — Select "Tools", email: `sinmb79@naver.com`
3. **Store listing** — Upload descriptions from `docs/store-listing.md`, screenshots from `docs/screenshots/`

### AAB Build

- Built via `eas build --platform android --profile production`
- File: `apps/mobile/careguardian-ai.aab` (59MB)
- Download URL: `https://expo.dev/artifacts/eas/8CxmsjgqKGNHzSLrjEznnj.aab`
- Internal test uploaded

## 7. Store Listing Text

Prepared in `docs/store-listing.md`:
- Short description (80 chars): caregiving continuity app summary
- Full description: features, privacy, target users
- Category: Medical or Tools
- Contact: sinmb79@naver.com

## 8. Verification

All checks pass:
- `npm test -- --run` — 24/24 tests pass
- `npm run build` — web PWA builds clean
- `npm run mobile:typecheck` — no TypeScript errors

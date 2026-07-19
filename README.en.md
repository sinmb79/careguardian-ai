# CareGuardian AI

A `web + mobile` care continuity platform that turns caregiver knowledge into a reusable operating manual. The web app stays as the fast demo and backup surface, while the mobile app is now the real delivery target for phones and tablets.  
[한국어](./README.md)

```mermaid
flowchart LR
  Core["packages/care-core"] --> Web["Web PWA"]
  Core --> Mobile["Expo Mobile App"]
  Web --> Pages["GitHub Pages"]
  Mobile --> Android["Android phone / tablet"]
  Mobile --> IOS["iPhone / iPad"]
  Mobile --> EAS["EAS Build"]
```

## Snapshot

| Item | Status | Notes |
|---|---|---|
| Shared care core | Done | `packages/care-core` now owns manual, schedule, reminder, and relay logic |
| Web PWA | Done | Existing Pages demo and backup path remain intact |
| Expo mobile app | Closed-test candidate | Android `1.0.1`, production AAB and Play closed-test preparation |
| Android emulator verification | Done | Release APK launch and primary-screen rendering confirmed |
| iOS delivery prep | Done | `apps/mobile/eas.json` added for EAS cloud builds |
| Local encryption and lock | Done | SQLCipher, separated SecureStore key, device authentication, background relock, and screen-capture blocking |
| Medication notification prep | Done | Privacy-safe daily local reminders with schedule/cancellation verification |

## Architecture

```mermaid
flowchart TD
  Core["Shared Care Core"] --> WebState["Web State + Web Storage"]
  Core --> MobileState["Mobile State + SQLCipher/SecureStore"]
  WebState --> WebUI["Vite React PWA"]
  MobileState --> MobileUI["Expo React Native UI"]
  MobileState --> MobileAuth["Device authentication + privacy lock"]
  MobileState --> MobileNotify["Privacy-safe local notifications"]
```

## Workspace

| Path | Responsibility | Notes |
|---|---|---|
| `src` | Existing web PWA | GitHub Pages demo remains live |
| `apps/mobile` | Expo app | Android, iPhone, and iPad target |
| `packages/care-core` | Shared domain | Imported by both web and mobile |
| `docs/mobile-delivery.md` | Delivery guide | Android + iOS setup and build notes |
| `CLAUDE.md` | Claude Code handoff | Follow-on collaboration entrypoint |

## Run locally

```bash
npm install
npm run dev
npm test -- --run
npm run build
npm run mobile:typecheck
```

## Run on Android

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:JAVA_HOME\bin;$env:Path"
npm run mobile:android:go
```

Korean: 위 명령은 Expo Go 기준의 빠른 UI 확인용입니다. 복약 알림 같은 네이티브 모듈 검증은 `npm run mobile:android:dev`로 진행합니다.  
English: The command above is the quick Expo Go path. Validate native modules such as medication notifications with `npm run mobile:android:dev`.

## Store build commands

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile preview
```

Korean: 이 저장소는 이미 `@sinmb79/careguardian-ai-mobile` EAS 프로젝트와 연결돼 있습니다.  
English: This repository is already linked to the `@sinmb79/careguardian-ai-mobile` EAS project.

## Current constraints

1. The current closed test permits fictional people, medicines, and contacts only. Real health or medication data remains out of scope until real-device forensic, network, and notification-matrix validation is complete.
2. Expo Go is not a native security or notification verification target. Play candidates are built only as EAS production AABs.
3. The iOS simulator cannot run directly on Windows.

## Public links

```text
GitHub Repository: https://github.com/sinmb79/careguardian-ai/
GitHub Pages: https://sinmb79.github.io/careguardian-ai/
```

## Reference docs

1. [Mobile delivery guide](./docs/mobile-delivery.md)
2. [Closed-test operations guide](./docs/private-test-operations.md)
3. [Security and safety readiness audit (Korean)](./docs/security/private-test-readiness-2026-07-20.md)
4. [Claude Code handoff](./CLAUDE.md)
5. [Mobile design spec](./docs/superpowers/specs/2026-04-10-mobile-delivery-design.md)

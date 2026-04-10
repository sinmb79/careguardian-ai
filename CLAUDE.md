# Claude Code Handoff

한국어: 이 저장소는 이제 `웹 데모 + Expo 모바일 앱 + 공용 돌봄 코어` 구조입니다. Claude Code는 문서 확인 후 `apps/mobile` 중심으로 이어서 작업하면 됩니다.  
English: This repository now uses a `web demo + Expo mobile app + shared care core` structure. Claude Code should review the docs first and continue from `apps/mobile`.

## 먼저 읽을 문서 / Read First

1. `README.md`
2. `docs/mobile-delivery.md`
3. `docs/superpowers/specs/2026-04-10-mobile-delivery-design.md`
4. `docs/superpowers/plans/2026-04-10-mobile-delivery-implementation.md`

## 핵심 경로 / Key Paths

| 경로 | 역할 |
|---|---|
| `packages/care-core` | 웹과 모바일이 공유하는 돌봄 도메인 로직 |
| `apps/mobile` | Expo Android/iOS/iPad 앱 |
| `src` | 기존 웹 PWA |
| `docs/mobile-delivery.md` | 로컬 실행, Android, iOS 배포 메모 |

## 추천 명령 / Recommended Commands

```powershell
npm test -- --run
npm run build
npm run mobile:typecheck
npm run mobile:android
```

## 현재 주의점 / Current Warnings

한국어: Expo Go에서는 `expo-notifications`가 완전하지 않으므로, 다음 단계는 `npm run mobile:android:dev` 또는 `eas build` 기반 dev client 검증입니다.  
English: `expo-notifications` is not fully supported in Expo Go, so the next step is dev client verification via `npm run mobile:android:dev` or `eas build`.

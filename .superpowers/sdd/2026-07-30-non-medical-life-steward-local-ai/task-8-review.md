# Task 8 독립 검토 보고서

- 검토일: 2026-07-30 (Asia/Seoul)
- 수정 재검토 범위: `1e3bb8e..d50d453`
- 전체 Task 8 범위: `55ea3f1..d50d453`
- 검토 방식: 구현·문서·자산의 읽기 전용 대조 후 테스트와 빌드 재실행

## 판정

| 항목 | 판정 |
|---|---|
| SPEC | **PASS** |
| QUALITY | **PASS** |
| Critical findings | **0** |
| Important findings | **0** |
| Minor findings | **0** |

Task 8 범위에서 해결해야 할 추가 결함은 발견하지 못했습니다. 아래 Task 9·Task 10 차단기는 누락이 아니라 의도적으로 보존된 출시 전 게이트입니다.

## 검토 근거

### 1. 공개 출시 표면과 Play 문안

- 한국어·영문 README는 제품을 일반 개인 생산성 도구로 설명합니다 (`README.md:5`, `README.en.md:5`).
- 공개 스토어 짧은 설명은 로컬 AI보다 개인 작업공간의 일정·메모·체크리스트 생산성을 우선합니다 (`docs/store-listing.md:11`, `docs/store-listing.md:54`).
- 한국어 전체 설명은 로컬 AI를 선택 설치 기능으로 두고, 기존 텍스트의 요약·문장 다듬기·제목 제안·체크리스트 초안의 네 동작만 제공하며 자유 대화형 기능이 아님을 명시합니다 (`docs/store-listing.md:22`). 영문 설명도 같은 제한을 유지합니다 (`docs/store-listing.md:60`).
- README, 공개 스토어 설명, 개인정보처리방침을 대상으로 `복약|투약|질환|알레르기|진단|치료|health|medical|Medication and Treatment`를 검사한 결과 공개 문구는 0건이었습니다. 개인정보처리방침 역시 일반 개인 생산성 도구와 로컬 저장 경계로 중립화되어 있습니다 (`public/privacy-policy.html:15`, `public/privacy-policy.html:40`).
- `docs/store-listing.md:39`의 `Health apps declaration`은 공개 설명이 아니라 Play Console 내부 설문 적용표이며, 실제 선택값 `My app doesn't provide any health features`를 정확히 기록합니다.
- 타깃 연령 18세 이상과 IARC 콘텐츠 등급은 별도 항목으로 구분되어 있고, IARC 값은 설문 후 확정하도록 되어 있습니다 (`docs/store-listing.md:36-37`, `README.md:49`, `README.en.md:35`).
- 한국어·영문 스토어 전체 설명에서 내부 `Task`, `Data safety`, production AAB, 실기기 네트워크 관찰 운영 문구를 검사한 결과 0건이었습니다.

### 2. 알림 표시와 data payload

- 알림 표시 제목과 data payload의 경계가 README, 배포 문서, 스토어 문안, 개인정보처리방침에서 일치합니다 (`README.md:22`, `README.en.md:20`, `docs/mobile-delivery.md:29`, `docs/store-listing.md:21`, `public/privacy-policy.html:22`).
- 구현 타입과 생성 코드 모두 data payload를 `{ taskId }` 하나로 제한합니다 (`apps/mobile/src/notifications/lifeNotifications.ts:23`, `apps/mobile/src/notifications/lifeNotifications.ts:42`).
- 집중 테스트가 정확히 `{ taskId: "buy-fruit" }`를 검증합니다 (`apps/mobile/src/notifications/lifeNotifications.test.ts:42`).

### 3. Play App access와 보존된 차단기

- 새 설치는 저장 자료가 없어 잠금 없이 빈 작업공간으로 진입합니다 (`docs/security/private-test-readiness-2026-07-30.md:28`).
- 저장 후 재진입은 리뷰어 자신의 기기 PIN 또는 생체 인증을 사용하며 앱 계정·공용 암호·별도 리뷰 계정이 없습니다 (`docs/security/private-test-readiness-2026-07-30.md:29`).
- 생체 미사용 기기의 PIN fallback은 Task 10 실기기 검증 전에는 완료로 주장하지 않습니다 (`docs/security/private-test-readiness-2026-07-30.md:30`).
- Task 9 차단기인 이전 저장 자료·알림의 전체 삭제 포함 여부, CSP 부재, `npm audit --omit=dev`의 Critical 0 / High 19 / Moderate 10이 그대로 유지됩니다 (`docs/security/private-test-readiness-2026-07-30.md:36-38`).

### 4. 식별자·버전·자산 게이트

- 표시명과 앱 버전은 `생활후견 AI`, `1.1.0`, Android `versionCode 7`입니다 (`apps/mobile/app.json:3-5`, `apps/mobile/app.json:30`, `apps/mobile/package.json:3`).
- 기존 package `com.sinmb.careguardianai`, EAS slug `careguardian-ai-mobile`, EAS project ID `15b9e293-b631-4b77-8cfc-9937cd604dd4`가 보존되었습니다 (`apps/mobile/app.json:4`, `apps/mobile/app.json:23`, `apps/mobile/app.json:81`).
- 실제 자산은 feature graphic 1024×500, phone 4장 1080×1920, 7-inch 2장 900×1536, 10-inch 2장 1600×2560이며 문서값과 일치합니다 (`docs/mobile-delivery.md:64-67`). 캡처 스크립트는 8-bit opaque RGB, 8MB 이하, 2:1 이하 규격을 검사합니다 (`scripts/capture-screenshots.mjs:103-115`).
- 현재 스크린샷은 웹 PWA 기반 잠정 자산이며 Play 업로드 후보가 아닙니다. Task 10에서 Android Expo 실제 화면으로 교체해야 하는 출시 차단 게이트가 유지됩니다 (`docs/mobile-delivery.md:60`, `docs/mobile-delivery.md:69`, `docs/security/private-test-readiness-2026-07-30.md:39`, `docs/security/private-test-readiness-2026-07-30.md:54`).

## 재실행 결과

| 명령 | 결과 |
|---|---|
| `npm test -- --run` | PASS — 19 files / 169 tests |
| `npm run build` | PASS — TypeScript 검사와 Vite production build 완료 |
| `npm run mobile:typecheck` | PASS |
| `git diff --check 1e3bb8e..d50d453` | PASS |
| `git diff --check 55ea3f1..d50d453` | PASS |

검증 명령은 `package.json:19`, `package.json:26`, `package.json:29`의 현재 스크립트를 사용했습니다. 검토 후 작업 트리는 clean 상태였습니다.

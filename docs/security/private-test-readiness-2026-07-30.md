# 생활후견 AI 비공개 테스트 준비도

- 기준일: 2026-07-30 (Asia/Seoul)
- 대상: `생활후견 AI` Android `1.1.0` / `versionCode 7`
- 판정: **합성·비민감 데이터에 한해 조건부 준비**, production AAB·실기기 검증 전 실제 데이터는 `NO-GO`

## 현재 구현 근거

| 경계 | 현재 구현 | 비공개 테스트 확인 |
|---|---|---|
| 웹 저장 | 브라우저 IndexedDB 전용 | IndexedDB 접근 불가·삭제·다중 탭 충돌 경로 |
| 모바일 저장 | SQLCipher DB, SecureStore/Android Keystore 키 경계 | Samsung·Pixel에서 저장·잠금·삭제 포렌식 확인 필요 |
| 화면 보호 | 기기 인증, 백그라운드 잠금, 화면 캡처 차단 | 실기기 recent-app·screen capture 확인 필요 |
| 일반 알림 | 일반 제목과 `taskId`만 payload에 포함 | 권한·DND·절전·잠금화면 매트릭스 필요 |
| 로컬 AI | 고정 GGUF, 크기·SHA-256 검증, CPU 추론, 승인 전 미저장 | arm64 다운로드·중단·이어받기·삭제 필요 |
| 전체 삭제 | 추론 중지 → 알림 취소 → 모델·부분 파일 → DB → 키 → 메모리 | 삭제 후 저장소·알림 잔존 확인 필요 |

## 개인정보·네트워크 처리

- 계정, 광고, 분석 SDK, 원격 푸시와 사용자 본문 원격 전송 경로를 구현하지 않았습니다.
- 연락처, 위치, 마이크, 카메라, 외부 저장소 권한을 요청하지 않습니다.
- 사용자가 모델 설치를 선택할 때만 고정 Hugging Face GGUF 파일 요청이 발생합니다. 이때 호스트는 IP 주소와 일반 네트워크 메타데이터를 볼 수 있습니다.
- 프롬프트와 출력은 모델 다운로드 요청으로 전송하지 않으며, 로컬 AI 추론은 기기 CPU에서 수행합니다.
- Data safety 최종값은 아직 확정하지 않았습니다. Task 10에서 production AAB를 만들고 모델 미설치·설치·생성·삭제 상태의 실기기 네트워크 관찰을 마친 뒤 제출값을 확정합니다.

## Play App access

- 새 설치에는 저장된 자료가 없으므로 잠금 없이 빈 작업공간으로 진입합니다.
- 저장된 작업공간이 있는 재진입은 리뷰어 자신의 기기 PIN 또는 생체 인증으로 엽니다. 앱 계정, 공용 암호, 별도 리뷰 계정은 없습니다.
- Task 10에서 생체 인증을 사용하지 않는 기기에서 PIN fallback을 확인해야 합니다. 이 확인 전에는 접근 흐름이 모든 기기에서 동일하게 동작한다고 주장하지 않습니다.

## 현재 차단·위험 기록

| 항목 | 현재 상태 | 해소 기준 |
|---|---|---|
| 이전 건강형 데이터·알림 전체 삭제 | **미충족**. 별도 이전 테스트 데이터 삭제 경로는 있으나, 현재 전체 삭제가 그 이전 저장소·알림까지 포함하는지는 보장하지 않습니다. | Task 9에서 release blocker로 검증·수정하고 회귀 증거를 남김 |
| Content Security Policy | **미충족**. `index.html`의 CSP 방어가 없습니다. | Task 9에서 release blocker로 정책·빌드 호환성 확인 |
| production 의존성 감사 | `npm audit --omit=dev`: Critical 0 / High 19 / Moderate 10 (2026-07-30 `npm ci` 직후) | Task 9에서 AAB 도달 가능성, owner, 검토일·만료일이 있는 risk acceptance gate를 통과해야 함 |
| 현재 스크린샷 | 실제 웹 PWA 렌더이며 잠정 검토 자산입니다. Android 앱 화면으로 제출할 수 없습니다. | Task 10에서 Expo Android 실제 화면으로 phone 4장·tablet 4장을 재캡처해 같은 파일을 교체하는 출시 차단 게이트 |

## 현재 범위와 금지 범위

비공개 테스트는 합성·비민감 생활 일정, 목록, 메모, 체크리스트만 다룹니다. 기능 제한형 로컬 문서 보조 도구로서 임의 URL, 코드, 플러그인 실행을 제공하지 않으며, AI 결과는 사용자가 승인하기 전 저장하지 않습니다. 실제 개인정보·민감정보, 계정 자격증명, 실제 연락처·위치 정보는 테스트에 사용하지 않습니다.

## Task 10 전 필수 게이트

1. `npm ci`, 전체 테스트, 웹 build, mobile typecheck를 새 lockfile에서 통과
2. Expo prebuild로 name `생활후견 AI`, version `1.1.0`, versionCode `7`, package·EAS 식별자 보존 확인
3. production AAB의 권한, ABI, `allowBackup=false`, debug/development surface 부재 검사
4. Samsung과 Pixel에서 저장·잠금·삭제·일반 알림·로컬 AI의 합성 데이터 smoke
5. 모델 다운로드 외 네트워크 동작과 모델 설치 시 메타데이터 노출 경계 관찰
6. Play Console에서 Productivity·18+·비건강 앱 상태, 최신 문안·자산·Data safety를 최종 AAB와 대조
7. Task 9의 이전 데이터·알림 삭제, CSP, production 의존성 위험 승인 게이트를 해소 또는 명시적으로 차단
8. Task 10의 Android Expo 실제 화면 재캡처가 완료되기 전에는 현재 PNG를 Play에 업로드하지 않음

## 역사 자료 경계

`docs/security/private-test-readiness-2026-07-20.md`와 과거 건강형 Play 관련 문서는 이전 구현의 역사 기록입니다. 현재 출시 근거·스토어 등록·Data safety 근거로 사용하지 않습니다.

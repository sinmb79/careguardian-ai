# Task 19 구현·검증 보고서

작성일: 2026-07-31
대상 브랜치: `codex/non-medical-local-ai-closed-test`

## 결론

비공개 테스트용 한국어 Play Console 문안을 현재 비의료·로컬 우선 구현에 맞게
확정했다. 승인 문안, 네 필드 글자 수, 의료 오분류 관련 금지어, 필수 고지 문장,
한국어 섹션 중복을 `non-medical-release` 게이트에 연결했다. 영문 참고 번역과
Data safety 입력 기준도 Android 전용 로컬 알림, 선택형 Hugging Face 모델 요청,
iOS 알림 미지원, 기기 내 삭제와 외부 기록 한계에 맞춰 대조했다.

구현 커밋:

- `26b33c72331bb16022bbe03e9764ac0890efaa2c`
- 구현 tree: `fa17d5f2f15637ba74513c9914fd217d7be23b37`

## 문안 지표

`node scripts/check-non-medical-release.mjs` 결과:

| 필드/계약 | 결과 |
|---|---:|
| 앱 이름 | 7 / 30자 |
| 짧은 설명 | 50 / 80자 |
| 전체 설명 | 1,379 / 4,000자 |
| 출시 노트 | 160 / 500자 |
| 필수 비의료 고지 문장 | 1회 |
| 고지 문장 밖 `건강\|의료` | 0건 |
| 전체 설명 `복약\|진단\|치료` | 0건 |
| 출시 노트 의료 관련 금지어 | 0건 |
| 한국어 네 섹션 제목 | 각각 1회 |

게이트 상태는 `pass`, 문제는 0건이었다.

## RED → GREEN 증거

### 최초 문안 계약

아래 집중 테스트를 구현 전에 실행했다.

```powershell
node --test --test-name-pattern "Play Store|Play Console|health terms outside" scripts/check-non-medical-release.node-test.mjs
```

RED 결과:

- Play Store 문서가 릴리스 inventory에 포함되지 않음
- 승인 짧은 설명 드리프트를 통과함
- 네 필드 제한 초과를 통과함
- 필수 고지 밖 추가 `건강` 표현을 통과함
- 4 tests, 0 pass, 4 fail

구현 후 동일 범위와 제목 중복 테스트는 5 tests, 5 pass, 0 fail이었다.

### 독립 리뷰 보완

승인된 첫 섹션 뒤에 동일한 한국어 `###` 제목을 추가해도 기존 extractor가 첫
섹션만 읽고 통과하는 RED를 확인했다.

```powershell
node --test --test-name-pattern "duplicate Korean Play Console" scripts/check-non-medical-release.node-test.mjs
```

RED 결과는 1 test, 0 pass, 1 fail이었다. 네 한국어 제목의 실제 출현 횟수를
각각 정확히 1회로 고정한 뒤 전체 집중 범위가 5/5로 통과했다. 테스트에서
불필요해진 수동 `baseline.set`도 제거했다.

## 전체 검증

최종 구현 상태에서 `npm run verify`가 종료 코드 0으로 성공했다.

- Vitest: 30 files, 298 tests 통과
- 웹 production build 통과
- 모바일 TypeScript 통과
- Expo Doctor: 18/18 통과
- static security, non-medical policy, model registry, audit policy,
  release workflow 통과
- 정책 게이트 테스트: 193개 통과
- no-remote-push 테스트: 35개 통과
- production audit: Critical 0, High 19, Moderate 9의 제한 수용 기준선 유지

`verify:no-remote-push`의 `releaseBinaryPair`는 `false`다. 따라서 이 보고서는
소스·문안 게이트의 통과만 증명하며 최종 AAB/universal APK의 FCM 부재나 Play
업로드 완료를 주장하지 않는다.

## 반영된 사실과 제한

- Android 앱이 선택 날짜 오전 9시를 기준으로 로컬 알림을 직접 예약한다.
- 배터리 절전과 Android 정책에 따라 알림이 정확한 시각보다 늦을 수 있다.
- 일반 제목과 작업 식별자만 사용하며 원격 푸시는 없다.
- iOS 알림은 현재 버전에서 지원하지 않는다.
- 선택형 NAVER HyperCLOVA X GGUF만 Hugging Face에서 내려받고 기기 CPU에서
  실행한다.
- Hugging Face가 IP 주소와 일반 네트워크 메타데이터를 기록할 수 있지만 작업
  내용과 AI 입력·결과는 보내지 않는다.
- 계정, 광고, 분석 SDK, 클라우드 AI를 사용하지 않는다.
- 앱의 전체 삭제는 기기 내 데이터·모델·부분 다운로드·키·예약 알림을 다루며,
  Hugging Face가 독립 보관한 기록에는 해당 서비스의 삭제 절차가 적용된다.

## 후속 인수 조건

이 Task에서는 Play Console을 조작하거나 AAB를 생성·업로드하지 않았다. 실제
비공개 테스트 업데이트 전에는 정확한 source tree로 만든 AAB와 universal APK
쌍에 `verify:no-remote-push:artifacts`를 통과시키고, 그 AAB의 서명·versionCode·
실기기 동작을 확인한 뒤 검증한 동일 파일만 업로드해야 한다.

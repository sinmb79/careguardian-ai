# Google Play 조직 계정 거부 보완 계획

- 확인일: 2026-07-22 (Asia/Seoul)
- 앱: CareGuardian AI (`com.sinmb.careguardianai`)
- 거부 적용일: 2026-07-20
- 정책 영역: `Play Console Requirements`
- 문제 위치: `Developer Account`

## 결론

Google은 CareGuardian AI의 코드나 AAB 결함이 아니라 **개인 개발자 계정으로 건강·의료 앱을 제출한 것**을 이유로 변경사항을 거부했다. Play Console 이메일과 정책 상태에는 다음 취지의 사유가 표시됐다.

> 일부 앱 유형은 조직만 배포할 수 있다. 조직 계정이 필요한 앱 카테고리 또는 기능을 선택했다.

현재 계정 `22B`는 `개인`이며 공식 웹사이트가 등록되지 않았다. `개발자 계정 > 내 정보`의 `계정 유형 변경` 버튼은 비활성화되어 있고, 도움말은 먼저 조직의 웹사이트를 제공하고 인증하라고 안내한다.

CareGuardian AI는 약 이름·시각 입력, DAILY 복약 타임라인, 매일 반복되는 로컬 복약 알림을 실제로 제공한다. 따라서 Play의 `Medication and Treatment Management` Health 선언과 `Medical` 카테고리는 정확하다. 이를 `건강 기능 없음`이나 비의료 카테고리로 바꾸는 것은 보완이 아니라 사실과 다른 선언이므로 금지한다.

## 권장 해결책: 기존 계정을 조직 계정으로 전환

새 계정으로 앱을 이전하는 것보다 기존 개인 계정을 조직 계정으로 직접 전환하는 경로가 우선이다. 이 경로는 현재 패키지명, Play App Signing, Closed Alpha 설정과 테스터 목록을 보존할 가능성이 가장 높다.

### 보스가 준비해야 하는 조직 정보

- 실제로 존재하는 회사·사업자·비영리·학술기관 등 조직의 법적 이름
- 조직의 D-U-N-S 번호
- D&B에 등록된 법적 이름·주소와 일치하는 조직 문서
- 조직을 대표하는 공식 웹사이트와 그 사이트를 인증할 수 있는 Google 계정
- 조직 대표 전화번호
- Google 연락용 이메일·전화번호
- Play에 공개할 개발자 이메일·전화번호

D-U-N-S 번호나 법적 조직이 없다면 건강 기능을 유지한 채 개인 계정으로 재제출할 수 없다. 이 경우 먼저 조직을 준비하거나, 복약·건강 기능 전체를 제거하는 별도 제품 피벗을 결정해야 한다.

### Play Console 실행 순서

1. `개발자 계정 > 내 정보`에서 공식 웹사이트를 등록한다.
2. Search Console 연계를 포함한 웹사이트 인증 요청을 완료한다.
3. 웹사이트가 인증되면 활성화되는 `계정 유형 변경`을 선택한다.
4. 조직 결제 프로필을 생성하거나 선택하고 D-U-N-S 번호를 입력한다.
5. 조직 유형·규모·전화번호와 연락처를 입력하고 OTP 및 요청된 조직 문서를 검증한다.
6. 검증된 결제 프로필을 개발자 계정에 연결한 뒤 조직 계정 전환을 확정한다.
7. 전환 완료 후 Google 시스템 동기화를 위해 **최소 72시간 동안 재제출하지 않는다.**
8. 72시간 이후 `게시 개요`에서 대기 중인 13개 변경사항을 다시 검토 제출한다.
9. Google 승인과 Closed Alpha 설치 가능 상태를 확인한 뒤 실제 고유 opt-in 12명 이상을 14일 연속 추적한다.

계정 전환과 재제출은 외부 상태를 바꾸고 조직 신원정보를 Google에 전송하므로, 정확한 조직 정보와 보스의 실행 시점 승인을 받은 뒤 진행한다.

## 대안: 새 조직 계정으로 앱 이전

앱의 법적 소유 주체가 현재 계정 소유자와 달라야 할 때만 고려한다. 새 조직 계정 등록비가 발생하고 두 계정이 모두 활성 상태여야 한다. 앱·스토어 등록정보·평점 등은 이전되지만 내부·비공개·공개 테스트 그룹은 이전되지 않으므로, 테스터 목록을 다시 만들고 참여자가 다시 opt-in해야 한다. 현재 12명/14일 일정도 다시 시작할 위험이 있다.

## 코드와 선언에 대한 결정

- 새 AAB 빌드: 이번 거부 해결에는 불필요
- `Medical` 카테고리: 유지
- Health 선언 `Medication and Treatment Management`: 유지
- 의료기기 아님·진단/치료/처방/복약이행 확인/응급 호출 미제공 문구: 유지
- Data safety `수집 없음/공유 없음`: 이번 거부 영역이 아니므로 추측으로 변경하지 않음
- 실제 개인정보·건강정보 테스트: 계속 금지, 합성 데이터만 허용
- 이의신청: 계정 유형 판정이 사실과 다르다는 증거가 없으므로 현재는 권장하지 않음

## 재검증

- Play Console 정책 상태·거부 이메일·계정 세부정보를 직접 대조했다.
- `npm run verify` 통과: Vitest 25개 파일/66개 테스트, 웹 production build, 모바일 TypeScript 검사, Expo Doctor 18/18.
- 앱 코드와 AAB는 변경하지 않았다. 이번 거부를 해결하지 못하는 불필요한 새 빌드는 만들지 않았다.

## 공식 근거

- [Play Console Requirements](https://support.google.com/googleplay/android-developer/answer/10788890)
- [개발자 계정 유형 선택](https://support.google.com/googleplay/android-developer/answer/13634885)
- [개인 계정을 조직 계정으로 전환](https://support.google.com/googleplay/android-developer/answer/16260648)
- [조직 개발자 계정 필수 정보](https://support.google.com/googleplay/android-developer/answer/13628312)
- [Health apps 선언 작성](https://support.google.com/googleplay/android-developer/answer/14738291)
- [Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511)
- [다른 개발자 계정으로 앱 이전](https://support.google.com/googleplay/android-developer/answer/6230247)

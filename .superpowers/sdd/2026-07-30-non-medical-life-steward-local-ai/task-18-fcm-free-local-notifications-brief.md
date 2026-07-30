# Task 18 — FCM 없는 Android 기기 내 일반 알림

## 배경

`expo-notifications`가 Android 릴리스에 Firebase Messaging, Firebase Installations,
Cloud Messaging, ShortcutBadger 표면을 남겼다. 기존의 도달 가능한 일반 생활 알림과
완전 삭제 계약은 유지하면서 원격 푸시 공격 표면을 의존성, 매니페스트, 조립
산출물에서 제거한다.

## 제품 계약

1. `apps/mobile/modules/life-local-notifications`에 Android 전용 로컬 Expo Module을 둔다.
2. 채널 ID는 `life-steward-local-v2`, 중요도는 HIGH, 잠금화면 공개 범위는 SECRET,
   배지는 비활성화한다. 이전 `life-steward-tasks-v1` 채널은 마이그레이션에서 삭제한다.
3. 예약은 `AlarmManager.setAndAllowWhileIdle`을 사용한다. 정시 알람 권한, 네트워크,
   원격 푸시, FCM/FID, ShortcutBadger를 사용하지 않는다. 절전 정책 때문에 알림은
   설정 시각 이후로 지연될 수 있다.
4. 앱 비공개 `SharedPreferences` ledger에는 제한된 `identifier`, 미래 `epochMs`,
   identifier에서 검증·도출한 `taskId`만 저장한다.
5. PendingIntent identity는 앱 고정 action/package와 안정적인 digest 기반 request
   code/data로 만들며, 수신기는 ledger의 identifier와 epoch가 정확히 일치할 때만
   알림을 소비하고 표시한다.
6. 제목은 `생활 일정 알림`, 본문은 빈 문자열, data는 taskId만 사용한다.
   `localOnly=true`, SECRET, autoCancel을 적용하고 임의 URL·메모·본문은 저장하거나
   표시하지 않는다.
7. due-alarm receiver와 boot/package-replaced restore receiver는 모두 enabled=true,
   exported=false다. 복원은 미래 ledger만 다시 예약하고 오래된 항목을 제거한다.
8. `schedule`은 Android 알림 권한을 네이티브에서도 확인한 뒤 ledger를 쓰며,
   실패하면 alarm과 ledger를 롤백한다.
9. `cancel`, `cancelAll`, due-alarm 소비, reboot 복원은 프로세스 전역 lock으로
   직렬화한다. 전체 삭제는 이전 Expo 상태, 현재 alarm, 표시된 알림, ledger를
   독립적으로 지우고 실제 잔존 여부를 확인한다.
10. Android JS adapter는 새 모듈만 사용한다. iOS는 이번 비공개 테스트 범위에서
    기기 알림 미지원으로 명시하며 날짜 저장 자체는 유지한다.

## 제거 계약

- `expo-notifications` 패키지, lockfile 항목, config plugin과 이전 로컬 전용 plugin 제거
- C2DM, FCM/Firebase Messaging/Installations/DataTransport registrar,
  cloud messaging, ShortcutBadger/badge 권한·컴포넌트·메타데이터 제거
- AD_ID, VIBRATE, 정시 알람 권한 제거
- legacy Expo PendingIntent, SharedPreferences, 설치 식별자 파일, 이전 채널을
  허용된 고정 문자열만으로 1회 정리

## 검증 계약

1. TS 회귀 테스트가 sync, future-only, rollback, prefix 취소, 개인정보 비노출,
   Task 15 clock 계약을 보존한다.
2. 소스 계약 테스트와 실제 Kotlin 컴파일이 입력 검증, receiver privacy, ledger
   일치, reboot 복원, 전체 삭제, 네이티브 권한 확인을 검증한다.
3. clean Expo prebuild, autolink, resolved release dependency, merged release manifest,
   두 로컬 모듈 Kotlin 컴파일, release Metro bundle이 하나의 네이티브 게이트에서
   성공해야 한다.
4. `verify:no-remote-push`는 lockfile, Gradle resolved dependency report와 미래의
   AAB·universal APK 쌍을 검사한다. ZIP은 스트리밍·크기 제한·경로 안전성 검사를
   적용하고 DEX/패키지/매니페스트에서 금지 표면을 탐지한다.
5. 소스 게이트 성공만으로 최종 바이너리의 FCM 부재를 주장하지 않는다. Task 14가
   정확한 AAB와 universal APK 쌍을 만든 뒤 두 산출물을 함께 통과시켜야 한다.

## 범위 제한

- 사용자 작업공간, 합성 데이터, 모델 파일, 로컬 AI 경로는 변경하지 않는다.
- Task 14의 실제 AAB/EAS/Play 배포는 수행하지 않는다.
- 실패한 임시 산출물은 Task 18 전용 경로에서만 정리한다.

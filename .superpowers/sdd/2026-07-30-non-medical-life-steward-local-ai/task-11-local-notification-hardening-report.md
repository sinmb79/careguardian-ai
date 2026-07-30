# Task 11 Android 로컬 알림 전용 하드닝 보고서

## 상태

`DONE`

`expo-notifications`의 로컬 예약 알림 기능은 유지하면서, 최종 Android
release 병합 매니페스트에서 원격 푸시 수신·초기화·등록 표면과 런처 배지
권한을 제거했습니다. 구현 커밋은
`443351beb3e9707ca395e6bda3b2f486f683673c`입니다.

## TDD 및 변이 검증

생산 코드 변경 전에 다음 실패를 확인했습니다.

- 순수 매니페스트 하드닝 함수가 없어서 export 및 동작 테스트가 실패했습니다.
- 원격 FCM/C2DM 표면이 있는 현재 매니페스트 fixture가 차단되지 않았습니다.
- 필수 로컬 receiver/activity/permission 또는 disable metadata를 제거·변조한
  17개 변이가 차단되지 않았습니다.
- CLI verifier가 실패 fixture에도 성공 종료했습니다.
- 정책 게이트가 정확한 플러그인 제거 계약과 외부 링크 변이를 충분히
  차단하지 못했습니다.

구현 후 `npm run release:policy-check:test`에서 **75개 단위·fixture·변이
테스트가 모두 통과**했습니다. 여기에는 하드닝 플러그인의 멱등성, 모든
금지 표면, 필수 로컬 표면, 세 disable flag, verifier CLI의 성공·실패 종료
계약이 포함됩니다.

## 소스 및 정책 게이트

```powershell
npm run release:policy-check
```

결과: **111개 파일 검사, 문제 0개**.

추가로 다음 검증을 통과했습니다.

- `npm test -- --run`: 30개 파일, 280개 테스트 통과
- `npm run mobile:typecheck`: 통과
- `git diff --check`: 통과

## 실제 release 병합 매니페스트 검증

Unicode 경로의 주 작업트리에서는 Expo clean prebuild 직후 Windows 네이티브
프로세스가 `0xC0000005`로 종료되는 환경 문제가 재현되었습니다. 코드 오류로
판정하지 않고 ASCII 경로 작업트리와 휴대용 Node.js 22.23.2로 동일 커밋을
검증했습니다.

- ASCII 작업트리:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-final-android-v7-20260731`
- 실행: clean Expo prebuild → `:app:processReleaseManifest` → 전용 verifier
- Gradle 결과: **BUILD SUCCESSFUL (47초)**
- verifier 결과: **pass, problems 0**
- 병합 매니페스트:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-final-android-v7-20260731\apps\mobile\android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml`

증거용으로 보존한 동일 병합 결과는 다음과 같습니다.

- 경로:
  `C:\Users\sinmb\AppData\Local\Temp\careguardian-task11-ascii-manifest-20260731\generated-android\app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml`
- SHA-256:
  `AE7A3BCFB406A4BEAE6C8712CCC0E576BB8EF14B4D57EF7A41A9497FEA712A9D`

검증 후 기존 ignored Android 트리를 원래 위치에 복원했고 임시 backup은
남기지 않았으며, 원본 작업트리는 clean 상태였습니다.

## 제거된 원격 푸시 및 배지 표면

최종 병합 매니페스트에 다음 항목이 없습니다.

- `com.google.android.c2dm.permission.RECEIVE`
- Expo Firebase messaging service
- Firebase Instance ID receiver
- Firebase Messaging service
- Firebase init provider
- Firebase component discovery service
- Messaging, Installations, DataTransport Firebase registrar
- ShortcutBadger가 추가하는 16개 런처 배지 권한

Firebase/DataTransport 라이브러리 의존성 자체를 제거했다고 주장하지
않습니다. 이번 하드닝의 검증 대상은 원격 푸시의 시작·수신·등록·권한
표면을 최종 병합 매니페스트에서 제거하는 것입니다.

## 유지된 로컬 알림 표면

남아 있는 권한은 정확히 다음과 같습니다.

- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.DETECT_SCREEN_CAPTURE`
- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.RECEIVE_BOOT_COMPLETED`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`
- `android.permission.VIBRATE`
- `android.permission.WAKE_LOCK`
- `com.sinmb.careguardianai.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

남아 있는 component는 다음과 같습니다.

- activities: `com.google.android.gms.common.api.GoogleApiActivity`,
  `com.sinmb.careguardianai.MainActivity`,
  `expo.modules.notifications.service.NotificationForwarderActivity`
- receivers: `androidx.profileinstaller.ProfileInstallReceiver`,
  `com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver`,
  `expo.modules.notifications.service.NotificationsService`
- services:
  `com.google.android.datatransport.runtime.backends.TransportBackendDiscovery`,
  `com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService`
- providers: `androidx.startup.InitializationProvider`,
  `expo.modules.filesystem.FileSystemFileProvider`

`NotificationsService`에는 다음 로컬 복원·처리 action이 유지됩니다.

- `expo.modules.notifications.NOTIFICATION_EVENT`
- `android.intent.action.BOOT_COMPLETED`
- `android.intent.action.REBOOT`
- `android.intent.action.QUICKBOOT_POWERON`
- `com.htc.intent.action.QUICKBOOT_POWERON`
- `android.intent.action.MY_PACKAGE_REPLACED`

다음 방어적 metadata도 정확히 `false`로 유지됩니다.

- `firebase_messaging_auto_init_enabled=false`
- `firebase_analytics_collection_enabled=false`
- `google_analytics_adid_collection_enabled=false`

## 변경 파일

- `apps/mobile/plugins/with-local-only-notifications.js`
- `apps/mobile/plugins/with-local-only-notifications.node-test.cjs`
- `apps/mobile/scripts/fixtures/android-manifests/current-remote.xml`
- `apps/mobile/scripts/fixtures/android-manifests/hardened-local.xml`
- `apps/mobile/scripts/verify-android-release-manifest.mjs`
- `apps/mobile/scripts/verify-android-release-manifest.node-test.mjs`
- `apps/mobile/scripts/verify-android-release.mjs`
- `apps/mobile/scripts/verify-native-android-contracts.mjs`
- `package.json`
- `scripts/check-non-medical-release.mjs`
- `scripts/check-non-medical-release.node-test.mjs`
- Task 11 brief 및 본 보고서

## 자체 검토 및 남은 확인

- 로컬 예약 알림에 필요한 permission, receiver, activity와 재부팅·앱 교체
  복원 action을 제거하지 않았습니다.
- 금지·필수 surface와 disable flag를 소스 정책 게이트 및 실제 Gradle 병합
  결과 양쪽에서 fail-closed로 확인했습니다.
- `GoogleApiActivity`와 DataTransport runtime component는 남아 있지만,
  Firebase init/component discovery/FCM receive 표면은 없습니다.
- `INTERNET`은 모델 다운로드에 필요하며 `ACCESS_NETWORK_STATE`와
  `WAKE_LOCK`은 transitive surface로 남습니다.
- 최종 서명 APK에서 예약 알림 표시, 취소, 부팅 복원을 확인하는 기기 smoke는
  통합 컨트롤러의 별도 단계입니다.

## 커밋

- 구현 및 회귀 테스트:
  `443351beb3e9707ca395e6bda3b2f486f683673c`
- 본 검증 보고서: 후속 문서 전용 커밋

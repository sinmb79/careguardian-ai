# Task 10 독립 출시 설정 검토

대상 커밋: `ade0ee82bd144681e19075fb155988c3d327ea2d`
검토 범위: `apps/mobile/eas.json`, 비의료 출시 정책 및 mutation test
검토 일시: 2026-07-31 (KST)

## 판정

**PASS — Critical 0 / Important 0 / Minor 0**

## 확인 결과

- `cli.appVersionSource`가 `local`이고 production `autoIncrement`이 명시적으로 `false`입니다. 따라서 EAS는 원격 버전 값을 우선하거나 production 빌드 중 Android `versionCode`를 자동 증가시키지 않고, 검토 대상 `app.json`의 `version: 1.1.0`, `android.versionCode: 7`을 사용합니다. Expo의 공식 app-version 문서도 local source에서는 EAS가 프로젝트의 version 값을 읽어 그대로 빌드하며, `autoIncrement: false`는 자동 bump를 하지 않는다고 명시합니다.
- production Android 산출물은 `buildType: app-bundle`로 고정되어 있어 Play 업로드용 AAB 계약도 함께 검증됩니다.
- release gate의 정확한 파일 인벤토리에 `apps/mobile/eas.json`이 포함되었습니다. `validateIdentity`는 `appVersionSource === "local"`, production `autoIncrement === false`, `android.buildType === "app-bundle"`를 모두 exact 비교합니다. 누락, 다른 source, `true`, 또는 APK output은 모두 fail-closed입니다.
- 기존 mutation test는 `autoIncrement: true`를 red path로 검증합니다. 독립 실행으로 추가 확인한 `appVersionSource: "remote"`, `buildType: "apk"`, production profile 누락도 각각 같은 EAS production policy 오류로 fail-closed되었습니다. 따라서 검증 대상 세 계약 모두 실제 gate에 연결되어 있습니다.

## 독립 실행 증빙

Portable Node `v22.23.2` / npm `10.9.8`:

```text
npm run release:policy-check                    PASS (checkedFiles 98)
node --test scripts/check-non-medical-release.node-test.mjs
                                                   PASS (19/19)
git diff --check ade0ee82^ ade0ee82             PASS
```

제품 파일은 수정하지 않았습니다. 이 보고서만 추가했습니다.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const moduleRoot = import.meta.dirname;
const mobileRoot = resolve(moduleRoot, "..", "..");
const repositoryRoot = resolve(mobileRoot, "..", "..");
const requiredFiles = [
  "package.json",
  "expo-module.config.json",
  "index.ts",
  "android/build.gradle",
  "android/src/main/AndroidManifest.xml",
  "android/src/main/java/expo/modules/lifelocalnotifications/LifeLocalNotificationsModule.kt",
  "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt",
  "android/src/main/java/expo/modules/lifelocalnotifications/LifeReminderReceiver.kt",
  "android/src/main/java/expo/modules/lifelocalnotifications/LifeRestoreReceiver.kt"
];

test("contains the complete Android-only local notification module", () => {
  for (const relativePath of requiredFiles) {
    assert.equal(existsSync(resolve(moduleRoot, relativePath)), true, relativePath);
  }
});

test("removes expo-notifications and its config plugin completely", () => {
  const app = JSON.parse(readFileSync(resolve(mobileRoot, "app.json"), "utf8")).expo;
  const mobilePackage = JSON.parse(readFileSync(resolve(mobileRoot, "package.json"), "utf8"));
  const rootPackage = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  const lockfile = readFileSync(resolve(repositoryRoot, "package-lock.json"), "utf8");

  assert.equal(mobilePackage.dependencies?.["expo-notifications"], undefined);
  assert.equal(app.plugins.includes("expo-notifications"), false);
  assert.equal(app.plugins.includes("./plugins/with-local-only-notifications"), false);
  assert.doesNotMatch(lockfile, /node_modules\/expo-notifications/);
  assert.match(rootPackage.scripts["verify:no-remote-push"], /verify-no-remote-push/);
});

test("uses only app-local alarms and private generic notifications", () => {
  const kotlinSources = requiredFiles
    .filter((path) => path.endsWith(".kt"))
    .map((path) => readFileSync(resolve(moduleRoot, path), "utf8"))
    .join("\n");

  assert.match(kotlinSources, /setAndAllowWhileIdle/);
  assert.doesNotMatch(kotlinSources, /setExact|SCHEDULE_EXACT_ALARM/);
  assert.match(kotlinSources, /MODE_PRIVATE/);
  assert.match(kotlinSources, /생활 일정 알림/);
  assert.match(kotlinSources, /setLocalOnly\(true\)/);
  assert.match(kotlinSources, /VISIBILITY_SECRET/);
  assert.match(kotlinSources, /life-steward-local-v2/);
  assert.match(kotlinSources, /setShowBadge\(false\)/);
  assert.match(kotlinSources, /BADGE_ICON_NONE/);
  assert.doesNotMatch(kotlinSources, /https?:|Firebase|C2DM|ShortcutBadger|RemoteInput/);
});

test("native scheduling fails closed when Android notification permission is unavailable", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  const scheduleBody = scheduler.match(
    /fun schedule\([\s\S]*?synchronized\(LOCK\) \{([\s\S]*?)\n  \}/
  )?.[1] ?? "";

  assert.match(scheduler, /Manifest\.permission\.POST_NOTIFICATIONS/);
  assert.match(scheduler, /PackageManager\.PERMISSION_GRANTED/);
  assert.match(scheduler, /notificationManager\.areNotificationsEnabled\(\)/);
  assert.match(scheduleBody, /requireNotificationsEnabled\(\)/);
  assert.ok(
    scheduleBody.indexOf("requireNotificationsEnabled()") <
      scheduleBody.indexOf("putString")
  );
});

test("declares only non-exported reminder and restore receivers", () => {
  const app = JSON.parse(
    readFileSync(resolve(mobileRoot, "app.json"), "utf8")
  ).expo;
  const manifest = readFileSync(
    resolve(moduleRoot, "android/src/main/AndroidManifest.xml"),
    "utf8"
  );
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android\.permission\.RECEIVE_BOOT_COMPLETED/);
  assert.match(manifest, /LifeReminderReceiver/);
  assert.match(manifest, /LifeRestoreReceiver/);
  assert.equal((manifest.match(/android:exported="false"/g) ?? []).length, 2);
  assert.doesNotMatch(manifest, /VIBRATE|C2DM|badge|firebase|SCHEDULE_EXACT_ALARM/i);
  assert.ok(
    app.android.blockedPermissions.includes(
      "android.permission.VIBRATE"
    )
  );
});

test("migrates every known Expo notification store and installation identifier fail-closed", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  for (const exactLegacyContract of [
    "expo.modules.notifications.SharedPreferencesNotificationsStore",
    "expo.modules.notifications.SharedPreferencesNotificationCategoriesStore",
    "notification_request-",
    "expo_notifications_installation_uuid.txt",
    "expo_notifications_registration_info.txt",
    "expo_installation_uuid.txt",
    "host.exp.exponent.SharedPreferences",
    "\"uuid\"",
    "expo.modules.notifications.NOTIFICATION_EVENT",
    "expo.modules.notifications.service.NotificationsService",
    "appendPath(\"scheduled\")",
    "appendPath(\"trigger\")"
  ]) {
    assert.match(scheduler, new RegExp(exactLegacyContract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(scheduler, /MIGRATION_COMPLETE/);
  assert.match(scheduler, /commit\(\)/);
  assert.match(scheduler, /noBackupFilesDir/);
  assert.match(scheduler, /NotificationManager/);
  assert.match(scheduler, /deleteNotificationChannel\(\"life-steward-tasks-v1\"\)/);
  assert.match(scheduler, /alarmManager\.cancelAll\(\)/);
  assert.doesNotMatch(scheduler, /\.clear\(\).*host\.exp\.exponent/s);
});

test("separates stored-entry structure validation from future schedule validation", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  assert.match(scheduler, /validateStoredEntry/);
  assert.match(scheduler, /validateFutureEntry/);
  const decodeBody = scheduler.match(
    /private fun decode\(value: String\): LedgerEntry \{([\s\S]*?)\n  \}/
  )?.[1] ?? "";
  assert.doesNotMatch(decodeBody, /System\.currentTimeMillis|validateFutureEntry/);
  assert.match(scheduler, /entry\.epochMs > nowMs[\s\S]*staleKeys/);
  assert.match(scheduler, /entry\.epochMs == epochMs/);
});

test("reconstructs the legacy Expo PendingIntent identity exactly", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  const legacyBody = scheduler.match(
    /private fun legacyPendingIntent[\s\S]*?\n  \}/
  )?.[0] ?? "";
  assert.match(legacyBody, /scheme\("expo-notifications"\)/);
  assert.match(legacyBody, /authority\("notifications"\)/);
  assert.match(legacyBody, /appendPath\("scheduled"\)/);
  assert.match(legacyBody, /appendPath\(identifier\)/);
  assert.match(legacyBody, /appendPath\("trigger"\)/);
  assert.match(legacyBody, /ComponentName\(context\.packageName, LEGACY_RECEIVER\)/);
  assert.doesNotMatch(legacyBody, /setPackage/);
});

test("serializes every ledger and AlarmManager transaction process-wide", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  assert.match(scheduler, /private val LOCK = Any\(\)/);
  for (const operation of [
    "schedule",
    "listIdentifiers",
    "cancel",
    "cancelAll",
    "cleanupLegacy",
    "restoreFuture",
    "consume"
  ]) {
    assert.match(
      scheduler,
      new RegExp(`fun ${operation}[\\s\\S]{0,160}synchronized\\(LOCK\\)`)
    );
  }
  assert.match(scheduler, /Local reminder alarm was not registered/);
});

test("keeps due-alarm consumption and publication atomic against full deletion", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  const receiver = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/LifeReminderReceiver.kt"
    ),
    "utf8"
  );
  const transaction = scheduler.match(
    /fun consumeAndShow[\s\S]*?synchronized\(LOCK\) \{([\s\S]*?)\n  \}/
  )?.[1] ?? "";

  assert.match(transaction, /consume\(/);
  assert.match(transaction, /show\(/);
  assert.match(receiver, /\.consumeAndShow\(identifier, epochMs\)/);
  assert.doesNotMatch(receiver, /\.consume\(|\.show\(/);
  assert.match(scheduler, /private fun show\(/);
});

test("wires autolink, Kotlin, and resolved runtime dependency release gates", () => {
  const nativeGate = readFileSync(
    resolve(mobileRoot, "scripts/verify-native-android-contracts.mjs"),
    "utf8"
  );

  assert.match(nativeGate, /expo-modules-autolinking/);
  assert.match(nativeGate, /life-local-notifications/);
  assert.match(nativeGate, /expo\.modules\.lifelocalnotifications\.LifeLocalNotificationsModule/);
  assert.match(nativeGate, /expo-notifications/);
  assert.match(nativeGate, /:life-local-notifications:compileDebugKotlin/);
  assert.match(nativeGate, /releaseRuntimeClasspath/);
  assert.match(nativeGate, /analyzeNoRemotePush/);
});

test("full deletion clears current state despite corruption or legacy cleanup failure", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  const cancelAllBody = scheduler.match(
    /fun cancelAll\(\)[\s\S]*?synchronized\(LOCK\) \{([\s\S]*?)\n  \}/
  )?.[1] ?? "";

  assert.match(scheduler, /class NotificationDeletionException/);
  assert.match(cancelAllBody, /readValidEntriesForDeletion/);
  assert.doesNotMatch(cancelAllBody, /readEntries\(\)/);
  for (const independentDomain of [
    "legacy cleanup",
    "current alarms",
    "delivered notifications",
    "local reminder ledger"
  ]) {
    assert.match(cancelAllBody, new RegExp(`attemptDeletion\\([\\s\\S]*?${independentDomain}`));
  }
  assert.match(scheduler, /runCatching \{ decode\(value\) \}\.getOrNull\(\)/);
  assert.match(scheduler, /unknown alarm tokens are inert after the ledger is cleared/);
  assert.match(cancelAllBody, /throw NotificationDeletionException\(failures\)/);
});

test("full and legacy deletion verify that delivered notifications are gone", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  const verification = scheduler.match(
    /private fun cancelDeliveredNotificationsAndVerify\(\) \{([\s\S]*?)\n  \}/
  )?.[1] ?? "";

  assert.match(verification, /notificationManager\.cancelAll\(\)/);
  assert.match(verification, /notificationManager\.activeNotifications/);
  assert.match(verification, /error\("Delivered notifications remain after deletion"\)/);
  assert.equal(
    [...scheduler.matchAll(/cancelDeliveredNotificationsAndVerify\(\)/g)].length,
    3
  );
});

test("boot restore contains corrupt-ledger failures without posting or logging data", () => {
  const scheduler = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/NotificationScheduler.kt"
    ),
    "utf8"
  );
  const receiver = readFileSync(
    resolve(
      moduleRoot,
      "android/src/main/java/expo/modules/lifelocalnotifications/LifeRestoreReceiver.kt"
    ),
    "utf8"
  );
  const restoreBody = scheduler.match(
    /fun restoreFuture[\s\S]*?synchronized\(LOCK\) \{([\s\S]*?)\n  \}/
  )?.[1] ?? "";

  assert.match(restoreBody, /val entries = readEntries\(\)/);
  assert.match(receiver, /try \{/);
  assert.match(receiver, /catch \(_: Exception\)/);
  assert.doesNotMatch(receiver, /Log\.|print|show\(/);
});

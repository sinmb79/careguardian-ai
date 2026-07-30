package expo.modules.lifelocalnotifications

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import java.io.File
import java.security.MessageDigest

internal data class LedgerEntry(
  val identifier: String,
  val epochMs: Long,
  val taskId: String
)

internal class NotificationDeletionException(
  val failures: List<String>
) : IllegalStateException(
  "Local notification deletion failed: ${failures.joinToString("; ")}"
)

internal class NotificationScheduler(
  private val context: Context
) {
  companion object {
    const val CHANNEL_ID = "life-steward-local-v2"
    const val PREVIOUS_CHANNEL_ID = "life-steward-tasks-v1"
    const val TITLE = "생활 일정 알림"
    const val IDENTIFIER_PREFIX = "life-steward-task-"
    const val ACTION_REMINDER =
      "com.sinmb.careguardianai.action.LIFE_LOCAL_REMINDER"
    const val EXTRA_IDENTIFIER = "identifier"
    const val EXTRA_EPOCH_MS = "epochMs"
    const val MIGRATION_COMPLETE = "legacy_cleanup_complete_v1"

    private const val PREFS_NAME =
      "com.sinmb.careguardianai.LifeLocalNotifications"
    private const val ENTRY_PREFIX = "entry."
    private const val LEGACY_NOTIFICATION_PREFS =
      "expo.modules.notifications.SharedPreferencesNotificationsStore"
    private const val LEGACY_CATEGORY_PREFS =
      "expo.modules.notifications.SharedPreferencesNotificationCategoriesStore"
    private const val LEGACY_REQUEST_PREFIX = "notification_request-"
    private const val LEGACY_SHARED_PREFS =
      "host.exp.exponent.SharedPreferences"
    private const val LEGACY_UUID_KEY = "uuid"
    private const val LEGACY_ACTION =
      "expo.modules.notifications.NOTIFICATION_EVENT"
    private const val LEGACY_RECEIVER =
      "expo.modules.notifications.service.NotificationsService"
    private const val PRIMARY_UUID_FILE =
      "expo_notifications_installation_uuid.txt"
    private const val REGISTRATION_INFO_FILE =
      "expo_notifications_registration_info.txt"
    private const val LEGACY_UUID_FILE = "expo_installation_uuid.txt"
    private const val MAX_EPOCH_MS = 253402300799000L
    private val IDENTIFIER_PATTERN =
      Regex("^life-steward-task-[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
    private val TASK_ID_PATTERN =
      Regex("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
    private val LOCK = Any()

    fun from(context: Context) = NotificationScheduler(
      context.applicationContext
    )
  }

  private val alarmManager =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private val notificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private val preferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        TITLE,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description =
          "기기에서 예약한 일반 생활 알림입니다. 절전 상태에 따라 지연될 수 있습니다."
        lockscreenVisibility = Notification.VISIBILITY_SECRET
        setShowBadge(false)
      }
      notificationManager.createNotificationChannel(channel)
    }
  }

  fun areEnabled(): Boolean =
    notificationManager.areNotificationsEnabled() &&
      (
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
          context.checkSelfPermission(
            Manifest.permission.POST_NOTIFICATIONS
          ) == PackageManager.PERMISSION_GRANTED
      )

  fun schedule(identifier: String, epochMs: Long): String = synchronized(LOCK) {
    requireNotificationsEnabled()
    val entry = validateFutureEntry(identifier, epochMs)
    val key = entryKey(identifier)
    if (!preferences.edit().putString(key, encode(entry)).commit()) {
      error("Could not persist local reminder")
    }
    try {
      scheduleAlarm(entry)
    } catch (error: Throwable) {
      if (!preferences.edit().remove(key).commit()) {
        throw IllegalStateException(
          "Could not roll back failed local reminder persistence",
          error
        )
      }
      throw error
    }
    identifier
  }

  fun listIdentifiers(): List<String> = synchronized(LOCK) {
    readEntries().map { it.identifier }.sorted()
  }

  fun cancel(identifier: String) = synchronized(LOCK) {
    requireValidIdentifier(identifier)
    val pending = pendingIntent(identifier, PendingIntent.FLAG_NO_CREATE)
    if (pending != null) {
      alarmManager.cancel(pending)
      pending.cancel()
    }
    if (!preferences.edit().remove(entryKey(identifier)).commit()) {
      error("Could not remove local reminder ledger entry")
    }
    if (pendingIntent(identifier, PendingIntent.FLAG_NO_CREATE) != null) {
      error("Local reminder alarm still exists after cancellation")
    }
  }

  fun cancelAll() = synchronized(LOCK) {
    val failures = mutableListOf<String>()
    attemptDeletion(failures, "legacy cleanup") {
      cleanupLegacy(true)
    }

    var entries = emptyList<LedgerEntry>()
    attemptDeletion(failures, "current alarms") {
      entries = readValidEntriesForDeletion()
    }
    entries.forEach { entry ->
      attemptDeletion(failures, "current alarms") {
        val pending = pendingIntent(
          entry.identifier,
          PendingIntent.FLAG_NO_CREATE
        )
        if (pending != null) {
          alarmManager.cancel(pending)
          pending.cancel()
        }
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      attemptDeletion(failures, "current alarms") {
        alarmManager.cancelAll()
      }
    }
    // On API < 34, unknown alarm tokens are inert after the ledger is cleared:
    // the receiver cannot consume an entry and therefore cannot show anything.
    attemptDeletion(failures, "delivered notifications") {
      cancelDeliveredNotificationsAndVerify()
    }
    attemptDeletion(failures, "local reminder ledger") {
      if (!preferences.edit().clear().commit()) {
        error("Could not clear local reminder ledger")
      }
      if (preferences.all.isNotEmpty()) {
        error("Local reminder ledger is not empty after deletion")
      }
    }
    entries.forEach { entry ->
      attemptDeletion(failures, "current alarms") {
        if (
          pendingIntent(
            entry.identifier,
            PendingIntent.FLAG_NO_CREATE
          ) != null
        ) {
          error("A local reminder alarm remains after deletion")
        }
      }
    }
    if (failures.isNotEmpty()) {
      throw NotificationDeletionException(failures)
    }
  }

  fun cleanupLegacy(force: Boolean) = synchronized(LOCK) {
    if (!force && preferences.getBoolean(MIGRATION_COMPLETE, false)) {
      return@synchronized
    }

    val legacyNotifications = context.getSharedPreferences(
      LEGACY_NOTIFICATION_PREFS,
      Context.MODE_PRIVATE
    )
    val identifiers = legacyNotifications.all.keys
      .filter { it.startsWith(LEGACY_REQUEST_PREFIX) }
      .map { it.removePrefix(LEGACY_REQUEST_PREFIX) }
    identifiers.forEach(::cancelLegacyPendingIntent)

    if (!legacyNotifications.edit().clear().commit()) {
      error("Could not clear legacy Expo notification requests")
    }
    val legacyCategories = context.getSharedPreferences(
      LEGACY_CATEGORY_PREFS,
      Context.MODE_PRIVATE
    )
    if (!legacyCategories.edit().clear().commit()) {
      error("Could not clear legacy Expo notification categories")
    }
    val legacyShared = context.getSharedPreferences(
      LEGACY_SHARED_PREFS,
      Context.MODE_PRIVATE
    )
    if (!legacyShared.edit().remove(LEGACY_UUID_KEY).commit()) {
      error("Could not remove legacy Expo installation identifier")
    }
    for (fileName in listOf(
      PRIMARY_UUID_FILE,
      REGISTRATION_INFO_FILE,
      LEGACY_UUID_FILE
    )) {
      val file = File(context.noBackupFilesDir, fileName)
      if (file.exists() && !file.delete()) {
        error("Could not delete legacy Expo identifier file")
      }
      if (file.exists()) {
        error("Legacy Expo identifier file remains after deletion")
      }
    }
    cancelDeliveredNotificationsAndVerify()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.deleteNotificationChannel("life-steward-tasks-v1")
      if (notificationManager.getNotificationChannel(PREVIOUS_CHANNEL_ID) != null) {
        error("Legacy notification channel remains after deletion")
      }
    }
    if (identifiers.any { legacyPendingIntent(it, PendingIntent.FLAG_NO_CREATE) != null }) {
      error("Legacy Expo notification alarm remains after deletion")
    }
    if (legacyNotifications.all.isNotEmpty() ||
      legacyCategories.all.isNotEmpty() ||
      legacyShared.contains(LEGACY_UUID_KEY)
    ) {
      error("Legacy Expo notification data remains after deletion")
    }
    if (!preferences.edit().putBoolean(MIGRATION_COMPLETE, true).commit()) {
      error("Could not record successful legacy notification cleanup")
    }
  }

  fun restoreFuture(nowMs: Long) = synchronized(LOCK) {
    val entries = readEntries()
    val staleKeys = mutableListOf<String>()
    entries.forEach { entry ->
      if (entry.epochMs > nowMs) {
        scheduleAlarm(entry)
      } else {
        staleKeys += entryKey(entry.identifier)
      }
    }
    if (staleKeys.isNotEmpty()) {
      val editor = preferences.edit()
      staleKeys.forEach(editor::remove)
      if (!editor.commit()) error("Could not remove stale local reminders")
    }
  }

  fun consume(identifier: String, epochMs: Long): LedgerEntry? = synchronized(LOCK) {
    if (!IDENTIFIER_PATTERN.matches(identifier)) return@synchronized null
    val stored = preferences.getString(
      entryKey(identifier),
      null
    ) ?: return@synchronized null
    val entry = runCatching { decode(stored) }
      .getOrNull() ?: return@synchronized null
    val matchesStoredAlarm =
      entry.identifier == identifier && entry.epochMs == epochMs
    if (!matchesStoredAlarm) {
      return@synchronized null
    }
    if (!preferences.edit().remove(entryKey(identifier)).commit()) {
      return@synchronized null
    }
    entry
  }

  fun consumeAndShow(
    identifier: String,
    epochMs: Long
  ): Boolean = synchronized(LOCK) {
    val entry = consume(identifier, epochMs)
    if (entry == null) {
      false
    } else {
      show(entry)
      true
    }
  }

  private fun show(entry: LedgerEntry) {
    createChannel()
    val extras = Bundle().apply {
      putString("taskId", entry.taskId)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      Notification.Builder(context)
    }
    val notification = builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(TITLE)
      .setContentText("")
      .setAutoCancel(true)
      .setLocalOnly(true)
      .setVisibility(Notification.VISIBILITY_SECRET)
      .setExtras(extras)
      .apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          setBadgeIconType(Notification.BADGE_ICON_NONE)
        }
      }
      .build()
    notificationManager.notify(notificationId(entry.identifier), notification)
  }

  private fun validateStoredEntry(
    identifier: String,
    epochMs: Long,
    expectedTaskId: String? = null
  ): LedgerEntry {
    requireValidIdentifier(identifier)
    require(epochMs > 0 && epochMs <= MAX_EPOCH_MS) {
      "Local reminder epoch is outside the supported range"
    }
    val taskId = identifier.removePrefix(IDENTIFIER_PREFIX)
    require(TASK_ID_PATTERN.matches(taskId)) { "Invalid task identifier" }
    if (expectedTaskId != null) {
      require(taskId == expectedTaskId) {
        "Mismatched local reminder task"
      }
    }
    return LedgerEntry(identifier, epochMs, taskId)
  }

  private fun validateFutureEntry(
    identifier: String,
    epochMs: Long
  ): LedgerEntry {
    val entry = validateStoredEntry(identifier, epochMs)
    require(entry.epochMs > System.currentTimeMillis()) {
      "Local reminder epoch must be a future time"
    }
    return entry
  }

  private fun requireValidIdentifier(identifier: String) {
    require(IDENTIFIER_PATTERN.matches(identifier)) {
      "Invalid local reminder identifier"
    }
  }

  private fun scheduleAlarm(entry: LedgerEntry) {
    val pending = pendingIntent(
      entry.identifier,
      PendingIntent.FLAG_UPDATE_CURRENT,
      entry.epochMs
    ) ?: error("Could not create local reminder PendingIntent")
    alarmManager.setAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      entry.epochMs,
      pending
    )
    if (pendingIntent(
        entry.identifier,
        PendingIntent.FLAG_NO_CREATE
      ) == null) {
      error("Local reminder alarm was not registered")
    }
  }

  private fun pendingIntent(
    identifier: String,
    lookupFlag: Int,
    epochMs: Long? = null
  ): PendingIntent? {
    val intent = Intent(context, LifeReminderReceiver::class.java).apply {
      action = ACTION_REMINDER
      setPackage(context.packageName)
      data = Uri.Builder()
        .scheme("careguardian-local")
        .authority("reminder")
        .appendPath(digest(identifier))
        .build()
      putExtra(EXTRA_IDENTIFIER, identifier)
      if (epochMs != null) putExtra(EXTRA_EPOCH_MS, epochMs)
    }
    return PendingIntent.getBroadcast(
      context,
      notificationId(identifier),
      intent,
      lookupFlag or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun cancelLegacyPendingIntent(identifier: String) {
    val pending = legacyPendingIntent(identifier, PendingIntent.FLAG_NO_CREATE)
    if (pending != null) {
      alarmManager.cancel(pending)
      pending.cancel()
    }
  }

  private fun legacyPendingIntent(identifier: String, lookupFlag: Int): PendingIntent? {
    val uri = Uri.Builder()
      .scheme("expo-notifications")
      .authority("notifications")
      .appendPath("scheduled")
      .appendPath(identifier)
      .appendPath("trigger")
      .build()
    val intent = Intent(LEGACY_ACTION, uri).apply {
      component = ComponentName(context.packageName, LEGACY_RECEIVER)
    }
    val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PendingIntent.FLAG_MUTABLE
    } else {
      0
    }
    return PendingIntent.getBroadcast(
      context,
      LEGACY_RECEIVER.hashCode(),
      intent,
      lookupFlag or mutableFlag
    )
  }

  private fun readEntries(): List<LedgerEntry> =
    preferences.all
      .filterKeys { it.startsWith(ENTRY_PREFIX) }
      .values
      .map { value ->
        require(value is String) { "Invalid local reminder ledger value" }
        decode(value)
      }

  private fun readValidEntriesForDeletion(): List<LedgerEntry> =
    preferences.all
      .filterKeys { it.startsWith(ENTRY_PREFIX) }
      .values
      .mapNotNull { value ->
        if (value !is String) null
        else runCatching { decode(value) }.getOrNull()
      }

  private inline fun attemptDeletion(
    failures: MutableList<String>,
    domain: String,
    operation: () -> Unit
  ) {
    try {
      operation()
    } catch (error: Throwable) {
      failures += "$domain (${error::class.java.simpleName})"
    }
  }

  private fun cancelDeliveredNotificationsAndVerify() {
    notificationManager.cancelAll()
    if (notificationManager.activeNotifications.isNotEmpty()) {
      error("Delivered notifications remain after deletion")
    }
  }

  private fun requireNotificationsEnabled() {
    check(areEnabled()) {
      "Android notification permission is unavailable"
    }
  }

  private fun encode(entry: LedgerEntry): String =
    "${entry.identifier}\n${entry.epochMs}\n${entry.taskId}"

  private fun decode(value: String): LedgerEntry {
    val parts = value.split('\n')
    require(parts.size == 3) { "Invalid local reminder ledger entry" }
    val epochMs = parts[1].toLongOrNull()
      ?: error("Invalid local reminder ledger epoch")
    return validateStoredEntry(parts[0], epochMs, parts[2])
  }

  private fun entryKey(identifier: String): String =
    ENTRY_PREFIX + digest(identifier)

  private fun digest(value: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(value.toByteArray(Charsets.UTF_8))
      .joinToString("") { byte -> "%02x".format(byte) }

  private fun notificationId(identifier: String): Int {
    val bytes = MessageDigest.getInstance("SHA-256")
      .digest(identifier.toByteArray(Charsets.UTF_8))
    return ((bytes[0].toInt() and 0xff) shl 24) or
      ((bytes[1].toInt() and 0xff) shl 16) or
      ((bytes[2].toInt() and 0xff) shl 8) or
      (bytes[3].toInt() and 0xff)
  }
}

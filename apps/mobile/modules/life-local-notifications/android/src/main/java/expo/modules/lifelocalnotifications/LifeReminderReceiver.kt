package expo.modules.lifelocalnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class LifeReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != NotificationScheduler.ACTION_REMINDER) return
    val identifier =
      intent.getStringExtra(NotificationScheduler.EXTRA_IDENTIFIER) ?: return
    val epochMs = intent.getLongExtra(
      NotificationScheduler.EXTRA_EPOCH_MS,
      Long.MIN_VALUE
    )
    NotificationScheduler.from(context).consumeAndShow(identifier, epochMs)
  }
}

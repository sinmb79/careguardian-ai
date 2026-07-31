package expo.modules.lifelocalnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class LifeRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (
      intent.action != Intent.ACTION_BOOT_COMPLETED &&
      intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
    ) return
    try {
      NotificationScheduler.from(context).restoreFuture(
        System.currentTimeMillis()
      )
    } catch (_: Exception) {
      return
    }
  }
}

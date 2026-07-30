package expo.modules.lifelocalnotifications

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LifeLocalNotificationsModule : Module() {
  private fun scheduler(): NotificationScheduler {
    val context = appContext.reactContext
      ?: error("React context is unavailable")
    return NotificationScheduler(context.applicationContext)
  }

  override fun definition() = ModuleDefinition {
    Name("LifeLocalNotifications")

    AsyncFunction("createChannel") Coroutine { ->
      scheduler().createChannel()
    }

    AsyncFunction("areEnabled") Coroutine { ->
      scheduler().areEnabled()
    }

    AsyncFunction("cleanupLegacy") Coroutine { ->
      scheduler().cleanupLegacy(false)
    }

    AsyncFunction("schedule") Coroutine { identifier: String, epochMs: Long ->
      scheduler().schedule(identifier, epochMs)
    }

    AsyncFunction("listIdentifiers") Coroutine { ->
      scheduler().listIdentifiers()
    }

    AsyncFunction("cancel") Coroutine { identifier: String ->
      scheduler().cancel(identifier)
    }

    AsyncFunction("cancelAll") Coroutine { ->
      scheduler().cancelAll()
    }
  }
}

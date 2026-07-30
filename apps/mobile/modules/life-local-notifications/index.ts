import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface LifeLocalNotificationsNativeModule {
  createChannel(): Promise<void>;
  areEnabled(): Promise<boolean>;
  cleanupLegacy(): Promise<void>;
  schedule(identifier: string, epochMs: number): Promise<string>;
  listIdentifiers(): Promise<string[]>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
}

const nativeModule = Platform.OS === "android"
  ? requireOptionalNativeModule<LifeLocalNotificationsNativeModule>(
      "LifeLocalNotifications"
    )
  : null;

export function isLifeLocalNotificationsAvailable(): boolean {
  return nativeModule !== null;
}

function requireModule(): LifeLocalNotificationsNativeModule {
  if (!nativeModule) {
    const error = new Error(
      "LifeLocalNotifications is unavailable on this platform"
    );
    error.name = "LifeLocalNotificationsUnavailableError";
    throw error;
  }
  return nativeModule;
}

export async function createLocalNotificationChannel(): Promise<void> {
  await requireModule().createChannel();
}

export async function areLocalNotificationsEnabled(): Promise<boolean> {
  return requireModule().areEnabled();
}

export async function cleanupLegacyNotifications(): Promise<void> {
  await requireModule().cleanupLegacy();
}

export async function scheduleLocalNotification(
  identifier: string,
  epochMs: number
): Promise<string> {
  return requireModule().schedule(identifier, epochMs);
}

export async function listLocalNotificationIdentifiers(): Promise<string[]> {
  return requireModule().listIdentifiers();
}

export async function cancelLocalNotification(
  identifier: string
): Promise<void> {
  await requireModule().cancel(identifier);
}

export async function cancelAllLocalNotifications(): Promise<void> {
  await requireModule().cancelAll();
}

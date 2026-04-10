import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { CareManual } from "@careguardian/care-core/manual";
import { buildMedicationNotificationRequests } from "./notificationSchedule";

const MEDICATION_CHANNEL_ID = "careguardian-medication";
const NOTIFICATION_HANDLER = {
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
};

Notifications.setNotificationHandler(NOTIFICATION_HANDLER);

async function ensureNotificationChannelAsync() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
    name: "복약 알림",
    importance: Notifications.AndroidImportance.HIGH
  });
}

export async function requestNotificationPermissionsAsync(): Promise<boolean> {
  await ensureNotificationChannelAsync();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function syncMedicationNotifications(
  manual: CareManual,
  referenceDate: Date = new Date()
): Promise<number> {
  const isGranted = await requestNotificationPermissionsAsync();
  if (!isGranted) {
    return 0;
  }

  const requests = buildMedicationNotificationRequests(manual, referenceDate);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = scheduled
    .map((item) => item.identifier)
    .filter((identifier) => identifier.startsWith("careguardian-medication-"));

  await Promise.all(existingIds.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));

  for (const request of requests) {
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: request.content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.date,
        channelId: Platform.OS === "android" ? MEDICATION_CHANNEL_ID : undefined
      }
    });
  }

  return requests.length;
}

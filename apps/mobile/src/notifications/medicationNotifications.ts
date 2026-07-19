import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { CareManual } from "@careguardian/care-core/manual";
import {
  buildMedicationNotificationRequests,
  type MedicationNotificationRequest
} from "./notificationSchedule";

const MEDICATION_CHANNEL_ID = "careguardian-medication-v2";
const MEDICATION_IDENTIFIER_PREFIX = "careguardian-medication-";
const NOTIFICATION_HANDLER = {
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
};

Notifications.setNotificationHandler(NOTIFICATION_HANDLER);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function cancelNewMedicationNotificationsAsync(
  requests: MedicationNotificationRequest[]
): Promise<void> {
  await Promise.allSettled(
    requests.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

async function ensureNotificationChannelAsync() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
    name: "복약 알림",
    description: "잠금 화면에는 복약 세부 정보를 표시하지 않습니다.",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET
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

export async function cancelCareguardianMedicationNotifications(): Promise<void> {
  let scheduled;
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    throw new Error(`복약 알림 취소 조회에 실패했습니다: ${errorMessage(error)}`);
  }

  const medicationIds = scheduled
    .map((item) => item.identifier)
    .filter((identifier) => identifier.startsWith(MEDICATION_IDENTIFIER_PREFIX));

  await Promise.allSettled(
    medicationIds.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier))
  );

  let remaining;
  try {
    remaining = await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    throw new Error(`복약 알림 취소 검증에 실패했습니다: 조회 오류 - ${errorMessage(error)}`);
  }

  const remainingCount = remaining.filter((item) =>
    item.identifier.startsWith(MEDICATION_IDENTIFIER_PREFIX)
  ).length;
  if (remainingCount > 0) {
    throw new Error(`복약 알림 취소 검증에 실패했습니다: ${remainingCount}건이 남아 있습니다.`);
  }
}

export async function syncMedicationNotifications(
  manual: CareManual,
  referenceDate: Date = new Date()
): Promise<number> {
  const requests = buildMedicationNotificationRequests(manual, referenceDate);

  // Clear and verify stale reminders even when the user removed medication data
  // or no longer grants notification permission.
  await cancelCareguardianMedicationNotifications();

  if (requests.length === 0) {
    return 0;
  }

  const isGranted = await requestNotificationPermissionsAsync();
  if (!isGranted) {
    return 0;
  }

  for (const request of requests) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: request.identifier,
        content: request.content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: request.schedule.hour,
          minute: request.schedule.minute,
          channelId: Platform.OS === "android" ? MEDICATION_CHANNEL_ID : undefined
        }
      });
    } catch (error) {
      await cancelNewMedicationNotificationsAsync(requests);
      throw new Error(`복약 알림 예약에 실패했습니다 (${request.identifier}): ${errorMessage(error)}`);
    }
  }

  let verified;
  try {
    verified = await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    await cancelNewMedicationNotificationsAsync(requests);
    throw new Error(`복약 알림 예약 검증에 실패했습니다: ${errorMessage(error)}`);
  }

  const verifiedIds = new Set(verified.map((item) => item.identifier));
  const missingIds = requests
    .map((request) => request.identifier)
    .filter((identifier) => !verifiedIds.has(identifier));
  if (missingIds.length > 0) {
    await cancelNewMedicationNotificationsAsync(requests);
    throw new Error(`복약 알림 예약 검증에 실패했습니다: ${missingIds.length}건이 확인되지 않았습니다.`);
  }

  return requests.length;
}

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { LifeTask } from "@life-steward/life-core";

const CHANNEL_ID = "life-steward-tasks-v1";
const IDENTIFIER_PREFIX = "life-steward-task-";
const PREVIOUS_TEST_IDENTIFIER_PREFIX = "careguardian-medication-";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export type LifeNotificationRequest = {
  identifier: string;
  content: {
    title: "생활 일정 알림";
    body: "";
    data: { notificationType: "life-task"; taskId: string };
  };
  trigger: { type: "date"; date: Date; channelId?: string };
};

function dateForTask(task: LifeTask): Date | null {
  if (task.status !== "open" || !task.dueDate) return null;
  const date = new Date(`${task.dueDate}T09:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildLifeNotification(task: LifeTask): LifeNotificationRequest {
  const date = dateForTask(task);
  if (!date) throw new Error("an open task with a valid due date is required");
  return {
    identifier: `${IDENTIFIER_PREFIX}${task.id}`,
    content: {
      title: "생활 일정 알림",
      body: "",
      data: { notificationType: "life-task", taskId: task.id }
    },
    trigger: { type: "date", date, channelId: Platform.OS === "android" ? CHANNEL_ID : undefined }
  };
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "생활 일정 알림",
      description: "알림에는 일정 제목이나 메모를 표시하지 않습니다.",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  return existing.granted || (await Notifications.requestPermissionsAsync()).granted;
}

async function cancelNotificationsWithPrefix(prefix: string, errorMessage: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = scheduled
    .map((notification) => notification.identifier)
    .filter((identifier) => identifier.startsWith(prefix));
  await Promise.allSettled(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
  const remaining = await Notifications.getAllScheduledNotificationsAsync();
  if (remaining.some((notification) => notification.identifier.startsWith(prefix))) {
    throw new Error(errorMessage);
  }
}

async function rollbackScheduledNotifications(identifiers: string[]): Promise<void> {
  const cancellations = await Promise.allSettled(
    identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier))
  );
  let remaining: { identifier: string }[];
  try {
    remaining = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    throw new Error("notification rollback failed: could not verify scheduled notifications");
  }
  const remainingIds = new Set(remaining.map((notification) => notification.identifier));
  if (cancellations.some((result) => result.status === "rejected") || identifiers.some((identifier) => remainingIds.has(identifier))) {
    throw new Error("notification rollback failed");
  }
}

export async function cancelAllLifeNotifications(): Promise<void> {
  await cancelNotificationsWithPrefix(IDENTIFIER_PREFIX, "생활 알림 취소 검증에 실패했습니다.");
}

export async function cancelPreviousTestNotifications(): Promise<void> {
  await cancelNotificationsWithPrefix(PREVIOUS_TEST_IDENTIFIER_PREFIX, "이전 테스트 알림 취소 검증에 실패했습니다.");
}

export async function syncLifeNotifications(tasks: LifeTask[]): Promise<number> {
  const requests = tasks.flatMap((task) => {
    try {
      return [buildLifeNotification(task)];
    } catch {
      return [];
    }
  });
  await cancelAllLifeNotifications();
  if (requests.length === 0 || !(await ensurePermission())) return 0;
  const scheduledIdentifiers: string[] = [];
  try {
    for (const request of requests) {
      const nativeIdentifier = await Notifications.scheduleNotificationAsync(request as Notifications.NotificationRequestInput);
      scheduledIdentifiers.push(nativeIdentifier);
    }
  } catch (error) {
    try {
      await rollbackScheduledNotifications(scheduledIdentifiers);
    } catch (rollbackError) {
      throw rollbackError;
    }
    throw error;
  }
  const reserved = new Set((await Notifications.getAllScheduledNotificationsAsync()).map((item) => item.identifier));
  if (scheduledIdentifiers.some((identifier) => !reserved.has(identifier))) {
    await rollbackScheduledNotifications(scheduledIdentifiers);
    throw new Error("생활 알림 예약 검증에 실패했습니다.");
  }
  return requests.length;
}

import type { LifeTask } from "@life-steward/life-core";
import { PermissionsAndroid, Platform } from "react-native";
import {
  areLocalNotificationsEnabled,
  cancelAllLocalNotifications,
  cancelLocalNotification,
  cleanupLegacyNotifications,
  createLocalNotificationChannel,
  isLifeLocalNotificationsAvailable,
  listLocalNotificationIdentifiers,
  scheduleLocalNotification
} from "../../modules/life-local-notifications";
import {
  isFutureLocalReminder,
  localNineAmForDate
} from "../reminders/localReminderTime";

const IDENTIFIER_PREFIX = "life-steward-task-";

export type LifeNotificationRequest = {
  identifier: string;
  epochMs: number;
};

function dateForTask(task: LifeTask): Date | null {
  if (task.status !== "open" || !task.dueDate) return null;
  return localNineAmForDate(task.dueDate);
}

export function buildLifeNotification(
  task: LifeTask
): LifeNotificationRequest {
  const date = dateForTask(task);
  if (!date) {
    throw new Error("an open task with a valid due date is required");
  }
  return {
    identifier: `${IDENTIFIER_PREFIX}${task.id}`,
    epochMs: date.getTime()
  };
}

export async function initializeLifeNotifications(): Promise<boolean> {
  if (
    Platform.OS !== "android" ||
    !isLifeLocalNotificationsAvailable()
  ) {
    return false;
  }
  await cleanupLegacyNotifications();
  await createLocalNotificationChannel();
  return true;
}

async function ensurePermission(): Promise<boolean> {
  if (!(await initializeLifeNotifications())) return false;
  const platformVersion = Number(Platform.Version);
  if (Number.isFinite(platformVersion) && platformVersion >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const granted = await PermissionsAndroid.check(permission);
    if (
      !granted &&
      (await PermissionsAndroid.request(permission)) !==
        PermissionsAndroid.RESULTS.GRANTED
    ) {
      return false;
    }
  }
  return areLocalNotificationsEnabled();
}

async function cancelNotificationsWithPrefix(
  prefix: string,
  errorMessage: string
): Promise<void> {
  if (!isLifeLocalNotificationsAvailable()) return;
  const identifiers = (await listLocalNotificationIdentifiers())
    .filter((identifier) => identifier.startsWith(prefix));
  const cancellations = await Promise.allSettled(
    identifiers.map((identifier) =>
      cancelLocalNotification(identifier)
    )
  );
  const remaining = await listLocalNotificationIdentifiers();
  if (
    cancellations.some((result) => result.status === "rejected") ||
    remaining.some((identifier) => identifier.startsWith(prefix))
  ) {
    throw new Error(errorMessage);
  }
}

async function rollbackScheduledNotifications(
  identifiers: string[]
): Promise<void> {
  const cancellations = await Promise.allSettled(
    identifiers.map((identifier) =>
      cancelLocalNotification(identifier)
    )
  );
  let remaining: string[];
  try {
    remaining = await listLocalNotificationIdentifiers();
  } catch {
    throw new Error(
      "notification rollback failed: could not verify scheduled notifications"
    );
  }
  const remainingIds = new Set(remaining);
  if (
    cancellations.some((result) => result.status === "rejected") ||
    identifiers.some((identifier) => remainingIds.has(identifier))
  ) {
    throw new Error("notification rollback failed");
  }
}

export async function cancelAllLifeNotifications(): Promise<void> {
  await cancelNotificationsWithPrefix(
    IDENTIFIER_PREFIX,
    "생활 알림 취소 검증에 실패했습니다."
  );
}

export async function cancelPreviousTestNotifications(): Promise<void> {
  if (isLifeLocalNotificationsAvailable()) {
    await cleanupLegacyNotifications();
  }
}

export async function cancelAllScheduledNotificationsForFullDeletion(): Promise<void> {
  if (!isLifeLocalNotificationsAvailable()) return;
  try {
    await cancelAllLocalNotifications();
    const remaining = await listLocalNotificationIdentifiers();
    if (remaining.length > 0) {
      throw new Error(`${remaining.length} scheduled notification(s) remain`);
    }
  } catch (error) {
    throw new Error(
      `full notification deletion verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function syncLifeNotifications(
  tasks: LifeTask[],
  now: () => Date = () => new Date()
): Promise<number> {
  const currentTime = now();
  const requests = tasks.flatMap((task) => {
    if (
      !task.dueDate ||
      !isFutureLocalReminder(task.dueDate, currentTime)
    ) {
      return [];
    }
    try {
      return [buildLifeNotification(task)];
    } catch {
      return [];
    }
  });

  if (!isLifeLocalNotificationsAvailable()) return 0;
  await cancelAllLifeNotifications();
  if (requests.length === 0 || !(await ensurePermission())) return 0;

  const scheduledIdentifiers: string[] = [];
  try {
    for (const request of requests) {
      const nativeIdentifier = await scheduleLocalNotification(
        request.identifier,
        request.epochMs
      );
      if (nativeIdentifier !== request.identifier) {
        throw new Error("native local reminder identifier mismatch");
      }
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

  const reserved = new Set(
    await listLocalNotificationIdentifiers()
  );
  if (
    scheduledIdentifiers.some((identifier) => !reserved.has(identifier))
  ) {
    await rollbackScheduledNotifications(scheduledIdentifiers);
    throw new Error("생활 알림 예약 검증에 실패했습니다.");
  }
  return requests.length;
}

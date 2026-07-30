import { beforeEach, describe, expect, test, vi } from "vitest";
import { fixtureWorkspace } from "../test/fixtureWorkspace";

const notificationApi = vi.hoisted(() => ({
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { SECRET: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn()
}));

vi.mock("expo-notifications", () => notificationApi);
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import {
  buildLifeNotification,
  cancelAllLifeNotifications,
  cancelAllScheduledNotificationsForFullDeletion,
  cancelPreviousTestNotifications,
  syncLifeNotifications
} from "./lifeNotifications";

describe("life notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationApi.getAllScheduledNotificationsAsync.mockReset();
    notificationApi.scheduleNotificationAsync.mockReset();
    notificationApi.getPermissionsAsync.mockResolvedValue({ granted: true });
    notificationApi.getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ identifier: "life-steward-task-buy-fruit" }]);
    notificationApi.scheduleNotificationAsync.mockResolvedValue("life-steward-task-buy-fruit");
  });

  test("uses a generic private notification payload", () => {
    const request = buildLifeNotification(fixtureWorkspace.tasks[0]);

    expect(request.content.title).toBe("생활 일정 알림");
    expect(request.content.data).toEqual({ taskId: "buy-fruit" });
    expect(JSON.stringify(request)).not.toMatch(/약|복약|질환|치료|과일 사기/);
  });

  test("synchronizes only open tasks with due dates and verifies reservation", async () => {
    await expect(syncLifeNotifications(fixtureWorkspace.tasks, () => new Date(2026, 6, 30, 10, 0, 0))).resolves.toBe(1);

    expect(notificationApi.setNotificationChannelAsync).toHaveBeenCalledWith(
      "life-steward-tasks-v1",
      expect.objectContaining({ lockscreenVisibility: notificationApi.AndroidNotificationVisibility.SECRET })
    );
    expect(notificationApi.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "life-steward-task-buy-fruit",
        trigger: expect.objectContaining({ type: "date" })
      })
    );
  });

  test("does not attempt a native reservation for a past local 9 AM trigger", async () => {
    const pastTask = { ...fixtureWorkspace.tasks[0], dueDate: "2026-07-30" };

    await expect(syncLifeNotifications([pastTask], () => new Date(2026, 6, 31, 10, 0, 0))).resolves.toBe(0);

    expect(notificationApi.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(notificationApi.getPermissionsAsync).not.toHaveBeenCalled();
  });

  test("schedules a future local 9 AM trigger with an injected clock", async () => {
    const futureTask = { ...fixtureWorkspace.tasks[0], dueDate: "2026-08-01" };

    await expect(syncLifeNotifications([futureTask], () => new Date(2026, 6, 31, 10, 0, 0))).resolves.toBe(1);

    expect(notificationApi.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      trigger: expect.objectContaining({ date: new Date(2026, 7, 1, 9, 0, 0) })
    }));
  });

  test("cancels and verifies all private life notifications", async () => {
    notificationApi.getAllScheduledNotificationsAsync
      .mockReset()
      .mockResolvedValueOnce([{ identifier: "life-steward-task-buy-fruit" }])
      .mockResolvedValueOnce([]);

    await expect(cancelAllLifeNotifications()).resolves.toBeUndefined();
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith("life-steward-task-buy-fruit");
  });

  test("clears prior test notifications only when the user chooses to remove prior test data", async () => {
    notificationApi.getAllScheduledNotificationsAsync
      .mockReset()
      .mockResolvedValueOnce([{ identifier: "careguardian-medication-0" }])
      .mockResolvedValueOnce([]);

    await expect(cancelPreviousTestNotifications()).resolves.toBeUndefined();
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith("careguardian-medication-0");
  });

  test("full deletion cancels and verifies every scheduled notification, including legacy identifiers", async () => {
    notificationApi.getAllScheduledNotificationsAsync
      .mockReset()
      .mockResolvedValueOnce([]);

    await expect(cancelAllScheduledNotificationsForFullDeletion()).resolves.toBeUndefined();
    expect(notificationApi.cancelAllScheduledNotificationsAsync).toHaveBeenCalledOnce();
  });

  test("full deletion fails closed when any scheduled notification remains", async () => {
    notificationApi.getAllScheduledNotificationsAsync
      .mockReset()
      .mockResolvedValueOnce([{ identifier: "legacy-unrelated-notification" }]);

    await expect(cancelAllScheduledNotificationsForFullDeletion()).rejects.toThrow("verification failed");
  });

  test("cancels every newly scheduled notification when scheduling stops midway", async () => {
    const secondTask = { ...fixtureWorkspace.tasks[0], id: "plan-trip", dueDate: "2026-08-01" };
    const scheduled = new Set<string>();
    notificationApi.getAllScheduledNotificationsAsync
      .mockReset()
      .mockImplementation(async () => [...scheduled].map((identifier) => ({ identifier })));
    notificationApi.cancelScheduledNotificationAsync
      .mockReset()
      .mockImplementation(async (identifier: string) => void scheduled.delete(identifier));
    notificationApi.scheduleNotificationAsync
      .mockReset()
      .mockImplementationOnce(async () => {
        scheduled.add("native-reservation-42");
        return "native-reservation-42";
      })
      .mockRejectedValueOnce(new Error("native schedule failure"));

    await expect(syncLifeNotifications([fixtureWorkspace.tasks[0], secondTask])).rejects.toThrow("native schedule failure");
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith("native-reservation-42");
    expect(scheduled).toEqual(new Set());
  });

  test("reports rollback failure when a returned native reservation remains scheduled", async () => {
    const secondTask = { ...fixtureWorkspace.tasks[0], id: "plan-trip", dueDate: "2026-08-01" };
    const scheduled = new Set<string>();
    notificationApi.getAllScheduledNotificationsAsync
      .mockReset()
      .mockImplementation(async () => [...scheduled].map((identifier) => ({ identifier })));
    notificationApi.scheduleNotificationAsync
      .mockReset()
      .mockImplementationOnce(async () => {
        scheduled.add("native-reservation-42");
        return "native-reservation-42";
      })
      .mockRejectedValueOnce(new Error("native schedule failure"));
    notificationApi.cancelScheduledNotificationAsync.mockReset().mockRejectedValue(new Error("native cancel failure"));

    await expect(syncLifeNotifications([fixtureWorkspace.tasks[0], secondTask])).rejects.toThrow("rollback");
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith("native-reservation-42");
    expect(scheduled).toEqual(new Set(["native-reservation-42"]));
  });
});

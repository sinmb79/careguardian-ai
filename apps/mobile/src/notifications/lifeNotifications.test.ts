import { beforeEach, describe, expect, test, vi } from "vitest";
import { fixtureWorkspace } from "../test/fixtureWorkspace";

const nativeApi = vi.hoisted(() => ({
  createChannel: vi.fn(),
  areEnabled: vi.fn(),
  cleanupLegacy: vi.fn(),
  schedule: vi.fn(),
  listIdentifiers: vi.fn(),
  cancel: vi.fn(),
  cancelAll: vi.fn(),
  available: true
}));

const permissionsApi = vi.hoisted(() => ({
  check: vi.fn(),
  request: vi.fn()
}));

const platformApi = vi.hoisted(() => ({
  OS: "android",
  Version: 36
}));

vi.mock("../../modules/life-local-notifications", () => ({
  createLocalNotificationChannel: nativeApi.createChannel,
  areLocalNotificationsEnabled: nativeApi.areEnabled,
  cleanupLegacyNotifications: nativeApi.cleanupLegacy,
  scheduleLocalNotification: nativeApi.schedule,
  listLocalNotificationIdentifiers: nativeApi.listIdentifiers,
  cancelLocalNotification: nativeApi.cancel,
  cancelAllLocalNotifications: nativeApi.cancelAll,
  isLifeLocalNotificationsAvailable: () => nativeApi.available
}));

vi.mock("react-native", () => ({
  Platform: platformApi,
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: "android.permission.POST_NOTIFICATIONS" },
    RESULTS: { GRANTED: "granted" },
    check: permissionsApi.check,
    request: permissionsApi.request
  }
}));

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
    nativeApi.available = true;
    platformApi.OS = "android";
    nativeApi.createChannel.mockResolvedValue(undefined);
    nativeApi.areEnabled.mockResolvedValue(true);
    nativeApi.cleanupLegacy.mockResolvedValue(undefined);
    nativeApi.listIdentifiers.mockResolvedValue([]);
    nativeApi.schedule.mockImplementation(async (identifier: string) => identifier);
    nativeApi.cancel.mockResolvedValue(undefined);
    nativeApi.cancelAll.mockResolvedValue(undefined);
    permissionsApi.check.mockResolvedValue(true);
    permissionsApi.request.mockResolvedValue("granted");
  });

  test("uses a generic private notification request", () => {
    const request = buildLifeNotification(fixtureWorkspace.tasks[0]);

    expect(request).toEqual({
      identifier: "life-steward-task-buy-fruit",
      epochMs: new Date(2026, 6, 31, 9, 0, 0).getTime()
    });
    expect(JSON.stringify(request)).not.toMatch(/약|복약|질환|치료|과일 사기|https?:/);
  });

  test("configures the private channel, requests Android permission, and verifies reservation", async () => {
    nativeApi.listIdentifiers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["life-steward-task-buy-fruit"]);

    await expect(
      syncLifeNotifications(fixtureWorkspace.tasks, () => new Date(2026, 6, 30, 10, 0, 0))
    ).resolves.toBe(1);

    expect(nativeApi.cleanupLegacy).toHaveBeenCalledOnce();
    expect(nativeApi.createChannel).toHaveBeenCalledOnce();
    expect(permissionsApi.check).toHaveBeenCalledWith("android.permission.POST_NOTIFICATIONS");
    expect(nativeApi.schedule).toHaveBeenCalledWith(
      "life-steward-task-buy-fruit",
      new Date(2026, 6, 31, 9, 0, 0).getTime()
    );
  });

  test("requests permission only when Android 13 permission is not already granted", async () => {
    permissionsApi.check.mockResolvedValue(false);
    nativeApi.listIdentifiers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["life-steward-task-buy-fruit"]);

    await expect(
      syncLifeNotifications(fixtureWorkspace.tasks, () => new Date(2026, 6, 30, 10, 0, 0))
    ).resolves.toBe(1);

    expect(permissionsApi.request).toHaveBeenCalledOnce();
  });

  test("does not attempt permission or native scheduling for a past local trigger", async () => {
    const pastTask = { ...fixtureWorkspace.tasks[0], dueDate: "2026-07-30" };
    nativeApi.listIdentifiers.mockResolvedValue([]);

    await expect(
      syncLifeNotifications([pastTask], () => new Date(2026, 6, 31, 10, 0, 0))
    ).resolves.toBe(0);

    expect(permissionsApi.check).not.toHaveBeenCalled();
    expect(nativeApi.schedule).not.toHaveBeenCalled();
  });

  test("returns a non-blocking zero on an unsupported platform", async () => {
    nativeApi.available = false;

    await expect(
      syncLifeNotifications(fixtureWorkspace.tasks, () => new Date(2026, 6, 30, 10, 0, 0))
    ).resolves.toBe(0);

    expect(nativeApi.cleanupLegacy).not.toHaveBeenCalled();
    expect(nativeApi.createChannel).not.toHaveBeenCalled();
    expect(nativeApi.schedule).not.toHaveBeenCalled();
  });

  test("cancels and verifies every life-prefixed reservation", async () => {
    nativeApi.listIdentifiers
      .mockResolvedValueOnce(["life-steward-task-buy-fruit", "other-app-entry"])
      .mockResolvedValueOnce(["other-app-entry"]);

    await expect(cancelAllLifeNotifications()).resolves.toBeUndefined();
    expect(nativeApi.cancel).toHaveBeenCalledWith("life-steward-task-buy-fruit");
  });

  test("fails closed when native cancellation rejects even if the ledger is empty", async () => {
    nativeApi.listIdentifiers
      .mockResolvedValueOnce(["life-steward-task-buy-fruit"])
      .mockResolvedValueOnce([]);
    nativeApi.cancel.mockRejectedValueOnce(
      new Error("alarm post-cancellation verification failed")
    );

    await expect(cancelAllLifeNotifications()).rejects.toThrow(
      "생활 알림 취소 검증에 실패했습니다."
    );
  });

  test("legacy Expo health alarm cancellation is a safe no-op after its receiver is removed", async () => {
    await expect(cancelPreviousTestNotifications()).resolves.toBeUndefined();
    expect(nativeApi.cancel).not.toHaveBeenCalled();
  });

  test("full deletion removes native alarms, delivered notifications, and ledger then verifies empty", async () => {
    nativeApi.listIdentifiers.mockResolvedValueOnce([]);

    await expect(cancelAllScheduledNotificationsForFullDeletion()).resolves.toBeUndefined();
    expect(nativeApi.cancelAll).toHaveBeenCalledOnce();
  });

  test("full deletion fails closed when the native ledger is not empty", async () => {
    nativeApi.listIdentifiers.mockResolvedValueOnce(["life-steward-task-buy-fruit"]);

    await expect(cancelAllScheduledNotificationsForFullDeletion()).rejects.toThrow("verification failed");
  });

  test("full deletion fails closed on Android when the native module is unavailable", async () => {
    nativeApi.available = false;

    await expect(
      cancelAllScheduledNotificationsForFullDeletion()
    ).rejects.toThrow(/Android.*module.*unavailable/i);
    expect(nativeApi.cancelAll).not.toHaveBeenCalled();
  });

  test.each(["ios", "web"])(
    "full deletion is a no-op on unsupported %s",
    async (platform) => {
      platformApi.OS = platform;

      await expect(
        cancelAllScheduledNotificationsForFullDeletion()
      ).resolves.toBeUndefined();
      expect(nativeApi.cancelAll).not.toHaveBeenCalled();
    }
  );

  test("rolls back every newly scheduled identifier if a later schedule fails", async () => {
    const secondTask = { ...fixtureWorkspace.tasks[0], id: "plan-trip", dueDate: "2026-08-01" };
    const scheduled = new Set<string>();
    nativeApi.listIdentifiers.mockImplementation(async () => [...scheduled]);
    nativeApi.schedule
      .mockImplementationOnce(async (identifier: string) => {
        scheduled.add(identifier);
        return identifier;
      })
      .mockRejectedValueOnce(new Error("native schedule failure"));
    nativeApi.cancel.mockImplementation(async (identifier: string) => void scheduled.delete(identifier));

    await expect(
      syncLifeNotifications(
        [fixtureWorkspace.tasks[0], secondTask],
        () => new Date(2026, 6, 30, 10, 0, 0)
      )
    ).rejects.toThrow("native schedule failure");
    expect(scheduled).toEqual(new Set());
  });

  test("reports rollback failure when a native identifier remains", async () => {
    const secondTask = { ...fixtureWorkspace.tasks[0], id: "plan-trip", dueDate: "2026-08-01" };
    const scheduled = new Set<string>();
    nativeApi.listIdentifiers.mockImplementation(async () => [...scheduled]);
    nativeApi.schedule
      .mockImplementationOnce(async (identifier: string) => {
        scheduled.add(identifier);
        return identifier;
      })
      .mockRejectedValueOnce(new Error("native schedule failure"));
    nativeApi.cancel.mockRejectedValue(new Error("native cancel failure"));

    await expect(
      syncLifeNotifications(
        [fixtureWorkspace.tasks[0], secondTask],
        () => new Date(2026, 6, 30, 10, 0, 0)
      )
    ).rejects.toThrow("rollback");
    expect(scheduled).toEqual(new Set(["life-steward-task-buy-fruit"]));
  });
});

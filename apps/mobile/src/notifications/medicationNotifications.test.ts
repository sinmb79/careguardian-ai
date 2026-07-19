import { beforeEach, describe, expect, test, vi } from "vitest";
import { createEmptyCareManual } from "@careguardian/care-core/manual";
import { makeMobileFixtureManual } from "../test/fixtureManual";

const notificationApi = vi.hoisted(() => ({
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { SECRET: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn()
}));

vi.mock("expo-notifications", () => notificationApi);
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import {
  cancelCareguardianMedicationNotifications,
  syncMedicationNotifications
} from "./medicationNotifications";

describe("syncMedicationNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationApi.getPermissionsAsync.mockResolvedValue({ granted: true });
    notificationApi.getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { identifier: "careguardian-medication-0" },
        { identifier: "careguardian-medication-1" }
      ]);
    notificationApi.scheduleNotificationAsync
      .mockResolvedValueOnce("careguardian-medication-0")
      .mockResolvedValueOnce("careguardian-medication-1");
  });

  test("uses a private Android v2 channel, daily triggers, and verifies every reservation", async () => {
    await expect(syncMedicationNotifications(makeMobileFixtureManual())).resolves.toBe(2);

    expect(notificationApi.setNotificationChannelAsync).toHaveBeenCalledWith(
      "careguardian-medication-v2",
      expect.objectContaining({
        lockscreenVisibility: notificationApi.AndroidNotificationVisibility.SECRET,
        description: "잠금 화면에는 복약 세부 정보를 표시하지 않습니다."
      })
    );
    expect(notificationApi.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: notificationApi.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 30,
          channelId: "careguardian-medication-v2"
        })
      })
    );
    expect(notificationApi.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(3);
  });

  test("does not request notification permission when there is no valid medication reminder", async () => {
    await expect(syncMedicationNotifications(createEmptyCareManual())).resolves.toBe(0);

    expect(notificationApi.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(notificationApi.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(notificationApi.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationApi.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationApi.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test("cancels old reminders before returning when new notification permission is denied", async () => {
    notificationApi.getPermissionsAsync.mockResolvedValue({ granted: false });
    notificationApi.requestPermissionsAsync.mockResolvedValue({ granted: false });
    notificationApi.getAllScheduledNotificationsAsync.mockReset();
    notificationApi.getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([{ identifier: "careguardian-medication-0" }])
      .mockResolvedValueOnce([]);

    await expect(syncMedicationNotifications(makeMobileFixtureManual())).resolves.toBe(0);

    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-0"
    );
    expect(notificationApi.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test("reports a clear error when only part of the daily schedule is retained", async () => {
    notificationApi.getAllScheduledNotificationsAsync.mockReset();
    notificationApi.getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ identifier: "careguardian-medication-0" }]);

    await expect(syncMedicationNotifications(makeMobileFixtureManual())).rejects.toThrow(
      "복약 알림 예약 검증에 실패했습니다"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-0"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-1"
    );
  });

  test("cleans up every new medication identifier when scheduling stops midway", async () => {
    notificationApi.scheduleNotificationAsync
      .mockReset()
      .mockResolvedValueOnce("careguardian-medication-0")
      .mockRejectedValueOnce(new Error("native schedule failure"));

    await expect(syncMedicationNotifications(makeMobileFixtureManual())).rejects.toThrow(
      "복약 알림 예약에 실패했습니다"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-0"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-1"
    );
  });

  test("does not start new reservations when existing medication cancellation leaves a residual", async () => {
    notificationApi.getAllScheduledNotificationsAsync.mockReset();
    notificationApi.getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([
        { identifier: "careguardian-medication-0" },
        { identifier: "careguardian-medication-1" }
      ])
      .mockResolvedValueOnce([{ identifier: "careguardian-medication-0" }]);
    notificationApi.cancelScheduledNotificationAsync
      .mockReset()
      .mockRejectedValueOnce(new Error("native cancel failure"))
      .mockResolvedValueOnce(undefined);

    await expect(syncMedicationNotifications(makeMobileFixtureManual())).rejects.toThrow(
      "복약 알림 취소 검증에 실패했습니다: 1건"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-0"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-1"
    );
    expect(notificationApi.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("cancelCareguardianMedicationNotifications", () => {
  beforeEach(() => {
    notificationApi.getAllScheduledNotificationsAsync.mockReset();
    notificationApi.cancelScheduledNotificationAsync.mockReset();
  });

  test("attempts every medication cancellation and reports residual reservations", async () => {
    notificationApi.getAllScheduledNotificationsAsync
      .mockResolvedValueOnce([
        { identifier: "careguardian-medication-0" },
        { identifier: "careguardian-medication-1" },
        { identifier: "unrelated-notification" }
      ])
      .mockResolvedValueOnce([{ identifier: "careguardian-medication-1" }]);
    notificationApi.cancelScheduledNotificationAsync
      .mockRejectedValueOnce(new Error("native cancel failure"))
      .mockResolvedValueOnce(undefined);

    await expect(cancelCareguardianMedicationNotifications()).rejects.toThrow(
      "복약 알림 취소 검증에 실패했습니다: 1건"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-0"
    );
    expect(notificationApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "careguardian-medication-1"
    );
    expect(notificationApi.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, test, vi } from "vitest";
import { createEmptyCareManual } from "@careguardian/care-core/manual";
import { saveMobileCareProfile } from "./mobileCareSaveFlow";

describe("saveMobileCareProfile", () => {
  test("does not report success or schedule notifications when storage fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("disk unavailable"));
    const syncNotifications = vi.fn();

    const outcome = await saveMobileCareProfile({
      manual: createEmptyCareManual(),
      save,
      syncNotifications
    });

    expect(outcome).toEqual({
      kind: "storage-failed",
      message: "저장에 실패했습니다. 내용을 확인한 뒤 다시 시도해 주세요."
    });
    expect(syncNotifications).not.toHaveBeenCalled();
  });

  test("keeps the saved profile usable when notification synchronization fails", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const syncNotifications = vi.fn().mockRejectedValue(new Error("notification unavailable"));

    const outcome = await saveMobileCareProfile({
      manual: createEmptyCareManual(),
      save,
      syncNotifications
    });

    expect(outcome).toEqual({
      kind: "notification-failed",
      message: "저장은 완료됐지만 알림 예약에 실패했습니다. 기기 알림 권한과 설정을 확인해 주세요."
    });
  });

  test("reports the reserved notification count when both operations succeed", async () => {
    const outcome = await saveMobileCareProfile({
      manual: createEmptyCareManual(),
      save: vi.fn().mockResolvedValue(undefined),
      syncNotifications: vi.fn().mockResolvedValue(2)
    });

    expect(outcome).toEqual({
      kind: "saved",
      notificationCount: 2,
      message: "저장 완료. 복약 알림 2건을 예약했습니다."
    });
  });
});

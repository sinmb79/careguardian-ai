import { describe, expect, test, vi } from "vitest";
import { clearMobileData } from "./clearMobileData";

describe("clearMobileData", () => {
  test("verifies reminder cancellation before deleting the manual and resetting memory", async () => {
    const events: string[] = [];

    await clearMobileData({
      deleteManual: async () => {
        events.push("manual");
      },
      cancelCareguardianNotifications: async () => {
        events.push("notifications");
      },
      resetMemory: vi.fn(() => {
        events.push("memory");
      })
    });

    expect(events).toEqual(["notifications", "manual", "memory"]);
  });

  test("keeps the stored manual available for retry when reminder cancellation fails", async () => {
    const deleteManual = vi.fn();

    await expect(
      clearMobileData({
        deleteManual,
        cancelCareguardianNotifications: async () => {
          throw new Error("one reminder remains");
        },
        resetMemory: vi.fn()
      })
    ).rejects.toThrow("one reminder remains");

    expect(deleteManual).not.toHaveBeenCalled();
  });

  test("does not reset the visible data when deletion fails", async () => {
    const resetMemory = vi.fn();

    await expect(
      clearMobileData({
        deleteManual: async () => {
          throw new Error("storage unavailable");
        },
        cancelCareguardianNotifications: async () => undefined,
        resetMemory
      })
    ).rejects.toThrow("storage unavailable");

    expect(resetMemory).not.toHaveBeenCalled();
  });
});

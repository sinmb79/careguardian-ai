import { describe, expect, test, vi } from "vitest";
import { clearMobileData } from "./clearMobileData";

describe("clearMobileData", () => {
  test("verifies general notification cancellation before deleting the workspace", async () => {
    const events: string[] = [];
    await clearMobileData({
      cancelLifeNotifications: async () => void events.push("notifications"),
      deleteWorkspace: async () => void events.push("workspace"),
      resetMemory: vi.fn(() => void events.push("memory"))
    });
    expect(events).toEqual(["notifications", "workspace", "memory"]);
  });

  test("keeps the stored workspace available when notification cancellation fails", async () => {
    const deleteWorkspace = vi.fn();
    await expect(clearMobileData({
      cancelLifeNotifications: async () => { throw new Error("one reminder remains"); },
      deleteWorkspace,
      resetMemory: vi.fn()
    })).rejects.toThrow("one reminder remains");
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });
});

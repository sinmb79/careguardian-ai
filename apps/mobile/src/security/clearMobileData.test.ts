import { describe, expect, test, vi } from "vitest";
import { clearMobileData } from "./clearMobileData";

describe("clearMobileData", () => {
  test("uses the explicit notification, model, workspace, key, memory deletion order", async () => {
    const events: string[] = [];
    await clearMobileData({
      cancelLifeNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => void events.push("models"),
      deleteWorkspace: async () => void events.push("workspace"),
      deleteSecureStoreKey: async () => void events.push("key"),
      resetMemory: vi.fn(() => void events.push("memory"))
    });
    expect(events).toEqual(["notifications", "models", "workspace", "key", "memory"]);
  });

  test("can inject the Task 7 inference stop hook before deletion starts", async () => {
    const events: string[] = [];
    await clearMobileData({
      stopActiveInference: async () => void events.push("inference"),
      cancelLifeNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => void events.push("models"),
      deleteWorkspace: async () => void events.push("workspace"),
      deleteSecureStoreKey: async () => void events.push("key"),
      resetMemory: () => void events.push("memory")
    });

    expect(events).toEqual(["inference", "notifications", "models", "workspace", "key", "memory"]);
  });

  test("does not hide a step failure or continue deleting later stores", async () => {
    const events: string[] = [];
    const deleteWorkspace = vi.fn();
    await expect(clearMobileData({
      cancelLifeNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => { throw new Error("partial cleanup failed"); },
      deleteWorkspace,
      deleteSecureStoreKey: async () => void events.push("key"),
      resetMemory: vi.fn(() => void events.push("memory"))
    })).rejects.toThrow("partial cleanup failed");
    expect(deleteWorkspace).not.toHaveBeenCalled();
    expect(events).toEqual(["notifications"]);
  });
});

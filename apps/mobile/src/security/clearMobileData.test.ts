import { describe, expect, test, vi } from "vitest";
import { clearMobileData } from "./clearMobileData";

describe("clearMobileData", () => {
  test("uses the explicit notification, model, repository, memory deletion order", async () => {
    const events: string[] = [];
    await clearMobileData({
      cancelAllScheduledNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => void events.push("models"),
      deleteAllKnownWorkspaceData: async () => void events.push("workspace"),
      resetMemory: vi.fn(() => void events.push("memory"))
    });
    expect(events).toEqual(["notifications", "models", "workspace", "memory"]);
  });

  test("can inject the Task 7 inference stop hook before deletion starts", async () => {
    const events: string[] = [];
    await clearMobileData({
      stopActiveInference: async () => void events.push("inference"),
      cancelAllScheduledNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => void events.push("models"),
      deleteAllKnownWorkspaceData: async () => void events.push("workspace"),
      resetMemory: () => void events.push("memory")
    });

    expect(events).toEqual(["inference", "notifications", "models", "workspace", "memory"]);
  });

  test("attempts independent domains after a failure and returns typed aggregate failures", async () => {
    const events: string[] = [];
    const deleteAllKnownWorkspaceData = vi.fn();
    await expect(clearMobileData({
      cancelAllScheduledNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => { throw new Error("partial cleanup failed"); },
      deleteAllKnownWorkspaceData,
      resetMemory: vi.fn(() => void events.push("memory"))
    })).rejects.toMatchObject({
      name: "AggregateError",
      errors: [expect.objectContaining({ domain: "local-model-files" })]
    });
    expect(deleteAllKnownWorkspaceData).toHaveBeenCalledOnce();
    expect(events).toEqual(["notifications", "memory"]);
  });
});

import { describe, expect, test, vi } from "vitest";
import { clearMobileData } from "./clearMobileData";

describe("clearMobileData", () => {
  test("uses the explicit notification, model, repository, memory deletion order", async () => {
    const events: string[] = [];
    await clearMobileData({
      stopActiveInference: async () => undefined,
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

  test("stops before every mutation when active inference cannot be released", async () => {
    const events: string[] = [];
    const releaseFailure = Object.assign(new Error("native context still owns the model"), {
      code: "release_failed"
    });

    await expect(clearMobileData({
      stopActiveInference: async () => { throw releaseFailure; },
      cancelAllScheduledNotifications: async () => void events.push("notifications"),
      removeAllModels: async () => void events.push("models"),
      deleteAllKnownWorkspaceData: async () => void events.push("workspace"),
      resetMemory: () => void events.push("memory")
    })).rejects.toBe(releaseFailure);

    expect(events).toEqual([]);
  });

  test("attempts independent domains after a failure and returns typed aggregate failures", async () => {
    const events: string[] = [];
    const deleteAllKnownWorkspaceData = vi.fn();
    await expect(clearMobileData({
      stopActiveInference: async () => undefined,
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

  test("preserves ordered domains and causes when several independent deletions fail", async () => {
    const notificationFailure = new Error("alarm remains");
    const workspaceFailure = new Error("encrypted record remains");
    const resetMemory = vi.fn();

    await expect(clearMobileData({
      stopActiveInference: async () => undefined,
      cancelAllScheduledNotifications: async () => { throw notificationFailure; },
      removeAllModels: async () => undefined,
      deleteAllKnownWorkspaceData: async () => { throw workspaceFailure; },
      resetMemory
    })).rejects.toMatchObject({
      name: "AggregateError",
      errors: [
        expect.objectContaining({
          domain: "scheduled-notifications",
          cause: notificationFailure
        }),
        expect.objectContaining({
          domain: "workspace-and-legacy-storage",
          cause: workspaceFailure
        })
      ]
    });

    expect(resetMemory).toHaveBeenCalledOnce();
  });
});

import { describe, expect, test, vi } from "vitest";
import { fixtureWorkspace } from "../test/fixtureWorkspace";

vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) }
}));
vi.mock("../notifications/lifeNotifications", () => ({
  syncLifeNotifications: async () => 0,
  cancelAllLifeNotifications: async () => undefined
}));
vi.mock("../storage/mobileWorkspaceRepository", () => ({
  loadWorkspace: async () => null,
  hasPreviousTestData: async () => false,
  deletePreviousTestData: async () => undefined,
  saveWorkspace: async () => undefined,
  deleteWorkspace: async () => undefined
}));
vi.mock("../security/localAuthentication", () => ({
  authenticateForSensitiveAccess: async () => ({ authenticated: false, message: "test" })
}));
import { createLifeWorkspaceController } from "./useLifeWorkspace";

describe("life workspace state", () => {
  test("saves a valid workspace before synchronizing generic notifications", async () => {
    const events: string[] = [];
    const controller = createLifeWorkspaceController({
      load: async () => null,
      hasPreviousTestData: async () => false,
      save: async () => void events.push("save"),
      deleteWorkspace: async () => void events.push("delete"),
      syncNotifications: async () => {
        events.push("notifications");
        return 1;
      },
      cancelNotifications: async () => void events.push("cancel")
    });

    await expect(controller.save(fixtureWorkspace)).resolves.toMatchObject({ kind: "saved", notificationCount: 1 });
    expect(events).toEqual(["save", "notifications"]);
  });

  test("does not save an invalid extension and leaves storage untouched", async () => {
    const save = vi.fn();
    const controller = createLifeWorkspaceController({
      load: async () => null,
      hasPreviousTestData: async () => false,
      save,
      deleteWorkspace: async () => undefined,
      syncNotifications: async () => 0,
      cancelNotifications: async () => undefined
    });

    await expect(
      controller.save({ ...fixtureWorkspace, extensions: [{ id: "bad", title: "오류", fields: [], automations: [{ trigger: "never", action: "showNotification" }] }] } as never)
    ).resolves.toMatchObject({ kind: "validation-failed" });
    expect(save).not.toHaveBeenCalled();
  });

  test("keeps stored data available when notification cancellation fails", async () => {
    const deleteWorkspace = vi.fn();
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      deleteWorkspace,
      syncNotifications: async () => 0,
      cancelNotifications: async () => { throw new Error("one reminder remains"); }
    });

    await expect(controller.deleteAll()).rejects.toThrow("one reminder remains");
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  test("requires explicit deletion before clearing previous test data", async () => {
    const deletePreviousTestData = vi.fn();
    const controller = createLifeWorkspaceController({
      load: async () => null,
      hasPreviousTestData: async () => true,
      deletePreviousTestData,
      save: async () => undefined,
      deleteWorkspace: async () => undefined,
      syncNotifications: async () => 0,
      cancelNotifications: async () => undefined
    });

    await controller.load();
    expect(controller.snapshot().previousTestData).toBe(true);
    expect(deletePreviousTestData).not.toHaveBeenCalled();

    await controller.deletePreviousTestData();
    expect(deletePreviousTestData).toHaveBeenCalledOnce();
    expect(controller.snapshot().previousTestData).toBe(false);
  });
});

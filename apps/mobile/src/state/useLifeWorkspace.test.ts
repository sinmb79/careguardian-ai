import { describe, expect, test, vi } from "vitest";
import { fixtureWorkspace } from "../test/fixtureWorkspace";
import { createEmptyWorkspace } from "@life-steward/life-core";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

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

  test("keeps the real coordinator locked when a save completes after backgrounding", async () => {
    const pendingSave = deferred<void>();
    const syncNotifications = vi.fn(async () => 1);
    const controller = createLifeWorkspaceController({
      load: async () => null, hasPreviousTestData: async () => false,
      save: async () => pendingSave.promise, deleteWorkspace: async () => undefined,
      syncNotifications, cancelNotifications: async () => undefined
    });
    controller.update(fixtureWorkspace);

    const saving = controller.save(fixtureWorkspace);
    controller.onAppStateChange("inactive");
    pendingSave.resolve();

    await expect(saving).resolves.toMatchObject({ kind: "stale" });
    expect(syncNotifications).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({ privacyGate: "locked", hasStoredWorkspace: true, isSaving: false });
  });

  test("invalidates an empty first save on every non-active lifecycle transition", async () => {
    const pendingSave = deferred<void>();
    const syncNotifications = vi.fn(async () => 1);
    const controller = createLifeWorkspaceController({
      load: async () => null, hasPreviousTestData: async () => false,
      save: async () => pendingSave.promise, deleteWorkspace: async () => undefined,
      syncNotifications, cancelNotifications: async () => undefined
    });
    const emptyWorkspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    controller.update(emptyWorkspace);

    const saving = controller.save(emptyWorkspace);
    controller.onAppStateChange("background");
    pendingSave.resolve();

    await expect(saving).resolves.toMatchObject({ kind: "stale" });
    expect(syncNotifications).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({ privacyGate: "locked", isSaving: false });
  });

  test("keeps the real coordinator locked when authentication completes after backgrounding", async () => {
    const authentication = deferred<{ authenticated: boolean; message: string }>();
    const load = vi.fn(async () => fixtureWorkspace);
    const controller = createLifeWorkspaceController({
      load, hasPreviousTestData: async () => false, authenticate: async () => authentication.promise,
      save: async () => undefined, deleteWorkspace: async () => undefined,
      syncNotifications: async () => 0, cancelNotifications: async () => undefined
    });
    await controller.load();

    const unlocking = controller.unlock();
    controller.onAppStateChange("background");
    authentication.resolve({ authenticated: true, message: "ok" });

    await expect(unlocking).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toMatchObject({ privacyGate: "locked", isAuthenticating: false });
  });

  test("rejects delete while save is active and never deletes beneath that save", async () => {
    const pendingSave = deferred<void>();
    const deleteWorkspace = vi.fn(async () => undefined);
    const controller = createLifeWorkspaceController({
      load: async () => null, hasPreviousTestData: async () => false,
      save: async () => pendingSave.promise, deleteWorkspace,
      syncNotifications: async () => 0, cancelNotifications: async () => undefined
    });
    const saving = controller.save(fixtureWorkspace);

    await expect(controller.deleteAll()).rejects.toThrow("operation in progress");
    expect(deleteWorkspace).not.toHaveBeenCalled();
    pendingSave.resolve();
    await saving;
  });

  test("rejects save while full delete is active and cannot recreate storage afterwards", async () => {
    const pendingCancel = deferred<void>();
    const save = vi.fn(async () => undefined);
    const deleteWorkspace = vi.fn(async () => undefined);
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace, hasPreviousTestData: async () => false,
      save, deleteWorkspace, syncNotifications: async () => 0,
      cancelNotifications: async () => pendingCancel.promise
    });
    const deleting = controller.deleteAll();

    await expect(controller.save(fixtureWorkspace)).resolves.toMatchObject({ kind: "busy" });
    expect(save).not.toHaveBeenCalled();
    pendingCancel.resolve();
    await deleting;
    expect(deleteWorkspace).toHaveBeenCalledOnce();
  });
});

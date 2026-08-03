import { describe, expect, test, vi } from "vitest";
import { fixtureWorkspace } from "../test/fixtureWorkspace";
import { createEmptyWorkspace } from "@life-steward/life-core";

vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) }
}));
vi.mock("../notifications/lifeNotifications", () => ({
  syncLifeNotifications: async () => 0,
  cancelAllLifeNotifications: async () => undefined,
  cancelAllScheduledNotificationsForFullDeletion: async () => undefined,
  cancelPreviousTestNotifications: async () => undefined
}));
vi.mock("../storage/mobileWorkspaceRepository", () => ({
  loadWorkspace: async () => null,
  hasPreviousTestData: async () => false,
  deletePreviousTestData: async () => undefined,
  saveWorkspace: async () => undefined,
  deleteAllKnownMobileData: async () => undefined
}));
vi.mock("../security/localAuthentication", () => ({
  authenticateForSensitiveAccess: async () => ({ authenticated: false, message: "test" })
}));
vi.mock("../local-ai/modelStore", () => ({
  removeAllModels: async () => undefined
}));
import {
  createLifeWorkspaceController as createControllerWithRequiredRelease,
  type LifeWorkspaceControllerDependencies
} from "./useLifeWorkspace";

const releaseInference = async () => undefined;
type TestControllerDependencies =
  Omit<LifeWorkspaceControllerDependencies, "stopActiveInference"> &
  Partial<Pick<LifeWorkspaceControllerDependencies, "stopActiveInference">>;

function createLifeWorkspaceController(
  dependencies: TestControllerDependencies
) {
  return createControllerWithRequiredRelease({
    stopActiveInference: releaseInference,
    ...dependencies
  });
}

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
      deleteAllKnownWorkspaceData: async () => void events.push("delete"),
      removeAllModels: async () => void events.push("models"),
      syncNotifications: async () => {
        events.push("notifications");
        return 1;
      },
      cancelAllScheduledNotifications: async () => void events.push("cancel")
    });

    await expect(controller.save(fixtureWorkspace)).resolves.toMatchObject({ kind: "saved", notificationCount: 1 });
    expect(events).toEqual(["save", "notifications"]);
  });

  test("passes a newly stored due date to notification synchronization after saving", async () => {
    const syncNotifications = vi.fn(async () => 1);
    const workspace = {
      ...fixtureWorkspace,
      tasks: [{ ...fixtureWorkspace.tasks[0], dueDate: "2026-08-01" }]
    };
    const controller = createLifeWorkspaceController({
      load: async () => null,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications,
      cancelAllScheduledNotifications: async () => undefined
    });

    await expect(controller.save(workspace)).resolves.toMatchObject({ kind: "saved", notificationCount: 1 });
    expect(syncNotifications).toHaveBeenCalledWith([{ ...fixtureWorkspace.tasks[0], dueDate: "2026-08-01" }]);
  });

  test("does not save an invalid extension and leaves storage untouched", async () => {
    const save = vi.fn();
    const controller = createLifeWorkspaceController({
      load: async () => null,
      hasPreviousTestData: async () => false,
      save,
      deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => undefined
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
      deleteAllKnownWorkspaceData: deleteWorkspace,
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => { throw new Error("one reminder remains"); }
    });

    await expect(controller.deleteAll()).rejects.toMatchObject({
      name: "AggregateError",
      errors: [expect.objectContaining({ domain: "scheduled-notifications" })]
    });
    expect(deleteWorkspace).toHaveBeenCalledOnce();
  });

  test("requires explicit deletion before clearing previous test data", async () => {
    const deletePreviousTestData = vi.fn();
    const controller = createLifeWorkspaceController({
      load: async () => null,
      hasPreviousTestData: async () => true,
      deletePreviousTestData,
      save: async () => undefined,
      deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => undefined
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
      save: async () => pendingSave.promise, deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications, cancelAllScheduledNotifications: async () => undefined
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
      save: async () => pendingSave.promise, deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications, cancelAllScheduledNotifications: async () => undefined
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
      save: async () => undefined, deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0, cancelAllScheduledNotifications: async () => undefined
    });
    await controller.load();

    const unlocking = controller.unlock();
    controller.onAppStateChange("background");
    authentication.resolve({ authenticated: true, message: "ok" });

    await expect(unlocking).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toMatchObject({ privacyGate: "locked", isAuthenticating: false });
  });

  test("unlocks after the device credential activity temporarily backgrounds and returns to the app", async () => {
    const authentication = deferred<{ authenticated: boolean; message: string }>();
    const load = vi.fn(async () => fixtureWorkspace);
    const controller = createLifeWorkspaceController({
      load, hasPreviousTestData: async () => false, authenticate: async () => authentication.promise,
      save: async () => undefined, deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0, cancelAllScheduledNotifications: async () => undefined
    });
    await controller.load();

    const unlocking = controller.unlock();
    controller.onAppStateChange("background");
    controller.onAppStateChange("active");
    authentication.resolve({ authenticated: true, message: "인증되었습니다." });

    await expect(unlocking).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
    expect(controller.snapshot()).toMatchObject({
      workspace: fixtureWorkspace,
      privacyGate: "unlocked",
      isAuthenticating: false,
      statusMessage: "인증되었습니다."
    });
  });

  test("rejects delete while save is active and never deletes beneath that save", async () => {
    const pendingSave = deferred<void>();
    const deleteWorkspace = vi.fn(async () => undefined);
    const controller = createLifeWorkspaceController({
      load: async () => null, hasPreviousTestData: async () => false,
      save: async () => pendingSave.promise,
      deleteAllKnownWorkspaceData: deleteWorkspace,
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0, cancelAllScheduledNotifications: async () => undefined
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
      save, deleteAllKnownWorkspaceData: deleteWorkspace, syncNotifications: async () => 0,
      removeAllModels: async () => undefined,
      cancelAllScheduledNotifications: async () => pendingCancel.promise
    });
    const deleting = controller.deleteAll();

    await expect(controller.save(fixtureWorkspace)).resolves.toMatchObject({ kind: "busy" });
    expect(save).not.toHaveBeenCalled();
    pendingCancel.resolve();
    await deleting;
    expect(deleteWorkspace).toHaveBeenCalledOnce();
  });

  test("production full deletion removes models before the repository and resets memory last", async () => {
    const events: string[] = [];
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      deleteAllKnownWorkspaceData: async () => void events.push("workspace"),
      removeAllModels: async () => void events.push("models"),
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => void events.push("notifications")
    });
    await controller.load();

    await controller.deleteAll();

    expect(events).toEqual(["notifications", "models", "workspace"]);
    const snapshot = controller.snapshot();
    expect(snapshot).toMatchObject({
      hasStoredWorkspace: false,
      privacyGate: "unlocked"
    });
    expect(snapshot.workspace).toEqual(
      createEmptyWorkspace(snapshot.workspace.createdAt)
    );
  });

  test("stops and releases active inference before every production full-delete mutation", async () => {
    const events: string[] = [];
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      stopActiveInference: async () => void events.push("inference"),
      deleteAllKnownWorkspaceData: async () => void events.push("workspace"),
      removeAllModels: async () => void events.push("models"),
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => void events.push("notifications")
    });
    await controller.load();

    await controller.deleteAll();

    expect(events).toEqual(["inference", "notifications", "models", "workspace"]);
  });

  test("keeps UI locked while deleting independent workspace data after model deletion fails", async () => {
    const deleteWorkspace = vi.fn();
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      deleteAllKnownWorkspaceData: deleteWorkspace,
      removeAllModels: async () => { throw new Error("model deletion failed"); },
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => undefined
    });
    await controller.load();

    await expect(controller.deleteAll()).rejects.toMatchObject({
      name: "AggregateError",
      errors: [expect.objectContaining({ domain: "local-model-files" })]
    });

    expect(deleteWorkspace).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toMatchObject({
      workspace: expect.objectContaining({ id: "personal-workspace", tasks: [], lists: [], records: [] }),
      hasStoredWorkspace: false,
      privacyGate: "locked",
      isDeleting: false,
      deletionFailure: {
        failedDomains: ["local-model-files"]
      }
    });
    expect(controller.snapshot().statusMessage).toContain("로컬 모델 파일");
    expect(controller.snapshot().statusMessage).not.toContain("모든 로컬 데이터를 삭제했습니다");
  });

  test("records a persistent workspace deletion failure without reporting success", async () => {
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      deleteAllKnownWorkspaceData: async () => { throw new Error("secure store key remains"); },
      removeAllModels: async () => undefined,
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => undefined
    });
    await controller.load();

    await expect(controller.deleteAll()).rejects.toMatchObject({ name: "AggregateError" });

    expect(controller.snapshot()).toMatchObject({
      privacyGate: "locked",
      hasStoredWorkspace: true,
      workspace: expect.objectContaining({ tasks: [], records: [], lists: [] }),
      deletionFailure: {
        failedDomains: ["workspace-and-legacy-storage"]
      }
    });
    expect(controller.snapshot().statusMessage).toContain("작업공간 및 이전 저장소");
  });

  test("can retry a partial deletion from the locked recovery state", async () => {
    let modelAttempts = 0;
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      deleteAllKnownWorkspaceData: async () => undefined,
      removeAllModels: async () => {
        modelAttempts += 1;
        if (modelAttempts === 1) throw new Error("model file remains");
      },
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => undefined
    });
    await controller.load();

    await expect(controller.deleteAll()).rejects.toMatchObject({
      name: "AggregateError"
    });
    expect(controller.snapshot()).toMatchObject({
      privacyGate: "locked",
      deletionFailure: { failedDomains: ["local-model-files"] }
    });

    await controller.deleteAll();

    const snapshot = controller.snapshot();
    expect(modelAttempts).toBe(2);
    expect(snapshot).toMatchObject({
      hasStoredWorkspace: false,
      privacyGate: "unlocked",
      deletionFailure: null
    });
    expect(snapshot.workspace).toEqual(
      createEmptyWorkspace(snapshot.workspace.createdAt)
    );
  });

  test("stops full deletion before any mutation and requires an app restart when inference release fails", async () => {
    const events: string[] = [];
    const controller = createLifeWorkspaceController({
      load: async () => fixtureWorkspace,
      hasPreviousTestData: async () => false,
      save: async () => undefined,
      stopActiveInference: async () => {
        throw Object.assign(new Error("native context still alive"), {
          code: "release_failed"
        });
      },
      deleteAllKnownWorkspaceData: async () => void events.push("workspace"),
      removeAllModels: async () => void events.push("models"),
      syncNotifications: async () => 0,
      cancelAllScheduledNotifications: async () => void events.push("notifications")
    });
    await controller.load();

    await expect(controller.deleteAll()).rejects.toMatchObject({
      code: "release_failed"
    });

    expect(events).toEqual([]);
    expect(controller.snapshot()).toMatchObject({
      workspace: fixtureWorkspace,
      hasStoredWorkspace: true,
      privacyGate: "locked",
      isDeleting: false,
      deletionFailure: {
        failedDomains: ["active-inference"]
      },
      statusMessage:
        "로컬 AI 컨텍스트 해제를 확인하지 못했습니다. 앱을 완전히 종료한 뒤 다시 열어 주세요."
    });
  });
});

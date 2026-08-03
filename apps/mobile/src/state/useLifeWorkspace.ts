import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  createEmptyWorkspace,
  validateExtension,
  validateWorkspace,
  type PersonalWorkspace
} from "@life-steward/life-core";
import {
  cancelAllScheduledNotificationsForFullDeletion,
  cancelPreviousTestNotifications,
  syncLifeNotifications
} from "../notifications/lifeNotifications";
import { authenticateForSensitiveAccess, type AuthenticationResult } from "../security/localAuthentication";
import {
  createPrivacyGateState,
  lockedWorkspaceStatusMessage,
  type PrivacyGateState
} from "../security/privacyGate";
import {
  deleteAllKnownMobileData,
  deletePreviousTestData,
  hasPreviousTestData,
  loadWorkspace,
  saveWorkspace
} from "../storage/mobileWorkspaceRepository";
import { removeAllModels } from "../local-ai/modelStore";
import { stopAndReleaseLocalModel } from "../local-ai/llamaRuntime";
import {
  clearMobileData,
  getMobileDeletionFailedDomains,
  type MobileDeletionDomain
} from "../security/clearMobileData";

export type LifeWorkspaceSection = "today" | "lists" | "extensions" | "local-ai" | "settings";
type OperationKind = "save" | "delete" | "unlock" | "previous-delete" | null;

export type LifeWorkspaceSnapshot = {
  workspace: PersonalWorkspace;
  hasStoredWorkspace: boolean;
  previousTestData: boolean;
  isLoaded: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isAuthenticating: boolean;
  privacyGate: PrivacyGateState;
  deletionFailure: {
    failedDomains: MobileDeletionDomain[];
    message: string;
  } | null;
  statusMessage: string;
  section: LifeWorkspaceSection;
};

export type LifeWorkspaceState = LifeWorkspaceSnapshot & {
  actions: {
    updateWorkspace(workspace: PersonalWorkspace): void;
    save(): Promise<void>;
    deleteAllData(): Promise<void>;
    unlock(): Promise<void>;
    deletePreviousTestData(): Promise<void>;
    openSection(section: LifeWorkspaceSection): void;
  };
};

type SaveOutcome =
  | { kind: "saved"; notificationCount: number }
  | { kind: "validation-failed"; message: string }
  | { kind: "busy" }
  | { kind: "stale" };

export type LifeWorkspaceControllerDependencies = {
  load(): Promise<PersonalWorkspace | null>;
  hasPreviousTestData(): Promise<boolean>;
  deletePreviousTestData?(): Promise<void>;
  save(workspace: PersonalWorkspace): Promise<void>;
  stopActiveInference(): Promise<void>;
  deleteAllKnownWorkspaceData(): Promise<void>;
  removeAllModels(): Promise<void>;
  syncNotifications(tasks: PersonalWorkspace["tasks"]): Promise<number>;
  cancelAllScheduledNotifications(): Promise<void>;
  cancelPreviousTestNotifications?(): Promise<void>;
  authenticate?(): Promise<AuthenticationResult>;
};

function validateForSaving(workspace: PersonalWorkspace): string | null {
  const workspaceValidation = validateWorkspace(workspace);
  if (!workspaceValidation.ok) return workspaceValidation.errors.join(" ");
  for (const extension of workspace.extensions) {
    const extensionValidation = validateExtension(extension);
    if (!extensionValidation.ok) return extensionValidation.errors.join(" ");
  }
  return null;
}

function initialSnapshot(): LifeWorkspaceSnapshot {
  return {
    workspace: createEmptyWorkspace(), hasStoredWorkspace: false, previousTestData: false,
    isLoaded: false, isSaving: false, isDeleting: false, isAuthenticating: false,
    privacyGate: "unlocked", deletionFailure: null,
    statusMessage: "개인 생활 작업공간을 준비하고 있습니다.", section: "today"
  };
}

const DELETION_DOMAIN_LABELS: Record<MobileDeletionDomain, string> = {
  "active-inference": "실행 중인 로컬 AI",
  "scheduled-notifications": "예약된 알림",
  "local-model-files": "로컬 모델 파일",
  "workspace-and-legacy-storage": "작업공간 및 이전 저장소",
  "in-memory-state": "메모리 상태"
};

export function createLifeWorkspaceController(dependencies: LifeWorkspaceControllerDependencies) {
  let current = initialSnapshot();
  let listener: ((snapshot: LifeWorkspaceSnapshot) => void) | undefined;
  let lifecycleGeneration = 0;
  let operationGeneration = 0;
  let activeOperation: { kind: Exclude<OperationKind, null>; id: number } | null = null;
  let appState = "active";
  let authenticationPromptOperationId: number | null = null;

  const publish = (next: LifeWorkspaceSnapshot) => {
    current = next;
    listener?.(current);
  };
  const patch = (next: Partial<LifeWorkspaceSnapshot>) => publish({ ...current, ...next });
  const isCurrent = (kind: Exclude<OperationKind, null>, id: number, generation: number) =>
    activeOperation?.kind === kind && activeOperation.id === id && lifecycleGeneration === generation;
  const start = (kind: Exclude<OperationKind, null>): number | null => {
    if (activeOperation) return null;
    const id = ++operationGeneration;
    activeOperation = { kind, id };
    return id;
  };
  const finish = (kind: Exclude<OperationKind, null>, id: number, next: Partial<LifeWorkspaceSnapshot>) => {
    if (activeOperation?.kind !== kind || activeOperation.id !== id) return;
    activeOperation = null;
    patch(next);
  };

  return {
    snapshot: () => current,
    subscribe(nextListener: (snapshot: LifeWorkspaceSnapshot) => void) {
      listener = nextListener;
      return () => { if (listener === nextListener) listener = undefined; };
    },
    update(workspace: PersonalWorkspace) { patch({ workspace }); },
    onAppStateChange(nextState: string) {
      appState = nextState;
      if (nextState !== "active") {
        if (
          activeOperation?.kind === "unlock" &&
          authenticationPromptOperationId === activeOperation.id
        ) {
          return;
        }
        lifecycleGeneration += 1;
        patch({ privacyGate: "locked", statusMessage: "앱이 백그라운드로 전환되어 작업공간을 잠갔습니다." });
      }
    },
    async load() {
      const generation = lifecycleGeneration;
      try {
        const [workspace, previousTestData] = await Promise.all([dependencies.load(), dependencies.hasPreviousTestData()]);
        const shouldRemainLocked = generation !== lifecycleGeneration || Boolean(workspace);
        patch({
          workspace: workspace ?? current.workspace,
          hasStoredWorkspace: Boolean(workspace), previousTestData, isLoaded: true,
          privacyGate: shouldRemainLocked ? "locked" : createPrivacyGateState(false),
          statusMessage: previousTestData
            ? "이전 테스트 데이터 삭제 후 시작할 수 있습니다."
            : workspace ? lockedWorkspaceStatusMessage() : "오늘의 생활 작업을 정리해 보세요."
        });
        return current;
      } catch (error) {
        patch({ isLoaded: true, privacyGate: "locked", statusMessage: "저장된 작업공간을 안전하게 확인하지 못했습니다." });
        throw error;
      }
    },
    async save(workspace: PersonalWorkspace): Promise<SaveOutcome> {
      const validationError = validateForSaving(workspace);
      if (validationError) return { kind: "validation-failed", message: validationError };
      const id = start("save");
      if (id === null) return { kind: "busy" };
      const generation = lifecycleGeneration;
      patch({ isSaving: true });
      try {
        await dependencies.save(workspace);
        if (!isCurrent("save", id, generation)) {
          patch({ hasStoredWorkspace: true, privacyGate: "locked" });
          return { kind: "stale" };
        }
        const notificationCount = await dependencies.syncNotifications(workspace.tasks);
        if (!isCurrent("save", id, generation)) {
          patch({ hasStoredWorkspace: true, privacyGate: "locked" });
          return { kind: "stale" };
        }
        patch({
          workspace, hasStoredWorkspace: true, privacyGate: "unlocked",
          statusMessage: notificationCount > 0 ? `생활 알림 ${notificationCount}건을 예약했습니다.` : "생활 작업공간을 저장했습니다."
        });
        return { kind: "saved", notificationCount };
      } finally {
        finish("save", id, { isSaving: false });
      }
    },
    async deleteAll(): Promise<void> {
      const id = start("delete");
      if (id === null) throw new Error("workspace operation in progress");
      lifecycleGeneration += 1;
      patch({ isDeleting: true, privacyGate: "locked", deletionFailure: null });
      try {
        await clearMobileData({
          stopActiveInference: dependencies.stopActiveInference,
          cancelAllScheduledNotifications: dependencies.cancelAllScheduledNotifications,
          removeAllModels: dependencies.removeAllModels,
          deleteAllKnownWorkspaceData: dependencies.deleteAllKnownWorkspaceData,
          resetMemory: () => patch({
            workspace: createEmptyWorkspace(), privacyGate: "locked"
          })
        });
        patch({
          hasStoredWorkspace: false,
          privacyGate: "unlocked",
          deletionFailure: null,
          statusMessage: "이 기기의 모든 로컬 데이터를 삭제했습니다."
        });
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "";
        if (code === "release_failed" || code === "runtime_faulted") {
          const failedDomains: MobileDeletionDomain[] = ["active-inference"];
          const message =
            "로컬 AI 컨텍스트 해제를 확인하지 못했습니다. 앱을 완전히 종료한 뒤 다시 열어 주세요.";
          patch({
            privacyGate: "locked",
            deletionFailure: { failedDomains, message },
            statusMessage: message
          });
          throw error;
        }
        const failedDomains = getMobileDeletionFailedDomains(error);
        const failedLabels = failedDomains.map((domain) => DELETION_DOMAIN_LABELS[domain]);
        const message = failedLabels.length > 0
          ? `모든 데이터 삭제를 완료하지 못했습니다. 실패 영역: ${failedLabels.join(", ")}. 남은 데이터를 확인한 뒤 다시 시도해 주세요.`
          : "모든 데이터 삭제를 완료하지 못했습니다. 남은 데이터를 확인한 뒤 다시 시도해 주세요.";
        patch({
          hasStoredWorkspace: failedDomains.length > 0
            ? failedDomains.includes("workspace-and-legacy-storage")
            : current.hasStoredWorkspace,
          privacyGate: "locked",
          deletionFailure: { failedDomains, message },
          statusMessage: message
        });
        throw error;
      } finally {
        finish("delete", id, { isDeleting: false });
      }
    },
    async unlock(): Promise<void> {
      const id = start("unlock");
      if (id === null) return;
      const generation = lifecycleGeneration;
      patch({ isAuthenticating: true });
      try {
        authenticationPromptOperationId = id;
        let authentication: AuthenticationResult;
        try {
          authentication = await (dependencies.authenticate?.() ?? Promise.resolve({ authenticated: false, message: "기기 인증을 확인할 수 없습니다." }));
        } finally {
          if (authenticationPromptOperationId === id) {
            authenticationPromptOperationId = null;
          }
        }
        if (!isCurrent("unlock", id, generation)) return;
        if (!authentication.authenticated) {
          patch({ privacyGate: "locked", statusMessage: authentication.message });
          return;
        }
        if (appState !== "active") return;
        const workspace = await dependencies.load();
        if (!isCurrent("unlock", id, generation) || appState !== "active") return;
        if (!workspace) {
          patch({ privacyGate: "locked", statusMessage: "저장된 개인 작업공간을 찾지 못했습니다. 안전을 위해 잠금 상태를 유지합니다." });
          return;
        }
        patch({ workspace, hasStoredWorkspace: true, privacyGate: "unlocked", statusMessage: authentication.message });
      } finally {
        finish("unlock", id, { isAuthenticating: false });
      }
    },
    async deletePreviousTestData(): Promise<void> {
      const id = start("previous-delete");
      if (id === null) throw new Error("workspace operation in progress");
      try {
        await dependencies.cancelPreviousTestNotifications?.();
        await dependencies.deletePreviousTestData?.();
        patch({ previousTestData: false, statusMessage: "이전 테스트 데이터를 삭제했습니다." });
      } finally {
        finish("previous-delete", id, {});
      }
    },
    openSection(section: LifeWorkspaceSection) { patch({ section }); }
  };
}

function stampWorkspace(workspace: PersonalWorkspace): PersonalWorkspace {
  return { ...workspace, updatedAt: new Date().toISOString() };
}

export function useLifeWorkspace(): LifeWorkspaceState {
  const controllerRef = useRef<ReturnType<typeof createLifeWorkspaceController> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createLifeWorkspaceController({
      load: loadWorkspace, hasPreviousTestData, deletePreviousTestData, save: saveWorkspace,
      stopActiveInference: () => stopAndReleaseLocalModel("full-data-delete"),
      deleteAllKnownWorkspaceData: deleteAllKnownMobileData, removeAllModels, syncNotifications: syncLifeNotifications,
      cancelAllScheduledNotifications: cancelAllScheduledNotificationsForFullDeletion,
      cancelPreviousTestNotifications, authenticate: authenticateForSensitiveAccess
    });
  }
  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState<LifeWorkspaceSnapshot>(() => controller.snapshot());

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    void controller.load().catch(() => undefined);
    return unsubscribe;
  }, [controller]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => controller.onAppStateChange(state));
    return () => subscription.remove();
  }, [controller]);

  const actions = useMemo(() => ({
    updateWorkspace: (workspace: PersonalWorkspace) => controller.update(workspace),
    save: async () => { await controller.save(stampWorkspace(controller.snapshot().workspace)); },
    deleteAllData: () => controller.deleteAll(),
    unlock: () => controller.unlock(),
    deletePreviousTestData: () => controller.deletePreviousTestData(),
    openSection: (section: LifeWorkspaceSection) => controller.openSection(section)
  }), [controller]);
  return { ...snapshot, actions };
}

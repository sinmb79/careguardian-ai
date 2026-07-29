import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import {
  createEmptyWorkspace,
  validateExtension,
  validateWorkspace,
  type PersonalWorkspace
} from "@life-steward/life-core";
import {
  cancelAllLifeNotifications,
  cancelPreviousTestNotifications,
  syncLifeNotifications
} from "../notifications/lifeNotifications";
import { clearMobileData } from "../security/clearMobileData";
import { authenticateForSensitiveAccess } from "../security/localAuthentication";
import {
  createPrivacyGateState,
  lockedWorkspaceStatusMessage,
  resolveWorkspaceUnlock,
  shouldLockWorkspaceOnBackground,
  type PrivacyGateState
} from "../security/privacyGate";
import {
  deletePreviousTestData,
  deleteWorkspace,
  hasPreviousTestData,
  loadWorkspace,
  saveWorkspace
} from "../storage/mobileWorkspaceRepository";

export type LifeWorkspaceSection = "today" | "lists" | "extensions" | "local-ai" | "settings";

export type LifeWorkspaceSnapshot = {
  workspace: PersonalWorkspace;
  hasStoredWorkspace: boolean;
  previousTestData: boolean;
  isLoaded: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isAuthenticating: boolean;
  privacyGate: PrivacyGateState;
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
  | { kind: "validation-failed"; message: string };

export type LifeWorkspaceControllerDependencies = {
  load(): Promise<PersonalWorkspace | null>;
  hasPreviousTestData(): Promise<boolean>;
  deletePreviousTestData?(): Promise<void>;
  save(workspace: PersonalWorkspace): Promise<void>;
  deleteWorkspace(): Promise<void>;
  syncNotifications(tasks: PersonalWorkspace["tasks"]): Promise<number>;
  cancelNotifications(): Promise<void>;
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

export function createLifeWorkspaceController(dependencies: LifeWorkspaceControllerDependencies) {
  let current: LifeWorkspaceSnapshot = {
    workspace: createEmptyWorkspace(),
    hasStoredWorkspace: false,
    previousTestData: false,
    isLoaded: false,
    isSaving: false,
    isDeleting: false,
    isAuthenticating: false,
    privacyGate: "unlocked",
    statusMessage: "개인 생활 작업공간을 준비하고 있습니다.",
    section: "today"
  };

  return {
    snapshot: () => current,
    update(workspace: PersonalWorkspace) {
      current = { ...current, workspace };
    },
    async load() {
      const [workspace, previousTestData] = await Promise.all([
        dependencies.load(),
        dependencies.hasPreviousTestData()
      ]);
      current = {
        ...current,
        workspace: workspace ?? current.workspace,
        hasStoredWorkspace: Boolean(workspace),
        previousTestData,
        isLoaded: true,
        privacyGate: createPrivacyGateState(Boolean(workspace)),
        statusMessage: previousTestData
          ? "이전 테스트 데이터 삭제 후 시작할 수 있습니다."
          : workspace
            ? lockedWorkspaceStatusMessage()
            : "오늘의 생활 작업을 정리해 보세요."
      };
      return current;
    },
    async save(workspace: PersonalWorkspace): Promise<SaveOutcome> {
      const validationError = validateForSaving(workspace);
      if (validationError) return { kind: "validation-failed", message: validationError };
      current = { ...current, isSaving: true };
      try {
        await dependencies.save(workspace);
        const notificationCount = await dependencies.syncNotifications(workspace.tasks);
        current = {
          ...current,
          workspace,
          hasStoredWorkspace: true,
          privacyGate: "unlocked",
          statusMessage: notificationCount > 0 ? `생활 알림 ${notificationCount}건을 예약했습니다.` : "생활 작업공간을 저장했습니다."
        };
        return { kind: "saved", notificationCount };
      } finally {
        current = { ...current, isSaving: false };
      }
    },
    async deleteAll() {
      await dependencies.cancelNotifications();
      await dependencies.deleteWorkspace();
      current = {
        ...current,
        workspace: createEmptyWorkspace(),
        hasStoredWorkspace: false,
        privacyGate: "unlocked",
        statusMessage: "이 기기의 개인 생활 작업공간과 알림을 삭제했습니다."
      };
    },
    async deletePreviousTestData() {
      if (!dependencies.deletePreviousTestData) return;
      await dependencies.deletePreviousTestData();
      current = { ...current, previousTestData: false, statusMessage: "이전 테스트 데이터를 삭제했습니다." };
    }
  };
}

function stampWorkspace(workspace: PersonalWorkspace): PersonalWorkspace {
  return { ...workspace, updatedAt: new Date().toISOString() };
}

export function useLifeWorkspace(): LifeWorkspaceState {
  const [snapshot, setSnapshot] = useState<LifeWorkspaceSnapshot>({
    workspace: createEmptyWorkspace(), hasStoredWorkspace: false, previousTestData: false, isLoaded: false, isSaving: false,
    isDeleting: false, isAuthenticating: false, privacyGate: "unlocked",
    statusMessage: "개인 생활 작업공간을 준비하고 있습니다.", section: "today"
  });

  useEffect(() => {
    let active = true;
    const controller = createLifeWorkspaceController({
      load: loadWorkspace, hasPreviousTestData, deletePreviousTestData, save: saveWorkspace,
      deleteWorkspace, syncNotifications: syncLifeNotifications, cancelNotifications: cancelAllLifeNotifications
    });
    void controller.load().then((next) => active && setSnapshot(next)).catch(() => {
      if (active) setSnapshot((current) => ({ ...current, isLoaded: true, statusMessage: "저장된 작업공간을 안전하게 확인하지 못했습니다." }));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if ((nextState === "background" || nextState === "inactive") && shouldLockWorkspaceOnBackground(snapshot.hasStoredWorkspace, snapshot.workspace)) {
        setSnapshot((current) => ({ ...current, privacyGate: "locked", statusMessage: "앱이 백그라운드로 전환되어 작업공간을 잠갔습니다." }));
      }
    });
    return () => subscription.remove();
  }, [snapshot.privacyGate, snapshot.workspace]);

  const actions = useMemo(() => ({
    updateWorkspace(workspace: PersonalWorkspace) { setSnapshot((current) => ({ ...current, workspace })); },
    async save() {
      const workspace = stampWorkspace(snapshot.workspace);
      const validation = validateForSaving(workspace);
      if (validation) {
        setSnapshot((current) => ({ ...current, statusMessage: validation }));
        return;
      }
      setSnapshot((current) => ({ ...current, isSaving: true }));
      try {
        await saveWorkspace(workspace);
        const notificationCount = await syncLifeNotifications(workspace.tasks);
        setSnapshot((current) => ({ ...current, workspace, hasStoredWorkspace: true, privacyGate: "unlocked", statusMessage: notificationCount > 0 ? `생활 알림 ${notificationCount}건을 예약했습니다.` : "생활 작업공간을 저장했습니다." }));
      } finally { setSnapshot((current) => ({ ...current, isSaving: false })); }
    },
    async deleteAllData() {
      setSnapshot((current) => ({ ...current, isDeleting: true }));
      try {
        await clearMobileData({ deleteWorkspace, cancelLifeNotifications: cancelAllLifeNotifications, resetMemory: () => undefined });
        setSnapshot((current) => ({ ...current, workspace: createEmptyWorkspace(), hasStoredWorkspace: false, privacyGate: "unlocked", statusMessage: "이 기기의 개인 생활 작업공간과 알림을 삭제했습니다." }));
      } finally { setSnapshot((current) => ({ ...current, isDeleting: false })); }
    },
    async unlock() {
      setSnapshot((current) => ({ ...current, isAuthenticating: true }));
      try {
        const result = await resolveWorkspaceUnlock({ hasStoredWorkspace: true, authenticate: authenticateForSensitiveAccess, loadStoredWorkspace: loadWorkspace });
        setSnapshot((current) => result.authenticated && result.workspace
          ? { ...current, workspace: result.workspace, privacyGate: "unlocked", statusMessage: result.message }
          : { ...current, privacyGate: "locked", statusMessage: result.message });
      } finally { setSnapshot((current) => ({ ...current, isAuthenticating: false })); }
    },
    async deletePreviousTestData() {
      await cancelPreviousTestNotifications();
      await deletePreviousTestData();
      setSnapshot((current) => ({ ...current, previousTestData: false, statusMessage: "이전 테스트 데이터를 삭제했습니다." }));
    },
    openSection(section: LifeWorkspaceSection) { setSnapshot((current) => ({ ...current, section })); }
  }), [snapshot.workspace]);

  return { ...snapshot, actions };
}

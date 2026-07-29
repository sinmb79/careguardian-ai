import type { PersonalWorkspace } from "@life-steward/life-core";
import type { AuthenticationResult } from "./localAuthentication";

export type PrivacyGateState = "locked" | "unlocked";

export function createPrivacyGateState(hasStoredWorkspace: boolean): PrivacyGateState {
  return hasStoredWorkspace ? "locked" : "unlocked";
}

export function isSensitiveUiVisible(state: PrivacyGateState): boolean {
  return state === "unlocked";
}

export function lockedWorkspaceStatusMessage(): string {
  return "저장된 개인 작업공간은 기기 인증 후에 열 수 있습니다.";
}

function containsMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(containsMeaningfulValue);
  return Boolean(value && typeof value === "object" && Object.values(value).some(containsMeaningfulValue));
}

export function shouldLockWorkspaceOnBackground(
  hasStoredWorkspace: boolean,
  workspace: PersonalWorkspace
): boolean {
  return hasStoredWorkspace || containsMeaningfulValue({
    lists: workspace.lists, records: workspace.records, tasks: workspace.tasks,
    reminders: workspace.reminders, extensions: workspace.extensions
  });
}

export interface WorkspaceUnlockDependencies {
  hasStoredWorkspace: boolean;
  authenticate: () => Promise<AuthenticationResult>;
  loadStoredWorkspace: () => Promise<PersonalWorkspace | null>;
}

export type WorkspaceUnlockResult = AuthenticationResult & { workspace?: PersonalWorkspace };

export async function resolveWorkspaceUnlock({
  hasStoredWorkspace, authenticate, loadStoredWorkspace
}: WorkspaceUnlockDependencies): Promise<WorkspaceUnlockResult> {
  const authentication = await authenticate();
  if (!authentication.authenticated || !hasStoredWorkspace) return authentication;
  const workspace = await loadStoredWorkspace();
  return workspace
    ? { ...authentication, workspace }
    : { authenticated: false, message: "저장된 개인 작업공간을 찾지 못했습니다. 안전을 위해 잠금 상태를 유지합니다." };
}

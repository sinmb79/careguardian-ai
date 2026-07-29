import {
  validateExtension,
  validateWorkspace,
  type PersonalWorkspace
} from "@life-steward/life-core";

export const WORKSPACE_STORAGE_KEY = "life-steward.workspace.v1";

export function saveWorkspace(
  workspace: PersonalWorkspace,
  storage: Storage = localStorage
): void {
  assertValidWorkspace(workspace);
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

export function loadWorkspace(
  storage: Storage = localStorage
): PersonalWorkspace | null {
  const storedWorkspace = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!storedWorkspace) return null;

  try {
    const parsedWorkspace: unknown = JSON.parse(storedWorkspace);
    return isValidWorkspace(parsedWorkspace) ? parsedWorkspace : null;
  } catch {
    return null;
  }
}

export function clearWorkspace(storage: Storage = localStorage): void {
  storage.removeItem(WORKSPACE_STORAGE_KEY);
}

function assertValidWorkspace(workspace: PersonalWorkspace): void {
  if (!isValidWorkspace(workspace)) {
    throw new Error("개인 작업공간 형식이 올바르지 않습니다.");
  }
}

function isValidWorkspace(input: unknown): input is PersonalWorkspace {
  const workspaceValidation = validateWorkspace(input);
  if (!workspaceValidation.ok) return false;

  return workspaceValidation.value.extensions.every((extension) => validateExtension(extension).ok);
}

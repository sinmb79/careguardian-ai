import {
  validateExtension,
  validateWorkspace,
  type PersonalWorkspace
} from "@life-steward/life-core";

export const WORKSPACE_STORAGE_KEY = "life-steward.workspace.v1";

type StoredWorkspace = {
  schemaVersion: 1;
  revision: number;
  workspace: PersonalWorkspace;
};

export type WorkspaceLoadResult =
  | { kind: "missing" }
  | { kind: "loaded"; workspace: PersonalWorkspace; revision: number }
  | { kind: "invalid"; raw: string }
  | { kind: "unavailable" };

export type WorkspaceMutationResult =
  | { kind: "saved"; revision: number }
  | { kind: "cleared" }
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "conflict" };

export function loadWorkspace(storage: Storage = localStorage): WorkspaceLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return { kind: "missing" };

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredWorkspace(parsed)
      ? { kind: "loaded", workspace: parsed.workspace, revision: parsed.revision }
      : { kind: "invalid", raw };
  } catch {
    return { kind: "invalid", raw };
  }
}

export function saveWorkspace(
  workspace: PersonalWorkspace,
  expectedRevision: number,
  storage: Storage = localStorage
): WorkspaceMutationResult {
  if (!isValidWorkspace(workspace)) return { kind: "invalid" };
  const current = loadWorkspace(storage);
  if (current.kind === "unavailable" || current.kind === "invalid") return { kind: current.kind };
  const currentRevision = current.kind === "loaded" ? current.revision : 0;
  if (currentRevision !== expectedRevision) return { kind: "conflict" };

  const nextRevision = currentRevision + 1;
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, revision: nextRevision, workspace } satisfies StoredWorkspace));
    return { kind: "saved", revision: nextRevision };
  } catch {
    return { kind: "unavailable" };
  }
}

export function initializeWorkspace(
  workspace: PersonalWorkspace,
  expectedInvalidRaw: string,
  storage: Storage = localStorage
): WorkspaceMutationResult {
  if (!isValidWorkspace(workspace)) return { kind: "invalid" };
  let raw: string | null;
  try {
    raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw !== expectedInvalidRaw) return { kind: "conflict" };

  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, revision: 1, workspace } satisfies StoredWorkspace));
    return { kind: "saved", revision: 1 };
  } catch {
    return { kind: "unavailable" };
  }
}

export function clearWorkspace(
  expectedRevision: number,
  storage: Storage = localStorage
): WorkspaceMutationResult {
  const current = loadWorkspace(storage);
  if (current.kind === "unavailable" || current.kind === "invalid") return { kind: current.kind };
  const currentRevision = current.kind === "loaded" ? current.revision : 0;
  if (currentRevision !== expectedRevision) return { kind: "conflict" };

  try {
    storage.removeItem(WORKSPACE_STORAGE_KEY);
    return { kind: "cleared" };
  } catch {
    return { kind: "unavailable" };
  }
}

function isStoredWorkspace(input: unknown): input is StoredWorkspace {
  if (!isPlainObject(input) || input.schemaVersion !== 1 || !isRevision(input.revision) || !isValidWorkspace(input.workspace)) return false;
  return Object.keys(input).every((key) => key === "schemaVersion" || key === "revision" || key === "workspace");
}

function isValidWorkspace(input: unknown): input is PersonalWorkspace {
  const workspaceValidation = validateWorkspace(input);
  return workspaceValidation.ok && workspaceValidation.value.extensions.every((extension) => validateExtension(extension).ok);
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

import {
  validateWorkspace,
  type LifeList,
  type LifeTask,
  type PersonalWorkspace
} from "@life-steward/life-core";

const MAX_TITLE_LENGTH = 500;
const MAX_ID_ATTEMPTS = 101;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type WorkspaceEntryDependencies = {
  now(): string;
  createId(prefix: "task-" | "list-", attempt: number): string;
};

export type WorkspaceEntryResult =
  | { ok: true; workspace: PersonalWorkspace }
  | { ok: false; error: string };

export function addWorkspaceTask(
  workspace: PersonalWorkspace,
  inputTitle: string,
  dependencies: WorkspaceEntryDependencies
): WorkspaceEntryResult {
  return addEntry(workspace, inputTitle, "task-", workspace.tasks, dependencies, (id, title) => ({
    id,
    title,
    status: "open"
  }));
}

export function addWorkspaceList(
  workspace: PersonalWorkspace,
  inputTitle: string,
  dependencies: WorkspaceEntryDependencies
): WorkspaceEntryResult {
  return addEntry(workspace, inputTitle, "list-", workspace.lists, dependencies, (id, title) => ({
    id,
    title,
    recordIds: []
  }));
}

export function createMobileWorkspaceEntryDependencies(): WorkspaceEntryDependencies {
  return {
    now: () => new Date().toISOString(),
    createId: (prefix, attempt) => `${prefix}${Date.now().toString(36)}-${attempt}`
  };
}

function addEntry<T extends LifeTask | LifeList>(
  workspace: PersonalWorkspace,
  inputTitle: string,
  prefix: "task-" | "list-",
  collection: readonly T[],
  dependencies: WorkspaceEntryDependencies,
  createEntry: (id: string, title: string) => T
): WorkspaceEntryResult {
  const title = inputTitle.trim();
  if (title.length === 0) return { ok: false, error: "Enter a title." };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: "Titles can be at most 500 characters." };

  const id = createAvailableId(prefix, collection, dependencies);
  if (id === null) return { ok: false, error: "Unable to create a unique item identifier." };

  const nextWorkspace = prefix === "task-"
    ? { ...workspace, updatedAt: dependencies.now(), tasks: [...workspace.tasks, createEntry(id, title) as LifeTask] }
    : { ...workspace, updatedAt: dependencies.now(), lists: [...workspace.lists, createEntry(id, title) as LifeList] };
  const validation = validateWorkspace(nextWorkspace);
  return validation.ok
    ? { ok: true, workspace: validation.value }
    : { ok: false, error: "Unable to save this item. Please check its title." };
}

function createAvailableId<T extends { id: string }>(
  prefix: "task-" | "list-",
  collection: readonly T[],
  dependencies: WorkspaceEntryDependencies
): string | null {
  const existingIds = new Set(collection.map((entry) => entry.id));
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const candidate = dependencies.createId(prefix, attempt);
    if (candidate.startsWith(prefix) && ID_PATTERN.test(candidate) && !existingIds.has(candidate)) return candidate;
  }
  return null;
}

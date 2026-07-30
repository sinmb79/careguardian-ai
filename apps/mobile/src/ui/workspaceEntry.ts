import {
  validateWorkspace,
  type LifeList,
  type LifeTask,
  type PersonalWorkspace
} from "@life-steward/life-core";
import { localNineAmForDate } from "../reminders/localReminderTime";

const MAX_TITLE_LENGTH = 500;
const MAX_ID_ATTEMPTS = 101;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type WorkspaceEntryDependencies = {
  now(): string;
  nowDate?(): Date;
  createId(prefix: "task-" | "list-", attempt: number): string;
};

export type WorkspaceEntryResult =
  | { ok: true; workspace: PersonalWorkspace }
  | { ok: false; error: string };

export function addWorkspaceTask(
  workspace: PersonalWorkspace,
  inputTitle: string,
  dependencies: WorkspaceEntryDependencies
): WorkspaceEntryResult;
export function addWorkspaceTask(
  workspace: PersonalWorkspace,
  inputTitle: string,
  inputDueDate: string,
  dependencies: WorkspaceEntryDependencies
): WorkspaceEntryResult;
export function addWorkspaceTask(
  workspace: PersonalWorkspace,
  inputTitle: string,
  inputDueDateOrDependencies: string | WorkspaceEntryDependencies,
  maybeDependencies?: WorkspaceEntryDependencies
): WorkspaceEntryResult {
  const inputDueDate = typeof inputDueDateOrDependencies === "string" ? inputDueDateOrDependencies : "";
  const dependencies = typeof inputDueDateOrDependencies === "string" ? maybeDependencies : inputDueDateOrDependencies;
  if (!dependencies) throw new Error("workspace entry dependencies are required");
  const dueDate = inputDueDate.trim();
  if (dueDate && !localNineAmForDate(dueDate)) {
    return { ok: false, error: "알림 날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요." };
  }
  if (dueDate) {
    const now = dependencies.nowDate?.() ?? new Date(dependencies.now());
    if (!Number.isFinite(now.getTime())) {
      return { ok: false, error: "기기 시간을 확인할 수 없습니다. 알림 날짜를 다시 확인해 주세요." };
    }
    if (localNineAmForDate(dueDate)!.getTime() <= now.getTime()) {
      return { ok: false, error: "알림 날짜는 기기 시간 기준 미래로 선택해 주세요." };
    }
  }
  return addEntry(workspace, inputTitle, "task-", workspace.tasks, dependencies, (id, title) => ({
    id,
    title,
    status: "open",
    ...(dueDate ? { dueDate } : {})
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
    nowDate: () => new Date(),
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
  if (title.length === 0) return { ok: false, error: "제목을 입력해 주세요." };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: "제목은 500자 이하로 입력해 주세요." };

  const id = createAvailableId(prefix, collection, dependencies);
  if (id === null) return { ok: false, error: "새 항목의 고유 식별자를 만들지 못했습니다." };

  const nextWorkspace = prefix === "task-"
    ? { ...workspace, updatedAt: dependencies.now(), tasks: [...workspace.tasks, createEntry(id, title) as LifeTask] }
    : { ...workspace, updatedAt: dependencies.now(), lists: [...workspace.lists, createEntry(id, title) as LifeList] };
  const validation = validateWorkspace(nextWorkspace);
  return validation.ok
    ? { ok: true, workspace: validation.value }
    : { ok: false, error: "이 항목을 저장할 수 없습니다. 제목을 확인해 주세요." };
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

import {
  validateExtension,
  validateWorkspace,
  type PersonalWorkspace
} from "@life-steward/life-core";

export const WORKSPACE_STORAGE_KEY = "life-steward.workspace.v1";
export const LEGACY_CARE_STORAGE_KEY = "careguardian.manual";
export const WORKSPACE_DATABASE_NAME = "life-steward-workspace";
export const WORKSPACE_CHANGE_EVENT = "life-steward-workspace-change";

const WORKSPACE_STORE_NAME = "workspaces";
const WORKSPACE_RECORD_KEY = "current";
const WORKSPACE_CHANNEL_NAME = "life-steward-workspace";
const WORKSPACE_SOURCE_ID = `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const WEB_PERSISTENCE_INVENTORY = Object.freeze({
  indexedDb: Object.freeze({
    databaseName: WORKSPACE_DATABASE_NAME,
    storeName: WORKSPACE_STORE_NAME,
    userRecordKey: WORKSPACE_RECORD_KEY,
    tombstone: Object.freeze({ type: "cleared" as const })
  }),
  localStorageKeys: Object.freeze([WORKSPACE_STORAGE_KEY, LEGACY_CARE_STORAGE_KEY])
});

type StoredWorkspace = {
  schemaVersion: 1;
  revision: number;
  workspace: PersonalWorkspace;
};

type InvalidWorkspace = { type: "invalid"; raw: string };
// A tombstone is deliberately retained after deletion.  It contains no user
// data, but stops a legacy localStorage copy from being imported again when a
// browser has blocked removal of that old key.
type ClearedWorkspace = { type: "cleared" };
type StoredRecord = StoredWorkspace | InvalidWorkspace | ClearedWorkspace;

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

export async function loadWorkspace(): Promise<WorkspaceLoadResult> {
  const database = await openWorkspaceDatabase();
  if (!database) return { kind: "unavailable" };

  try {
    const record = await readRecord(database);
    if (isClearedWorkspace(record)) {
      return eraseAppOwnedLegacyStorageAndVerify() ? { kind: "missing" } : { kind: "unavailable" };
    }
    if (record !== undefined) return toLoadResult(record);
    return await importLegacyWorkspace(database);
  } catch {
    return { kind: "unavailable" };
  } finally {
    database.close();
  }
}

export async function saveWorkspace(
  workspace: PersonalWorkspace,
  expectedRevision: number
): Promise<WorkspaceMutationResult> {
  if (!isValidWorkspace(workspace)) return { kind: "invalid" };
  const database = await openWorkspaceDatabase();
  if (!database) return { kind: "unavailable" };

  try {
    const result = await mutateRecord<WorkspaceMutationResult>(database, (record) => {
      const current = toLoadResult(record);
      if (current.kind === "invalid") return { result: { kind: "invalid" } };
      const revision = current.kind === "loaded" ? current.revision : 0;
      if (revision !== expectedRevision) return { result: { kind: "conflict" } };
      const nextRevision = revision + 1;
      return { result: { kind: "saved", revision: nextRevision }, record: { schemaVersion: 1, revision: nextRevision, workspace } };
    });
    if (result.kind === "saved") publishWorkspaceChange();
    return result;
  } catch {
    return { kind: "unavailable" };
  } finally {
    database.close();
  }
}

export async function initializeWorkspace(
  workspace: PersonalWorkspace,
  expectedInvalidRaw: string
): Promise<WorkspaceMutationResult> {
  if (!isValidWorkspace(workspace)) return { kind: "invalid" };
  const database = await openWorkspaceDatabase();
  if (!database) return { kind: "unavailable" };

  try {
    const result = await mutateRecord<WorkspaceMutationResult>(database, (record) => {
      const current = toLoadResult(record);
      if (current.kind !== "invalid") return { result: { kind: "conflict" } };
      if (current.raw !== expectedInvalidRaw) return { result: { kind: "conflict" } };
      return { result: { kind: "saved", revision: 1 }, record: { schemaVersion: 1, revision: 1, workspace } };
    });
    if (result.kind === "saved") {
      removeLegacyWorkspace();
      publishWorkspaceChange();
    }
    return result;
  } catch {
    return { kind: "unavailable" };
  } finally {
    database.close();
  }
}

export async function clearWorkspace(expectedRevision: number): Promise<WorkspaceMutationResult> {
  const database = await openWorkspaceDatabase();
  if (!database) return { kind: "unavailable" };

  try {
    const result = await mutateRecord<WorkspaceMutationResult>(database, (record) => {
      const current = toLoadResult(record);
      if (current.kind === "invalid") return { result: { kind: "invalid" } };
      const revision = current.kind === "loaded" ? current.revision : 0;
      if (revision !== expectedRevision) return { result: { kind: "conflict" } };
      return { result: { kind: "cleared" }, record: { type: "cleared" } };
    });
    if (result.kind === "cleared") {
      if (!eraseAppOwnedLegacyStorageAndVerify()) return { kind: "unavailable" };
      publishWorkspaceChange();
    }
    return result;
  } catch {
    return { kind: "unavailable" };
  } finally {
    database.close();
  }
}

export function subscribeWorkspaceChanges(listener: () => void): () => void {
  const localListener = () => listener();
  window.addEventListener(WORKSPACE_CHANGE_EVENT, localListener);

  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(WORKSPACE_CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.sourceId !== WORKSPACE_SOURCE_ID) listener();
      };
    }
  } catch {
    channel = undefined;
  }

  return () => {
    window.removeEventListener(WORKSPACE_CHANGE_EVENT, localListener);
    channel?.close();
  };
}

async function importLegacyWorkspace(database: IDBDatabase): Promise<WorkspaceLoadResult> {
  const raw = getLegacyWorkspaceRaw();
  if (raw.kind === "unavailable") return raw;
  if (raw.raw === null) return { kind: "missing" };

  const parsed = parseLegacyRaw(raw.raw);
  try {
    const result = await mutateRecord<WorkspaceLoadResult>(database, (record) => {
      if (record !== undefined) return { result: toLoadResult(record) };
      if (parsed.kind === "loaded") {
        return {
          result: parsed,
          record: { schemaVersion: 1, revision: parsed.revision, workspace: parsed.workspace }
        };
      }
      return { result: parsed, record: { type: "invalid", raw: parsed.raw } };
    });
    if (result.kind === "loaded" || result.kind === "invalid") removeLegacyWorkspace();
    return result;
  } catch {
    return { kind: "unavailable" };
  }
}

function parseLegacyRaw(raw: string): Extract<WorkspaceLoadResult, { kind: "loaded" } | { kind: "invalid" }> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredWorkspace(parsed)) return { kind: "loaded", workspace: parsed.workspace, revision: parsed.revision };
    if (isValidWorkspace(parsed)) return { kind: "loaded", workspace: parsed, revision: 1 };
    return { kind: "invalid", raw };
  } catch {
    return { kind: "invalid", raw };
  }
}

function getLegacyWorkspaceRaw(): { kind: "available"; raw: string | null } | { kind: "unavailable" } {
  try {
    return { kind: "available", raw: window.localStorage.getItem(WORKSPACE_STORAGE_KEY) };
  } catch {
    return { kind: "unavailable" };
  }
}

function removeLegacyWorkspace(): void {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // IndexedDB is already authoritative; a blocked legacy cleanup must not erase the durable record.
  }
}

function eraseAppOwnedLegacyStorageAndVerify(): boolean {
  try {
    const storage = window.localStorage;
    for (const key of WEB_PERSISTENCE_INVENTORY.localStorageKeys) storage.removeItem(key);
    return WEB_PERSISTENCE_INVENTORY.localStorageKeys.every((key) => storage.getItem(key) === null);
  } catch {
    return false;
  }
}

function openWorkspaceDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      const factory = globalThis.indexedDB;
      if (!factory) {
        resolve(null);
        return;
      }
      request = factory.open(WORKSPACE_DATABASE_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE_STORE_NAME)) request.result.createObjectStore(WORKSPACE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readRecord(database: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WORKSPACE_STORE_NAME, "readonly");
    const request = transaction.objectStore(WORKSPACE_STORE_NAME).get(WORKSPACE_RECORD_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function mutateRecord<T>(
  database: IDBDatabase,
  mutation: (record: unknown) => { result: T; record?: StoredRecord; remove?: boolean }
): Promise<T> {
  return new Promise((resolve, reject) => {
    let result!: T;
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(WORKSPACE_STORE_NAME, "readwrite");
    } catch (error) {
      reject(error);
      return;
    }
    const store = transaction.objectStore(WORKSPACE_STORE_NAME);
    const read = store.get(WORKSPACE_RECORD_KEY);
    read.onerror = () => transaction.abort();
    read.onsuccess = () => {
      const next = mutation(read.result);
      result = next.result;
      if (next.remove) store.delete(WORKSPACE_RECORD_KEY);
      else if (next.record) store.put(next.record, WORKSPACE_RECORD_KEY);
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function toLoadResult(record: unknown): WorkspaceLoadResult {
  if (record === undefined) return { kind: "missing" };
  if (isClearedWorkspace(record)) return { kind: "missing" };
  if (isStoredWorkspace(record)) return { kind: "loaded", workspace: record.workspace, revision: record.revision };
  if (isInvalidWorkspace(record)) return { kind: "invalid", raw: record.raw };
  return { kind: "invalid", raw: serializeRecord(record) };
}

function publishWorkspaceChange(): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(WORKSPACE_CHANNEL_NAME);
      channel.postMessage({ kind: "changed", sourceId: WORKSPACE_SOURCE_ID });
      channel.close();
    }
  } catch {
    // A notification channel is optional; transaction safety does not depend on it.
  }
}

function isStoredWorkspace(input: unknown): input is StoredWorkspace {
  if (!isPlainObject(input) || input.schemaVersion !== 1 || !isRevision(input.revision) || !isValidWorkspace(input.workspace)) return false;
  return Object.keys(input).every((key) => key === "schemaVersion" || key === "revision" || key === "workspace");
}

function isInvalidWorkspace(input: unknown): input is InvalidWorkspace {
  return isPlainObject(input) && input.type === "invalid" && typeof input.raw === "string" && Object.keys(input).every((key) => key === "type" || key === "raw");
}

function isClearedWorkspace(input: unknown): input is ClearedWorkspace {
  return isPlainObject(input) && input.type === "cleared" && Object.keys(input).length === 1;
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

function serializeRecord(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unreadable IndexedDB record]";
  }
}

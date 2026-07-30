import { createEmptyWorkspace } from "@life-steward/life-core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  WORKSPACE_DATABASE_NAME,
  WORKSPACE_STORAGE_KEY,
  LEGACY_CARE_STORAGE_KEY,
  WEB_PERSISTENCE_INVENTORY,
  clearWorkspace,
  initializeWorkspace,
  loadWorkspace,
  saveWorkspace
} from "./workspaceRepository";

const atRevision = (revision: number) => ({ kind: "revision", revision } as const);
const expectInvalidRaw = (raw: string) => ({ kind: "invalid", raw } as const);

function deleteWorkspaceDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(WORKSPACE_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("database remained blocked"));
  });
}

function putWorkspaceRecord(record: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const { storeName } = WEB_PERSISTENCE_INVENTORY.indexedDb;
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const { storeName, userRecordKey } = WEB_PERSISTENCE_INVENTORY.indexedDb;
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(record, userRecordKey);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

describe("browser personal workspace repository", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await deleteWorkspaceDatabase();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("stores and loads a valid workspace in the authoritative IndexedDB record", async () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");

    await expect(saveWorkspace(workspace, 0)).resolves.toEqual({ kind: "saved", revision: 1 });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace, revision: 1 });
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  test("migrates the previous raw PersonalWorkspace at the same key without losing fields", async () => {
    const workspace = {
      ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"),
      title: "이전 작업공간",
      tasks: [{ id: "market", title: "장보기", status: "open" as const }]
    };
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));

    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace, revision: 1 });
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace, revision: 1 });
  });

  test("does not read or convert the old health-shaped key", async () => {
    localStorage.setItem(LEGACY_CARE_STORAGE_KEY, JSON.stringify({ subject: { name: "legacy" } }));

    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("reports unavailable when the localStorage getter itself is blocked before migration", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });

    await expect(loadWorkspace()).resolves.toEqual({ kind: "unavailable" });
  });

  test("preserves invalid raw data until explicit initialization wins its transaction", async () => {
    const invalidRaw = JSON.stringify({ schemaVersion: 2 });
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    localStorage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);

    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "invalid", raw: invalidRaw });
    await expect(saveWorkspace(workspace, 0)).resolves.toEqual({ kind: "invalid" });
    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "invalid", raw: invalidRaw });

    await expect(initializeWorkspace(workspace, invalidRaw)).resolves.toEqual({ kind: "saved", revision: 1 });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace, revision: 1 });
  });

  test("serializes concurrent initialization and keeps the invalid original until one confirmation wins", async () => {
    const invalidRaw = JSON.stringify({ schemaVersion: 2 });
    const first = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "첫 초기화" };
    const second = { ...first, title: "둘째 초기화" };
    localStorage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);
    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "invalid", raw: invalidRaw });

    const results = await Promise.all([initializeWorkspace(first, invalidRaw), initializeWorkspace(second, invalidRaw)]);

    expect(results.filter((result) => result.kind === "saved")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1);
    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "loaded", revision: 1 });
  });

  test("explicitly deletes an unknown-schema record and every app-owned legacy key", async () => {
    const invalidRaw = JSON.stringify({ schemaVersion: 2 });
    localStorage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);
    localStorage.setItem(LEGACY_CARE_STORAGE_KEY, "legacy-sensitive");
    await loadWorkspace();

    await expect(clearWorkspace(expectInvalidRaw(invalidRaw))).resolves.toEqual({ kind: "cleared" });
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CARE_STORAGE_KEY)).toBeNull();
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("explicitly deletes malformed JSON after it is quarantined in IndexedDB", async () => {
    const corruptRaw = '{"schemaVersion":1,"workspace":';
    localStorage.setItem(WORKSPACE_STORAGE_KEY, corruptRaw);
    await expect(loadWorkspace()).resolves.toEqual({ kind: "invalid", raw: corruptRaw });

    await expect(clearWorkspace(expectInvalidRaw(corruptRaw))).resolves.toEqual({ kind: "cleared" });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("explicitly deletes a corrupt unknown-schema IndexedDB record", async () => {
    const corruptRecord = { schemaVersion: 9001, private: "must-be-deleted" };
    const corruptRaw = JSON.stringify(corruptRecord);
    await putWorkspaceRecord(corruptRecord);

    await expect(loadWorkspace()).resolves.toEqual({ kind: "invalid", raw: corruptRaw });
    await expect(clearWorkspace(expectInvalidRaw(corruptRaw))).resolves.toEqual({ kind: "cleared" });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("rejects deletion when an invalid IndexedDB record changes after confirmation", async () => {
    const originalRaw = JSON.stringify({ schemaVersion: 2, private: "original" });
    const replacementRaw = JSON.stringify({ schemaVersion: 3, private: "newer-tab" });
    await putWorkspaceRecord({ type: "invalid", raw: originalRaw });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "invalid", raw: originalRaw });

    await putWorkspaceRecord({ type: "invalid", raw: replacementRaw });

    await expect(clearWorkspace(expectInvalidRaw(originalRaw))).resolves.toEqual({ kind: "conflict" });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "invalid", raw: replacementRaw });
  });

  test("serializes explicit deletion against initialization of the same invalid raw record", async () => {
    const invalidRaw = JSON.stringify({ schemaVersion: 999, private: "must-not-survive" });
    const replacement = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    localStorage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);
    await expect(loadWorkspace()).resolves.toEqual({ kind: "invalid", raw: invalidRaw });

    const results = await Promise.all([
      initializeWorkspace(replacement, invalidRaw),
      clearWorkspace(expectInvalidRaw(invalidRaw))
    ]);

    expect(results.filter((result) => result.kind === "saved" || result.kind === "cleared")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1);
    const loaded = await loadWorkspace();
    expect(
      loaded.kind === "missing" ||
      (loaded.kind === "loaded" && loaded.workspace.id === replacement.id)
    ).toBe(true);
  });

  test("keeps a cleared tombstone so legacy raw data cannot reappear after cleanup is blocked", async () => {
    const workspace = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "지워야 할 이전 데이터" };
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });

    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace, revision: 1 });
    await expect(clearWorkspace(atRevision(1))).resolves.toEqual({ kind: "unavailable" });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "unavailable" });
  });

  test("enumerates and erases only app-owned browser persistence while retaining a data-free tombstone", async () => {
    const workspace = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "삭제 대상" };
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    localStorage.setItem(LEGACY_CARE_STORAGE_KEY, JSON.stringify({ private: "legacy" }));
    localStorage.setItem("unrelated.example.preference", "keep-me");
    await loadWorkspace();

    await expect(clearWorkspace(atRevision(1))).resolves.toEqual({ kind: "cleared" });

    expect(WEB_PERSISTENCE_INVENTORY).toEqual({
      indexedDb: { databaseName: WORKSPACE_DATABASE_NAME, storeName: "workspaces", userRecordKey: "current", tombstone: { type: "cleared" } },
      localStorageKeys: [WORKSPACE_STORAGE_KEY, LEGACY_CARE_STORAGE_KEY]
    });
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CARE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated.example.preference")).toBe("keep-me");
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("fails deletion when a legacy key is recreated during cleanup and removes it on a later reload", async () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    await saveWorkspace(workspace, 0);
    const originalRemove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key: string) {
      originalRemove.call(this, key);
      if (key === LEGACY_CARE_STORAGE_KEY) this.setItem(key, "late-writer-sensitive-value");
    });

    await expect(clearWorkspace(atRevision(1))).resolves.toEqual({ kind: "unavailable" });
    expect(localStorage.getItem(LEGACY_CARE_STORAGE_KEY)).toBe("late-writer-sensitive-value");

    vi.restoreAllMocks();
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
    expect(localStorage.getItem(LEGACY_CARE_STORAGE_KEY)).toBeNull();
  });

  test("rejects a stale multi-tab writer after the deletion tombstone commits", async () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    await saveWorkspace(workspace, 0);
    await expect(clearWorkspace(atRevision(1))).resolves.toEqual({ kind: "cleared" });

    await expect(saveWorkspace({ ...workspace, title: "늦은 탭" }, 1)).resolves.toEqual({ kind: "conflict" });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("fails closed when localStorage SecurityError prevents verified full deletion", async () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    await saveWorkspace(workspace, 0);
    localStorage.setItem(LEGACY_CARE_STORAGE_KEY, "sensitive");
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });

    await expect(clearWorkspace(atRevision(1))).resolves.toEqual({ kind: "unavailable" });
  });

  test("serializes two concurrent saves from the same revision so exactly one succeeds", async () => {
    const first = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "첫 탭" };
    const second = { ...first, title: "둘째 탭" };

    const results = await Promise.all([saveWorkspace(first, 0), saveWorkspace(second, 0)]);

    expect(results.filter((result) => result.kind === "saved")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1);
    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "loaded", revision: 1 });
  });

  test("serializes concurrent save and delete from the same revision so one operation conflicts", async () => {
    const original = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    const updated = { ...original, title: "보존할 변경" };
    await saveWorkspace(original, 0);

    const results = await Promise.all([saveWorkspace(updated, 1), clearWorkspace(atRevision(1))]);

    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1);
    expect(results.some((result) => result.kind === "saved" || result.kind === "cleared")).toBe(true);
  });

  test("fails closed when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(loadWorkspace()).resolves.toEqual({ kind: "unavailable" });
    await expect(saveWorkspace(createEmptyWorkspace(), 0)).resolves.toEqual({ kind: "unavailable" });
    await expect(clearWorkspace(atRevision(0))).resolves.toEqual({ kind: "unavailable" });
  });
});

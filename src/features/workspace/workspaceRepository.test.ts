import { createEmptyWorkspace } from "@life-steward/life-core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  WORKSPACE_DATABASE_NAME,
  WORKSPACE_STORAGE_KEY,
  clearWorkspace,
  initializeWorkspace,
  loadWorkspace,
  saveWorkspace
} from "./workspaceRepository";

function deleteWorkspaceDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(WORKSPACE_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("database remained blocked"));
  });
}

describe("browser personal workspace repository", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await deleteWorkspaceDatabase();
  });
  afterEach(() => vi.restoreAllMocks());

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
    localStorage.setItem("careguardian.manual", JSON.stringify({ subject: { name: "legacy" } }));

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

  test("refuses deletion of an invalid original until explicit initialization", async () => {
    const invalidRaw = JSON.stringify({ schemaVersion: 2 });
    localStorage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);
    await loadWorkspace();

    await expect(clearWorkspace(0)).resolves.toEqual({ kind: "invalid" });
    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "invalid", raw: invalidRaw });
  });

  test("keeps a cleared tombstone so legacy raw data cannot reappear after cleanup is blocked", async () => {
    const workspace = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "지워야 할 이전 데이터" };
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });

    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace, revision: 1 });
    await expect(clearWorkspace(1)).resolves.toEqual({ kind: "cleared" });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });

    const replacement = { ...workspace, title: "새 작업공간" };
    await expect(saveWorkspace(replacement, 0)).resolves.toEqual({ kind: "saved", revision: 1 });
    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace: replacement, revision: 1 });
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

    const results = await Promise.all([saveWorkspace(updated, 1), clearWorkspace(1)]);

    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1);
    expect(results.some((result) => result.kind === "saved" || result.kind === "cleared")).toBe(true);
  });

  test("fails closed when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(loadWorkspace()).resolves.toEqual({ kind: "unavailable" });
    await expect(saveWorkspace(createEmptyWorkspace(), 0)).resolves.toEqual({ kind: "unavailable" });
  });
});

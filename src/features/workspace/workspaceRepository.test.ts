import { createEmptyWorkspace } from "@life-steward/life-core";
import { beforeEach, describe, expect, test } from "vitest";
import {
  clearWorkspace,
  initializeWorkspace,
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_STORAGE_KEY
} from "./workspaceRepository";

function throwingStorage(method: keyof Storage): Storage {
  return new Proxy(localStorage, {
    get(target, key, receiver) {
      if (key === method) return () => { throw new Error(`${String(method)} unavailable`); };
      return Reflect.get(target, key, receiver);
    }
  });
}

describe("browser personal workspace repository", () => {
  beforeEach(() => localStorage.clear());

  test("stores and loads a valid workspace with a revision in its dedicated key", () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");

    expect(saveWorkspace(workspace, 0)).toEqual({ kind: "saved", revision: 1 });
    expect(loadWorkspace()).toEqual({ kind: "loaded", workspace, revision: 1 });
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toContain('"revision":1');
    expect(localStorage.getItem("careguardian.manual")).toBeNull();
  });

  test("does not import old health-shaped browser data", () => {
    localStorage.setItem("careguardian.manual", JSON.stringify({ subject: { name: "legacy" } }));

    expect(loadWorkspace()).toEqual({ kind: "missing" });
  });

  test("reports unavailable when reading browser storage throws", () => {
    expect(loadWorkspace(throwingStorage("getItem"))).toEqual({ kind: "unavailable" });
  });

  test("keeps invalid raw data intact until the person explicitly initializes a replacement", () => {
    const invalidRaw = JSON.stringify({ schemaVersion: 2 });
    localStorage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");

    expect(loadWorkspace()).toMatchObject({ kind: "invalid" });
    expect(saveWorkspace(workspace, 0)).toEqual({ kind: "invalid" });
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(invalidRaw);

    expect(initializeWorkspace(workspace, invalidRaw)).toEqual({ kind: "saved", revision: 1 });
    expect(loadWorkspace()).toEqual({ kind: "loaded", workspace, revision: 1 });
  });

  test("does not overwrite a newer revision from another browser tab", () => {
    const original = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    const newer = { ...original, title: "새 탭", updatedAt: "2026-07-31T00:00:00.000Z" };
    const stale = { ...original, title: "오래된 탭", updatedAt: "2026-07-31T00:00:00.000Z" };

    expect(saveWorkspace(original, 0)).toEqual({ kind: "saved", revision: 1 });
    expect(saveWorkspace(newer, 1)).toEqual({ kind: "saved", revision: 2 });

    expect(saveWorkspace(stale, 1)).toEqual({ kind: "conflict" });
    expect(loadWorkspace()).toEqual({ kind: "loaded", workspace: newer, revision: 2 });
  });

  test("does not delete a newer revision from another browser tab", () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    const newer = { ...workspace, title: "계속 보관", updatedAt: "2026-07-31T00:00:00.000Z" };
    saveWorkspace(workspace, 0);
    saveWorkspace(newer, 1);

    expect(clearWorkspace(1)).toEqual({ kind: "conflict" });
    expect(loadWorkspace()).toEqual({ kind: "loaded", workspace: newer, revision: 2 });
  });

  test("reports write and deletion failures without destroying the stored workspace", () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    saveWorkspace(workspace, 0);

    expect(saveWorkspace(workspace, 1, throwingStorage("setItem"))).toEqual({ kind: "unavailable" });
    expect(clearWorkspace(1, throwingStorage("removeItem"))).toEqual({ kind: "unavailable" });
    expect(loadWorkspace()).toEqual({ kind: "loaded", workspace, revision: 1 });
  });
});

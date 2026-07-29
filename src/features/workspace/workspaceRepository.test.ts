import { createEmptyWorkspace } from "@life-steward/life-core";
import { beforeEach, describe, expect, test } from "vitest";
import { clearWorkspace, loadWorkspace, saveWorkspace, WORKSPACE_STORAGE_KEY } from "./workspaceRepository";

describe("browser personal workspace repository", () => {
  beforeEach(() => localStorage.clear());

  test("stores and loads only a valid personal workspace in its dedicated key", () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");

    saveWorkspace(workspace);

    expect(loadWorkspace()).toEqual(workspace);
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toContain('"personal-workspace"');
    expect(localStorage.getItem("careguardian.manual")).toBeNull();
  });

  test("does not import old health-shaped browser data", () => {
    localStorage.setItem("careguardian.manual", JSON.stringify({ subject: { name: "legacy" } }));

    expect(loadWorkspace()).toBeNull();
  });

  test("clears only the dedicated personal workspace", () => {
    const workspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    localStorage.setItem("careguardian.manual", "legacy");
    saveWorkspace(workspace);

    clearWorkspace();

    expect(loadWorkspace()).toBeNull();
    expect(localStorage.getItem("careguardian.manual")).toBe("legacy");
  });

  test("rejects invalid stored workspace data instead of returning it", () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2 }));

    expect(loadWorkspace()).toBeNull();
  });
});

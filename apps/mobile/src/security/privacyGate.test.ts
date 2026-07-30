import { describe, expect, test } from "vitest";
import { createEmptyWorkspace } from "@life-steward/life-core";
import {
  createPrivacyGateState,
  getPrivacyGateRecoveryMode,
  resolveWorkspaceUnlock,
  shouldLockWorkspaceOnBackground
} from "./privacyGate";

describe("personal workspace privacy gate", () => {
  test("locks an existing saved workspace until device authentication succeeds", async () => {
    const workspace = createEmptyWorkspace();
    expect(createPrivacyGateState(true)).toBe("locked");
    expect(shouldLockWorkspaceOnBackground(true, workspace)).toBe(true);
    const result = await resolveWorkspaceUnlock({
      hasStoredWorkspace: true,
      authenticate: async () => ({ authenticated: true, message: "인증했습니다." }),
      loadStoredWorkspace: async () => workspace
    });
    expect(result.workspace).toEqual(workspace);
  });

  test("locks an unsaved draft containing personal work when leaving the foreground", () => {
    const workspace = createEmptyWorkspace();
    workspace.tasks.push({ id: "task-1", title: "장보기", status: "open" });
    expect(shouldLockWorkspaceOnBackground(false, createEmptyWorkspace())).toBe(false);
    expect(shouldLockWorkspaceOnBackground(false, workspace)).toBe(true);
  });

  test("routes deletion failures to retry or mandatory restart without exposing unlock", () => {
    expect(getPrivacyGateRecoveryMode(null)).toBeNull();
    expect(getPrivacyGateRecoveryMode(["local-model-files"])).toBe("retry-delete");
    expect(getPrivacyGateRecoveryMode([
      "scheduled-notifications",
      "active-inference"
    ])).toBe("restart-required");
  });
});

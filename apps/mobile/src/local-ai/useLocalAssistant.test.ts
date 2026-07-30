import { describe, expect, test, vi } from "vitest";
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) }
}));
import { validateWorkspace, type AiAction } from "@life-steward/life-core";
import { fixtureWorkspace } from "../test/fixtureWorkspace";
import type {
  GenerationResult,
  LocalModelSession
} from "./llamaRuntime";
import {
  applyApprovedAssistantResult,
  classifyLocalAiError,
  createLocalAssistantController,
  deleteLocalModelSafely
} from "./useLocalAssistant";

const session: LocalModelSession = {
  sessionId: "session-1",
  modelId: "hyperclovax-seed-text-instruct-0.5b-q4km",
  revision: "27831169fdebe6fe30bb1b9d76b12a2d06693f26"
};

function controllerWith(
  generate: (
    session: LocalModelSession,
    request: { action: AiAction; input: string },
    onToken: (token: string, accumulated: string) => void
  ) => Promise<GenerationResult>
) {
  const onWorkspaceChange = vi.fn();
  const stopAndRelease = vi.fn(async () => undefined);
  const controller = createLocalAssistantController({
    generate,
    stopAndRelease,
    onWorkspaceChange,
    now: () => "2026-07-30T12:00:00.000Z",
    createId: () => "ai-draft-1"
  });
  controller.attachSession(session);
  return { controller, onWorkspaceChange, stopAndRelease };
}

describe("local assistant approval flow", () => {
  test("distinguishes offline, storage, integrity, unsupported-device, and runtime failures", () => {
    expect(classifyLocalAiError({ code: "network_failed" })).toBe("offline");
    expect(classifyLocalAiError(new Error("ENOSPC: no space left"))).toBe("storage");
    expect(classifyLocalAiError({ code: "sha256_mismatch" })).toBe("integrity");
    expect(classifyLocalAiError({ code: "unsupported_environment" })).toBe("unsupported");
    expect(classifyLocalAiError({ code: "context_initialization_failed" })).toBe("runtime");
  });

  test("stops and releases inference before deleting an installed model", async () => {
    const events: string[] = [];
    await deleteLocalModelSafely(
      async () => void events.push("stop-release"),
      async () => void events.push("delete"),
      "model-id"
    );
    expect(events).toEqual(["stop-release", "delete"]);
  });

  test("keeps streamed output in memory and changes no workspace until explicit approval", async () => {
    const { controller, onWorkspaceChange } = controllerWith(
      async (_session, request, onToken) => {
        onToken("회의", "회의");
        onToken(" 요약", "회의 요약");
        return { action: request.action, modelId: session.modelId, text: "회의 요약" };
      }
    );
    controller.setAction("summarize");
    controller.setInput("회의 장소는 3층입니다.");

    await controller.generate();

    expect(controller.snapshot()).toMatchObject({
      preview: "회의 요약",
      isGenerating: false
    });
    expect(onWorkspaceChange).not.toHaveBeenCalled();

    const next = controller.approve(fixtureWorkspace);
    expect(validateWorkspace(next).ok).toBe(true);
    expect(onWorkspaceChange).toHaveBeenCalledWith(next);
    expect(next.title).toBe(fixtureWorkspace.title);
    expect(next.records.at(-1)).toMatchObject({
      id: "ai-draft-1",
      listId: "local-ai-drafts",
      values: { content: "회의 요약", action: "summarize" }
    });
    expect(controller.snapshot().preview).toBe("");
  });

  test("refuses an invalid oversized result instead of bypassing life-core validation", () => {
    expect(() =>
      applyApprovedAssistantResult(
        fixtureWorkspace,
        {
          action: "rewriteText",
          modelId: session.modelId,
          text: "가".repeat(501)
        },
        {
          now: "2026-07-30T12:00:00.000Z",
          recordId: "ai-draft-oversized"
        }
      )
    ).toThrow("workspace validation failed");
  });

  test("background, Android blur, cancellation, and unmount clear prompt and preview before releasing", async () => {
    const { controller, stopAndRelease } = controllerWith(
      async (_session, request, onToken) => {
        onToken("임시", "임시");
        return { action: request.action, modelId: session.modelId, text: "임시 결과" };
      }
    );
    controller.setInput("외부에 남으면 안 되는 메모");
    await controller.generate();

    await controller.stopAndClear("android-blur");

    expect(stopAndRelease).toHaveBeenCalledWith("android-blur");
    expect(controller.snapshot()).toMatchObject({
      input: "",
      preview: "",
      session: null,
      isGenerating: false
    });
    expect(JSON.stringify(controller.snapshot())).not.toContain("외부에 남으면 안 되는 메모");
  });

  test("locally flags and discards a problematic result without pretending to transmit a report", async () => {
    const { controller } = controllerWith(async (_session, request) => ({
      action: request.action,
      modelId: session.modelId,
      text: "삭제할 결과"
    }));
    controller.setInput("일반 메모");
    await controller.generate();

    controller.flagProblem();

    expect(controller.snapshot()).toMatchObject({
      input: "",
      preview: "",
      statusMessage: "문제 있는 결과를 기기 메모리에서 폐기했습니다. 외부로 전송하지 않았습니다."
    });
  });

  test("clears restricted output errors without retaining raw prompt or output", async () => {
    const rawPrompt = "비공개 입력";
    const rawOutput = "제한된 출력";
    const { controller } = controllerWith(async () => {
      const error = Object.assign(new Error("차단됨"), { code: "output_blocked" });
      Object.defineProperty(error, "rawOutput", { value: rawOutput, enumerable: false });
      throw error;
    });
    controller.setInput(rawPrompt);

    await expect(controller.generate()).rejects.toMatchObject({ code: "output_blocked" });

    const serialized = JSON.stringify(controller.snapshot());
    expect(serialized).not.toContain(rawPrompt);
    expect(serialized).not.toContain(rawOutput);
    expect(controller.snapshot()).toMatchObject({ input: "", preview: "" });
  });
});

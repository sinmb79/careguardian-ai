import { describe, expect, test, vi } from "vitest";
import { MODEL_REGISTRY, type ModelArtifact } from "./modelRegistry";
import type { InstalledModel } from "./modelStore";
import {
  LocalAiRuntimeError,
  createLlamaRuntime,
  hasRequiredMemory,
  type LlamaContextAdapter
} from "./llamaRuntime";

const model = MODEL_REGISTRY[0] as ModelArtifact &
  Required<Pick<ModelArtifact, "bytes" | "sha256">>;
const installed: InstalledModel = {
  modelId: model.id,
  revision: model.revision,
  uri: `file:///data/user/0/com.sinmb.careguardianai/files/models/${model.id}/${model.revision}.gguf`,
  bytes: model.bytes,
  sha256: model.sha256
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function contextWithText(text = "정리된 결과"): LlamaContextAdapter {
  return {
    completion: async (_options, onToken) => {
      onToken({ token: text });
      return { text };
    },
    stopCompletion: async () => undefined,
    release: async () => undefined
  };
}

function runtimeWith(
  context: LlamaContextAdapter,
  overrides: Partial<Parameters<typeof createLlamaRuntime>[0]> = {}
) {
  return createLlamaRuntime({
    getEnvironment: async () => ({
      platform: "android",
      supportedCpuArchitectures: ["arm64-v8a"],
      totalMemoryBytes: 8 * 1024 ** 3
    }),
    verifyInstalledModel: async () => model,
    initContext: async () => context,
    ...overrides
  });
}

describe("llama runtime", () => {
  test("re-verifies the installed private model immediately before CPU-only single-context initialization", async () => {
    const verifyInstalledModel = vi.fn(async () => model);
    const initContext = vi.fn(async () => contextWithText());
    const runtime = runtimeWith(contextWithText(), {
      verifyInstalledModel,
      initContext
    });

    await runtime.loadLocalModel(installed);

    expect(verifyInstalledModel).toHaveBeenCalledWith(installed);
    expect(initContext).toHaveBeenCalledWith({
      model: installed.uri,
      n_ctx: model.appDefaultContextTokens,
      n_batch: 256,
      n_gpu_layers: 0,
      no_gpu_devices: true,
      devices: [],
      n_parallel: 1,
      use_mmap: true,
      use_mlock: false
    });
    expect(initContext.mock.invocationCallOrder[0]).toBeGreaterThan(
      verifyInstalledModel.mock.invocationCallOrder[0]
    );
  });

  test("fails closed with a typed error outside Android arm64-v8a and x86_64", async () => {
    for (const environment of [
      { platform: "ios", supportedCpuArchitectures: ["arm64-v8a"] },
      { platform: "android", supportedCpuArchitectures: ["armeabi-v7a"] },
      { platform: "android", supportedCpuArchitectures: [] }
    ].map((entry) => ({ ...entry, totalMemoryBytes: 8 * 1024 ** 3 }))) {
      const runtime = runtimeWith(contextWithText(), {
        getEnvironment: async () => environment
      });

      await expect(runtime.loadLocalModel(installed)).rejects.toMatchObject({
        name: "LocalAiRuntimeError",
        code: "unsupported_environment"
      });
    }
  });

  test("rejects concurrent contexts and generations instead of using parallel slots", async () => {
    const pending = deferred<{ text: string }>();
    const context: LlamaContextAdapter = {
      completion: async () => pending.promise,
      stopCompletion: async () => undefined,
      release: async () => undefined
    };
    const runtime = runtimeWith(context);
    const session = await runtime.loadLocalModel(installed);
    const generating = runtime.generateLocalText(
      session,
      { action: "summarize", input: "회의 장소는 3층입니다." },
      () => undefined
    );

    await expect(runtime.loadLocalModel(installed)).rejects.toMatchObject({
      code: "runtime_busy"
    });
    await expect(
      runtime.generateLocalText(
        session,
        { action: "suggestTitle", input: "회의 장소는 3층입니다." },
        () => undefined
      )
    ).rejects.toMatchObject({ code: "generation_in_progress" });

    pending.resolve({ text: "회의 장소는 3층입니다." });
    await generating;
  });

  test("blocks restricted input before native completion without retaining it in the error", async () => {
    const context = contextWithText();
    const completion = vi.spyOn(context, "completion");
    const runtime = runtimeWith(context);
    const session = await runtime.loadLocalModel(installed);
    const original = "처방약 복용 계획을 만들어줘";

    const result = runtime.generateLocalText(
      session,
      { action: "draftChecklist", input: original },
      () => undefined
    );

    await expect(result).rejects.toBeInstanceOf(LocalAiRuntimeError);
    await expect(result).rejects.toMatchObject({ code: "input_blocked" });
    await result.catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain(original);
      expect((error as Error).message).not.toContain(original);
    });
    expect(completion).not.toHaveBeenCalled();
  });

  test("buffers every token and exposes a guarded fixed-action result only once", async () => {
    const runtime = runtimeWith({
      completion: async (options, onToken) => {
        expect(options.messages).toHaveLength(2);
        expect(options.messages[0]).toMatchObject({ role: "system" });
        expect(options.messages[1]).toMatchObject({ role: "user" });
        onToken({ token: "- 우산" });
        onToken({ token: "\n- 열쇠" });
        return { text: "- 우산\n- 열쇠" };
      },
      stopCompletion: async () => undefined,
      release: async () => undefined
    });
    const session = await runtime.loadLocalModel(installed);
    const streamed: string[] = [];

    const result = await runtime.generateLocalText(
      session,
      { action: "draftChecklist", input: "외출할 때 우산과 열쇠를 챙깁니다." },
      (_token, accumulated) => streamed.push(accumulated)
    );

    expect(streamed).toEqual(["- 우산\n- 열쇠"]);
    expect(result).toEqual({
      action: "draftChecklist",
      modelId: model.id,
      text: "- 우산\n- 열쇠"
    });
  });

  test("stops, waits for completion settlement, then releases exactly once on concurrent shutdown", async () => {
    const pending = deferred<{ text: string }>();
    const events: string[] = [];
    const context: LlamaContextAdapter = {
      completion: async () => {
        const result = await pending.promise;
        events.push("completion-settled");
        return result;
      },
      stopCompletion: async () => {
        events.push("stop");
      },
      release: async () => {
        events.push("release");
      }
    };
    const runtime = runtimeWith(context);
    const session = await runtime.loadLocalModel(installed);
    const generating = runtime.generateLocalText(
      session,
      { action: "summarize", input: "일반 회의 메모입니다." },
      () => undefined
    );

    const firstStop = runtime.stopAndRelease("background");
    const secondStop = runtime.stopAndRelease("android-blur");
    await vi.waitFor(() => expect(events).toEqual(["stop"]));
    pending.resolve({ text: "완료되어서는 안 되는 오래된 결과" });

    await Promise.all([firstStop, secondStop]);
    await expect(generating).rejects.toMatchObject({ code: "generation_interrupted" });
    expect(events).toEqual(["stop", "completion-settled", "release"]);
    expect(runtime.snapshot()).toEqual({ state: "idle", modelId: null });
  });

  test("discards a restricted output, releases the context, and never exposes the final text", async () => {
    const release = vi.fn(async () => undefined);
    const stopCompletion = vi.fn(async () => undefined);
    const runtime = runtimeWith({
      completion: async () => ({ text: "상대를 협박해서 돈을 보내게 하세요" }),
      stopCompletion,
      release
    });
    const session = await runtime.loadLocalModel(installed);
    const result = runtime.generateLocalText(
      session,
      { action: "rewriteText", input: "상대에게 비용을 정중히 요청합니다." },
      () => {
        throw new Error("restricted output must never be exposed");
      }
    );

    await expect(result).rejects.toMatchObject({ code: "output_blocked" });
    expect(stopCompletion).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
    expect(runtime.snapshot()).toEqual({ state: "idle", modelId: null });
  });

  test("awaits a streaming policy stop before releasing the native context", async () => {
    const stop = deferred<void>();
    const completion = deferred<{ text: string }>();
    const events: string[] = [];
    const runtime = runtimeWith({
      completion: async (_options, onToken) => {
        onToken({ token: "상대를 협박해서 돈을 보내게 하세요" });
        return completion.promise;
      },
      stopCompletion: async () => {
        events.push("stop-started");
        await stop.promise;
        events.push("stop-settled");
      },
      release: async () => {
        events.push("release");
      }
    });
    const session = await runtime.loadLocalModel(installed);
    const generating = runtime.generateLocalText(
      session,
      { action: "rewriteText", input: "상대에게 비용을 정중히 요청합니다." },
      () => undefined
    );

    await vi.waitFor(() => expect(events).toEqual(["stop-started"]));
    completion.resolve({ text: "상대를 협박해서 돈을 보내게 하세요" });
    await Promise.resolve();
    expect(events).toEqual(["stop-started"]);
    stop.resolve();

    await expect(generating).rejects.toMatchObject({ code: "output_blocked" });
    expect(events).toEqual(["stop-started", "stop-settled", "release"]);
  });

  test.each(["sync-throw", "async-reject"] as const)(
    "keeps output_blocked and releases when policy stop has a %s failure",
    async (failureMode) => {
      const release = vi.fn(async () => undefined);
      const context: LlamaContextAdapter = {
        completion: async (_options, onToken) => {
          onToken({ token: "상대를 협박해서 돈을 보내게 하세요" });
          return { text: "상대를 협박해서 돈을 보내게 하세요" };
        },
        stopCompletion:
          failureMode === "sync-throw"
            ? (() => {
                throw new Error("sync stop failure");
              })
            : async () => {
                throw new Error("async stop failure");
              },
        release
      };
      const runtime = runtimeWith(context);
      const session = await runtime.loadLocalModel(installed);
      const exposed = vi.fn();

      await expect(
        runtime.generateLocalText(
          session,
          { action: "rewriteText", input: "상대에게 비용을 정중히 요청합니다." },
          exposed
        )
      ).rejects.toMatchObject({ code: "output_blocked" });

      expect(exposed).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
      expect(runtime.snapshot()).toEqual({ state: "idle", modelId: null });
    }
  );

  test.each(["sync-throw", "async-reject"] as const)(
    "keeps output_blocked when policy stop has a %s failure and completion rejects",
    async (failureMode) => {
      const release = vi.fn(async () => undefined);
      const context: LlamaContextAdapter = {
        completion: async (_options, onToken) => {
          onToken({ token: "상대를 협박해서 돈을 보내게 하세요" });
          throw new Error("completion rejected after policy stop");
        },
        stopCompletion:
          failureMode === "sync-throw"
            ? (() => {
                throw new Error("sync stop failure");
              })
            : async () => {
                throw new Error("async stop failure");
              },
        release
      };
      const runtime = runtimeWith(context);
      const session = await runtime.loadLocalModel(installed);
      const exposed = vi.fn();

      await expect(
        runtime.generateLocalText(
          session,
          { action: "rewriteText", input: "상대에게 비용을 정중히 요청합니다." },
          exposed
        )
      ).rejects.toMatchObject({ code: "output_blocked" });

      expect(exposed).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
    }
  );

  test("enters a terminal fault after release failure and rejects every later load", async () => {
    const release = vi.fn(async () => {
      throw new Error("native context still alive");
    });
    const runtime = runtimeWith({
      ...contextWithText("회의 장소는 3층입니다."),
      release
    });
    await runtime.loadLocalModel(installed);

    await expect(runtime.unloadLocalModel()).rejects.toMatchObject({
      code: "release_failed"
    });
    expect(runtime.snapshot()).toEqual({ state: "faulted", modelId: null });
    await expect(runtime.loadLocalModel(installed)).rejects.toMatchObject({
      code: "runtime_faulted"
    });
  });

  test("fails closed when model RAM minimum is not known or not available", async () => {
    for (const totalMemoryBytes of [null, model.minimumRamGb * 1024 ** 3 - 1]) {
      const runtime = runtimeWith(contextWithText(), {
        getEnvironment: async () => ({
          platform: "android",
          supportedCpuArchitectures: ["arm64-v8a"],
          totalMemoryBytes
        })
      });
      await expect(runtime.loadLocalModel(installed)).rejects.toMatchObject({
        code: "insufficient_memory"
      });
    }
  });

  test("applies the registry RAM minimum independently to the 0.5B and 1.5B models", () => {
    const larger = MODEL_REGISTRY[1];
    expect(hasRequiredMemory(model, 4 * 1024 ** 3)).toBe(true);
    expect(hasRequiredMemory(larger, 5 * 1024 ** 3)).toBe(false);
    expect(hasRequiredMemory(larger, 6 * 1024 ** 3)).toBe(true);
  });

  test("faults permanently when an interrupted load cannot release its initialized context", async () => {
    const initialization = deferred<LlamaContextAdapter>();
    const initContext = vi.fn(async () => initialization.promise);
    const runtime = runtimeWith(contextWithText(), { initContext });
    const loading = runtime.loadLocalModel(installed);
    await vi.waitFor(() => expect(initContext).toHaveBeenCalledOnce());
    const stopping = runtime.stopAndRelease("background");
    initialization.resolve({
      ...contextWithText(),
      release: async () => {
        throw new Error("interrupted native context remains alive");
      }
    });

    await expect(loading).rejects.toMatchObject({ code: "release_failed" });
    await stopping;
    expect(runtime.snapshot()).toEqual({ state: "faulted", modelId: null });
    await expect(runtime.loadLocalModel(installed)).rejects.toMatchObject({
      code: "runtime_faulted"
    });
  });

  test("recovers to ready when the native completion call throws synchronously", async () => {
    const runtime = runtimeWith({
      completion: () => {
        throw new Error("native binding unavailable");
      },
      stopCompletion: async () => undefined,
      release: async () => undefined
    });
    const session = await runtime.loadLocalModel(installed);

    await expect(
      runtime.generateLocalText(
        session,
        { action: "summarize", input: "일반 회의 메모입니다." },
        () => undefined
      )
    ).rejects.toMatchObject({ code: "generation_failed" });

    expect(runtime.snapshot()).toEqual({ state: "ready", modelId: model.id });
    await runtime.unloadLocalModel();
  });

  test("background interruption during verification never initializes a stale native context", async () => {
    const verification = deferred<ModelArtifact>();
    const initContext = vi.fn(async () => contextWithText());
    const runtime = runtimeWith(contextWithText(), {
      verifyInstalledModel: async () => verification.promise,
      initContext
    });

    const loading = runtime.loadLocalModel(installed);
    const stopping = runtime.stopAndRelease("background");
    verification.resolve(model);

    await expect(loading).rejects.toMatchObject({ code: "generation_interrupted" });
    await stopping;
    expect(initContext).not.toHaveBeenCalled();
  });

  test("rejects stale or fabricated sessions", async () => {
    const runtime = runtimeWith(contextWithText());
    const session = await runtime.loadLocalModel(installed);

    await expect(
      runtime.generateLocalText(
        { ...session, sessionId: `${session.sessionId}-stale` },
        { action: "summarize", input: "일반 메모" },
        () => undefined
      )
    ).rejects.toMatchObject({ code: "invalid_session" });
  });
});

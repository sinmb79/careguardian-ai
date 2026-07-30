import type { AiAction } from "@life-steward/life-core";
import type { ModelArtifact } from "./modelRegistry";
import type { InstalledModel } from "./modelStore";
import {
  type AssistantChatMessage,
  AssistantPolicyError,
  buildAssistantMessages,
  guardAssistantOutput,
  validateAssistantResult
} from "./assistantPolicy";

export type LocalAiRuntimeErrorCode =
  | "unsupported_environment"
  | "insufficient_memory"
  | "runtime_faulted"
  | "model_verification_failed"
  | "runtime_busy"
  | "context_initialization_failed"
  | "generation_in_progress"
  | "invalid_session"
  | "input_blocked"
  | "output_blocked"
  | "generation_failed"
  | "generation_interrupted"
  | "release_failed";

export class LocalAiRuntimeError extends Error {
  constructor(
    readonly code: LocalAiRuntimeErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "LocalAiRuntimeError";
  }
}

export interface LocalAiRuntimeEnvironment {
  platform: string;
  supportedCpuArchitectures: readonly string[];
  totalMemoryBytes: number | null;
}

export interface LlamaInitOptions {
  model: string;
  n_ctx: number;
  n_batch: 256;
  n_gpu_layers: 0;
  no_gpu_devices: true;
  devices: [];
  n_parallel: 1;
  use_mmap: true;
  use_mlock: false;
}

export interface LlamaCompletionOptions {
  messages: readonly AssistantChatMessage[];
  n_predict: number;
  temperature: number;
  stop: string[];
}

export interface LlamaContextAdapter {
  completion(
    options: LlamaCompletionOptions,
    onToken: (event: { token: string }) => void
  ): Promise<{ text: string }>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
}

export interface LocalModelSession {
  readonly sessionId: string;
  readonly modelId: string;
  readonly revision: string;
}

export interface LocalGenerationRequest {
  action: AiAction;
  input: string;
}

export interface GenerationResult {
  action: AiAction;
  modelId: string;
  text: string;
}

export type RuntimeSnapshot =
  | { state: "idle"; modelId: null }
  | { state: "faulted"; modelId: null }
  | {
      state: "loading" | "ready" | "generating" | "stopping" | "releasing";
      modelId: string | null;
    };

export interface LlamaRuntimeDependencies {
  getEnvironment(): Promise<LocalAiRuntimeEnvironment>;
  verifyInstalledModel(installed: InstalledModel): Promise<ModelArtifact>;
  initContext(options: LlamaInitOptions): Promise<LlamaContextAdapter>;
}

const SUPPORTED_ANDROID_ABIS = new Set(["arm64-v8a", "x86_64"]);
const STOP_TOKENS = ["</s>", "<|end|>", "<|eot_id|>"] as const;
const PREDICTION_LIMITS: Readonly<Record<AiAction, number>> = {
  summarize: 192,
  rewriteText: 256,
  suggestTitle: 48,
  draftChecklist: 256
};
const BYTES_PER_GIBIBYTE = 1024 ** 3;

function runtimeError(
  error: unknown,
  code: LocalAiRuntimeErrorCode,
  message: string
): LocalAiRuntimeError {
  return error instanceof LocalAiRuntimeError
    ? error
    : new LocalAiRuntimeError(code, message, { cause: error });
}

function assertSupportedEnvironment(environment: LocalAiRuntimeEnvironment): void {
  const hasSupportedAbi = environment.supportedCpuArchitectures.some((abi) =>
    SUPPORTED_ANDROID_ABIS.has(abi)
  );
  if (environment.platform !== "android" || !hasSupportedAbi) {
    throw new LocalAiRuntimeError(
      "unsupported_environment",
      "로컬 AI는 Android arm64-v8a 또는 x86_64 환경에서만 사용할 수 있습니다."
    );
  }
}

export function hasRequiredMemory(
  model: Pick<ModelArtifact, "minimumRamGb">,
  totalMemoryBytes: number | null
): boolean {
  return (
    typeof totalMemoryBytes === "number" &&
    Number.isFinite(totalMemoryBytes) &&
    totalMemoryBytes >= model.minimumRamGb * BYTES_PER_GIBIBYTE
  );
}

function assertRequiredMemory(
  model: ModelArtifact,
  environment: LocalAiRuntimeEnvironment
): void {
  if (!hasRequiredMemory(model, environment.totalMemoryBytes)) {
    throw new LocalAiRuntimeError(
      "insufficient_memory",
      `이 모델은 확인 가능한 RAM ${model.minimumRamGb}GB 이상에서만 실행할 수 있습니다.`
    );
  }
}

function requestNativeStop(context: LlamaContextAdapter): Promise<void> {
  try {
    return Promise.resolve(context.stopCompletion());
  } catch (error) {
    return Promise.reject(error);
  }
}

function assertVerifiedIdentity(
  installed: InstalledModel,
  model: ModelArtifact
): asserts model is ModelArtifact &
  Required<Pick<ModelArtifact, "bytes" | "sha256">> {
  if (
    model.availability !== "installable" ||
    model.id !== installed.modelId ||
    model.revision !== installed.revision ||
    model.bytes !== installed.bytes ||
    model.sha256 !== installed.sha256 ||
    !Number.isSafeInteger(model.appDefaultContextTokens) ||
    model.appDefaultContextTokens <= 0 ||
    model.appDefaultContextTokens > model.officialModelContextTokens
  ) {
    throw new LocalAiRuntimeError(
      "model_verification_failed",
      "설치 모델이 고정 레지스트리와 일치하지 않습니다."
    );
  }
}

export function createLlamaRuntime(dependencies: LlamaRuntimeDependencies) {
  let state: RuntimeSnapshot["state"] = "idle";
  let context: LlamaContextAdapter | null = null;
  let session: LocalModelSession | null = null;
  let loadedModel: ModelArtifact | null = null;
  let loadPromise: Promise<LocalModelSession> | null = null;
  let activeCompletion: Promise<{ text: string }> | null = null;
  let activeStopPromise: Promise<void> | null = null;
  let shutdownPromise: Promise<void> | null = null;
  let lifecycleEpoch = 0;
  let generationEpoch = 0;
  let sessionSequence = 0;
  let terminalFault: LocalAiRuntimeError | null = null;

  function snapshot(): RuntimeSnapshot {
    if (state === "idle" || state === "faulted") return { state, modelId: null };
    return { state, modelId: session?.modelId ?? null };
  }

  function loadLocalModel(installed: InstalledModel): Promise<LocalModelSession> {
    if (terminalFault || state === "faulted") {
      return Promise.reject(
        new LocalAiRuntimeError(
          "runtime_faulted",
          "이전 네이티브 컨텍스트 해제를 확인하지 못했습니다. 앱 프로세스를 다시 시작해 주세요.",
          { cause: terminalFault ?? undefined }
        )
      );
    }
    if (state !== "idle" || loadPromise || shutdownPromise) {
      return Promise.reject(
        new LocalAiRuntimeError(
          "runtime_busy",
          "다른 로컬 AI 모델 또는 생성 작업이 진행 중입니다."
        )
      );
    }

    const operationEpoch = ++lifecycleEpoch;
    state = "loading";
    const operation = (async () => {
      const environment = await dependencies.getEnvironment();
      assertSupportedEnvironment(environment);

      let model: ModelArtifact;
      try {
        model = await dependencies.verifyInstalledModel(installed);
        assertVerifiedIdentity(installed, model);
        assertRequiredMemory(model, environment);
      } catch (error) {
        throw runtimeError(
          error,
          "model_verification_failed",
          "모델을 로드하기 전에 크기와 SHA-256을 확인하지 못했습니다."
        );
      }
      if (operationEpoch !== lifecycleEpoch) {
        throw new LocalAiRuntimeError(
          "generation_interrupted",
          "모델 로드가 앱 수명주기 변경으로 중단되었습니다."
        );
      }

      let initialized: LlamaContextAdapter;
      try {
        initialized = await dependencies.initContext({
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
      } catch (error) {
        throw runtimeError(
          error,
          "context_initialization_failed",
          "기기 내 모델 컨텍스트를 시작하지 못했습니다."
        );
      }

      if (operationEpoch !== lifecycleEpoch) {
        try {
          await initialized.release();
        } catch (error) {
          terminalFault = new LocalAiRuntimeError(
            "release_failed",
            "중단된 네이티브 모델 컨텍스트를 해제하지 못했습니다.",
            { cause: error }
          );
          state = "faulted";
          throw terminalFault;
        }
        throw new LocalAiRuntimeError(
          "generation_interrupted",
          "모델 로드가 앱 수명주기 변경으로 중단되었습니다."
        );
      }

      const loadedSession: LocalModelSession = Object.freeze({
        sessionId: `local-model-${++sessionSequence}-${operationEpoch}`,
        modelId: model.id,
        revision: model.revision
      });
      context = initialized;
      session = loadedSession;
      loadedModel = model;
      state = "ready";
      return loadedSession;
    })()
      .catch((error) => {
        if (operationEpoch === lifecycleEpoch) {
          context = null;
          session = null;
          loadedModel = null;
          state = terminalFault ? "faulted" : "idle";
        }
        throw runtimeError(
          error,
          "context_initialization_failed",
          "기기 내 모델을 안전하게 시작하지 못했습니다."
        );
      })
      .finally(() => {
        if (loadPromise === operation) loadPromise = null;
      });

    loadPromise = operation;
    return operation;
  }

  async function generateLocalText(
    requestedSession: LocalModelSession,
    request: LocalGenerationRequest,
    onToken: (token: string, accumulated: string) => void
  ): Promise<GenerationResult> {
    if (
      !session ||
      !context ||
      !loadedModel ||
      state === "idle" ||
      state === "loading"
    ) {
      throw new LocalAiRuntimeError(
        "invalid_session",
        "먼저 검증된 로컬 모델을 불러와 주세요."
      );
    }
    if (
      requestedSession.sessionId !== session.sessionId ||
      requestedSession.modelId !== session.modelId ||
      requestedSession.revision !== session.revision
    ) {
      throw new LocalAiRuntimeError(
        "invalid_session",
        "현재 모델 세션과 일치하지 않는 요청입니다."
      );
    }
    if (state === "generating" || activeCompletion) {
      throw new LocalAiRuntimeError(
        "generation_in_progress",
        "한 번에 하나의 문서 정리 작업만 실행할 수 있습니다."
      );
    }
    if (state !== "ready" || shutdownPromise) {
      throw new LocalAiRuntimeError(
        "runtime_busy",
        "로컬 AI 컨텍스트가 중지 또는 해제 중입니다."
      );
    }

    let messages: readonly AssistantChatMessage[];
    try {
      messages = buildAssistantMessages(request.action, request.input);
    } catch (error) {
      if (error instanceof AssistantPolicyError) {
        throw new LocalAiRuntimeError("input_blocked", error.message);
      }
      throw error;
    }

    const generationContext = context;
    const operationEpoch = lifecycleEpoch;
    const operationGeneration = ++generationEpoch;
    let accumulated = "";
    let streamingBlock: LocalAiRuntimeError | null = null;
    let stopRequestedForPolicy = false;
    state = "generating";

    let completion: Promise<{ text: string }>;
    try {
      completion = generationContext.completion(
        {
          messages,
          n_predict: PREDICTION_LIMITS[request.action],
          temperature: 0.2,
          stop: [...STOP_TOKENS]
        },
        ({ token }) => {
          if (
            operationEpoch !== lifecycleEpoch ||
            operationGeneration !== generationEpoch ||
            state !== "generating" ||
            streamingBlock
          ) {
            return;
          }
          const next = `${accumulated}${token}`;
          const decision = guardAssistantOutput(next);
          if (!decision.allowed) {
            streamingBlock = new LocalAiRuntimeError(
              "output_blocked",
              decision.message
            );
            accumulated = "";
            if (!stopRequestedForPolicy) {
              stopRequestedForPolicy = true;
              activeStopPromise = requestNativeStop(generationContext).catch(
                () => undefined
              );
            }
            return;
          }
          accumulated = next;
        }
      );
    } catch (error) {
      state = "ready";
      accumulated = "";
      messages = [];
      throw runtimeError(
        error,
        "generation_failed",
        "기기 내 문서 정리 작업을 시작하지 못했습니다."
      );
    }
    activeCompletion = completion;

    try {
      let result: { text: string };
      try {
        result = await completion;
      } catch (error) {
        if (activeCompletion === completion) activeCompletion = null;
        if (streamingBlock) {
          await activeStopPromise?.catch(() => undefined);
          throw streamingBlock;
        }
        if (
          operationEpoch !== lifecycleEpoch ||
          operationGeneration !== generationEpoch
        ) {
          throw new LocalAiRuntimeError(
            "generation_interrupted",
            "문서 정리 작업이 중단되었습니다."
          );
        }
        throw runtimeError(
          error,
          "generation_failed",
          "기기 내 문서 정리 결과를 만들지 못했습니다."
        );
      }
      if (activeCompletion === completion) activeCompletion = null;

      if (
        operationEpoch !== lifecycleEpoch ||
        operationGeneration !== generationEpoch
      ) {
        throw new LocalAiRuntimeError(
          "generation_interrupted",
          "문서 정리 작업이 중단되었습니다."
        );
      }
      if (streamingBlock) {
        await activeStopPromise?.catch(() => undefined);
        throw streamingBlock;
      }

      const outputDecision = validateAssistantResult(
        request.action,
        request.input,
        result.text
      );
      if (!outputDecision.allowed) {
        accumulated = "";
        throw new LocalAiRuntimeError("output_blocked", outputDecision.message);
      }
      try {
        onToken(result.text, result.text);
      } catch {
        // Rendering callbacks cannot change the validated native transaction.
      }
      return {
        action: request.action,
        modelId: loadedModel.id,
        text: result.text
      };
    } catch (error) {
      const normalized = runtimeError(
        error,
        "generation_failed",
        "기기 내 문서 정리 결과를 만들지 못했습니다."
      );
      if (normalized.code === "output_blocked") {
        await stopAndRelease("output-policy");
      }
      throw normalized;
    } finally {
      if (activeCompletion === completion) activeCompletion = null;
      activeStopPromise = null;
      if (
        state === "generating" &&
        operationEpoch === lifecycleEpoch &&
        operationGeneration === generationEpoch
      ) {
        state = "ready";
      }
      accumulated = "";
      messages = [];
    }
  }

  function stopAndRelease(_reason = "explicit"): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    const pendingLoad = loadPromise;
    const releaseContext = context;
    const completion = activeCompletion;
    ++lifecycleEpoch;
    ++generationEpoch;
    state = "stopping";

    const operation = (async () => {
      if (pendingLoad) await pendingLoad.catch(() => undefined);

      let stopError: unknown;
      if (releaseContext && completion) {
        try {
          activeStopPromise ??= requestNativeStop(releaseContext);
          await activeStopPromise;
        } catch (error) {
          stopError = error;
        }
        await completion.catch(() => undefined);
      }

      state = "releasing";
      let releaseError: unknown;
      if (releaseContext) {
        try {
          await releaseContext.release();
        } catch (error) {
          releaseError = error;
        }
      }
      if (releaseError || stopError) {
        terminalFault = new LocalAiRuntimeError(
          "release_failed",
          "로컬 AI 컨텍스트를 완전히 해제하지 못했습니다.",
          { cause: releaseError ?? stopError }
        );
        throw terminalFault;
      }
    })().finally(() => {
      context = null;
      session = null;
      loadedModel = null;
      activeCompletion = null;
      activeStopPromise = null;
      state = terminalFault ? "faulted" : "idle";
      if (shutdownPromise === operation) shutdownPromise = null;
    });

    shutdownPromise = operation;
    return operation;
  }

  return {
    snapshot,
    loadLocalModel,
    generateLocalText,
    stopGeneration: () => stopAndRelease("user-cancel"),
    unloadLocalModel: () => stopAndRelease("explicit-unload"),
    stopAndRelease
  };
}

async function getProductionEnvironment(): Promise<LocalAiRuntimeEnvironment> {
  const [{ Platform }, Device] = await Promise.all([
    import("react-native"),
    import("expo-device")
  ]);
  return {
    platform: Platform.OS,
    supportedCpuArchitectures: Device.supportedCpuArchitectures ?? [],
    totalMemoryBytes: Device.totalMemory
  };
}

export async function getLocalAiEnvironmentSupport(): Promise<{
  supported: boolean;
  architectures: readonly string[];
  totalMemoryBytes: number | null;
}> {
  const environment = await getProductionEnvironment();
  return {
    supported:
      environment.platform === "android" &&
      environment.supportedCpuArchitectures.some((abi) =>
        SUPPORTED_ANDROID_ABIS.has(abi)
      ) &&
      hasRequiredMemory({ minimumRamGb: 4 }, environment.totalMemoryBytes),
    architectures: environment.supportedCpuArchitectures,
    totalMemoryBytes: environment.totalMemoryBytes
  };
}

async function initProductionContext(
  options: LlamaInitOptions
): Promise<LlamaContextAdapter> {
  const { initLlama } = await import("llama.rn");
  const nativeContext = await initLlama(options);
  return {
    async completion(completionOptions, onToken) {
      const result = await nativeContext.completion(
        {
          ...completionOptions,
          messages: completionOptions.messages.map((message) => ({ ...message }))
        },
        ({ token }) => onToken({ token })
      );
      return { text: result.text };
    },
    stopCompletion: () => nativeContext.stopCompletion(),
    release: () => nativeContext.release()
  };
}

export const localAiRuntime = createLlamaRuntime({
  getEnvironment: getProductionEnvironment,
  async verifyInstalledModel(installed) {
    const { verifyInstalledModelForRuntime } = await import("./modelStore");
    return verifyInstalledModelForRuntime(installed);
  },
  initContext: initProductionContext
});

export const loadLocalModel = localAiRuntime.loadLocalModel;
export const generateLocalText = localAiRuntime.generateLocalText;
export const stopGeneration = localAiRuntime.stopGeneration;
export const unloadLocalModel = localAiRuntime.unloadLocalModel;
export const stopAndReleaseLocalModel = localAiRuntime.stopAndRelease;

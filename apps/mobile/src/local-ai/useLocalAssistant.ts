import {
  validateWorkspace,
  type AiAction,
  type PersonalWorkspace
} from "@life-steward/life-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { MODEL_REGISTRY, type ModelArtifact } from "./modelRegistry";
import {
  cancelActiveDownload,
  downloadModel,
  inspectInstalledModels,
  pauseActiveDownload,
  removeModel,
  type DownloadState,
  type InstalledModel,
  type ModelInstallationStatus,
  type PausedModelDownload
} from "./modelStore";
import type {
  GenerationResult,
  LocalGenerationRequest,
  LocalModelSession
} from "./llamaRuntime";
import {
  generateLocalText,
  getLocalAiEnvironmentSupport,
  hasRequiredMemory,
  loadLocalModel,
  stopAndReleaseLocalModel
} from "./llamaRuntime";

const DRAFT_LIST_ID = "local-ai-drafts";

export type LocalAiErrorKind =
  | "offline"
  | "storage"
  | "integrity"
  | "unsupported"
  | "memory"
  | "runtime"
  | "unknown";

export function classifyLocalAiError(error: unknown): LocalAiErrorKind {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "network_failed" || code === "http_failed") return "offline";
  if (
    code === "size_mismatch" ||
    code === "sha256_mismatch" ||
    code === "verification_failed"
  ) {
    return "integrity";
  }
  if (code === "unsupported_environment") return "unsupported";
  if (code === "insufficient_memory") return "memory";
  if (
    code === "context_initialization_failed" ||
    code === "generation_failed" ||
    code === "release_failed"
  ) {
    return "runtime";
  }
  if (
    code === "filesystem_unavailable" ||
    code === "filesystem_failed" ||
    /(?:ENOSPC|no space|disk full|저장\s*공간)/i.test(message)
  ) {
    return "storage";
  }
  return "unknown";
}

export async function deleteLocalModelSafely(
  stopAndRelease: () => Promise<void>,
  deleteModel: (modelId: string) => Promise<void>,
  modelId: string
): Promise<void> {
  await stopAndRelease();
  await deleteModel(modelId);
}

export function createDownloadUnmountGuard(
  cancelDownload: () => Promise<void>
) {
  let mounted = true;
  let cleanup: Promise<void> | null = null;
  return {
    isMounted: () => mounted,
    mount() {
      mounted = true;
    },
    commit(callback: () => void) {
      if (mounted) callback();
    },
    unmount(): Promise<void> {
      if (!mounted) return cleanup ?? Promise.resolve();
      mounted = false;
      cleanup = cancelDownload().finally(() => {
        cleanup = null;
      });
      return cleanup;
    }
  };
}

const ACTION_TITLES: Readonly<Record<AiAction, string>> = {
  summarize: "로컬 AI 요약 초안",
  rewriteText: "로컬 AI 다듬기 초안",
  suggestTitle: "로컬 AI 제목 제안",
  draftChecklist: "로컬 AI 체크리스트 초안"
};

export interface ApprovedAssistantResultOptions {
  now: string;
  recordId: string;
}

export function applyApprovedAssistantResult(
  workspace: PersonalWorkspace,
  result: GenerationResult,
  options: ApprovedAssistantResultOptions
): PersonalWorkspace {
  const existingList = workspace.lists.find((list) => list.id === DRAFT_LIST_ID);
  const lists = existingList
    ? workspace.lists.map((list) =>
        list.id === DRAFT_LIST_ID
          ? { ...list, recordIds: [...list.recordIds, options.recordId] }
          : list
      )
    : [
        ...workspace.lists,
        {
          id: DRAFT_LIST_ID,
          title: "로컬 AI 승인 초안",
          recordIds: [options.recordId]
        }
      ];

  const next: PersonalWorkspace = {
    ...workspace,
    updatedAt: options.now,
    lists,
    records: [
      ...workspace.records,
      {
        id: options.recordId,
        listId: DRAFT_LIST_ID,
        title: ACTION_TITLES[result.action],
        values: {
          content: result.text,
          action: result.action
        }
      }
    ]
  };
  const validation = validateWorkspace(next);
  if (!validation.ok) {
    throw new Error(`workspace validation failed: ${validation.errors.join(" ")}`);
  }
  return validation.value;
}

export interface LocalAssistantSnapshot {
  action: AiAction;
  input: string;
  preview: string;
  result: GenerationResult | null;
  session: LocalModelSession | null;
  isGenerating: boolean;
  statusMessage: string;
}

export interface LocalAssistantControllerDependencies {
  generate(
    session: LocalModelSession,
    request: LocalGenerationRequest,
    onToken: (token: string, accumulated: string) => void
  ): Promise<GenerationResult>;
  stopAndRelease(reason: string): Promise<void>;
  onWorkspaceChange(workspace: PersonalWorkspace): void;
  now(): string;
  createId(): string;
}

function initialAssistantSnapshot(): LocalAssistantSnapshot {
  return {
    action: "summarize",
    input: "",
    preview: "",
    result: null,
    session: null,
    isGenerating: false,
    statusMessage: "모델을 선택하고 네 가지 문서 정리 동작 중 하나를 사용하세요."
  };
}

export function createLocalAssistantController(
  dependencies: LocalAssistantControllerDependencies
) {
  let current = initialAssistantSnapshot();
  let listener: ((snapshot: LocalAssistantSnapshot) => void) | undefined;
  let generationEpoch = 0;

  const publish = (next: LocalAssistantSnapshot) => {
    current = next;
    listener?.(current);
  };
  const patch = (next: Partial<LocalAssistantSnapshot>) =>
    publish({ ...current, ...next });

  return {
    snapshot: () => current,
    subscribe(nextListener: (snapshot: LocalAssistantSnapshot) => void) {
      listener = nextListener;
      return () => {
        if (listener === nextListener) listener = undefined;
      };
    },
    attachSession(nextSession: LocalModelSession) {
      patch({
        session: nextSession,
        statusMessage: "검증된 모델을 불러왔습니다. 결과는 승인 전까지 메모리에만 둡니다."
      });
    },
    setAction(action: AiAction) {
      patch({ action, preview: "", result: null });
    },
    setInput(input: string) {
      patch({ input, preview: "", result: null });
    },
    async generate(): Promise<GenerationResult> {
      if (!current.session) {
        throw new Error("verified local model session is required");
      }
      if (current.isGenerating) {
        throw new Error("generation already in progress");
      }
      const operationEpoch = ++generationEpoch;
      const requestedSession = current.session;
      const request = { action: current.action, input: current.input };
      patch({
        preview: "",
        result: null,
        isGenerating: true,
        statusMessage: "기기 안에서 문서를 정리하고 있습니다."
      });
      try {
        const result = await dependencies.generate(
          requestedSession,
          request,
          (_token, accumulated) => {
            if (operationEpoch !== generationEpoch) return;
            patch({ preview: accumulated });
          }
        );
        if (operationEpoch !== generationEpoch) {
          throw Object.assign(new Error("generation interrupted"), {
            code: "generation_interrupted"
          });
        }
        patch({
          preview: result.text,
          result,
          statusMessage: "결과를 확인한 뒤 작업공간 반영 또는 폐기를 선택하세요."
        });
        return result;
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "generation_failed";
        if (
          code === "input_blocked" ||
          code === "output_blocked" ||
          code === "generation_interrupted"
        ) {
          patch({
            input: "",
            preview: "",
            result: null,
            statusMessage:
              code === "input_blocked"
                ? "이 요청은 로컬 AI의 문서 정리 범위를 벗어나 처리하지 않았습니다."
                : code === "output_blocked"
                  ? "문제가 있는 결과를 표시하지 않고 기기 메모리에서 폐기했습니다."
                  : "문서 정리를 중단하고 임시 내용을 기기 메모리에서 비웠습니다."
          });
        } else {
          patch({
            preview: "",
            result: null,
            statusMessage: "로컬 AI 작업을 완료하지 못했습니다. 모델 상태를 확인해 주세요."
          });
        }
        throw error;
      } finally {
        if (operationEpoch === generationEpoch) patch({ isGenerating: false });
      }
    },
    approve(workspace: PersonalWorkspace): PersonalWorkspace {
      if (!current.result || current.preview !== current.result.text) {
        throw new Error("no approved assistant preview is available");
      }
      const next = applyApprovedAssistantResult(workspace, current.result, {
        now: dependencies.now(),
        recordId: dependencies.createId()
      });
      dependencies.onWorkspaceChange(next);
      patch({
        input: "",
        preview: "",
        result: null,
        statusMessage:
          "승인한 초안을 작업공간에 반영했습니다. 전체 저장 버튼으로 확정할 수 있습니다."
      });
      return next;
    },
    discard() {
      ++generationEpoch;
      patch({
        input: "",
        preview: "",
        result: null,
        isGenerating: false,
        statusMessage: "임시 결과를 기기 메모리에서 폐기했습니다."
      });
    },
    flagProblem() {
      ++generationEpoch;
      patch({
        input: "",
        preview: "",
        result: null,
        isGenerating: false,
        statusMessage:
          "문제 있는 결과를 기기 메모리에서 폐기했습니다. 외부로 전송하지 않았습니다."
      });
    },
    async stopAndClear(reason: string): Promise<void> {
      ++generationEpoch;
      patch({
        input: "",
        preview: "",
        result: null,
        session: null,
        isGenerating: false,
        statusMessage: "로컬 AI 메모리와 모델 컨텍스트를 비웠습니다."
      });
      await dependencies.stopAndRelease(reason);
    }
  };
}

type EnvironmentSupport = "checking" | "supported" | "unsupported";

export interface LocalAssistantHookState extends LocalAssistantSnapshot {
  models: readonly ModelArtifact[];
  installationStatuses: readonly ModelInstallationStatus[];
  downloadStates: Readonly<Record<string, DownloadState>>;
  acceptedLicenseModelIds: ReadonlySet<string>;
  environmentSupport: EnvironmentSupport;
  environmentArchitectures: readonly string[];
  environmentTotalMemoryBytes: number | null;
  activeDownloadModelId: string | null;
  errorKind: LocalAiErrorKind | null;
  actions: {
    refreshModels(): Promise<void>;
    setAction(action: AiAction): void;
    setInput(input: string): void;
    toggleLicenseAcceptance(modelId: string): void;
    installModel(model: ModelArtifact): Promise<void>;
    pauseDownload(): Promise<void>;
    resumeDownload(model: ModelArtifact): Promise<void>;
    cancelDownload(modelId: string): Promise<void>;
    loadModel(installed: InstalledModel): Promise<void>;
    generate(): Promise<GenerationResult>;
    cancelGeneration(): Promise<void>;
    approve(workspace: PersonalWorkspace): PersonalWorkspace;
    discard(): void;
    flagProblem(): void;
    deleteModel(modelId: string): Promise<void>;
  };
}

function assistantRecordId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function initialInstallationStatuses(): readonly ModelInstallationStatus[] {
  return MODEL_REGISTRY.filter((model) => model.availability === "installable").map(
    (model) => ({ kind: "notInstalled", modelId: model.id })
  );
}

export function useLocalAssistant(
  onWorkspaceChange: (workspace: PersonalWorkspace) => void
): LocalAssistantHookState {
  const workspaceChangeRef = useRef(onWorkspaceChange);
  workspaceChangeRef.current = onWorkspaceChange;
  const controllerRef = useRef<ReturnType<typeof createLocalAssistantController> | null>(
    null
  );
  if (!controllerRef.current) {
    controllerRef.current = createLocalAssistantController({
      generate: generateLocalText,
      stopAndRelease: stopAndReleaseLocalModel,
      onWorkspaceChange: (workspace) => workspaceChangeRef.current(workspace),
      now: () => new Date().toISOString(),
      createId: assistantRecordId
    });
  }
  const controller = controllerRef.current;
  const lifecycleRef = useRef<ReturnType<typeof createDownloadUnmountGuard> | null>(
    null
  );
  if (!lifecycleRef.current) {
    lifecycleRef.current = createDownloadUnmountGuard(cancelActiveDownload);
  }
  const lifecycle = lifecycleRef.current;
  const [assistant, setAssistant] = useState<LocalAssistantSnapshot>(() =>
    controller.snapshot()
  );
  const [installationStatuses, setInstallationStatuses] = useState<
    readonly ModelInstallationStatus[]
  >(initialInstallationStatuses);
  const [downloadStates, setDownloadStates] = useState<
    Record<string, DownloadState>
  >({});
  const [pausedDownloads, setPausedDownloads] = useState<
    Record<string, PausedModelDownload>
  >({});
  const [acceptedLicenseModelIds, setAcceptedLicenseModelIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [environmentSupport, setEnvironmentSupport] =
    useState<EnvironmentSupport>("checking");
  const [environmentArchitectures, setEnvironmentArchitectures] = useState<
    readonly string[]
  >([]);
  const [environmentTotalMemoryBytes, setEnvironmentTotalMemoryBytes] = useState<
    number | null
  >(null);
  const [activeDownloadModelId, setActiveDownloadModelId] = useState<string | null>(
    null
  );
  const [errorKind, setErrorKind] = useState<LocalAiErrorKind | null>(null);

  const refreshModels = async () => {
    try {
      await cancelActiveDownload();
      const statuses = await inspectInstalledModels();
      lifecycle.commit(() => {
        setInstallationStatuses(statuses);
        const firstInvalid = statuses.find((status) => status.kind === "invalid");
        setErrorKind(firstInvalid ? "integrity" : null);
      });
    } catch (error) {
      lifecycle.commit(() => setErrorKind(classifyLocalAiError(error)));
      throw error;
    }
  };

  useEffect(
    () =>
      controller.subscribe((snapshot) =>
        lifecycle.commit(() => setAssistant(snapshot))
      ),
    [controller, lifecycle]
  );

  useEffect(() => {
    lifecycle.mount();
    void getLocalAiEnvironmentSupport()
      .then((support) => {
        lifecycle.commit(() => {
          setEnvironmentSupport(support.supported ? "supported" : "unsupported");
          setEnvironmentArchitectures(support.architectures);
          setEnvironmentTotalMemoryBytes(support.totalMemoryBytes);
        });
      })
      .catch(() => {
        lifecycle.commit(() => setEnvironmentSupport("unsupported"));
      });
    void refreshModels().catch(() => undefined);

    const changeSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        void controller.stopAndClear("app-background").catch(() => undefined);
      }
    });
    const blurSubscription = AppState.addEventListener("blur", () => {
      void controller.stopAndClear("android-blur").catch(() => undefined);
    });
    return () => {
      changeSubscription.remove();
      blurSubscription.remove();
      void lifecycle.unmount().catch(() => undefined);
      void controller.stopAndClear("screen-unmount").catch(() => undefined);
    };
    // The model inspection and lifecycle bindings are intentionally installed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, lifecycle]);

  const actions = useMemo<LocalAssistantHookState["actions"]>(
    () => ({
      refreshModels,
      setAction: (action) => controller.setAction(action),
      setInput: (input) => controller.setInput(input),
      toggleLicenseAcceptance(modelId) {
        setAcceptedLicenseModelIds((current) => {
          const next = new Set(current);
          if (next.has(modelId)) next.delete(modelId);
          else next.add(modelId);
          return next;
        });
      },
      async installModel(model) {
        if (
          environmentSupport !== "supported" ||
          !hasRequiredMemory(model, environmentTotalMemoryBytes) ||
          model.availability !== "installable" ||
          !acceptedLicenseModelIds.has(model.id)
        ) {
          const code =
            environmentSupport !== "supported"
              ? "unsupported_environment"
              : !hasRequiredMemory(model, environmentTotalMemoryBytes)
                ? "insufficient_memory"
                : "license_acceptance_required";
          throw Object.assign(new Error(code), { code });
        }
        setErrorKind(null);
        setActiveDownloadModelId(model.id);
        try {
          await downloadModel(model, {
            onStateChange: (next) =>
              lifecycle.commit(() =>
                setDownloadStates((current) => ({ ...current, [model.id]: next }))
              )
          });
          lifecycle.commit(() =>
            setPausedDownloads((current) => {
              const next = { ...current };
              delete next[model.id];
              return next;
            })
          );
          await refreshModels();
        } catch (error) {
          const code =
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "";
          if (code !== "download_paused" && code !== "download_cancelled") {
            lifecycle.commit(() => setErrorKind(classifyLocalAiError(error)));
            throw error;
          }
        } finally {
          lifecycle.commit(() => setActiveDownloadModelId(null));
        }
      },
      async pauseDownload() {
        const paused = await pauseActiveDownload();
        lifecycle.commit(() =>
          setPausedDownloads((current) => ({
            ...current,
            [paused.modelId]: paused
          }))
        );
      },
      async resumeDownload(model) {
        const resume = pausedDownloads[model.id];
        if (!resume) throw new Error("resume_state_invalid");
        setErrorKind(null);
        setActiveDownloadModelId(model.id);
        try {
          await downloadModel(model, {
            resume,
            onStateChange: (next) =>
              lifecycle.commit(() =>
                setDownloadStates((current) => ({ ...current, [model.id]: next }))
              )
          });
          lifecycle.commit(() =>
            setPausedDownloads((current) => {
              const next = { ...current };
              delete next[model.id];
              return next;
            })
          );
          await refreshModels();
        } catch (error) {
          const code =
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "";
          if (code !== "download_paused" && code !== "download_cancelled") {
            lifecycle.commit(() => setErrorKind(classifyLocalAiError(error)));
            throw error;
          }
        } finally {
          lifecycle.commit(() => setActiveDownloadModelId(null));
        }
      },
      async cancelDownload(modelId) {
        if (pausedDownloads[modelId]) await removeModel(modelId);
        else await cancelActiveDownload();
        lifecycle.commit(() => {
          setPausedDownloads((current) => {
            const next = { ...current };
            delete next[modelId];
            return next;
          });
          setDownloadStates((current) => ({
            ...current,
            [modelId]: { kind: "notInstalled" }
          }));
        });
        await refreshModels();
      },
      async loadModel(installed) {
        setErrorKind(null);
        try {
          const loadedSession = await loadLocalModel(installed);
          controller.attachSession(loadedSession);
        } catch (error) {
          lifecycle.commit(() => setErrorKind(classifyLocalAiError(error)));
          throw error;
        }
      },
      generate: () => controller.generate(),
      cancelGeneration: () => controller.stopAndClear("user-cancel"),
      approve: (workspace) => controller.approve(workspace),
      discard: () => controller.discard(),
      flagProblem: () => controller.flagProblem(),
      async deleteModel(modelId) {
        await deleteLocalModelSafely(
          () => controller.stopAndClear("model-delete"),
          removeModel,
          modelId
        );
        lifecycle.commit(() =>
          setDownloadStates((current) => ({
            ...current,
            [modelId]: { kind: "notInstalled" }
          }))
        );
        await refreshModels();
      }
    }),
    [
      acceptedLicenseModelIds,
      controller,
      environmentSupport,
      environmentTotalMemoryBytes,
      lifecycle,
      pausedDownloads
    ]
  );

  return {
    ...assistant,
    models: MODEL_REGISTRY,
    installationStatuses,
    downloadStates,
    acceptedLicenseModelIds,
    environmentSupport,
    environmentArchitectures,
    environmentTotalMemoryBytes,
    activeDownloadModelId,
    errorKind,
    actions
  };
}

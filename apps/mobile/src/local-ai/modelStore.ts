import { getInstallableModels, type ModelArtifact } from "./modelRegistry";
import {
  reduceDownloadState,
  type DownloadState,
  type InstalledModel
} from "./modelDownloadState";
export type { DownloadState, InstalledModel } from "./modelDownloadState";

export type ModelStoreErrorCode =
  | "registry_not_allowlisted"
  | "model_not_installed"
  | "install_in_progress"
  | "operation_in_progress"
  | "resume_state_invalid"
  | "filesystem_unavailable"
  | "filesystem_failed"
  | "native_bridge_unavailable"
  | "network_failed"
  | "http_failed"
  | "download_cancelled"
  | "download_paused"
  | "pause_failed"
  | "cancel_failed"
  | "size_mismatch"
  | "sha256_mismatch"
  | "verification_failed"
  | "rename_failed"
  | "cleanup_failed"
  | "deletion_failed";

export class ModelStoreError extends Error {
  constructor(
    readonly code: ModelStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ModelStoreError";
  }
}

export class ModelStoreCleanupError extends ModelStoreError {
  constructor(
    readonly primaryError: ModelStoreError,
    readonly cleanupError: unknown,
    message: string
  ) {
    super("cleanup_failed", message, { cause: primaryError });
    this.name = "ModelStoreCleanupError";
  }
}

export interface DownloadResult {
  uri: string;
  status: number;
}

export interface DownloadHandle {
  download: () => Promise<DownloadResult | undefined>;
  pause: () => Promise<{ resumeData?: string }>;
  cancel: () => Promise<void>;
}

export interface ModelFileSystem {
  readonly documentDirectory: string | null;
  initialize?(): Promise<void>;
  assertModelPath(uri: string): Promise<void>;
  ensureDirectory(uri: string): Promise<void>;
  getFileInfo(uri: string): Promise<{ exists: boolean; size?: number }>;
  delete(uri: string): Promise<void>;
  replaceVerified(
    partialUri: string,
    completedUri: string,
    expectedBytes: number,
    expectedSha256: string
  ): Promise<void>;
  createDownload(
    url: string,
    destinationUri: string,
    onProgress: (written: number, total: number) => void,
    resumeData?: string
  ): DownloadHandle | Promise<DownloadHandle>;
}

export interface ModelHasher {
  hashFile(uri: string): Promise<string>;
}

export interface ModelResumeRecord {
  modelId: string;
  revision: string;
  partialUri: string;
  bytesWritten: number;
  resumeData: string;
}

export interface DownloadModelCallbacks {
  onStateChange?: (state: DownloadState) => void;
  onProgress?: (written: number, total: number | null) => void;
  /** Pass back only the complete record returned by pauseActiveDownload. */
  resume?: ModelResumeRecord;
}

export type PausedModelDownload = ModelResumeRecord;

export type ModelInstallationStatus =
  | { kind: "notInstalled"; modelId: string }
  | { kind: "ready"; installed: InstalledModel }
  | {
      kind: "invalid";
      modelId: string;
      code: "size_mismatch" | "sha256_mismatch" | "verification_failed" | "native_bridge_unavailable";
    };

type InstallIntent = "run" | "pause" | "cancel";

interface ModelPaths {
  root: string;
  directory: string;
  completedUri: string;
  partialUri: string;
}

interface ActiveInstall {
  epoch: number;
  model: InstallableModel;
  paths: ModelPaths;
  callbacks: DownloadModelCallbacks;
  state: DownloadState;
  intent: InstallIntent;
  handle: DownloadHandle | null;
  handleReady: Deferred<DownloadHandle | null>;
  terminal: Deferred<void>;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  settled: boolean;
}

type InstallableModel = ModelArtifact &
  Required<Pick<ModelArtifact, "artifactFileName" | "downloadUrl" | "bytes" | "sha256">>;

const registryIdentityFields = [
  "id",
  "availability",
  "repository",
  "revision",
  "artifactFileName",
  "downloadUrl",
  "bytes",
  "sha256"
] as const satisfies readonly (keyof ModelArtifact)[];

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const result: Deferred<T> = {
    promise: new Promise<T>((resolve) => {
      resolvePromise = resolve;
    }),
    resolve(value: T) {
      if (result.settled) return;
      result.settled = true;
      resolvePromise(value);
    },
    settled: false
  };
  return result;
}

function approvedModel(candidate: ModelArtifact): InstallableModel {
  const approved = getInstallableModels().find((model) => model.id === candidate.id);
  if (
    !approved ||
    approved.availability !== "installable" ||
    registryIdentityFields.some((field) => approved[field] !== candidate[field])
  ) {
    throw new ModelStoreError(
      "registry_not_allowlisted",
      `${candidate.id}: model artifact is not an exact installable registry identity`
    );
  }
  return approved as InstallableModel;
}

function asStoreError(
  error: unknown,
  fallbackCode: ModelStoreErrorCode,
  fallbackMessage: string
): ModelStoreError {
  return error instanceof ModelStoreError
    ? error
    : new ModelStoreError(fallbackCode, fallbackMessage, { cause: error });
}

function canonicalDocumentUrl(directory: string | null): URL {
  if (!directory) {
    throw new ModelStoreError(
      "filesystem_unavailable",
      "App-specific document storage is unavailable"
    );
  }
  try {
    const parsed = new URL(directory);
    if (
      parsed.protocol !== "file:" ||
      parsed.host !== "" ||
      parsed.search !== "" ||
      parsed.hash !== "" ||
      parsed.href !== directory ||
      !parsed.pathname.endsWith("/")
    ) {
      throw new Error("document URI is not canonical");
    }
    return parsed;
  } catch (error) {
    throw new ModelStoreError(
      "filesystem_unavailable",
      "App-specific document storage URI is not canonical",
      { cause: error }
    );
  }
}

function modelPaths(documentDirectory: string | null, model: ModelArtifact): ModelPaths {
  const documentUrl = canonicalDocumentUrl(documentDirectory);
  const rootUrl = new URL("models/", documentUrl);
  const directoryUrl = new URL(`${model.id}/`, rootUrl);
  const completedUrl = new URL(`${model.revision}.gguf`, directoryUrl);
  const partialUrl = new URL(`${model.revision}.gguf.partial`, directoryUrl);
  const rootPrefix = rootUrl.href;

  for (const url of [directoryUrl, completedUrl, partialUrl]) {
    if (!url.href.startsWith(rootPrefix) || url.protocol !== "file:") {
      throw new ModelStoreError(
        "filesystem_unavailable",
        `${model.id}: generated model path escaped the models root`
      );
    }
  }
  return {
    root: rootUrl.href,
    directory: directoryUrl.href,
    completedUri: completedUrl.href,
    partialUri: partialUrl.href
  };
}

function safeCallback<T extends readonly unknown[]>(
  callback: ((...args: T) => void) | undefined,
  ...args: T
): void {
  try {
    callback?.(...args);
  } catch {
    // Observers are intentionally isolated from the install transaction.
  }
}

export function createModelStore({
  fileSystem,
  hasher
}: {
  fileSystem: ModelFileSystem;
  hasher: ModelHasher | null;
}) {
  let active: ActiveInstall | null = null;
  let installing = false;
  let epoch = 0;
  let pendingControls = 0;
  let controlTail: Promise<void> = Promise.resolve();
  let installReady: Deferred<ActiveInstall | null> | null = null;

  function emit(operation: ActiveInstall, next: DownloadState): void {
    operation.state = next;
    safeCallback(operation.callbacks.onStateChange, next);
  }

  function enqueueControl<T>(task: () => Promise<T>): Promise<T> {
    pendingControls += 1;
    const run = controlTail.then(task, task);
    controlTail = run.then(() => undefined, () => undefined);
    return run.finally(() => {
      pendingControls -= 1;
    });
  }

  async function initializeFileSystem(): Promise<void> {
    try {
      await fileSystem.initialize?.();
    } catch (error) {
      throw asStoreError(
        error,
        "filesystem_unavailable",
        "Could not initialize app-specific document storage"
      );
    }
  }

  async function assertPaths(paths: ModelPaths): Promise<void> {
    try {
      for (const uri of [paths.root, paths.directory, paths.partialUri, paths.completedUri]) {
        await fileSystem.assertModelPath(uri);
      }
    } catch (error) {
      throw asStoreError(
        error,
        "filesystem_unavailable",
        "Model path failed native models-root confinement"
      );
    }
  }

  async function cleanupPartial(
    partialUri: string,
    primaryError: ModelStoreError
  ): Promise<never> {
    try {
      await fileSystem.delete(partialUri);
    } catch (cleanupError) {
      throw new ModelStoreCleanupError(
        primaryError,
        cleanupError,
        `Could not remove untrusted partial model file: ${partialUri}`
      );
    }
    throw primaryError;
  }

  async function verifyFileSha256(uri: string, expectedSha256: string): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new ModelStoreError("verification_failed", "Expected SHA-256 is malformed");
    }
    if (!hasher) {
      throw new ModelStoreError(
        "native_bridge_unavailable",
        "Android streaming SHA-256 bridge is unavailable"
      );
    }
    try {
      const actual = await hasher.hashFile(uri);
      if (!/^[a-f0-9]{64}$/.test(actual)) {
        throw new Error("Native bridge returned a malformed SHA-256");
      }
      return actual === expectedSha256;
    } catch (error) {
      throw asStoreError(
        error,
        "verification_failed",
        `Could not calculate SHA-256 for ${uri}`
      );
    }
  }

  function interruption(operation: ActiveInstall): ModelStoreError | null {
    if (operation.intent === "pause") {
      return new ModelStoreError("download_paused", "Model download was paused");
    }
    if (operation.intent === "cancel") {
      return new ModelStoreError("download_cancelled", "Model download was cancelled");
    }
    return null;
  }

  function validateResume(
    model: InstallableModel,
    paths: ModelPaths,
    resume: ModelResumeRecord | undefined,
    partial: { exists: boolean; size?: number }
  ): string | undefined {
    if (!resume) return undefined;
    if (
      resume.modelId !== model.id ||
      resume.revision !== model.revision ||
      resume.partialUri !== paths.partialUri ||
      !Number.isSafeInteger(resume.bytesWritten) ||
      resume.bytesWritten < 0 ||
      resume.resumeData !== String(resume.bytesWritten) ||
      !partial.exists ||
      partial.size !== resume.bytesWritten
    ) {
      throw new ModelStoreError(
        "resume_state_invalid",
        "Resume record does not match the selected model and partial file"
      );
    }
    return resume.resumeData;
  }

  async function performDownloadModel(
    model: InstallableModel,
    paths: ModelPaths,
    callbacks: DownloadModelCallbacks,
    ready: Deferred<ActiveInstall | null>,
    terminal: Deferred<void>
  ): Promise<InstalledModel> {
    const operation: ActiveInstall = {
      epoch: ++epoch,
      model,
      paths,
      callbacks,
      state: { kind: "notInstalled" },
      intent: "run",
      handle: null,
      handleReady: deferred<DownloadHandle | null>(),
      terminal
    };
    active = operation;
    ready.resolve(operation);
    let pathsConfined = false;

    try {
      await assertPaths(paths);
      pathsConfined = true;
      const existingPartial = await fileSystem.getFileInfo(paths.partialUri);
      const resumeData = validateResume(model, paths, callbacks.resume, existingPartial);
      const earlyInterruption = interruption(operation);
      if (earlyInterruption) throw earlyInterruption;

      if (!callbacks.resume) {
        try {
          await fileSystem.delete(paths.partialUri);
        } catch (error) {
          throw asStoreError(
            error,
            "cleanup_failed",
            `Could not reset stale partial file: ${paths.partialUri}`
          );
        }
      }
      const afterCleanupInterruption = interruption(operation);
      if (afterCleanupInterruption) throw afterCleanupInterruption;

      try {
        await fileSystem.ensureDirectory(paths.directory);
      } catch (error) {
        throw asStoreError(
          error,
          "filesystem_failed",
          `Could not create model directory: ${paths.directory}`
        );
      }
      const beforeCreateInterruption = interruption(operation);
      if (beforeCreateInterruption) throw beforeCreateInterruption;

      let handle: DownloadHandle;
      try {
        handle = await fileSystem.createDownload(
          model.downloadUrl,
          paths.partialUri,
          (written, total) => {
            const normalizedWritten =
              Number.isSafeInteger(written) && written >= 0 ? written : 0;
            const normalizedTotal =
              Number.isSafeInteger(total) && total >= 0 ? total : null;
            if (operation.state.kind === "downloading") {
              emit(operation, reduceDownloadState(operation.state, {
                type: "PROGRESS",
                bytesWritten: normalizedWritten,
                totalBytes: normalizedTotal
              }));
            }
            safeCallback(
              callbacks.onProgress,
              normalizedWritten,
              normalizedTotal
            );
          },
          resumeData
        );
      } catch (error) {
        throw asStoreError(
          error,
          "filesystem_failed",
          "Could not create native resumable download task"
        );
      }
      operation.handle = handle;
      operation.handleReady.resolve(handle);

      const startState = callbacks.resume
        ? reduceDownloadState(
          {
            kind: "paused",
            bytesWritten: callbacks.resume.bytesWritten,
            resumeData: callbacks.resume.resumeData
          },
          { type: "RESUME" }
        )
        : reduceDownloadState({ kind: "notInstalled" }, { type: "START" });
      emit(operation, startState);

      const beforeDownloadInterruption = interruption(operation);
      if (beforeDownloadInterruption) throw beforeDownloadInterruption;

      let result: DownloadResult | undefined;
      try {
        result = await handle.download();
      } catch (error) {
        const intended = interruption(operation);
        if (intended) throw intended;
        throw asStoreError(error, "network_failed", "Model download failed");
      }
      const intended = interruption(operation);
      if (intended) throw intended;
      if (!result) {
        throw new ModelStoreError("download_cancelled", "Model download was cancelled");
      }
      if (result.status < 200 || result.status >= 300) {
        throw new ModelStoreError(
          "http_failed",
          `Model download returned HTTP ${result.status}`
        );
      }

      const partial = await fileSystem.getFileInfo(paths.partialUri);
      if (!partial.exists || partial.size !== model.bytes) {
        throw new ModelStoreError(
          "size_mismatch",
          `Expected ${model.bytes} bytes, received ${partial.size ?? 0}`
        );
      }
      emit(operation, reduceDownloadState(operation.state, { type: "VERIFY" }));
      if (!(await verifyFileSha256(paths.partialUri, model.sha256))) {
        throw new ModelStoreError(
          "sha256_mismatch",
          "Downloaded model SHA-256 did not match"
        );
      }
      const beforeReplaceInterruption = interruption(operation);
      if (beforeReplaceInterruption) throw beforeReplaceInterruption;

      try {
        await fileSystem.replaceVerified(
          paths.partialUri,
          paths.completedUri,
          model.bytes,
          model.sha256
        );
      } catch (error) {
        throw asStoreError(
          error,
          "rename_failed",
          `Could not safely replace model at ${paths.completedUri}`
        );
      }

      const installed: InstalledModel = {
        modelId: model.id,
        revision: model.revision,
        uri: paths.completedUri,
        bytes: model.bytes,
        sha256: model.sha256
      };
      emit(operation, reduceDownloadState(operation.state, {
        type: "COMPLETE",
        installed
      }));
      return installed;
    } catch (error) {
      const storeError = asStoreError(
        error,
        "filesystem_failed",
        "Model installation failed"
      );
      if (
        storeError.code !== "download_paused" &&
        operation.state.kind !== "ready" &&
        operation.state.kind !== "notInstalled"
      ) {
        emit(operation, reduceDownloadState(operation.state, {
          type: "FAIL",
          code: storeError.code,
          message: storeError.message
        }));
      }
      if (storeError.code === "download_paused") throw storeError;
      // Native confinement failure means even cleanup would be an untrusted
      // filesystem mutation. Leave the path untouched and fail closed.
      if (!pathsConfined) throw storeError;
      return await cleanupPartial(paths.partialUri, storeError);
    } finally {
      operation.handleReady.resolve(null);
      if (active?.epoch === operation.epoch) active = null;
      terminal.resolve(undefined);
    }
  }

  async function downloadModel(
    candidate: ModelArtifact,
    callbacks: DownloadModelCallbacks = {}
  ): Promise<InstalledModel> {
    if (installing || pendingControls > 0) {
      throw new ModelStoreError(
        pendingControls > 0 ? "operation_in_progress" : "install_in_progress",
        "Another model store operation is already in progress"
      );
    }
    installing = true;
    const ready = deferred<ActiveInstall | null>();
    const terminal = deferred<void>();
    installReady = ready;
    try {
      const model = approvedModel(candidate);
      await initializeFileSystem();
      const paths = modelPaths(fileSystem.documentDirectory, model);
      return await performDownloadModel(model, paths, callbacks, ready, terminal);
    } finally {
      ready.resolve(null);
      terminal.resolve(undefined);
      if (installReady === ready) installReady = null;
      installing = false;
    }
  }

  async function currentOrPendingInstall(): Promise<ActiveInstall | null> {
    if (active) return active;
    if (installing && installReady) return installReady.promise;
    return null;
  }

  async function pauseInternal(): Promise<PausedModelDownload> {
    const operation = await currentOrPendingInstall();
    if (!operation) {
      throw new ModelStoreError("pause_failed", "No active model download to pause");
    }
    operation.intent = "pause";
    const handle = operation.handle ?? await operation.handleReady.promise;
    if (!handle) {
      await operation.terminal.promise;
      throw new ModelStoreError("pause_failed", "Download ended before it could be paused");
    }

    let pauseState: { resumeData?: string };
    try {
      pauseState = await handle.pause();
    } catch (error) {
      operation.intent = "cancel";
      let cleanupError: unknown;
      try {
        await handle.cancel();
      } catch (cancelError) {
        cleanupError = cancelError;
      }
      await operation.terminal.promise;
      try {
        await fileSystem.delete(operation.paths.partialUri);
      } catch (deleteError) {
        cleanupError = cleanupError ?? deleteError;
      }
      const primary = asStoreError(error, "pause_failed", "Could not pause model download");
      if (cleanupError) {
        throw new ModelStoreCleanupError(
          primary,
          cleanupError,
          `Could not clean partial after pause failure: ${operation.paths.partialUri}`
        );
      }
      throw primary;
    }

    await operation.terminal.promise;
    const info = await fileSystem.getFileInfo(operation.paths.partialUri);
    const resumeData = pauseState.resumeData;
    if (
      !resumeData ||
      !info.exists ||
      !Number.isSafeInteger(info.size) ||
      info.size! < 0 ||
      resumeData !== String(info.size)
    ) {
      const primary = new ModelStoreError(
        "resume_state_invalid",
        "Native pause token does not match the terminal partial file size"
      );
      return await cleanupPartial(operation.paths.partialUri, primary);
    }

    const paused: PausedModelDownload = {
      modelId: operation.model.id,
      revision: operation.model.revision,
      partialUri: operation.paths.partialUri,
      bytesWritten: info.size!,
      resumeData
    };
    emit(operation, reduceDownloadState(operation.state, {
      type: "PAUSE",
      bytesWritten: paused.bytesWritten,
      resumeData: paused.resumeData
    }));
    return paused;
  }

  async function cancelOperation(operation: ActiveInstall): Promise<void> {
    operation.intent = "cancel";
    const handle = operation.handle ?? await operation.handleReady.promise;
    let cancelError: unknown;
    if (handle) {
      try {
        await handle.cancel();
      } catch (error) {
        cancelError = error;
      }
    }
    await operation.terminal.promise;

    let cleanupError: unknown;
    try {
      await fileSystem.delete(operation.paths.partialUri);
    } catch (error) {
      cleanupError = error;
    }
    if (cancelError) {
      const primary = asStoreError(
        cancelError,
        "cancel_failed",
        "Native model download cancellation failed"
      );
      if (cleanupError) {
        throw new ModelStoreCleanupError(
          primary,
          cleanupError,
          `Could not clean partial after cancellation: ${operation.paths.partialUri}`
        );
      }
      throw primary;
    }
    if (cleanupError) {
      throw asStoreError(
        cleanupError,
        "cleanup_failed",
        `Could not clean cancelled partial: ${operation.paths.partialUri}`
      );
    }
  }

  function pauseActiveDownload(): Promise<PausedModelDownload> {
    return enqueueControl(pauseInternal);
  }

  function cancelActiveDownload(): Promise<void> {
    return enqueueControl(async () => {
      const operation = await currentOrPendingInstall();
      if (operation) await cancelOperation(operation);
    });
  }

  function removeModel(modelId: string): Promise<void> {
    return enqueueControl(async () => {
      const model = getInstallableModels().find((entry) => entry.id === modelId);
      if (!model) {
        throw new ModelStoreError(
          "registry_not_allowlisted",
          `${modelId}: model is not in the installable registry`
        );
      }
      const operation = await currentOrPendingInstall();
      if (operation) await cancelOperation(operation);
      await initializeFileSystem();
      const paths = modelPaths(fileSystem.documentDirectory, model);
      await assertPaths(paths);
      try {
        await fileSystem.delete(paths.directory);
      } catch (error) {
        throw asStoreError(error, "deletion_failed", `Could not remove model ${modelId}`);
      }
    });
  }

  function cleanupPartialDownloads(): Promise<void> {
    if (installing || active) {
      return Promise.reject(new ModelStoreError(
        "operation_in_progress",
        "Cannot clean partial models while an installation is active"
      ));
    }
    return enqueueControl(async () => {
      await initializeFileSystem();
      for (const model of getInstallableModels()) {
        const paths = modelPaths(fileSystem.documentDirectory, model);
        await assertPaths(paths);
        try {
          await fileSystem.delete(paths.partialUri);
        } catch (error) {
          throw asStoreError(
            error,
            "cleanup_failed",
            `Could not clean partial model download: ${paths.partialUri}`
          );
        }
      }
    });
  }

  function removeAllModels(): Promise<void> {
    return enqueueControl(async () => {
      const operation = await currentOrPendingInstall();
      if (operation) await cancelOperation(operation);
      await initializeFileSystem();
      const documentUrl = canonicalDocumentUrl(fileSystem.documentDirectory);
      const root = new URL("models/", documentUrl).href;
      try {
        await fileSystem.assertModelPath(root);
        await fileSystem.delete(root);
      } catch (error) {
        throw asStoreError(error, "deletion_failed", "Could not remove all model artifacts");
      }
    });
  }

  function assertInspectionAvailable(): void {
    if (installing || active) {
      throw new ModelStoreError(
        "operation_in_progress",
        "Cannot inspect installed models while an installation is active"
      );
    }
  }

  async function inspectModel(
    model: InstallableModel,
    paths: ModelPaths
  ): Promise<ModelInstallationStatus> {
    await assertPaths(paths);
    const info = await fileSystem.getFileInfo(paths.completedUri);
    if (!info.exists) return { kind: "notInstalled", modelId: model.id };
    if (info.size !== model.bytes) {
      return { kind: "invalid", modelId: model.id, code: "size_mismatch" };
    }
    try {
      if (!(await verifyFileSha256(paths.completedUri, model.sha256))) {
        return { kind: "invalid", modelId: model.id, code: "sha256_mismatch" };
      }
    } catch (error) {
      const storeError = asStoreError(
        error,
        "verification_failed",
        `Could not verify installed model ${model.id}`
      );
      return {
        kind: "invalid",
        modelId: model.id,
        code:
          storeError.code === "native_bridge_unavailable"
            ? "native_bridge_unavailable"
            : "verification_failed"
      };
    }
    return {
      kind: "ready",
      installed: {
        modelId: model.id,
        revision: model.revision,
        uri: paths.completedUri,
        bytes: model.bytes,
        sha256: model.sha256
      }
    };
  }

  function inspectInstalledModels(): Promise<readonly ModelInstallationStatus[]> {
    try {
      assertInspectionAvailable();
    } catch (error) {
      return Promise.reject(error);
    }
    return enqueueControl(async () => {
      await initializeFileSystem();
      const statuses: ModelInstallationStatus[] = [];
      for (const candidate of getInstallableModels()) {
        const model = approvedModel(candidate);
        const paths = modelPaths(fileSystem.documentDirectory, model);
        statuses.push(await inspectModel(model, paths));
      }
      return statuses;
    });
  }

  function verifyInstalledModelForRuntime(
    installed: InstalledModel
  ): Promise<InstallableModel> {
    try {
      assertInspectionAvailable();
    } catch (error) {
      return Promise.reject(error);
    }
    return enqueueControl(async () => {
      const candidate = getInstallableModels().find(
        (entry) => entry.id === installed.modelId
      );
      if (!candidate) {
        throw new ModelStoreError(
          "registry_not_allowlisted",
          `${installed.modelId}: installed model is not allowlisted`
        );
      }
      const model = approvedModel(candidate);
      await initializeFileSystem();
      const paths = modelPaths(fileSystem.documentDirectory, model);
      if (
        installed.revision !== model.revision ||
        installed.uri !== paths.completedUri ||
        installed.bytes !== model.bytes ||
        installed.sha256 !== model.sha256
      ) {
        throw new ModelStoreError(
          "registry_not_allowlisted",
          `${installed.modelId}: installed model identity or private URI is invalid`
        );
      }
      await assertPaths(paths);
      const info = await fileSystem.getFileInfo(paths.completedUri);
      if (!info.exists) {
        throw new ModelStoreError(
          "model_not_installed",
          `${installed.modelId}: completed model file is not installed`
        );
      }
      if (info.size !== model.bytes) {
        throw new ModelStoreError(
          "size_mismatch",
          `${installed.modelId}: installed model size does not match the registry`
        );
      }
      if (!(await verifyFileSha256(paths.completedUri, model.sha256))) {
        throw new ModelStoreError(
          "sha256_mismatch",
          `${installed.modelId}: installed model SHA-256 does not match the registry`
        );
      }
      return model;
    });
  }

  return {
    downloadModel,
    verifyFileSha256,
    pauseActiveDownload,
    cancelActiveDownload,
    removeModel,
    removeAllModels,
    cleanupPartialDownloads,
    inspectInstalledModels,
    verifyInstalledModelForRuntime
  };
}

let cachedDocumentDirectory: string | null = null;

const expoFileSystemAdapter: ModelFileSystem = {
  get documentDirectory() {
    return cachedDocumentDirectory;
  },
  async initialize() {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    cachedDocumentDirectory = ExpoFileSystem.documentDirectory;
  },
  async assertModelPath(uri) {
    const integrity = await import("../../modules/model-integrity");
    await integrity.assertModelPath(uri);
  },
  async ensureDirectory(uri) {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    await ExpoFileSystem.makeDirectoryAsync(uri, { intermediates: true });
  },
  async getFileInfo(uri) {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    const info = await ExpoFileSystem.getInfoAsync(uri);
    return info.exists ? { exists: true, size: info.size } : { exists: false };
  },
  async delete(uri) {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    await ExpoFileSystem.deleteAsync(uri, { idempotent: true });
  },
  async replaceVerified(partialUri, completedUri, expectedBytes, expectedSha256) {
    const integrity = await import("../../modules/model-integrity");
    await integrity.replaceVerified(
      partialUri,
      completedUri,
      expectedBytes,
      expectedSha256
    );
  },
  async createDownload(url, destinationUri, onProgress, resumeData) {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    const task = ExpoFileSystem.createDownloadResumable(
      url,
      destinationUri,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        onProgress(totalBytesWritten, totalBytesExpectedToWrite);
      },
      resumeData
    );
    return {
      download: () => task.downloadAsync(),
      pause: () => task.pauseAsync(),
      cancel: () => task.cancelAsync()
    };
  }
};

const defaultStore = createModelStore({
  fileSystem: expoFileSystemAdapter,
  hasher: {
    async hashFile(uri) {
      const integrity = await import("../../modules/model-integrity");
      if (!integrity.isModelIntegrityAvailable()) {
        throw new ModelStoreError(
          "native_bridge_unavailable",
          "Android streaming SHA-256 bridge is unavailable"
        );
      }
      return integrity.hashFileSha256(uri);
    }
  }
});

export const downloadModel = defaultStore.downloadModel;
export const verifyFileSha256 = defaultStore.verifyFileSha256;
export const pauseActiveDownload = defaultStore.pauseActiveDownload;
export const cancelActiveDownload = defaultStore.cancelActiveDownload;
export const removeModel = defaultStore.removeModel;
export const removeAllModels = defaultStore.removeAllModels;
export const cleanupPartialDownloads = defaultStore.cleanupPartialDownloads;
export const inspectInstalledModels = defaultStore.inspectInstalledModels;
export const verifyInstalledModelForRuntime =
  defaultStore.verifyInstalledModelForRuntime;

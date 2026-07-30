import { getInstallableModels, type ModelArtifact } from "./modelRegistry";
import {
  reduceDownloadState,
  type DownloadState,
  type InstalledModel
} from "./modelDownloadState";
export type { DownloadState, InstalledModel } from "./modelDownloadState";

export type ModelStoreErrorCode =
  | "registry_not_allowlisted"
  | "install_in_progress"
  | "resume_state_invalid"
  | "filesystem_unavailable"
  | "filesystem_failed"
  | "native_bridge_unavailable"
  | "network_failed"
  | "http_failed"
  | "download_cancelled"
  | "download_paused"
  | "pause_failed"
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
  ensureDirectory(uri: string): Promise<void>;
  getFileInfo(uri: string): Promise<{ exists: boolean; size?: number }>;
  delete(uri: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
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

export interface DownloadModelCallbacks {
  onStateChange?: (state: DownloadState) => void;
  onProgress?: (written: number, total: number) => void;
  /** Opaque value returned by pauseActiveDownload. Never construct this value manually. */
  resumeData?: string;
}

export interface PausedModelDownload {
  modelId: string;
  partialUri: string;
  resumeData: string;
}

interface ActiveDownload {
  modelId: string;
  partialUri: string;
  handle: DownloadHandle;
  callbacks: DownloadModelCallbacks;
  state: DownloadState;
  paused: boolean;
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

function modelPaths(documentDirectory: string, model: ModelArtifact) {
  const root = `${documentDirectory.replace(/\/?$/, "/")}models/`;
  const directory = `${root}${model.id}/`;
  const completedUri = `${directory}${model.revision}.gguf`;
  return {
    root,
    directory,
    completedUri,
    partialUri: `${completedUri}.partial`
  };
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

export function createModelStore({
  fileSystem,
  hasher
}: {
  fileSystem: ModelFileSystem;
  hasher: ModelHasher | null;
}) {
  let active: ActiveDownload | null = null;
  let installing = false;

  function requireDocumentsDirectory(): string {
    const directory = fileSystem.documentDirectory;
    if (!directory?.startsWith("file:")) {
      throw new ModelStoreError(
        "filesystem_unavailable",
        "App-specific document storage is unavailable"
      );
    }
    return directory;
  }

  function emit(activeDownload: ActiveDownload, state: DownloadState): void {
    activeDownload.state = state;
    activeDownload.callbacks.onStateChange?.(state);
  }

  async function deletePartialOrThrow(
    partialUri: string,
    originalError: ModelStoreError
  ): Promise<never> {
    try {
      await fileSystem.delete(partialUri);
    } catch (cleanupError) {
      const error = new ModelStoreError(
        "cleanup_failed",
        `Could not remove untrusted partial model file: ${partialUri}`,
        { cause: originalError }
      );
      Object.defineProperty(error, "cleanupCause", { value: cleanupError });
      throw error;
    }
    throw originalError;
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

  async function performDownloadModel(
    candidate: ModelArtifact,
    callbacks: DownloadModelCallbacks = {}
  ): Promise<InstalledModel> {
    await fileSystem.initialize?.();
    const model = approvedModel(candidate);
    const paths = modelPaths(requireDocumentsDirectory(), model);

    if (callbacks.resumeData) {
      const partial = await fileSystem.getFileInfo(paths.partialUri);
      if (
        !partial.exists ||
        !Number.isSafeInteger(partial.size) ||
        partial.size! < 0 ||
        callbacks.resumeData !== String(partial.size)
      ) {
        throw new ModelStoreError(
          "resume_state_invalid",
          "Resume metadata does not match the partial model file length"
        );
      }
    } else {
      await fileSystem.delete(paths.partialUri).catch((error) => {
        throw new ModelStoreError(
          "cleanup_failed",
          `Could not reset stale partial file: ${paths.partialUri}`,
          { cause: error }
        );
      });
    }

    try {
      await fileSystem.ensureDirectory(paths.directory);
    } catch (error) {
      throw asStoreError(
        error,
        "filesystem_failed",
        `Could not create model directory: ${paths.directory}`
      );
    }

    const handle = await fileSystem.createDownload(
      model.downloadUrl,
      paths.partialUri,
      (written, total) => {
        if (active) {
          emit(active, reduceDownloadState(active.state, {
            type: "PROGRESS",
            bytesWritten: written,
            totalBytes: total
          }));
        }
        callbacks.onProgress?.(written, total);
      },
      callbacks.resumeData
    );
    const startState = callbacks.resumeData
      ? reduceDownloadState(
        {
          kind: "paused",
          bytesWritten: (await fileSystem.getFileInfo(paths.partialUri)).size ?? 0,
          resumeData: callbacks.resumeData
        },
        { type: "RESUME" }
      )
      : reduceDownloadState({ kind: "notInstalled" }, { type: "START" });
    active = {
      modelId: model.id,
      partialUri: paths.partialUri,
      handle,
      callbacks,
      state: startState,
      paused: false
    };
    callbacks.onStateChange?.(startState);

    try {
      let result: DownloadResult | undefined;
      try {
        result = await handle.download();
      } catch (error) {
        throw asStoreError(error, "network_failed", "Model download failed");
      }
      if (active?.paused) {
        throw new ModelStoreError("download_paused", "Model download was paused");
      }
      if (!result) {
        throw new ModelStoreError("download_cancelled", "Model download was cancelled");
      }
      if (result.status < 200 || result.status >= 300) {
        throw new ModelStoreError("http_failed", `Model download returned HTTP ${result.status}`);
      }

      const partial = await fileSystem.getFileInfo(paths.partialUri);
      if (!partial.exists || partial.size !== model.bytes) {
        throw new ModelStoreError(
          "size_mismatch",
          `Expected ${model.bytes} bytes, received ${partial.size ?? 0}`
        );
      }
      if (!active) {
        throw new ModelStoreError("download_cancelled", "Model download was cancelled");
      }
      emit(active, reduceDownloadState(active.state, { type: "VERIFY" }));
      if (!(await verifyFileSha256(paths.partialUri, model.sha256))) {
        throw new ModelStoreError("sha256_mismatch", "Downloaded model SHA-256 did not match");
      }

      try {
        await fileSystem.move(paths.partialUri, paths.completedUri);
      } catch (error) {
        throw asStoreError(
          error,
          "rename_failed",
          `Could not atomically install model at ${paths.completedUri}`
        );
      }

      const installed: InstalledModel = {
        modelId: model.id,
        revision: model.revision,
        uri: paths.completedUri,
        bytes: model.bytes,
        sha256: model.sha256
      };
      emit(active, reduceDownloadState(active.state, { type: "COMPLETE", installed }));
      return installed;
    } catch (error) {
      const storeError = asStoreError(error, "network_failed", "Model installation failed");
      if (active && storeError.code !== "download_paused") {
        emit(active, reduceDownloadState(active.state, {
          type: "FAIL",
          code: storeError.code,
          message: storeError.message
        }));
      }
      if (storeError.code === "download_paused") throw storeError;
      return await deletePartialOrThrow(paths.partialUri, storeError);
    } finally {
      active = null;
    }
  }

  async function downloadModel(
    candidate: ModelArtifact,
    callbacks: DownloadModelCallbacks = {}
  ): Promise<InstalledModel> {
    if (installing) {
      throw new ModelStoreError(
        "install_in_progress",
        "Another model installation is already in progress"
      );
    }
    installing = true;
    try {
      return await performDownloadModel(candidate, callbacks);
    } finally {
      installing = false;
    }
  }

  async function pauseActiveDownload(): Promise<PausedModelDownload> {
    if (!active) {
      throw new ModelStoreError("pause_failed", "No active model download to pause");
    }
    const current = active;
    // Set intent before awaiting native pause so a simultaneously resolving
    // download cannot be misclassified as cancellation and delete the partial.
    current.paused = true;
    try {
      const pauseState = await current.handle.pause();
      if (!pauseState.resumeData) throw new Error("No resume data returned");
      const info = await fileSystem.getFileInfo(current.partialUri);
      emit(current, reduceDownloadState(current.state, {
        type: "PAUSE",
        resumeData: pauseState.resumeData,
        bytesWritten: info.size ?? 0
      }));
      return {
        modelId: current.modelId,
        partialUri: current.partialUri,
        resumeData: pauseState.resumeData
      };
    } catch (error) {
      try {
        await current.handle.cancel();
        await fileSystem.delete(current.partialUri);
      } catch (cleanupError) {
        throw new ModelStoreError(
          "cleanup_failed",
          `Could not clean partial file after pause failure: ${current.partialUri}`,
          { cause: cleanupError }
        );
      }
      throw asStoreError(error, "pause_failed", "Could not pause model download");
    }
  }

  async function cancelActiveDownload(): Promise<void> {
    if (!active) return;
    const current = active;
    try {
      await current.handle.cancel();
      await fileSystem.delete(current.partialUri);
    } catch (error) {
      throw asStoreError(
        error,
        "cleanup_failed",
        `Could not cancel and clean ${current.partialUri}`
      );
    }
  }

  async function removeModel(modelId: string): Promise<void> {
    await fileSystem.initialize?.();
    const model = getInstallableModels().find((entry) => entry.id === modelId);
    if (!model) {
      throw new ModelStoreError(
        "registry_not_allowlisted",
        `${modelId}: model is not in the installable registry`
      );
    }
    if (active?.modelId === modelId) await cancelActiveDownload();
    const paths = modelPaths(requireDocumentsDirectory(), model);
    try {
      await fileSystem.delete(paths.directory);
    } catch (error) {
      throw asStoreError(error, "deletion_failed", `Could not remove model ${modelId}`);
    }
  }

  async function cleanupPartialDownloads(): Promise<void> {
    await fileSystem.initialize?.();
    const documentDirectory = requireDocumentsDirectory();
    for (const model of getInstallableModels()) {
      const { partialUri } = modelPaths(documentDirectory, model);
      try {
        await fileSystem.delete(partialUri);
      } catch (error) {
        throw asStoreError(
          error,
          "cleanup_failed",
          `Could not clean partial model download: ${partialUri}`
        );
      }
    }
  }

  async function removeAllModels(): Promise<void> {
    await fileSystem.initialize?.();
    if (active) await cancelActiveDownload();
    const root = `${requireDocumentsDirectory().replace(/\/?$/, "/")}models/`;
    try {
      await fileSystem.delete(root);
    } catch (error) {
      throw asStoreError(error, "deletion_failed", "Could not remove all model artifacts");
    }
  }

  return {
    downloadModel,
    verifyFileSha256,
    pauseActiveDownload,
    cancelActiveDownload,
    removeModel,
    removeAllModels,
    cleanupPartialDownloads
  };
}

const expoFileSystemAdapter: ModelFileSystem = {
  get documentDirectory() {
    // Expo initializes this field synchronously, but importing React Native at
    // module evaluation time breaks the pure TypeScript/fake test environment.
    return cachedDocumentDirectory;
  },
  async initialize() {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    cachedDocumentDirectory = ExpoFileSystem.documentDirectory;
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
  async move(from, to) {
    const ExpoFileSystem = await import("expo-file-system/legacy");
    await ExpoFileSystem.moveAsync({ from, to });
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

let cachedDocumentDirectory: string | null = null;

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

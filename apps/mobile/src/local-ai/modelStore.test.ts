import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { MODEL_REGISTRY, type ModelArtifact } from "./modelRegistry";
import {
  createModelStore,
  ModelStoreError,
  type DownloadHandle,
  type ModelFileSystem
} from "./modelStore";
import { reduceDownloadState } from "./modelDownloadState";

const installable = MODEL_REGISTRY[0];

class FakeFileSystem implements ModelFileSystem {
  readonly documentDirectory = "file:///documents/";
  readonly files = new Map<string, number>();
  readonly directories = new Set<string>();
  readonly deleted: string[] = [];
  readonly replacements: Array<{
    partialUri: string;
    completedUri: string;
    expectedBytes: number;
    expectedSha256: string;
  }> = [];
  readonly assertedPaths: string[] = [];
  readonly downloads: Array<{ url: string; destinationUri: string; resumeData?: string }> = [];
  assertError?: Error;
  downloadError?: Error;
  downloadResult: { uri: string; status: number } | undefined;
  cancelDownload = false;
  downloadedBytes = installable.bytes!;
  deleteErrorFor?: string;
  ensureDirectoryError?: Error;
  replaceError?: Error;
  createDownloadError?: Error;
  cancelError?: Error;
  progressEvent?: { written: number; total: number };

  async ensureDirectory(uri: string): Promise<void> {
    if (this.ensureDirectoryError) throw this.ensureDirectoryError;
    this.directories.add(uri);
  }

  async getFileInfo(uri: string): Promise<{ exists: boolean; size?: number }> {
    return this.files.has(uri)
      ? { exists: true, size: this.files.get(uri) }
      : { exists: false };
  }

  async delete(uri: string): Promise<void> {
    if (this.deleteErrorFor === uri) throw new Error("disk cleanup denied");
    this.deleted.push(uri);
    this.files.delete(uri);
  }

  async assertModelPath(uri: string): Promise<void> {
    this.assertedPaths.push(uri);
    if (this.assertError) throw this.assertError;
  }

  async replaceVerified(
    partialUri: string,
    completedUri: string,
    expectedBytes: number,
    expectedSha256: string
  ): Promise<void> {
    this.replacements.push({ partialUri, completedUri, expectedBytes, expectedSha256 });
    if (this.replaceError) throw this.replaceError;
    const size = this.files.get(partialUri);
    if (size === undefined) throw new Error("source missing");
    this.files.delete(partialUri);
    this.files.set(completedUri, size);
  }

  createDownload(
    url: string,
    destinationUri: string,
    _onProgress: (written: number, total: number) => void,
    resumeData?: string
  ): DownloadHandle {
    if (this.createDownloadError) throw this.createDownloadError;
    this.downloads.push({ url, destinationUri, resumeData });
    return {
      download: async () => {
        if (this.downloadError) throw this.downloadError;
        if (this.cancelDownload) return undefined;
        if (this.progressEvent) {
          _onProgress(this.progressEvent.written, this.progressEvent.total);
        }
        if (this.downloadResult === undefined) {
          this.files.set(destinationUri, this.downloadedBytes);
          return { uri: destinationUri, status: 200 };
        }
        return this.downloadResult;
      },
        pause: async () => ({ resumeData: "123" }),
      cancel: async () => {
        if (this.cancelError) throw this.cancelError;
      }
    };
  }
}

function createReadyStore(fileSystem = new FakeFileSystem()) {
  const hashFile = vi.fn(async () => installable.sha256!);
  return {
    fileSystem,
    hashFile,
    store: createModelStore({ fileSystem, hasher: { hashFile } })
  };
}

describe("download state reducer", () => {
  test("allows only the explicit install lifecycle", () => {
    const downloading = reduceDownloadState({ kind: "notInstalled" }, { type: "START" });
    const verifying = reduceDownloadState(downloading, { type: "VERIFY" });
    const installedModel = {
      modelId: installable.id,
      revision: installable.revision,
      uri: "file:///documents/models/model/revision.gguf",
      bytes: installable.bytes!,
      sha256: installable.sha256!
    };
    const ready = reduceDownloadState(verifying, {
      type: "COMPLETE",
      installed: installedModel
    });

    expect([downloading.kind, verifying.kind, ready.kind]).toEqual([
      "downloading",
      "verifying",
      "ready"
    ]);
    expect(() => reduceDownloadState({ kind: "notInstalled" }, { type: "COMPLETE", installed: installedModel }))
      .toThrow("invalid_download_state_transition");
  });

  test("preserves explicit paused and failed states", () => {
    const downloading = reduceDownloadState({ kind: "notInstalled" }, { type: "START" });
    const paused = reduceDownloadState(downloading, {
      type: "PAUSE",
      resumeData: "resume-token",
      bytesWritten: 25
    });
    const resumed = reduceDownloadState(paused, { type: "RESUME" });
    const failed = reduceDownloadState(resumed, {
      type: "FAIL",
      code: "network_failed",
      message: "offline"
    });

    expect(paused).toMatchObject({ kind: "paused", resumeData: "resume-token" });
    expect(resumed.kind).toBe("downloading");
    expect(failed).toMatchObject({ kind: "failed", code: "network_failed" });
  });

  test("represents an unknown download total as null and rejects negative totals", () => {
    const downloading = reduceDownloadState({ kind: "notInstalled" }, { type: "START" });
    expect(
      reduceDownloadState(downloading, {
        type: "PROGRESS",
        bytesWritten: 12,
        totalBytes: null
      })
    ).toMatchObject({ kind: "downloading", bytesWritten: 12, totalBytes: null });
    expect(() =>
      reduceDownloadState(downloading, {
        type: "PROGRESS",
        bytesWritten: 12,
        totalBytes: -1
      })
    ).toThrow("invalid_download_progress");
  });
});

describe("model store", () => {
  test("accepts only the exact installable registry identity and never an arbitrary URL", async () => {
    const { store, fileSystem } = createReadyStore();
    const tampered = { ...installable, downloadUrl: "https://example.com/model.gguf" };
    const blocked = MODEL_REGISTRY.find((model) => model.availability !== "installable")!;

    await expect(store.downloadModel(tampered)).rejects.toMatchObject({ code: "registry_not_allowlisted" });
    await expect(store.downloadModel(blocked)).rejects.toMatchObject({ code: "registry_not_allowlisted" });
    expect(fileSystem.downloads).toEqual([]);
  });

  test("downloads to a partial file, verifies size and native SHA, then renames in place", async () => {
    const { store, fileSystem, hashFile } = createReadyStore();
    const states: string[] = [];

    const installed = await store.downloadModel(installable, {
      onStateChange: (state) => states.push(state.kind)
    });

    expect(fileSystem.downloads[0]).toMatchObject({
      url: installable.downloadUrl,
      destinationUri: expect.stringMatching(/\.gguf\.partial$/)
    });
    expect(hashFile).toHaveBeenCalledWith(expect.stringMatching(/\.partial$/));
    expect(fileSystem.replacements).toEqual([{
      partialUri: expect.stringMatching(/\.partial$/),
      completedUri: expect.stringMatching(new RegExp(`${installable.revision}\\.gguf$`)),
      expectedBytes: installable.bytes,
      expectedSha256: installable.sha256
    }]);
    expect(installed).toMatchObject({
      modelId: installable.id,
      bytes: installable.bytes,
      sha256: installable.sha256
    });
    expect(states).toEqual(["downloading", "verifying", "ready"]);
  });

  test("isolates throwing progress and state callbacks from the install transaction", async () => {
    const { store, fileSystem } = createReadyStore();
    fileSystem.progressEvent = { written: 10, total: -1 };
    const totals: Array<number | null> = [];

    await expect(store.downloadModel(installable, {
      onProgress: (_written, total) => {
        totals.push(total);
        throw new Error("observer failed");
      },
      onStateChange: (state) => {
        if (state.kind === "downloading" || state.kind === "ready") {
          throw new Error("state observer failed");
        }
      }
    })).resolves.toMatchObject({ modelId: installable.id });

    expect(totals).toEqual([null]);
    expect(fileSystem.files.has(
      `file:///documents/models/${installable.id}/${installable.revision}.gguf`
    )).toBe(true);
  });

  test("types adapter creation failure, cleans its partial, and releases the install slot", async () => {
    const { store, fileSystem } = createReadyStore();
    fileSystem.createDownloadError = new Error("native task unavailable");
    const partialUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;
    fileSystem.files.set(partialUri, 12);

    await expect(store.downloadModel(installable)).rejects.toMatchObject({
      code: "filesystem_failed"
    });
    expect(fileSystem.files.has(partialUri)).toBe(false);

    fileSystem.createDownloadError = undefined;
    await expect(store.downloadModel(installable)).resolves.toMatchObject({
      modelId: installable.id
    });
  });

  test("resumes only from an identity-bound pause record", async () => {
    const { store, fileSystem } = createReadyStore();
    const partialUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;
    fileSystem.files.set(partialUri, 123);

    await store.downloadModel(installable, {
      resume: {
        modelId: installable.id,
        revision: installable.revision,
        partialUri,
        bytesWritten: 123,
        resumeData: "123"
      }
    });

    expect(fileSystem.downloads[0]?.resumeData).toBe("123");
  });

  test("rejects a cross-model pause record without touching the other model partial", async () => {
    const { store, fileSystem } = createReadyStore();
    const second = MODEL_REGISTRY[1];
    const firstPartial =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;
    const secondPartial =
      `file:///documents/models/${second.id}/${second.revision}.gguf.partial`;
    fileSystem.files.set(firstPartial, 123);
    fileSystem.files.set(secondPartial, 123);

    await expect(store.downloadModel(second, {
      resume: {
        modelId: installable.id,
        revision: installable.revision,
        partialUri: firstPartial,
        bytesWritten: 123,
        resumeData: "123"
      }
    })).rejects.toMatchObject({ code: "resume_state_invalid" });

    expect(fileSystem.files.has(firstPartial)).toBe(true);
    expect(fileSystem.files.has(secondPartial)).toBe(false);
    expect(fileSystem.downloads).toEqual([]);
  });

  test("rejects resume metadata that does not match the partial byte length", async () => {
    const { store, fileSystem } = createReadyStore();
    const partialUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;
    fileSystem.files.set(partialUri, 123);

    await expect(store.downloadModel(installable, {
      resume: {
        modelId: installable.id,
        revision: installable.revision,
        partialUri,
        bytesWritten: 122,
        resumeData: "122"
      }
    }))
      .rejects.toMatchObject({ code: "resume_state_invalid" });
    expect(fileSystem.downloads).toEqual([]);
    expect(fileSystem.files.has(partialUri)).toBe(false);
  });

  test("pauses an active download without deleting its resumable partial", async () => {
    const fileSystem = new FakeFileSystem();
    let finishDownload!: () => void;
    let finishPause!: () => void;
    const pendingDownload = new Promise<void>((resolvePending) => {
      finishDownload = resolvePending;
    });
    const pendingPause = new Promise<void>((resolvePending) => {
      finishPause = resolvePending;
    });
    fileSystem.createDownload = (url, destinationUri) => {
      fileSystem.downloads.push({ url, destinationUri });
      return {
        download: async () => {
          fileSystem.files.set(destinationUri, 321);
          await pendingDownload;
          return undefined;
        },
        pause: async () => {
          await pendingPause;
          return { resumeData: "321" };
        },
        cancel: async () => undefined
      };
    };
    const store = createModelStore({
      fileSystem,
      hasher: { hashFile: async () => installable.sha256! }
    });
    const states: string[] = [];
    const download = store.downloadModel(installable, {
      onStateChange: (state) => states.push(state.kind)
    });
    while (fileSystem.downloads.length === 0) await Promise.resolve();
    await Promise.resolve();

    const pausing = store.pauseActiveDownload();
    finishDownload();
    await expect(download).rejects.toMatchObject({ code: "download_paused" });
    finishPause();
    const paused = await pausing;

    expect(paused).toMatchObject({
      modelId: installable.id,
      revision: installable.revision,
      bytesWritten: 321,
      resumeData: "321",
      partialUri: expect.stringMatching(/\.partial$/)
    });
    expect(states).toEqual(["downloading", "paused"]);
    expect(fileSystem.files.has(paused.partialUri)).toBe(true);
  });

  test("waits for the native writer to terminate and rejects a pause token/size race", async () => {
    const fileSystem = new FakeFileSystem();
    let finishWriter!: () => void;
    const writerTerminal = new Promise<void>((resolveWriter) => {
      finishWriter = resolveWriter;
    });
    fileSystem.createDownload = (url, destinationUri) => {
      fileSystem.downloads.push({ url, destinationUri });
      return {
        download: async () => {
          fileSystem.files.set(destinationUri, 300);
          await writerTerminal;
          fileSystem.files.set(destinationUri, 321);
          return undefined;
        },
        pause: async () => ({ resumeData: "300" }),
        cancel: async () => undefined
      };
    };
    const store = createModelStore({
      fileSystem,
      hasher: { hashFile: async () => installable.sha256! }
    });
    const downloading = store.downloadModel(installable);
    while (fileSystem.downloads.length === 0) await Promise.resolve();
    await Promise.resolve();

    let pauseSettled = false;
    const pausing = store.pauseActiveDownload().finally(() => {
      pauseSettled = true;
    });
    await Promise.resolve();
    const settledBeforeWriterTerminal = pauseSettled;
    finishWriter();

    await expect(downloading).rejects.toMatchObject({ code: "download_paused" });
    await expect(pausing).rejects.toMatchObject({ code: "resume_state_invalid" });
    expect(settledBeforeWriterTerminal).toBe(false);
    expect(fileSystem.files.has(
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`
    )).toBe(false);
  });

  test("rejects resume metadata when its partial file is missing", async () => {
    const { store, fileSystem } = createReadyStore();

    await expect(store.downloadModel(installable, {
      resume: {
        modelId: installable.id,
        revision: installable.revision,
        partialUri:
          `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`,
        bytesWritten: 123,
        resumeData: "123"
      }
    }))
      .rejects.toMatchObject({ code: "resume_state_invalid" });
    expect(fileSystem.downloads).toEqual([]);
  });

  test("deletes a partial whose byte size does not match", async () => {
    const { store, fileSystem, hashFile } = createReadyStore();
    fileSystem.downloadedBytes = installable.bytes! - 1;

    await expect(store.downloadModel(installable)).rejects.toMatchObject({ code: "size_mismatch" });
    expect(fileSystem.deleted).toEqual(expect.arrayContaining([expect.stringMatching(/\.partial$/)]));
    expect(hashFile).not.toHaveBeenCalled();
  });

  test("deletes a partial whose native SHA-256 does not match", async () => {
    const fileSystem = new FakeFileSystem();
    const store = createModelStore({
      fileSystem,
      hasher: { hashFile: async () => "0".repeat(64) }
    });

    await expect(store.downloadModel(installable)).rejects.toMatchObject({ code: "sha256_mismatch" });
    expect(fileSystem.deleted).toEqual(expect.arrayContaining([expect.stringMatching(/\.partial$/)]));
    expect(fileSystem.replacements).toEqual([]);
  });

  test("cleans partial files after network failure and cancellation", async () => {
    const failedFs = new FakeFileSystem();
    failedFs.downloadError = new Error("connection reset");
    failedFs.files.set(
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`,
      42
    );
    const failedStore = createModelStore({
      fileSystem: failedFs,
      hasher: { hashFile: async () => installable.sha256! }
    });
    await expect(failedStore.downloadModel(installable)).rejects.toMatchObject({ code: "network_failed" });
    expect(failedFs.deleted).toEqual(expect.arrayContaining([expect.stringMatching(/\.partial$/)]));

    const cancelledFs = new FakeFileSystem();
    cancelledFs.cancelDownload = true;
    const cancelledStore = createModelStore({
      fileSystem: cancelledFs,
      hasher: { hashFile: async () => installable.sha256! }
    });
    await expect(cancelledStore.downloadModel(installable)).rejects.toMatchObject({ code: "download_cancelled" });
    expect(cancelledFs.deleted).toEqual(expect.arrayContaining([expect.stringMatching(/\.partial$/)]));
  });

  test("maps HTTP, disk, and rename failures to typed fail-closed errors", async () => {
    const http = createReadyStore();
    http.fileSystem.downloadResult = {
      uri: "file:///documents/model.partial",
      status: 503
    };
    await expect(http.store.downloadModel(installable)).rejects.toMatchObject({
      code: "http_failed"
    });

    const disk = createReadyStore();
    disk.fileSystem.ensureDirectoryError = new Error("no space left");
    await expect(disk.store.downloadModel(installable)).rejects.toMatchObject({
      code: "filesystem_failed"
    });

    const rename = createReadyStore();
    rename.fileSystem.replaceError = new Error("rename denied");
    const completedUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf`;
    rename.fileSystem.files.set(completedUri, 111);
    await expect(rename.store.downloadModel(installable)).rejects.toMatchObject({
      code: "rename_failed"
    });
    expect(rename.fileSystem.files.get(completedUri)).toBe(111);
    expect(rename.fileSystem.deleted).toEqual(
      expect.arrayContaining([expect.stringMatching(/\.partial$/)])
    );
  });

  test("uses verified replacement and preserves a prior completed model on replacement failure", async () => {
    const { store, fileSystem } = createReadyStore();
    const completedUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf`;
    fileSystem.files.set(completedUri, installable.bytes!);
    fileSystem.replaceError = new Error("native replace rollback");

    await expect(store.downloadModel(installable)).rejects.toMatchObject({
      code: "rename_failed"
    });
    expect(fileSystem.files.get(completedUri)).toBe(installable.bytes);
    expect(fileSystem.replacements).toHaveLength(1);
  });

  test("reports cleanup failure instead of hiding it", async () => {
    const { store, fileSystem } = createReadyStore();
    fileSystem.downloadedBytes = installable.bytes! - 1;
    fileSystem.deleteErrorFor =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;

    fileSystem.files.set(fileSystem.deleteErrorFor, 1);
    await expect(store.downloadModel(installable, {
      resume: {
        modelId: installable.id,
        revision: installable.revision,
        partialUri: fileSystem.deleteErrorFor,
        bytesWritten: 1,
        resumeData: "1"
      }
    })).rejects.toMatchObject({
      code: "cleanup_failed",
      primaryError: expect.any(ModelStoreError),
      cleanupError: expect.any(Error)
    });
  });

  test("fails closed when the native SHA bridge is absent", async () => {
    const fileSystem = new FakeFileSystem();
    const store = createModelStore({ fileSystem, hasher: null });

    await expect(store.verifyFileSha256("file:///model.gguf", installable.sha256!))
      .rejects.toMatchObject({ code: "native_bridge_unavailable" });
  });

  test("removes one approved model and all model artifacts", async () => {
    const { store, fileSystem } = createReadyStore();

    await store.removeModel(installable.id);
    await store.cleanupPartialDownloads();
    await store.removeAllModels();

    expect(fileSystem.deleted).toContain(
      `file:///documents/models/${installable.id}/`
    );
    expect(fileSystem.deleted).toContain(
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`
    );
    expect(fileSystem.deleted.at(-1)).toBe("file:///documents/models/");
    await expect(store.removeModel("unknown-model")).rejects.toMatchObject({
      code: "registry_not_allowlisted"
    });
  });

  test("confines every generated path to the app-specific models root", async () => {
    const { store, fileSystem } = createReadyStore();

    await store.downloadModel(installable);

    expect(fileSystem.assertedPaths).toEqual(expect.arrayContaining([
      "file:///documents/models/",
      `file:///documents/models/${installable.id}/`,
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`,
      `file:///documents/models/${installable.id}/${installable.revision}.gguf`
    ]));
  });

  test("rejects a non-canonical document URI before any filesystem mutation", async () => {
    const fileSystem = new FakeFileSystem();
    Object.defineProperty(fileSystem, "documentDirectory", {
      value: "file:///documents/../outside/"
    });
    const store = createModelStore({
      fileSystem,
      hasher: { hashFile: async () => installable.sha256! }
    });

    await expect(store.downloadModel(installable)).rejects.toMatchObject({
      code: "filesystem_unavailable"
    });
    expect(fileSystem.deleted).toEqual([]);
    expect(fileSystem.downloads).toEqual([]);
  });

  test("does not attempt cleanup when native path confinement fails", async () => {
    const { store, fileSystem } = createReadyStore();
    fileSystem.assertError = new Error("symlink escape");

    await expect(store.downloadModel(installable)).rejects.toMatchObject({
      code: "filesystem_unavailable"
    });
    expect(fileSystem.deleted).toEqual([]);
    expect(fileSystem.downloads).toEqual([]);
  });

  test("removeAll cancels and waits for the active native writer before deleting models", async () => {
    const fileSystem = new FakeFileSystem();
    let finishWriter!: () => void;
    const writerTerminal = new Promise<void>((resolveWriter) => {
      finishWriter = resolveWriter;
    });
    const events: string[] = [];
    fileSystem.createDownload = (url, destinationUri) => {
      fileSystem.downloads.push({ url, destinationUri });
      return {
        download: async () => {
          fileSystem.files.set(destinationUri, 10);
          await writerTerminal;
          events.push("writer-terminal");
          return undefined;
        },
        pause: async () => ({ resumeData: "10" }),
        cancel: async () => void events.push("cancel")
      };
    };
    const originalDelete = fileSystem.delete.bind(fileSystem);
    fileSystem.delete = async (uri) => {
      if (uri === "file:///documents/models/") events.push("models-delete");
      await originalDelete(uri);
    };
    const store = createModelStore({
      fileSystem,
      hasher: { hashFile: async () => installable.sha256! }
    });
    const downloading = store.downloadModel(installable);
    while (fileSystem.downloads.length === 0) await Promise.resolve();

    let removeSettled = false;
    const removing = store.removeAllModels().finally(() => {
      removeSettled = true;
    });
    await Promise.resolve();
    expect(removeSettled).toBe(false);
    expect(events).not.toContain("models-delete");

    finishWriter();
    await expect(downloading).rejects.toMatchObject({ code: "download_cancelled" });
    await removing;
    expect(events).toEqual(["cancel", "writer-terminal", "models-delete"]);
  });

  test("enforces one installation operation at a time", async () => {
    const fileSystem = new FakeFileSystem();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    fileSystem.createDownload = (url, destinationUri) => {
      fileSystem.downloads.push({ url, destinationUri });
      return {
        download: async () => {
          await pending;
          fileSystem.files.set(destinationUri, installable.bytes!);
          return { uri: destinationUri, status: 200 };
        },
        pause: async () => ({ resumeData: "resume" }),
        cancel: async () => undefined
      };
    };
    const store = createModelStore({
      fileSystem,
      hasher: { hashFile: async () => installable.sha256! }
    });

    const first = store.downloadModel(installable);
    await Promise.resolve();
    await expect(store.downloadModel(installable)).rejects.toMatchObject({ code: "install_in_progress" });
    finish();
    await first;
  });
});

describe("Android ModelIntegrity module contract", () => {
  test("streams SHA-256 with FileInputStream and a fixed buffer", () => {
    const kotlinPath = resolve(
      process.cwd(),
      "apps/mobile/modules/model-integrity/android/src/main/java/expo/modules/modelintegrity/ModelIntegrityModule.kt"
    );
    const source = readFileSync(kotlinPath, "utf8");

    expect(source).toContain("FileInputStream");
    expect(source).toMatch(/ByteArray\(\d+\)/);
    expect(source).toContain("messageDigest.update(buffer, 0, bytesRead)");
    expect(source).not.toContain("readBytes(");
  });

  test("uses the same Android filesDir root as installed expo-file-system 19.0.23", () => {
    const kotlinPath = resolve(
      process.cwd(),
      "apps/mobile/modules/model-integrity/android/src/main/java/expo/modules/modelintegrity/ModelIntegrityModule.kt"
    );
    const expoDirectoriesPath = resolve(
      process.cwd(),
      "node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/AppDirectoriesModule.kt"
    );

    expect(readFileSync(kotlinPath, "utf8")).toContain("reactContext.filesDir.canonicalFile");
    expect(readFileSync(expoDirectoriesPath, "utf8")).toContain("get() = context.filesDir");
  });

  test("rejects models-root and child symlink escapes in native canonical validation", () => {
    const kotlinPath = resolve(
      process.cwd(),
      "apps/mobile/modules/model-integrity/android/src/main/java/expo/modules/modelintegrity/ModelIntegrityModule.kt"
    );
    const source = readFileSync(kotlinPath, "utf8");

    expect(source).toContain("File(reactContext.filesDir, \"models\")");
    expect(source).toContain("modelsRoot.absolutePath == canonicalModelsRoot.path");
    expect(source).toContain("artifact.path.startsWith(modelsPrefix)");
  });

  test("implements native backup, rollback, fsync, and post-verification replacement", () => {
    const kotlinPath = resolve(
      process.cwd(),
      "apps/mobile/modules/model-integrity/android/src/main/java/expo/modules/modelintegrity/ModelIntegrityModule.kt"
    );
    const source = readFileSync(kotlinPath, "utf8");

    expect(source).toContain("AsyncFunction(\"replaceVerified\")");
    expect(source).toContain(".backup");
    expect(source).toContain("Os.rename");
    expect(source).toContain("Os.fsync");
    expect(source).toContain("verifyArtifact(completed");
    expect(source).toContain("restoreBackup");
  });
});

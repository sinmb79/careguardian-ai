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
  readonly moved: Array<{ from: string; to: string }> = [];
  readonly downloads: Array<{ url: string; destinationUri: string; resumeData?: string }> = [];
  downloadError?: Error;
  downloadResult: { uri: string; status: number } | undefined;
  cancelDownload = false;
  downloadedBytes = installable.bytes!;
  deleteErrorFor?: string;
  ensureDirectoryError?: Error;
  moveError?: Error;

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

  async move(from: string, to: string): Promise<void> {
    this.moved.push({ from, to });
    if (this.moveError) throw this.moveError;
    const size = this.files.get(from);
    if (size === undefined) throw new Error("source missing");
    this.files.delete(from);
    this.files.set(to, size);
  }

  createDownload(
    url: string,
    destinationUri: string,
    _onProgress: (written: number, total: number) => void,
    resumeData?: string
  ): DownloadHandle {
    this.downloads.push({ url, destinationUri, resumeData });
    return {
      download: async () => {
        if (this.downloadError) throw this.downloadError;
        if (this.cancelDownload) return undefined;
        if (this.downloadResult === undefined) {
          this.files.set(destinationUri, this.downloadedBytes);
          return { uri: destinationUri, status: 200 };
        }
        return this.downloadResult;
      },
        pause: async () => ({ resumeData: "123" }),
      cancel: async () => undefined
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
    expect(fileSystem.moved).toEqual([{
      from: expect.stringMatching(/\.partial$/),
      to: expect.stringMatching(new RegExp(`${installable.revision}\\.gguf$`))
    }]);
    expect(installed).toMatchObject({
      modelId: installable.id,
      bytes: installable.bytes,
      sha256: installable.sha256
    });
    expect(states).toEqual(["downloading", "verifying", "ready"]);
  });

  test("passes an opaque pause token only when resuming an existing partial file", async () => {
    const { store, fileSystem } = createReadyStore();
    const partialUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;
    fileSystem.files.set(partialUri, 123);

    await store.downloadModel(installable, { resumeData: "123" });

    expect(fileSystem.downloads[0]?.resumeData).toBe("123");
  });

  test("rejects resume metadata that does not match the partial byte length", async () => {
    const { store, fileSystem } = createReadyStore();
    const partialUri =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;
    fileSystem.files.set(partialUri, 123);

    await expect(store.downloadModel(installable, { resumeData: "122" }))
      .rejects.toMatchObject({ code: "resume_state_invalid" });
    expect(fileSystem.downloads).toEqual([]);
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
      resumeData: "321"
    });
    expect(states).toEqual(["downloading", "paused"]);
    expect(fileSystem.files.has(paused.partialUri)).toBe(true);
  });

  test("rejects resume metadata when its partial file is missing", async () => {
    const { store, fileSystem } = createReadyStore();

    await expect(store.downloadModel(installable, { resumeData: "stale-token" }))
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
    expect(fileSystem.moved).toEqual([]);
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
    rename.fileSystem.moveError = new Error("rename denied");
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

  test("reports cleanup failure instead of hiding it", async () => {
    const { store, fileSystem } = createReadyStore();
    fileSystem.downloadedBytes = installable.bytes! - 1;
    fileSystem.deleteErrorFor =
      `file:///documents/models/${installable.id}/${installable.revision}.gguf.partial`;

    fileSystem.files.set(fileSystem.deleteErrorFor, 1);
    await expect(store.downloadModel(installable, { resumeData: "1" })).rejects.toMatchObject({
      code: "cleanup_failed",
      cause: expect.any(ModelStoreError)
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
});

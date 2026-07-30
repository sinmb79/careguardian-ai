import { describe, expect, test, vi } from "vitest";
import { getInstallableModels } from "./modelRegistry";
import {
  createModelStore,
  type DownloadHandle,
  type ModelFileSystem
} from "./modelStore";

class InspectionFileSystem implements ModelFileSystem {
  readonly documentDirectory = "file:///documents/";
  readonly files = new Map<string, number>();
  readonly asserted: string[] = [];

  async assertModelPath(uri: string) {
    this.asserted.push(uri);
  }
  async ensureDirectory() {}
  async getFileInfo(uri: string) {
    return this.files.has(uri)
      ? { exists: true, size: this.files.get(uri) }
      : { exists: false };
  }
  async delete(uri: string) {
    this.files.delete(uri);
  }
  async replaceVerified() {}
  createDownload(): DownloadHandle {
    throw new Error("not used");
  }
}

function completedUri(modelId: string, revision: string) {
  return `file:///documents/models/${modelId}/${revision}.gguf`;
}

describe("installed model inspection", () => {
  test("discovers only registry models and re-hashes every completed file after restart", async () => {
    const fileSystem = new InspectionFileSystem();
    const models = getInstallableModels();
    const first = models[0];
    fileSystem.files.set(completedUri(first.id, first.revision), first.bytes!);
    const hashFile = vi.fn(async () => first.sha256!);
    const store = createModelStore({ fileSystem, hasher: { hashFile } });

    const statuses = await store.inspectInstalledModels();

    expect(statuses).toEqual([
      {
        kind: "ready",
        installed: {
          modelId: first.id,
          revision: first.revision,
          uri: completedUri(first.id, first.revision),
          bytes: first.bytes,
          sha256: first.sha256
        }
      },
      { kind: "notInstalled", modelId: models[1].id }
    ]);
    expect(hashFile).toHaveBeenCalledOnce();
    expect(fileSystem.asserted).toContain(completedUri(first.id, first.revision));
  });

  test("reports size and hash corruption without deleting or exposing a ready model", async () => {
    const model = getInstallableModels()[0];
    const uri = completedUri(model.id, model.revision);

    const wrongSizeFileSystem = new InspectionFileSystem();
    wrongSizeFileSystem.files.set(uri, model.bytes! - 1);
    const sizeHasher = vi.fn(async () => model.sha256!);
    const sizeStore = createModelStore({
      fileSystem: wrongSizeFileSystem,
      hasher: { hashFile: sizeHasher }
    });
    await expect(sizeStore.inspectInstalledModels()).resolves.toContainEqual({
      kind: "invalid",
      modelId: model.id,
      code: "size_mismatch"
    });
    expect(sizeHasher).not.toHaveBeenCalled();
    expect(wrongSizeFileSystem.files.has(uri)).toBe(true);

    const wrongHashFileSystem = new InspectionFileSystem();
    wrongHashFileSystem.files.set(uri, model.bytes!);
    const hashStore = createModelStore({
      fileSystem: wrongHashFileSystem,
      hasher: { hashFile: async () => "0".repeat(64) }
    });
    await expect(hashStore.inspectInstalledModels()).resolves.toContainEqual({
      kind: "invalid",
      modelId: model.id,
      code: "sha256_mismatch"
    });
    expect(wrongHashFileSystem.files.has(uri)).toBe(true);
  });

  test("freshly checks size and streaming SHA immediately before runtime load", async () => {
    const model = getInstallableModels()[0];
    const uri = completedUri(model.id, model.revision);
    const fileSystem = new InspectionFileSystem();
    fileSystem.files.set(uri, model.bytes!);
    const hashFile = vi.fn(async () => model.sha256!);
    const store = createModelStore({ fileSystem, hasher: { hashFile } });
    const installed = {
      modelId: model.id,
      revision: model.revision,
      uri,
      bytes: model.bytes!,
      sha256: model.sha256!
    };

    await expect(store.verifyInstalledModelForRuntime(installed)).resolves.toBe(model);
    expect(hashFile).toHaveBeenCalledWith(uri);

    fileSystem.files.set(uri, model.bytes! - 8);
    await expect(store.verifyInstalledModelForRuntime(installed)).rejects.toMatchObject({
      code: "size_mismatch"
    });
  });

  test("rejects missing, stale, or path-tampered runtime candidates before native hashing", async () => {
    const model = getInstallableModels()[0];
    const expectedUri = completedUri(model.id, model.revision);
    const fileSystem = new InspectionFileSystem();
    const hashFile = vi.fn(async () => model.sha256!);
    const store = createModelStore({ fileSystem, hasher: { hashFile } });
    const installed = {
      modelId: model.id,
      revision: model.revision,
      uri: expectedUri,
      bytes: model.bytes!,
      sha256: model.sha256!
    };

    await expect(store.verifyInstalledModelForRuntime(installed)).rejects.toMatchObject({
      code: "model_not_installed"
    });
    await expect(
      store.verifyInstalledModelForRuntime({
        ...installed,
        uri: "file:///sdcard/arbitrary.gguf"
      })
    ).rejects.toMatchObject({ code: "registry_not_allowlisted" });
    await expect(
      store.verifyInstalledModelForRuntime({
        ...installed,
        revision: "0".repeat(40)
      })
    ).rejects.toMatchObject({ code: "registry_not_allowlisted" });
    expect(hashFile).not.toHaveBeenCalled();
  });
});

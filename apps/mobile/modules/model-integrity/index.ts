import { requireOptionalNativeModule } from "expo";

interface ModelIntegrityNativeModule {
  sha256(uri: string): Promise<string>;
  assertModelPath(uri: string): Promise<void>;
  replaceVerified(
    partialUri: string,
    completedUri: string,
    expectedBytes: number,
    expectedSha256: string
  ): Promise<void>;
}

const nativeModule =
  requireOptionalNativeModule<ModelIntegrityNativeModule>("ModelIntegrity");

export function isModelIntegrityAvailable(): boolean {
  return nativeModule !== null;
}

export async function hashFileSha256(uri: string): Promise<string> {
  if (!nativeModule) {
    const error = new Error("ModelIntegrity native module is unavailable");
    error.name = "ModelIntegrityUnavailableError";
    throw error;
  }
  return nativeModule.sha256(uri);
}

function requireNativeModule(): ModelIntegrityNativeModule {
  if (!nativeModule) {
    const error = new Error("ModelIntegrity native module is unavailable");
    error.name = "ModelIntegrityUnavailableError";
    throw error;
  }
  return nativeModule;
}

export async function assertModelPath(uri: string): Promise<void> {
  await requireNativeModule().assertModelPath(uri);
}

export async function replaceVerified(
  partialUri: string,
  completedUri: string,
  expectedBytes: number,
  expectedSha256: string
): Promise<void> {
  await requireNativeModule().replaceVerified(
    partialUri,
    completedUri,
    expectedBytes,
    expectedSha256
  );
}

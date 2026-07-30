import { requireOptionalNativeModule } from "expo";

interface ModelIntegrityNativeModule {
  sha256(uri: string): Promise<string>;
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

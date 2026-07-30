import modelRegistryData from "./model-registry.json";

export type ModelAvailability = "installable" | "blocked_no_approved_gguf";

export interface ModelLicenseAsset {
  id: "license" | "notice" | "prohibited-use-policy";
  path: string;
  sourceUrls: readonly string[];
}

export interface ModelArtifact {
  id: string;
  provider: "NAVER" | "Kakao";
  displayName: string;
  availability: ModelAvailability;
  repository: string;
  revision: string;
  licenseName: string;
  licenseAssets: readonly ModelLicenseAsset[];
  attribution: string;
  minimumRamGb: number;
  appDefaultContextTokens: number;
  officialModelContextTokens: number;
  artifactFileName?: string;
  downloadUrl?: string;
  bytes?: number;
  sha256?: string;
}

const BASE_MODEL_KEYS = [
  "appDefaultContextTokens",
  "attribution",
  "availability",
  "displayName",
  "id",
  "licenseAssets",
  "licenseName",
  "minimumRamGb",
  "officialModelContextTokens",
  "provider",
  "repository",
  "revision"
] as const;
const INSTALLABLE_MODEL_KEYS = [
  ...BASE_MODEL_KEYS,
  "artifactFileName",
  "bytes",
  "downloadUrl",
  "sha256"
] as const;
const LICENSE_ASSET_KEYS = ["id", "path", "sourceUrls"] as const;
const INSTALLABLE_DOWNLOAD_URL =
  /^https:\/\/huggingface\.co\/([^/?#]+\/[^/?#]+)\/resolve\/([a-f0-9]{40})\/([^/?#]+\.gguf)\?download=true$/;
const LICENSE_SOURCE_URL =
  /^https:\/\/huggingface\.co\/[^/?#]+\/[^/?#]+\/resolve\/[a-f0-9]{40}\/LICENSE(?:#section-\d+)?$/;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(input).sort().join("\0") === [...keys].sort().join("\0");
}

function isPositiveInteger(input: unknown): input is number {
  return typeof input === "number" && Number.isSafeInteger(input) && input > 0;
}

function hasSafeRepository(repository: string): boolean {
  const segments = repository.split("/");
  const safeSegment = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/;
  return segments.length === 2 && segments.every((segment) => safeSegment.test(segment));
}

function hasSafeArtifactFileName(artifactFileName: string): boolean {
  return (
    /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?\.gguf$/.test(artifactFileName) &&
    !artifactFileName.includes("..")
  );
}

function hasSafeModelId(modelId: string): boolean {
  return (
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(modelId) &&
    modelId !== "." &&
    modelId !== ".." &&
    !modelId.includes("..")
  );
}

function validateLicenseAssets(modelId: string, input: unknown): asserts input is readonly ModelLicenseAsset[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${modelId}: attribution and license assets are required`);
  }
  const seen = new Set<string>();
  for (const asset of input) {
    if (!isPlainObject(asset) || !hasExactKeys(asset, LICENSE_ASSET_KEYS)) {
      throw new Error(`${modelId}: license asset schema is not exact`);
    }
    if (
      !["license", "notice", "prohibited-use-policy"].includes(String(asset.id)) ||
      seen.has(String(asset.id)) ||
      typeof asset.path !== "string" ||
      !/^assets\/model-licenses\/[A-Za-z0-9._/-]+\.txt$/.test(asset.path) ||
      !Array.isArray(asset.sourceUrls) ||
      asset.sourceUrls.length === 0 ||
      !asset.sourceUrls.every((url) => typeof url === "string" && LICENSE_SOURCE_URL.test(url))
    ) {
      throw new Error(`${modelId}: license asset values are unsafe`);
    }
    seen.add(String(asset.id));
  }
}

/** Validates exact runtime shape before any registry entry can be consumed. */
export function validateModelRegistry(registry: unknown): asserts registry is readonly ModelArtifact[] {
  if (!Array.isArray(registry)) throw new Error("model registry must be an array");
  const seenIds = new Set<string>();

  for (const candidate of registry) {
    if (!isPlainObject(candidate)) throw new Error("model registry entries must be objects");
    const availability = candidate.availability;
    if (
      availability === "blocked_no_approved_gguf" &&
      ["artifactFileName", "bytes", "downloadUrl", "sha256"].some((key) => key in candidate)
    ) {
      throw new Error(`${String(candidate.id)}: blocked model cannot expose an unapproved download artifact`);
    }
    const expectedKeys = availability === "installable" ? INSTALLABLE_MODEL_KEYS : BASE_MODEL_KEYS;
    if (!hasExactKeys(candidate, expectedKeys)) {
      throw new Error(`${String(candidate.id)}: model schema keys are not exact`);
    }
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.displayName !== "string" ||
      typeof candidate.repository !== "string" ||
      typeof candidate.revision !== "string" ||
      typeof candidate.licenseName !== "string" ||
      typeof candidate.attribution !== "string"
    ) {
      throw new Error("model registry string fields are required");
    }
    if (!hasSafeModelId(candidate.id)) {
      throw new Error(`${candidate.id}: model ID must be one safe lowercase ASCII path segment`);
    }
    if (seenIds.has(candidate.id)) throw new Error(`${candidate.id}: duplicate model ID is not allowed`);
    seenIds.add(candidate.id);
    if (candidate.provider !== "NAVER" && candidate.provider !== "Kakao") {
      throw new Error(`${candidate.id}: provider is not approved`);
    }
    if (availability !== "installable" && availability !== "blocked_no_approved_gguf") {
      throw new Error(`${candidate.id}: availability is not approved`);
    }
    if (!hasSafeRepository(candidate.repository)) {
      throw new Error(`${candidate.id}: repository must use owner/repository format`);
    }
    if (!/^[a-f0-9]{40}$/.test(candidate.revision)) {
      throw new Error(`${candidate.id}: revision must be a 40-character lowercase commit SHA`);
    }
    if (
      !isPositiveInteger(candidate.minimumRamGb) ||
      !isPositiveInteger(candidate.appDefaultContextTokens) ||
      !isPositiveInteger(candidate.officialModelContextTokens)
    ) {
      throw new Error(`${candidate.id}: positive RAM and context values are required`);
    }
    if (candidate.appDefaultContextTokens > candidate.officialModelContextTokens) {
      throw new Error(`${candidate.id}: app default context cannot exceed official context`);
    }
    if (!candidate.attribution) throw new Error(`${candidate.id}: attribution is required`);
    validateLicenseAssets(candidate.id, candidate.licenseAssets);

    if (availability === "installable") {
      if (
        typeof candidate.artifactFileName !== "string" ||
        !hasSafeArtifactFileName(candidate.artifactFileName)
      ) {
        throw new Error(`${candidate.id}: installable artifact must be a single GGUF file name`);
      }
      if (typeof candidate.downloadUrl !== "string") {
        throw new Error(`${candidate.id}: installable download URL is required`);
      }
      const match = INSTALLABLE_DOWNLOAD_URL.exec(candidate.downloadUrl);
      if (
        !match ||
        match[1] !== candidate.repository ||
        match[2] !== candidate.revision ||
        match[3] !== candidate.artifactFileName
      ) {
        throw new Error(`${candidate.id}: installable download URL must exactly match repository, revision, and file`);
      }
      if (!isPositiveInteger(candidate.bytes)) {
        throw new Error(`${candidate.id}: installable byte size must be a positive safe integer`);
      }
      if (typeof candidate.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(candidate.sha256)) {
        throw new Error(`${candidate.id}: installable SHA-256 must be 64 lowercase hex characters`);
      }
    }
  }
}

function deepFreeze<T>(input: T): T {
  if (typeof input === "object" && input !== null && !Object.isFrozen(input)) {
    for (const value of Object.values(input)) deepFreeze(value);
    Object.freeze(input);
  }
  return input;
}

function assertDeepFrozen(input: unknown, seen = new Set<object>()): void {
  if (typeof input !== "object" || input === null || seen.has(input)) return;
  if (!Object.isFrozen(input)) throw new Error("model registry must be deeply frozen");
  seen.add(input);
  for (const value of Object.values(input)) assertDeepFrozen(value, seen);
}

const validatedRegistryData: unknown = modelRegistryData;
validateModelRegistry(validatedRegistryData);

export const MODEL_REGISTRY: readonly ModelArtifact[] = deepFreeze(validatedRegistryData);
assertDeepFrozen(MODEL_REGISTRY);
const INSTALLABLE_MODELS: readonly ModelArtifact[] = Object.freeze(
  MODEL_REGISTRY.filter((model) => model.availability === "installable")
);
assertDeepFrozen(INSTALLABLE_MODELS);

export function getInstallableModels(): readonly ModelArtifact[] {
  return INSTALLABLE_MODELS;
}

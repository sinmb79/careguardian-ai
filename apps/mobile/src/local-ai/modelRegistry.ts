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
  /** Present only for supply-chain-approved, installable artifacts. */
  artifactFileName?: string;
  downloadUrl?: string;
  bytes?: number;
  sha256?: string;
}

const HYPERCLOVAX_LICENSE_ASSETS = [
  {
    id: "license",
    path: "assets/model-licenses/hyperclovax-seed/LICENSE.txt",
    sourceUrls: [
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B/resolve/3da5046fb0195d14f2497de198136987d35fd644/LICENSE",
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B/resolve/0728a47d632019a8da5f53b663db1c175dc04115/LICENSE"
    ]
  },
  {
    id: "notice",
    path: "assets/model-licenses/hyperclovax-seed/NOTICE.txt",
    sourceUrls: [
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B/resolve/3da5046fb0195d14f2497de198136987d35fd644/LICENSE#section-31",
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B/resolve/0728a47d632019a8da5f53b663db1c175dc04115/LICENSE#section-31"
    ]
  },
  {
    id: "prohibited-use-policy",
    path: "assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt",
    sourceUrls: [
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B/resolve/3da5046fb0195d14f2497de198136987d35fd644/LICENSE#section-23",
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B/resolve/0728a47d632019a8da5f53b663db1c175dc04115/LICENSE#section-23"
    ]
  }
] as const satisfies readonly ModelLicenseAsset[];

const APACHE_2_LICENSE_ASSETS = [
  {
    id: "license",
    path: "assets/model-licenses/apache-2.0/LICENSE.txt",
    sourceUrls: [
      "https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505/resolve/7df4bc35ccd610e451809d7106e1c3cf82bfd44c/LICENSE"
    ]
  }
] as const satisfies readonly ModelLicenseAsset[];

export const MODEL_REGISTRY: readonly ModelArtifact[] = [
  {
    id: "hyperclovax-seed-text-instruct-0.5b-q4km",
    provider: "NAVER",
    displayName: "HyperCLOVA X SEED Text Instruct 0.5B Q4_K_M",
    availability: "installable",
    repository: "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF",
    revision: "27831169fdebe6fe30bb1b9d76b12a2d06693f26",
    artifactFileName: "HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF/resolve/27831169fdebe6fe30bb1b9d76b12a2d06693f26/HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf?download=true",
    bytes: 431882784,
    sha256: "bc6a93b452648e8e90b06dc04f81edbdce9703fa76bdf589a63cc8418699d44f",
    licenseName: "HyperCLOVA X SEED Model License Agreement",
    licenseAssets: HYPERCLOVAX_LICENSE_ASSETS,
    attribution: "Powered by HyperCLOVA X",
    minimumRamGb: 4,
    appDefaultContextTokens: 2048,
    officialModelContextTokens: 8192
  },
  {
    id: "hyperclovax-seed-text-instruct-1.5b-q4km",
    provider: "NAVER",
    displayName: "HyperCLOVA X SEED Text Instruct 1.5B Q4_K_M",
    availability: "installable",
    repository: "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF",
    revision: "b9bbb68d6635a8b80263bf7165c8b908d64f28de",
    artifactFileName: "HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf",
    downloadUrl:
      "https://huggingface.co/naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF/resolve/b9bbb68d6635a8b80263bf7165c8b908d64f28de/HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf?download=true",
    bytes: 1006572160,
    sha256: "6e0841f886f55411327d4659308f2408424f0ac55a2d32f60a49f470c71381a6",
    licenseName: "HyperCLOVA X SEED Model License Agreement",
    licenseAssets: HYPERCLOVAX_LICENSE_ASSETS,
    attribution: "Powered by HyperCLOVA X",
    minimumRamGb: 6,
    appDefaultContextTokens: 4096,
    officialModelContextTokens: 131072
  },
  {
    id: "kanana-1.5-2.1b-instruct",
    provider: "Kakao",
    displayName: "Kanana 1.5 2.1B Instruct",
    availability: "blocked_no_approved_gguf",
    repository: "kakaocorp/kanana-1.5-2.1b-instruct-2505",
    revision: "7df4bc35ccd610e451809d7106e1c3cf82bfd44c",
    licenseName: "Apache License 2.0",
    licenseAssets: APACHE_2_LICENSE_ASSETS,
    attribution: "Kanana 1.5 by Kakao",
    minimumRamGb: 6,
    appDefaultContextTokens: 4096,
    officialModelContextTokens: 32768
  }
] as const;

function isImmutableHuggingFaceUrl(url: string, revision: string): boolean {
  return new RegExp(
    `^https://huggingface\\.co/[^/]+/[^/]+/resolve/${revision}/[^?#]+\\?download=true$`
  ).test(url);
}

/** Throws when an artifact is unsafe to present as an installable download. */
export function validateModelRegistry(registry: readonly ModelArtifact[]): void {
  for (const model of registry) {
    if (!Number.isInteger(model.minimumRamGb) || model.minimumRamGb <= 0) {
      throw new Error(`${model.id}: a positive minimum RAM value is required`);
    }
    if (
      !Number.isInteger(model.appDefaultContextTokens) ||
      !Number.isInteger(model.officialModelContextTokens) ||
      model.appDefaultContextTokens <= 0 ||
      model.officialModelContextTokens <= 0
    ) {
      throw new Error(`${model.id}: app and official context values are required`);
    }
    if (!model.attribution || model.licenseAssets.length === 0) {
      throw new Error(`${model.id}: attribution and license assets are required`);
    }
    if (model.availability === "installable") {
      if (!model.downloadUrl || !isImmutableHuggingFaceUrl(model.downloadUrl, model.revision)) {
        throw new Error(`${model.id}: installable download URL must be immutable HTTPS`);
      }
      if (!model.artifactFileName || !model.bytes || model.bytes <= 0) {
        throw new Error(`${model.id}: installable artifact file name and byte size are required`);
      }
      if (!model.sha256 || !/^[a-f0-9]{64}$/.test(model.sha256)) {
        throw new Error(`${model.id}: installable SHA-256 must be 64 lowercase hex characters`);
      }
      continue;
    }
    if (model.downloadUrl || model.artifactFileName || model.bytes || model.sha256) {
      throw new Error(`${model.id}: blocked model cannot expose an unapproved download artifact`);
    }
  }
}

validateModelRegistry(MODEL_REGISTRY);

export function getInstallableModels(): readonly ModelArtifact[] {
  return MODEL_REGISTRY.filter((model) => model.availability === "installable");
}

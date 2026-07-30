import { MODEL_REGISTRY, type ModelLicenseAsset } from "../local-ai/modelRegistry";

export type LicenseAssetModuleKey =
  | "hyperclovax-license"
  | "hyperclovax-notice"
  | "hyperclovax-prohibited-use-policy"
  | "apache-2.0-license";

export interface BundledLicenseAsset extends ModelLicenseAsset {
  moduleKey: LicenseAssetModuleKey;
  /** Deferred so Vitest never executes the source-text require. */
  moduleLoader: () => number;
}

export interface ExpoAssetLike {
  uri: string;
  localUri: string | null;
  downloadAsync: () => Promise<DownloadedExpoAssetLike>;
}

export interface DownloadedExpoAssetLike {
  uri: string;
  localUri: string | null;
}

export interface ExpoAssetFactory {
  fromModule: (moduleId: number) => ExpoAssetLike;
}

/** Literal paths let Metro discover and bundle every offline license text asset. */
function getBundledLicenseAssetModule(key: LicenseAssetModuleKey): number {
  switch (key) {
    case "hyperclovax-license":
      return require("../../assets/model-licenses/hyperclovax-seed/LICENSE.txt");
    case "hyperclovax-notice":
      return require("../../assets/model-licenses/hyperclovax-seed/NOTICE.txt");
    case "hyperclovax-prohibited-use-policy":
      return require("../../assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt");
    case "apache-2.0-license":
      return require("../../assets/model-licenses/apache-2.0/LICENSE.txt");
  }
}

function getLicenseAssetModuleKey(path: string): LicenseAssetModuleKey {
  switch (path) {
    case "assets/model-licenses/hyperclovax-seed/LICENSE.txt":
      return "hyperclovax-license";
    case "assets/model-licenses/hyperclovax-seed/NOTICE.txt":
      return "hyperclovax-notice";
    case "assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt":
      return "hyperclovax-prohibited-use-policy";
    case "assets/model-licenses/apache-2.0/LICENSE.txt":
      return "apache-2.0-license";
    default:
      throw new Error(`No bundled Metro asset loader registered for ${path}`);
  }
}

function createBundledLicenseAsset(asset: ModelLicenseAsset): BundledLicenseAsset {
  const moduleKey = getLicenseAssetModuleKey(asset.path);
  return {
    ...asset,
    moduleKey,
    moduleLoader: () => getBundledLicenseAssetModule(moduleKey)
  };
}

function getExpoAssetFactory(): ExpoAssetFactory {
  return require("expo-asset").Asset as ExpoAssetFactory;
}

/** Downloads a bundled asset if needed, then returns its device-local URI for offline display. */
export async function getOfflineLicenseAssetUri(
  asset: BundledLicenseAsset,
  assetFactory: ExpoAssetFactory = getExpoAssetFactory()
): Promise<string> {
  const downloadedAsset = await assetFactory.fromModule(asset.moduleLoader()).downloadAsync();
  return downloadedAsset.localUri ?? downloadedAsset.uri;
}

export interface ThirdPartyModelNotice {
  provider: "NAVER" | "Kakao";
  modelId: string;
  licenseName: string;
  licenseAssets: readonly BundledLicenseAsset[];
  poweredBy?: "Powered by HyperCLOVA X";
  requiresLicenseAcceptance: boolean;
  prohibitedUsePolicyIncluded: boolean;
  additionalCommercialLicenseGate?: "10M_MAU_OR_DIRECT_COMPETITOR";
}

export function getThirdPartyModelNotice(modelId: string): ThirdPartyModelNotice | undefined {
  const model = MODEL_REGISTRY.find((candidate) => candidate.id === modelId);
  if (!model) return undefined;

  if (model.provider === "NAVER") {
    return {
      provider: "NAVER",
      modelId: model.id,
      licenseName: model.licenseName,
      licenseAssets: model.licenseAssets.map(createBundledLicenseAsset),
      poweredBy: "Powered by HyperCLOVA X",
      requiresLicenseAcceptance: true,
      prohibitedUsePolicyIncluded: true,
      additionalCommercialLicenseGate: "10M_MAU_OR_DIRECT_COMPETITOR"
    };
  }

  return {
    provider: "Kakao",
    modelId: model.id,
    licenseName: model.licenseName,
    licenseAssets: model.licenseAssets.map(createBundledLicenseAsset),
    requiresLicenseAcceptance: false,
    prohibitedUsePolicyIncluded: false
  };
}

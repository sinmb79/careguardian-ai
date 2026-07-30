import { MODEL_REGISTRY, type ModelLicenseAsset } from "../local-ai/modelRegistry";

export interface ThirdPartyModelNotice {
  provider: "NAVER" | "Kakao";
  modelId: string;
  licenseName: string;
  licenseAssets: readonly ModelLicenseAsset[];
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
      licenseAssets: model.licenseAssets,
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
    licenseAssets: model.licenseAssets,
    requiresLicenseAcceptance: false,
    prohibitedUsePolicyIncluded: false
  };
}

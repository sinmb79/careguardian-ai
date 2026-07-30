import { describe, expect, test } from "vitest";

import {
  getInstallableModels,
  MODEL_REGISTRY,
  validateModelRegistry
} from "./modelRegistry";
import { getThirdPartyModelNotice } from "../legal/thirdPartyModels";

describe("MODEL_REGISTRY", () => {
  test("pins the approved 0.5B GGUF artifact to its immutable supply-chain identity", () => {
    const model = MODEL_REGISTRY.find(
      (candidate) => candidate.id === "hyperclovax-seed-text-instruct-0.5b-q4km"
    );

    expect(model).toMatchObject({
      revision: "27831169fdebe6fe30bb1b9d76b12a2d06693f26",
      bytes: 431882784,
      sha256: "bc6a93b452648e8e90b06dc04f81edbdce9703fa76bdf589a63cc8418699d44f",
      availability: "installable"
    });
    expect(model?.downloadUrl).toBe(
      "https://huggingface.co/naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF/resolve/27831169fdebe6fe30bb1b9d76b12a2d06693f26/HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf?download=true"
    );
  });

  test("keeps the Kakao candidate visible but non-downloadable until an approved GGUF exists", () => {
    const model = MODEL_REGISTRY.find((candidate) => candidate.provider === "Kakao");

    expect(model?.availability).toBe("blocked_no_approved_gguf");
    expect(model).not.toHaveProperty("downloadUrl");
    expect(model).not.toHaveProperty("sha256");
    expect(model).not.toHaveProperty("bytes");
  });

  test("returns only artifacts that can actually be installed", () => {
    expect(getInstallableModels().map((model) => model.id)).toEqual([
      "hyperclovax-seed-text-instruct-0.5b-q4km",
      "hyperclovax-seed-text-instruct-1.5b-q4km"
    ]);
  });

  test("enforces immutable download, integrity, license, attribution, RAM, and context requirements", () => {
    expect(() => validateModelRegistry(MODEL_REGISTRY)).not.toThrow();
    expect(() =>
      validateModelRegistry([
        {
          ...MODEL_REGISTRY[0],
          downloadUrl:
            "https://huggingface.co/naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF/resolve/main/model.gguf?download=true"
        }
      ])
    ).toThrow(/immutable/i);
  });
});

describe("getThirdPartyModelNotice", () => {
  test("makes the required HyperCLOVA X attribution and offline license assets available", () => {
    const notice = getThirdPartyModelNotice("hyperclovax-seed-text-instruct-1.5b-q4km");

    expect(notice).toMatchObject({
      provider: "NAVER",
      poweredBy: "Powered by HyperCLOVA X",
      requiresLicenseAcceptance: true,
      additionalCommercialLicenseGate: "10M_MAU_OR_DIRECT_COMPETITOR"
    });
    expect(notice?.licenseAssets.map((asset) => asset.path)).toEqual([
      "assets/model-licenses/hyperclovax-seed/LICENSE.txt",
      "assets/model-licenses/hyperclovax-seed/NOTICE.txt",
      "assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt"
    ]);
  });
});

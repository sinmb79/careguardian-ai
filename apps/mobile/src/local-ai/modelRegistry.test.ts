import { describe, expect, test } from "vitest";

import {
  getInstallableModels,
  MODEL_REGISTRY,
  validateModelRegistry
} from "./modelRegistry";
import {
  getOfflineLicenseAssetUri,
  getThirdPartyModelNotice
} from "../legal/thirdPartyModels";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

function expectedDownloadUrl(repository: string, revision: string, artifactFileName: string): string {
  return `https://huggingface.co/${repository}/resolve/${revision}/${artifactFileName}?download=true`;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested, seen);
}

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

  test("deep-freezes every exported registry object and nested array at runtime", () => {
    const originalUrl = MODEL_REGISTRY[0].downloadUrl;
    const originalSourceUrls = [...MODEL_REGISTRY[0].licenseAssets[0].sourceUrls];

    expectDeepFrozen(MODEL_REGISTRY);
    expectDeepFrozen(getInstallableModels());
    expect(() => {
      (MODEL_REGISTRY[0] as { downloadUrl?: string }).downloadUrl =
        "https://attacker.example/model.gguf";
    }).toThrow(TypeError);
    expect(() => {
      (MODEL_REGISTRY[0].licenseAssets[0].sourceUrls as string[]).push(
        "https://attacker.example/license"
      );
    }).toThrow(TypeError);
    expect(MODEL_REGISTRY[0].downloadUrl).toBe(originalUrl);
    expect(MODEL_REGISTRY[0].licenseAssets[0].sourceUrls).toEqual(originalSourceUrls);
  });

  test("rejects a mutable or non-commit revision", () => {
    expect(() => validateModelRegistry(MODEL_REGISTRY)).not.toThrow();
    expect(() =>
      validateModelRegistry([
        {
          ...MODEL_REGISTRY[0],
          revision: "main"
        }
      ])
    ).toThrow(/revision/i);
  });

  test("binds an installable URL exactly to its repository, revision, and file name", () => {
    const model = MODEL_REGISTRY[0];

    expect(() =>
      validateModelRegistry([
        {
          ...model,
          downloadUrl: model.downloadUrl?.replace(
            "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF",
            "different-owner/different-repo"
          )
        }
      ])
    ).toThrow(/download URL/i);
    expect(() =>
      validateModelRegistry([
        {
          ...model,
          artifactFileName: "different-file.gguf"
        }
      ])
    ).toThrow(/download URL/i);
  });

  test("rejects repository and filename URL normalization or control-character payloads", () => {
    const model = MODEL_REGISTRY[0];
    const unsafeRepositories = ["naver-ellm/..", "naver?x/repo", "naver#x/repo", "naver%2f/path"];
    const unsafeFileNames = ["../model.gguf", "model?.gguf", "model#.gguf", "model%2f.gguf"];

    for (const repository of unsafeRepositories) {
      expect(() =>
        validateModelRegistry([
          {
            ...model,
            repository,
            downloadUrl: expectedDownloadUrl(repository, model.revision, model.artifactFileName!)
          }
        ])
      ).toThrow(/repository/i);
    }
    for (const artifactFileName of unsafeFileNames) {
      expect(() =>
        validateModelRegistry([
          {
            ...model,
            artifactFileName,
            downloadUrl: expectedDownloadUrl(model.repository, model.revision, artifactFileName)
          }
        ])
      ).toThrow(/artifact/i);
    }
  });

  test("requires a safe integer byte count and an app default context no larger than official context", () => {
    const model = MODEL_REGISTRY[0];

    expect(() => validateModelRegistry([{ ...model, bytes: 0.5 }])).toThrow(/byte/i);
    expect(() =>
      validateModelRegistry([
        {
          ...model,
          appDefaultContextTokens: model.officialModelContextTokens + 1
        }
      ])
    ).toThrow(/context/i);
  });

  test("rejects duplicate IDs and all blocked artifact fields even when empty or zero", () => {
    const model = MODEL_REGISTRY[0];
    const blocked = MODEL_REGISTRY.find(
      (candidate) => candidate.availability !== "installable"
    )!;

    expect(() => validateModelRegistry([model, { ...model }])).toThrow(/duplicate/i);
    expect(() => validateModelRegistry([{ ...blocked, downloadUrl: "" }])).toThrow(/blocked/i);
    expect(() => validateModelRegistry([{ ...blocked, bytes: 0 }])).toThrow(/blocked/i);
  });

  test("requires every model ID to be one safe ASCII path segment", () => {
    const model = MODEL_REGISTRY[0];
    const unsafeIds = [
      "../other-data",
      "folder/model",
      "folder\\model",
      "%2e%2e",
      "/absolute",
      "C:\\absolute",
      ".",
      "..",
      "model id"
    ];

    for (const id of unsafeIds) {
      expect(() => validateModelRegistry([{ ...model, id }])).toThrow(/model ID/i);
    }
  });
});

describe("getThirdPartyModelNotice", () => {
  test("maps every required notice asset to a deferred static Metro loader", () => {
    const notice = getThirdPartyModelNotice("hyperclovax-seed-text-instruct-1.5b-q4km");

    expect(notice).toMatchObject({
      provider: "NAVER",
      poweredBy: "Powered by HyperCLOVA X",
      requiresLicenseAcceptance: true,
      additionalCommercialLicenseGate: "10M_MAU_OR_DIRECT_COMPETITOR"
    });
    const kananaNotice = getThirdPartyModelNotice("kanana-1.5-2.1b-instruct");

    expect([
      ...(notice?.licenseAssets ?? []),
      ...(kananaNotice?.licenseAssets ?? [])
    ].map((asset) => [asset.path, asset.moduleKey])).toEqual([
      ["assets/model-licenses/hyperclovax-seed/LICENSE.txt", "hyperclovax-license"],
      ["assets/model-licenses/hyperclovax-seed/NOTICE.txt", "hyperclovax-notice"],
      [
        "assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt",
        "hyperclovax-prohibited-use-policy"
      ],
      ["assets/model-licenses/apache-2.0/LICENSE.txt", "apache-2.0-license"]
    ]);
    expect(
      [...(notice?.licenseAssets ?? []), ...(kananaNotice?.licenseAssets ?? [])].every(
        (asset) => typeof asset.moduleLoader === "function"
      )
    ).toBe(true);
  });

  test("resolves a Metro asset module through an injected Expo-Asset compatible loader without executing txt requires in Vitest", async () => {
    const notice = getThirdPartyModelNotice("hyperclovax-seed-text-instruct-0.5b-q4km");
    const asset = notice?.licenseAssets[0];
    const moduleLoader = () => 73;

    await expect(
      getOfflineLicenseAssetUri({ ...asset!, moduleLoader }, {
        fromModule(moduleId) {
          expect(moduleId).toBe(73);
          return {
            uri: "asset://license",
            localUri: "file:///cached-license.txt",
            downloadAsync: async () => ({
              uri: "asset://license",
              localUri: "file:///cached-license.txt"
            })
          };
        }
      })
    ).resolves.toBe("file:///cached-license.txt");
  });

  test("fails closed when Expo Asset does not return a non-empty device-local URI", async () => {
    const asset = getThirdPartyModelNotice("hyperclovax-seed-text-instruct-0.5b-q4km")!
      .licenseAssets[0];
    const moduleLoader = () => 73;
    const factoryFor = (localUri: string | null, uri: string) => ({
      fromModule: () => ({
        uri,
        localUri,
        downloadAsync: async () => ({ uri, localUri })
      })
    });

    await expect(
      getOfflineLicenseAssetUri({ ...asset, moduleLoader }, factoryFor(null, "https://cdn.example/license.txt"))
    ).rejects.toThrow(/local/i);
    await expect(
      getOfflineLicenseAssetUri({ ...asset, moduleLoader }, factoryFor("", "asset://license"))
    ).rejects.toThrow(/local/i);
    await expect(
      getOfflineLicenseAssetUri(
        { ...asset, moduleLoader },
        factoryFor("https://cdn.example/license.txt", "asset://license")
      )
    ).rejects.toThrow(/local/i);
    await expect(
      getOfflineLicenseAssetUri({ ...asset, moduleLoader }, {
        fromModule: () => ({
          uri: "asset://license",
          localUri: null,
          downloadAsync: async () => {
            throw new Error("download failed");
          }
        })
      })
    ).rejects.toThrow("download failed");
  });

  test("registers txt exactly once in the live Metro resolver configuration", () => {
    const metroConfig = nodeRequire("../../metro.config.js");
    const textExtensions = metroConfig.resolver.assetExts.filter((extension: string) => extension === "txt");

    expect(textExtensions).toEqual(["txt"]);
  });
});

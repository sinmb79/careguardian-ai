import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const installable = [
  {
    id: "hyperclovax-seed-text-instruct-0.5b-q4km", provider: "NAVER",
    repository: "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF", revision: "27831169fdebe6fe30bb1b9d76b12a2d06693f26",
    artifactFileName: "HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf", bytes: "431882784",
    sha256: "bc6a93b452648e8e90b06dc04f81edbdce9703fa76bdf589a63cc8418699d44f", minimumRamGb: "4", appDefaultContextTokens: "2048"
  },
  {
    id: "hyperclovax-seed-text-instruct-1.5b-q4km", provider: "NAVER",
    repository: "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF", revision: "b9bbb68d6635a8b80263bf7165c8b908d64f28de",
    artifactFileName: "HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf", bytes: "1006572160",
    sha256: "6e0841f886f55411327d4659308f2408424f0ac55a2d32f60a49f470c71381a6", minimumRamGb: "6", appDefaultContextTokens: "4096"
  }
];
const licenseAssets = [
  "assets/model-licenses/hyperclovax-seed/LICENSE.txt", "assets/model-licenses/hyperclovax-seed/NOTICE.txt",
  "assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt", "assets/model-licenses/apache-2.0/LICENSE.txt"
];

function registryObjects(source) {
  const start = source.indexOf("export const MODEL_REGISTRY");
  if (start < 0) return [];
  const arrayStart = source.indexOf("[", start);
  const arrayEnd = source.indexOf("] as const;", arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) return [];
  const objects = [];
  for (let index = arrayStart + 1; index < arrayEnd; index += 1) {
    if (source[index] !== "{") continue;
    const objectStart = index;
    let depth = 0;
    for (; index < arrayEnd; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) { objects.push(source.slice(objectStart, index + 1).replace(/\r/g, "")); break; }
    }
  }
  return objects;
}

function field(object, name) {
  const match = object.match(new RegExp(`^    ${name}:\\s*(?:"([^"]+)"|(\\d+)|([A-Z_]+)),?$`, "m"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

export function validateRegistrySource(source, assetExists = () => true) {
  const problems = [];
  const objects = registryObjects(source);
  if (objects.length !== 3) problems.push(`expected exactly 3 registry objects, found ${objects.length}`);
  const byId = new Map(objects.map((object) => [field(object, "id"), object]));
  if (byId.size !== objects.length) problems.push("registry has a missing or duplicate object ID");
  const available = objects.filter((object) => field(object, "availability") === "installable");
  if (available.length !== installable.length) problems.push(`expected exactly ${installable.length} installable artifacts, found ${available.length}`);

  for (const expected of installable) {
    const object = byId.get(expected.id);
    if (!object) { problems.push(`approved model object missing: ${expected.id}`); continue; }
    for (const [name, value] of Object.entries(expected)) {
      if (field(object, name) !== value) problems.push(`${expected.id}: ${name} is not exact`);
    }
    const url = `https://huggingface.co/${expected.repository}/resolve/${expected.revision}/${expected.artifactFileName}?download=true`;
    if (field(object, "downloadUrl") !== url) problems.push(`${expected.id}: immutable download URL is not exact`);
    if (field(object, "availability") !== "installable") problems.push(`${expected.id}: approved artifact is not installable`);
    if (!object.includes("licenseAssets: HYPERCLOVAX_LICENSE_ASSETS") || !object.includes('attribution: "Powered by HyperCLOVA X"')) {
      problems.push(`${expected.id}: offline license attribution binding is absent`);
    }
  }
  for (const object of available) {
    if (!installable.some((expected) => expected.id === field(object, "id"))) problems.push(`unexpected installable artifact: ${field(object, "id")}`);
  }
  const blocked = byId.get("kanana-1.5-2.1b-instruct");
  if (!blocked || field(blocked, "availability") !== "blocked_no_approved_gguf") problems.push("Kakao artifact is not explicitly blocked");
  if (blocked && ["downloadUrl", "artifactFileName", "bytes", "sha256"].some((name) => field(blocked, name) !== undefined)) problems.push("blocked Kakao artifact exposes install fields");
  const urls = [...source.matchAll(/https:\/\/huggingface\.co\/[^"\s]+\/resolve\/[^"\s]+\.gguf\?download=true/g)].map((match) => match[0]);
  const expectedUrls = installable.map((model) => `https://huggingface.co/${model.repository}/resolve/${model.revision}/${model.artifactFileName}?download=true`).sort();
  if (JSON.stringify(urls.sort()) !== JSON.stringify(expectedUrls)) problems.push("registry contains an unexpected or missing GGUF download URL");
  if (/revision:\s*"(?:main|master|latest)"/i.test(source) || /\/resolve\/(?:main|master|latest)\//i.test(source)) problems.push("floating model revision is present");
  for (const asset of licenseAssets) if (!source.includes(asset) || !assetExists(asset)) problems.push(`offline license asset is missing: ${asset}`);
  return { gate: "model-registry", status: problems.length ? "fail" : "pass", installableModelIds: installable.map((model) => model.id), offlineLicenseAssets: licenseAssets, problems };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const source = readFileSync(resolve(root, "apps/mobile/src/local-ai/modelRegistry.ts"), "utf8");
  const report = validateRegistrySource(source, (asset) => existsSync(resolve(root, "apps/mobile", asset)));
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

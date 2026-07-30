import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
];
const APACHE_LICENSE_ASSETS = [
  {
    id: "license",
    path: "assets/model-licenses/apache-2.0/LICENSE.txt",
    sourceUrls: [
      "https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505/resolve/7df4bc35ccd610e451809d7106e1c3cf82bfd44c/LICENSE"
    ]
  }
];

export const APPROVED_MODEL_REGISTRY = [
  {
    id: "hyperclovax-seed-text-instruct-0.5b-q4km",
    provider: "NAVER",
    displayName: "HyperCLOVA X SEED Text Instruct 0.5B Q4_K_M",
    availability: "installable",
    repository: "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF",
    revision: "27831169fdebe6fe30bb1b9d76b12a2d06693f26",
    licenseName: "HyperCLOVA X SEED Model License Agreement",
    licenseAssets: HYPERCLOVAX_LICENSE_ASSETS,
    attribution: "Powered by HyperCLOVA X",
    minimumRamGb: 4,
    appDefaultContextTokens: 2048,
    officialModelContextTokens: 8192,
    artifactFileName: "HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf",
    downloadUrl: "https://huggingface.co/naver-ellm/HyperCLOVAX-SEED-Text-Instruct-0.5B-GGUF/resolve/27831169fdebe6fe30bb1b9d76b12a2d06693f26/HyperCLOVAX-SEED-Text-Instruct-0.5B-Q4_K_M.gguf?download=true",
    bytes: 431882784,
    sha256: "bc6a93b452648e8e90b06dc04f81edbdce9703fa76bdf589a63cc8418699d44f"
  },
  {
    id: "hyperclovax-seed-text-instruct-1.5b-q4km",
    provider: "NAVER",
    displayName: "HyperCLOVA X SEED Text Instruct 1.5B Q4_K_M",
    availability: "installable",
    repository: "naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF",
    revision: "b9bbb68d6635a8b80263bf7165c8b908d64f28de",
    licenseName: "HyperCLOVA X SEED Model License Agreement",
    licenseAssets: HYPERCLOVAX_LICENSE_ASSETS,
    attribution: "Powered by HyperCLOVA X",
    minimumRamGb: 6,
    appDefaultContextTokens: 4096,
    officialModelContextTokens: 131072,
    artifactFileName: "HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf",
    downloadUrl: "https://huggingface.co/naver-ellm/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF/resolve/b9bbb68d6635a8b80263bf7165c8b908d64f28de/HyperCLOVAX-SEED-Text-Instruct-1.5B-Q4_K_M.gguf?download=true",
    bytes: 1006572160,
    sha256: "6e0841f886f55411327d4659308f2408424f0ac55a2d32f60a49f470c71381a6"
  },
  {
    id: "kanana-1.5-2.1b-instruct",
    provider: "Kakao",
    displayName: "Kanana 1.5 2.1B Instruct",
    availability: "blocked_no_approved_gguf",
    repository: "kakaocorp/kanana-1.5-2.1b-instruct-2505",
    revision: "7df4bc35ccd610e451809d7106e1c3cf82bfd44c",
    licenseName: "Apache License 2.0",
    licenseAssets: APACHE_LICENSE_ASSETS,
    attribution: "Kanana 1.5 by Kakao",
    minimumRamGb: 6,
    appDefaultContextTokens: 4096,
    officialModelContextTokens: 32768
  }
];

const APPROVED_MODEL_REMOTE_URL_LIST = APPROVED_MODEL_REGISTRY.flatMap((model) => [
  ...model.licenseAssets.flatMap((asset) => asset.sourceUrls),
  ...("downloadUrl" in model ? [model.downloadUrl] : [])
]);
export const APPROVED_MODEL_REMOTE_URLS = new Set(APPROVED_MODEL_REMOTE_URL_LIST);

const OFFLINE_LICENSE_ASSETS = [
  "assets/model-licenses/hyperclovax-seed/LICENSE.txt",
  "assets/model-licenses/hyperclovax-seed/NOTICE.txt",
  "assets/model-licenses/hyperclovax-seed/PROHIBITED_USE_POLICY.txt",
  "assets/model-licenses/apache-2.0/LICENSE.txt"
];

function findDuplicateJsonKeys(source) {
  const sourceFile = ts.parseJsonText("model-registry.json", source);
  const duplicates = [];
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = ts.isStringLiteral(property.name) || ts.isIdentifier(property.name)
          ? property.name.text
          : property.name.getText(sourceFile);
        if (seen.has(name)) duplicates.push(name);
        seen.add(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return duplicates;
}

function parseRegistryJson(source, problems) {
  const duplicateKeys = findDuplicateJsonKeys(source);
  if (duplicateKeys.length) problems.push(`registry JSON has duplicate declarations: ${duplicateKeys.join(", ")}`);
  try {
    return JSON.parse(source);
  } catch (error) {
    problems.push(`registry is not strict JSON: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function isIdentifier(node, name) {
  return ts.isIdentifier(node) && node.text === name;
}

function isNamedCall(node, name) {
  return ts.isCallExpression(node) && isIdentifier(node.expression, name);
}

function collectNamedDeclarations(sourceFile, name) {
  const declarations = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && isIdentifier(node.name, name)) declarations.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

export function validateRegistryRuntimeSource(source) {
  const problems = [];
  const sourceFile = ts.createSourceFile("modelRegistry.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length) problems.push("model registry runtime TypeScript has parse errors");

  const registryImports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "./model-registry.json" &&
      statement.importClause?.name?.text === "modelRegistryData"
  );
  if (registryImports.length !== 1) problems.push("runtime must import the structured registry exactly once");

  const validatedData = collectNamedDeclarations(sourceFile, "validatedRegistryData");
  if (
    validatedData.length !== 1 ||
    !validatedData[0].initializer ||
    !isIdentifier(validatedData[0].initializer, "modelRegistryData")
  ) {
    problems.push("validated registry input binding is not exact");
  }

  const validationCalls = sourceFile.statements.filter(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      isNamedCall(statement.expression, "validateModelRegistry") &&
      statement.expression.arguments.length === 1 &&
      isIdentifier(statement.expression.arguments[0], "validatedRegistryData")
  );
  if (validationCalls.length !== 1) problems.push("structured registry must be validated exactly once before export");

  const registries = collectNamedDeclarations(sourceFile, "MODEL_REGISTRY");
  if (
    registries.length !== 1 ||
    !registries[0].initializer ||
    !isNamedCall(registries[0].initializer, "deepFreeze") ||
    registries[0].initializer.arguments.length !== 1 ||
    !isIdentifier(registries[0].initializer.arguments[0], "validatedRegistryData")
  ) {
    problems.push("MODEL_REGISTRY must derive only from validated structured data");
  }
  if (
    validationCalls.length === 1 &&
    registries.length === 1 &&
    validationCalls[0].getStart(sourceFile) > registries[0].getStart(sourceFile)
  ) {
    problems.push("structured registry validation must execute before MODEL_REGISTRY export");
  }

  const installableBindings = collectNamedDeclarations(sourceFile, "INSTALLABLE_MODELS");
  const installableInitializer = installableBindings[0]?.initializer;
  const freezeArgument =
    installableBindings.length === 1 &&
    installableInitializer &&
    ts.isCallExpression(installableInitializer) &&
    ts.isPropertyAccessExpression(installableInitializer.expression) &&
    isIdentifier(installableInitializer.expression.expression, "Object") &&
    installableInitializer.expression.name.text === "freeze"
      ? installableInitializer.arguments[0]
      : undefined;
  const derivesFromRegistry =
    freezeArgument &&
    ts.isCallExpression(freezeArgument) &&
    ts.isPropertyAccessExpression(freezeArgument.expression) &&
    isIdentifier(freezeArgument.expression.expression, "MODEL_REGISTRY") &&
    freezeArgument.expression.name.text === "filter";
  const predicate = derivesFromRegistry ? freezeArgument.arguments[0] : undefined;
  const predicateParameter =
    predicate && ts.isArrowFunction(predicate) && predicate.parameters.length === 1
      ? predicate.parameters[0].name
      : undefined;
  const predicateBody = predicate && ts.isArrowFunction(predicate) ? predicate.body : undefined;
  const exactInstallablePredicate =
    predicateParameter &&
    ts.isIdentifier(predicateParameter) &&
    predicateBody &&
    ts.isBinaryExpression(predicateBody) &&
    predicateBody.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    ts.isPropertyAccessExpression(predicateBody.left) &&
    isIdentifier(predicateBody.left.expression, predicateParameter.text) &&
    predicateBody.left.name.text === "availability" &&
    ts.isStringLiteral(predicateBody.right) &&
    predicateBody.right.text === "installable";
  if (!derivesFromRegistry || !exactInstallablePredicate) {
    problems.push("installable models must be the exact filtered and frozen output of MODEL_REGISTRY");
  }

  const getters = sourceFile.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "getInstallableModels"
  );
  const getterStatements = getters[0]?.body?.statements ?? [];
  if (
    getters.length !== 1 ||
    getterStatements.length !== 1 ||
    !ts.isReturnStatement(getterStatements[0]) ||
    !getterStatements[0].expression ||
    !isIdentifier(getterStatements[0].expression, "INSTALLABLE_MODELS")
  ) {
    problems.push("getInstallableModels must return only the validated installable binding");
  }

  const visitUnsafeUrlConstruction = (node) => {
    if (
      (ts.isTemplateExpression(node) || ts.isBinaryExpression(node)) &&
      /https?|:\/\/|huggingface|resolve/i.test(node.getText(sourceFile))
    ) {
      problems.push("runtime contains computed, template, or concatenated remote URL construction");
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      /^https?:\/\//i.test(node.text)
    ) {
      problems.push("runtime embeds a remote URL outside the structured registry");
    }
    ts.forEachChild(node, visitUnsafeUrlConstruction);
  };
  visitUnsafeUrlConstruction(sourceFile);
  return problems;
}

export function validateRegistryFiles(jsonSource, runtimeSource, assetExists = () => true) {
  const problems = [];
  const parsed = parseRegistryJson(jsonSource, problems);
  if (parsed !== undefined && !isDeepStrictEqual(parsed, APPROVED_MODEL_REGISTRY)) {
    problems.push("registry keys, types, count, or approved values are not exact");
  }
  if (parsed !== undefined) {
    const urls = [];
    const visit = (value) => {
      if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(parsed);
    if (!isDeepStrictEqual(urls.sort(), [...APPROVED_MODEL_REMOTE_URL_LIST].sort())) {
      problems.push("registry contains an unexpected, duplicate, or missing remote URL");
    }
  }
  problems.push(...validateRegistryRuntimeSource(runtimeSource));
  for (const asset of OFFLINE_LICENSE_ASSETS) {
    if (!assetExists(asset)) problems.push(`offline license asset is missing: ${asset}`);
  }
  return {
    gate: "model-registry",
    status: problems.length ? "fail" : "pass",
    installableModelIds: APPROVED_MODEL_REGISTRY
      .filter((model) => model.availability === "installable")
      .map((model) => model.id),
    offlineLicenseAssets: OFFLINE_LICENSE_ASSETS,
    problems
  };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const root = resolve(import.meta.dirname, "..");
  const jsonSource = readFileSync(resolve(root, "apps/mobile/src/local-ai/model-registry.json"), "utf8");
  const runtimeSource = readFileSync(resolve(root, "apps/mobile/src/local-ai/modelRegistry.ts"), "utf8");
  const report = validateRegistryFiles(
    jsonSource,
    runtimeSource,
    (asset) => existsSync(resolve(root, "apps/mobile", asset))
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

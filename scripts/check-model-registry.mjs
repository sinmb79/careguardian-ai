import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  createStaticExpressionEvaluator,
  unwrapExpression
} from "./typescript-static-analysis.mjs";

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

function isObjectMethodCall(node, method, argumentName) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(unwrapExpression(node.expression)) &&
    isIdentifier(unwrapExpression(node.expression).expression, "Object") &&
    unwrapExpression(node.expression).name.text === method &&
    node.arguments.length === 1 &&
    isIdentifier(unwrapExpression(node.arguments[0]), argumentName)
  );
}

function hasExactDeepFreezeImplementation(sourceFile) {
  const declarations = sourceFile.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "deepFreeze"
  );
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  if (
    declaration.parameters.length !== 1 ||
    !isIdentifier(declaration.parameters[0].name, "input") ||
    !declaration.body ||
    declaration.body.statements.length !== 2
  ) {
    return false;
  }

  const [guard, returnStatement] = declaration.body.statements;
  if (
    !ts.isIfStatement(guard) ||
    guard.elseStatement ||
    guard.expression.getText(sourceFile).replace(/\s+/gu, "") !==
      'typeofinput==="object"&&input!==null&&!Object.isFrozen(input)' ||
    !ts.isBlock(guard.thenStatement) ||
    guard.thenStatement.statements.length !== 2 ||
    !ts.isReturnStatement(returnStatement) ||
    !returnStatement.expression ||
    !isIdentifier(unwrapExpression(returnStatement.expression), "input")
  ) {
    return false;
  }

  const [loop, freezeStatement] = guard.thenStatement.statements;
  if (
    !ts.isForOfStatement(loop) ||
    !ts.isVariableDeclarationList(loop.initializer) ||
    (loop.initializer.flags & ts.NodeFlags.Const) === 0 ||
    loop.initializer.declarations.length !== 1 ||
    !isIdentifier(loop.initializer.declarations[0].name, "value") ||
    !isObjectMethodCall(loop.expression, "values", "input")
  ) {
    return false;
  }
  const loopBody = ts.isBlock(loop.statement)
    ? loop.statement.statements.length === 1
      ? loop.statement.statements[0]
      : undefined
    : loop.statement;
  if (
    !loopBody ||
    !ts.isExpressionStatement(loopBody) ||
    !isNamedCall(loopBody.expression, "deepFreeze") ||
    loopBody.expression.arguments.length !== 1 ||
    !isIdentifier(unwrapExpression(loopBody.expression.arguments[0]), "value")
  ) {
    return false;
  }
  return (
    ts.isExpressionStatement(freezeStatement) &&
    isObjectMethodCall(freezeStatement.expression, "freeze", "input")
  );
}

function hasDeepFreezeAssertions(sourceFile, registries, installableBindings) {
  const assertions = sourceFile.statements.filter(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      isNamedCall(statement.expression, "assertDeepFrozen") &&
      statement.expression.arguments.length === 1
  );
  const registryAssertion = assertions.filter((statement) =>
    isIdentifier(unwrapExpression(statement.expression.arguments[0]), "MODEL_REGISTRY")
  );
  const installableAssertion = assertions.filter((statement) =>
    isIdentifier(unwrapExpression(statement.expression.arguments[0]), "INSTALLABLE_MODELS")
  );
  return (
    assertions.length === 2 &&
    registryAssertion.length === 1 &&
    installableAssertion.length === 1 &&
    registries.length === 1 &&
    installableBindings.length === 1 &&
    registryAssertion[0].getStart(sourceFile) > registries[0].getStart(sourceFile) &&
    installableAssertion[0].getStart(sourceFile) > installableBindings[0].getStart(sourceFile)
  );
}

function findRegistryMutations(sourceFile) {
  const mutations = [];
  const evaluator = createStaticExpressionEvaluator(sourceFile);
  const declarations = new Map();
  const collectDeclarations = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const existing = declarations.get(node.name.text) ?? [];
      existing.push(node.initializer);
      declarations.set(node.name.text, existing);
    }
    ts.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(sourceFile);

  const resolveRegistryRoot = (node, resolving = new Set()) => {
    const expression = unwrapExpression(node);
    if (!expression) return undefined;
    if (
      ts.isIdentifier(expression) &&
      (expression.text === "MODEL_REGISTRY" || expression.text === "INSTALLABLE_MODELS")
    ) {
      return expression.text;
    }
    if (ts.isIdentifier(expression)) {
      if (resolving.has(expression.text)) return undefined;
      const initializers = declarations.get(expression.text);
      if (initializers?.length !== 1) return undefined;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return resolveRegistryRoot(initializers[0], nextResolving);
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return resolveRegistryRoot(expression.expression, resolving);
    }
    if (ts.isCallExpression(expression)) {
      const target = unwrapExpression(expression.expression);
      if (isIdentifier(target, "getInstallableModels")) return "INSTALLABLE_MODELS";
      if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
        return resolveRegistryRoot(target.expression, resolving);
      }
    }
    return undefined;
  };

  const mutatingMethods = new Set([
    "copyWithin",
    "fill",
    "pop",
    "push",
    "reverse",
    "shift",
    "sort",
    "splice",
    "unshift"
  ]);
  const objectMutationMethods = new Set([
    "assign",
    "defineProperties",
    "defineProperty",
    "setPrototypeOf"
  ]);
  const reflectMutationMethods = new Set(["deleteProperty", "defineProperty", "set", "setPrototypeOf"]);
  const isAssignmentOperator = (kind) =>
    kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      isAssignmentOperator(node.operatorToken.kind) &&
      resolveRegistryRoot(node.left)
    ) {
      mutations.push(node);
    } else if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
      resolveRegistryRoot(node.operand)
    ) {
      mutations.push(node);
    } else if (ts.isDeleteExpression(node) && resolveRegistryRoot(node.expression)) {
      mutations.push(node);
    } else if (ts.isCallExpression(node)) {
      const target = unwrapExpression(node.expression);
      if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
        const method = evaluator.evaluatePropertyName(target);
        const receiver = unwrapExpression(target.expression);
        if (method && mutatingMethods.has(method) && resolveRegistryRoot(receiver)) {
          mutations.push(node);
        } else if (
          method &&
          ts.isIdentifier(receiver) &&
          (
            (receiver.text === "Object" && objectMutationMethods.has(method)) ||
            (receiver.text === "Reflect" && reflectMutationMethods.has(method))
          ) &&
          node.arguments[0] &&
          resolveRegistryRoot(node.arguments[0])
        ) {
          mutations.push(node);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return mutations;
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
  if (!hasExactDeepFreezeImplementation(sourceFile)) {
    problems.push("deepFreeze must recursively freeze every nested registry value");
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
  if (!hasDeepFreezeAssertions(sourceFile, registries, installableBindings)) {
    problems.push("runtime must assert both exported registry surfaces are deeply frozen");
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

  const registryMutations = findRegistryMutations(sourceFile);
  if (registryMutations.length) {
    problems.push("runtime must not mutate MODEL_REGISTRY, INSTALLABLE_MODELS, or their nested values");
  }

  const evaluator = createStaticExpressionEvaluator(sourceFile);
  const reportedRemoteNodes = new Set();
  const visitUnsafeUrlConstruction = (node) => {
    const value = evaluator.evaluateString(node);
    if (
      value !== undefined &&
      /^https?:\/\//i.test(value) &&
      !reportedRemoteNodes.has(node.getStart(sourceFile))
    ) {
      reportedRemoteNodes.add(node.getStart(sourceFile));
      problems.push("runtime embeds a literal or statically computed remote URL outside the structured registry");
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

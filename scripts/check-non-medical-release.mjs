import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { APPROVED_MODEL_REMOTE_URLS } from "./check-model-registry.mjs";
import {
  createStaticExpressionEvaluator,
  unwrapExpression
} from "./typescript-static-analysis.mjs";

const RELEASE_ROOTS = ["apps/mobile/", "src/", "packages/life-core/", "public/"];
const EXACT_FILES = new Set([
  "index.html",
  "package.json",
  "vite.config.ts",
  "apps/mobile/app.json",
  "apps/mobile/package.json"
]);
const FORBIDDEN_HEALTH = /(?:복약|투약|약물|처방약|진단|증상|치료|알레르기|질환|재활|건강|혈압|혈당|체온|심박|의료|caregiver|medication|prescription|diagnos(?:e|is)|symptom|treatment|allerg(?:y|ies|ic)|disease|rehabilitation|health(?:care)?|medical)/iu;
const FORBIDDEN_CLOUD = /(?:firebase|sentry|amplitude|mixpanel|analytics|openai|anthropic|generative-ai)/iu;
const FORBIDDEN_SERVICE_IMPORT = /(?:from\s*["']|require\s*\(\s*["'])(?:firebase|@sentry|@amplitude|mixpanel|analytics|@segment|openai|@anthropic|@google\/generative-ai)/iu;
const NETWORK_CAPABILITIES = new Set([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "sendBeacon",
  "downloadFileAsync",
  "createDownloadResumable",
  "downloadAsync",
  "DownloadResumable",
  "uploadAsync",
  "createUploadTask",
  "UploadTask"
]);
const EXPO_FILE_SYSTEM_MODULE = "expo-file-system";
const EXPO_FILE_SYSTEM_LEGACY_MODULE = "expo-file-system/legacy";
const EXPECTED_EXPO_FILE_SYSTEM_VERSION = "19.0.23";
const EXPO_FILE_SYSTEM_DECLARATION_FILES = [
  "index.d.ts",
  "FileSystem.d.ts",
  "ExpoFileSystem.types.d.ts",
  "legacyWarnings.d.ts",
  "pathUtilities/index.d.ts",
  "legacy/index.d.ts",
  "legacy/FileSystem.d.ts",
  "legacy/FileSystem.types.d.ts"
];
const EXPECTED_EXPO_FILE_SYSTEM_DECLARATION_INVENTORY = new Map([
  ["index.d.ts", [
    "export-all:./FileSystem",
    "export-all:./legacyWarnings"
  ]],
  ["FileSystem.d.ts", [
    "class:Directory",
    "class:Directory.public:constructor",
    "class:Directory.public:get:name",
    "class:Directory.public:get:parentDirectory",
    "class:Directory.public:method:createDirectory",
    "class:Directory.public:method:createFile",
    "class:Directory.public:method:list",
    "class:File",
    "class:File.public:constructor",
    "class:File.public:get:extension",
    "class:File.public:get:name",
    "class:File.public:get:parentDirectory",
    "class:File.public:method:arrayBuffer",
    "class:File.public:method:readableStream",
    "class:File.public:method:slice",
    "class:File.public:method:stream",
    "class:File.public:method:writableStream",
    "class:Paths",
    "class:Paths.public:static:get:appleSharedContainers",
    "class:Paths.public:static:get:availableDiskSpace",
    "class:Paths.public:static:get:bundle",
    "class:Paths.public:static:get:cache",
    "class:Paths.public:static:get:document",
    "class:Paths.public:static:get:totalDiskSpace",
    "class:Paths.public:static:method:info"
  ]],
  ["ExpoFileSystem.types.d.ts", [
    "class:Directory",
    "class:Directory.public:constructor",
    "class:Directory.public:method:copy",
    "class:Directory.public:method:create",
    "class:Directory.public:method:createDirectory",
    "class:Directory.public:method:createFile",
    "class:Directory.public:method:delete",
    "class:Directory.public:method:info",
    "class:Directory.public:method:list",
    "class:Directory.public:method:listAsRecords",
    "class:Directory.public:method:move",
    "class:Directory.public:method:rename",
    "class:Directory.public:method:validatePath",
    "class:Directory.public:property:exists",
    "class:Directory.public:property:size",
    "class:Directory.public:property:uri",
    "class:Directory.public:static:method:pickDirectoryAsync",
    "class:File",
    "class:File.public:constructor",
    "class:File.public:method:base64",
    "class:File.public:method:base64Sync",
    "class:File.public:method:bytes",
    "class:File.public:method:bytesSync",
    "class:File.public:method:copy",
    "class:File.public:method:create",
    "class:File.public:method:delete",
    "class:File.public:method:info",
    "class:File.public:method:move",
    "class:File.public:method:open",
    "class:File.public:method:rename",
    "class:File.public:method:text",
    "class:File.public:method:textSync",
    "class:File.public:method:validatePath",
    "class:File.public:method:write",
    "class:File.public:property:contentUri",
    "class:File.public:property:creationTime",
    "class:File.public:property:exists",
    "class:File.public:property:md5",
    "class:File.public:property:modificationTime",
    "class:File.public:property:size",
    "class:File.public:property:type",
    "class:File.public:property:uri",
    "class:File.public:static:method:downloadFileAsync",
    "class:File.public:static:method:pickFileAsync",
    "class:FileHandle",
    "class:FileHandle.public:method:close",
    "class:FileHandle.public:method:readBytes",
    "class:FileHandle.public:method:writeBytes",
    "class:FileHandle.public:property:offset",
    "class:FileHandle.public:property:size",
    "enum:EncodingType",
    "enum:EncodingType.member:Base64",
    "enum:EncodingType.member:UTF8"
  ]],
  ["legacyWarnings.d.ts", [
    "function:copyAsync",
    "function:createDownloadResumable",
    "function:createUploadTask",
    "function:deleteAsync",
    "function:deleteLegacyDocumentDirectoryAndroid",
    "function:downloadAsync",
    "function:getContentUriAsync",
    "function:getFreeDiskStorageAsync",
    "function:getInfoAsync",
    "function:getTotalDiskCapacityAsync",
    "function:makeDirectoryAsync",
    "function:moveAsync",
    "function:readAsStringAsync",
    "function:readDirectoryAsync",
    "function:uploadAsync",
    "function:writeAsStringAsync"
  ]],
  ["pathUtilities/index.d.ts", [
    "class:PathUtilities",
    "class:PathUtilities.public:static:method:basename",
    "class:PathUtilities.public:static:method:dirname",
    "class:PathUtilities.public:static:method:extname",
    "class:PathUtilities.public:static:method:isAbsolute",
    "class:PathUtilities.public:static:method:join",
    "class:PathUtilities.public:static:method:normalize",
    "class:PathUtilities.public:static:method:parse",
    "class:PathUtilities.public:static:method:relative"
  ]],
  ["legacy/index.d.ts", [
    "export-all:./FileSystem",
    "export-all:./FileSystem.types"
  ]],
  ["legacy/FileSystem.d.ts", [
    "class:DownloadResumable",
    "class:DownloadResumable.public:constructor",
    "class:DownloadResumable.public:get:fileUri",
    "class:DownloadResumable.public:method:downloadAsync",
    "class:DownloadResumable.public:method:pauseAsync",
    "class:DownloadResumable.public:method:resumeAsync",
    "class:DownloadResumable.public:method:savable",
    "class:FileSystemCancellableNetworkTask",
    "class:FileSystemCancellableNetworkTask.public:method:cancelAsync",
    "class:UploadTask",
    "class:UploadTask.public:constructor",
    "class:UploadTask.public:method:uploadAsync",
    "const:bundleDirectory",
    "const:cacheDirectory",
    "const:documentDirectory",
    "function:copyAsync",
    "function:createDownloadResumable",
    "function:createUploadTask",
    "function:deleteAsync",
    "function:deleteLegacyDocumentDirectoryAndroid",
    "function:downloadAsync",
    "function:getContentUriAsync",
    "function:getFreeDiskStorageAsync",
    "function:getInfoAsync",
    "function:getTotalDiskCapacityAsync",
    "function:makeDirectoryAsync",
    "function:moveAsync",
    "function:readAsStringAsync",
    "function:readDirectoryAsync",
    "function:uploadAsync",
    "function:writeAsStringAsync",
    "namespace:StorageAccessFramework",
    "namespace:StorageAccessFramework.const:copyAsync",
    "namespace:StorageAccessFramework.const:deleteAsync",
    "namespace:StorageAccessFramework.const:moveAsync",
    "namespace:StorageAccessFramework.const:readAsStringAsync",
    "namespace:StorageAccessFramework.const:writeAsStringAsync",
    "namespace:StorageAccessFramework.function:createFileAsync",
    "namespace:StorageAccessFramework.function:getUriForDirectoryInRoot",
    "namespace:StorageAccessFramework.function:makeDirectoryAsync",
    "namespace:StorageAccessFramework.function:readDirectoryAsync",
    "namespace:StorageAccessFramework.function:requestDirectoryPermissionsAsync"
  ]],
  ["legacy/FileSystem.types.d.ts", [
    "enum:EncodingType",
    "enum:EncodingType.member:Base64",
    "enum:EncodingType.member:UTF8",
    "enum:FileSystemSessionType",
    "enum:FileSystemSessionType.member:BACKGROUND",
    "enum:FileSystemSessionType.member:FOREGROUND",
    "enum:FileSystemUploadType",
    "enum:FileSystemUploadType.member:BINARY_CONTENT",
    "enum:FileSystemUploadType.member:MULTIPART"
  ]]
]);
const EXPECTED_EXPO_FILE_SYSTEM_IMPORTS = new Map([
  ["apps/mobile/src/storage/mobileWorkspaceRepository.ts", [
    "static:FileSystem"
  ]],
  ["apps/mobile/src/ui/LocalAiSettingsScreen.tsx", [
    "dynamic:openLicense:FileSystem"
  ]],
  ["apps/mobile/src/local-ai/modelStore.ts", [
    "dynamic:createDownload:ExpoFileSystem",
    "dynamic:delete:ExpoFileSystem",
    "dynamic:ensureDirectory:ExpoFileSystem",
    "dynamic:getFileInfo:ExpoFileSystem",
    "dynamic:initialize:ExpoFileSystem"
  ]]
]);
const EXPECTED_EXPO_FILE_SYSTEM_MEMBERS = new Map([
  ["apps/mobile/src/storage/mobileWorkspaceRepository.ts", [
    "FileSystem.getInfoAsync:databaseFileExists"
  ]],
  ["apps/mobile/src/ui/LocalAiSettingsScreen.tsx", [
    "FileSystem.readAsStringAsync:openLicense"
  ]],
  ["apps/mobile/src/local-ai/modelStore.ts", [
    "ExpoFileSystem.createDownloadResumable:createDownload",
    "ExpoFileSystem.deleteAsync:delete",
    "ExpoFileSystem.documentDirectory:initialize",
    "ExpoFileSystem.getInfoAsync:getFileInfo",
    "ExpoFileSystem.makeDirectoryAsync:ensureDirectory",
    "task.cancelAsync:createDownload",
    "task.downloadAsync:createDownload",
    "task.pauseAsync:createDownload"
  ]]
]);
const FORBIDDEN_DYNAMIC_IDENTIFIERS = new Set(["Reflect", "eval", "Function", "Proxy"]);
const FORBIDDEN_CAPABILITY_PROPERTIES = new Set([
  "__lookupGetter__",
  "__lookupSetter__",
  "__proto__",
  "constructor",
  "defaultView"
]);

// These are line-level, single-occurrence contracts for explicit policy
// denials, migration identifiers, and cloud-disable metadata. No whole file is
// exempted from health, cloud, URL, import, or network checks.
const POLICY_LINE_CONTRACTS = new Map([
  ["package.json", [
    '    "release:policy-check": "node scripts/check-non-medical-release.mjs",',
    '    "release:policy-check:test": "node --test scripts/check-non-medical-release.node-test.mjs",'
  ]],
  ["packages/life-core/src/policy.ts", [
    '  reasonCode?: "restricted_health_intent";',
    "const RESTRICTED_HEALTH_PATTERN = /(?:복약|투약|약먹|약을|약물|약품|처방약|처방|진단|증상|치료|알레르기|질환|재활|건강|혈압|혈당|체온|심박|맥박|bmi|병원|의사|의료|medication|medicine|prescription|diagnos(?:e|is)|symptom|treatment|dosage|dose|allerg(?:y|ies|ic)|disease|rehabilitation|health|bloodpressure|bloodsugar|bodytemperature|heartrate|pulse|bmi|doctor|hospital|medical|healthcare)/i;",
    "export function detectRestrictedHealthIntent(input: string): PolicyDecision {",
    "  if (RESTRICTED_HEALTH_PATTERN.test(normalized)) {",
    '      reasonCode: "restricted_health_intent",',
    '      message: "의료·건강 관련 요청은 이 생활 관리 기능에서 처리할 수 없습니다.",'
  ]],
  ["apps/mobile/src/local-ai/assistantPolicy.ts", [
    "  detectRestrictedHealthIntent,",
    '  | "restricted_health_intent"',
    '  "이 앱의 AI는 건강, 약물, 증상, 진단, 치료 또는 응급상황에 관한 정보·권고·일정 생성과 유해하거나 불법적인 콘텐츠 생성을 제공하지 않습니다. 일반 일정·메모·체크리스트 정리는 도와드릴 수 있습니다.";',
    '    "invalid_input" | "unsupported_action" | "restricted_health_intent"',
    "      /(?:랜섬웨어|악성코드(?:작성|만들|제작)|해킹(?:방법|하는법)|마약(?:제조|만들)|불법약물(?:제조|만들)|위조(?:신분증|화폐)(?:만들|제작)|불법침입(?:방법|하는법)|ddos|credentialstealer|ransomware|malware(?:code|payload|write|create)|sqlinjection(?:payload|attack)|hack(?:account|instruction|password)|(?:make|manufacture)illegaldrugs?|illegaldrugs?(?:make|manufacture)|counterfeit(?:money|id)|breakinto(?:house|account))/",
    "  const healthDecision = detectRestrictedHealthIntent(text);",
    "  if (!healthDecision.allowed) {",
    '      reasonCode: "restricted_health_intent",',
    '    "의료·건강 판단, 위해, 착취, 사기, 괴롭힘, 악성 코드 또는 불법행위를 생성하지 마세요.",'
  ]],
  ["apps/mobile/src/ui/LocalAiScreen.tsx", [
    "          건강·약물·증상·진단·치료·응급, 위해·착취·사기·괴롭힘·악성 코드·불법행위"
  ]],
  ["src/features/workspace/workspaceRepository.ts", [
    "      const factory = globalThis.indexedDB;"
  ]],
  ["apps/mobile/src/storage/mobileWorkspaceRepository.ts", [
    " * a release install can erase health-era records without opening or migrating them."
  ]],
  ["apps/mobile/src/notifications/lifeNotifications.ts", [
    'const PREVIOUS_TEST_IDENTIFIER_PREFIX = "careguardian-medication-";'
  ]],
  ["apps/mobile/plugins/with-local-only-notifications.js", [
    '    setBooleanMetadata(application, "firebase_messaging_auto_init_enabled", false);',
    '    setBooleanMetadata(application, "firebase_analytics_collection_enabled", false);',
    '    setBooleanMetadata(application, "google_analytics_adid_collection_enabled", false);'
  ]],
  ["public/privacy-policy.html", [
    "  <p>There are no accounts, ads, analytics SDKs, or remote push. The displayed notification title is generic and its data payload contains only a task ID. Mobile deletion stops inference, cancels local notifications, removes models and partial files, deletes the workspace and keys, and resets memory.</p>"
  ]]
]);

const NETWORK_LINE_CONTRACTS = new Map([
  ["apps/mobile/src/local-ai/modelStore.ts", [
    "    const task = ExpoFileSystem.createDownloadResumable(",
    "      download: () => task.downloadAsync(),"
  ]],
  ["apps/mobile/src/legal/thirdPartyModels.ts", [
    "  const downloadedAsset = await assetFactory.fromModule(asset.moduleLoader()).downloadAsync();"
  ]]
]);

function isReleaseFile(file) {
  return RELEASE_ROOTS.some((prefix) => file.startsWith(prefix)) || EXACT_FILES.has(file);
}

function isSkippedAssetOrTest(file) {
  return (
    file === "apps/mobile/.gitignore" ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file) ||
    file.includes("/assets/model-licenses/") ||
    /\.(?:png|jpg|jpeg|webp|ico|svg|ttf|woff2?|gguf)$/i.test(file)
  );
}

function lineIsExactContract(file, line) {
  return (POLICY_LINE_CONTRACTS.get(file) ?? []).includes(line);
}

function networkLineIsExactContract(file, line) {
  return (NETWORK_LINE_CONTRACTS.get(file) ?? []).includes(line);
}

function checkExactContractCounts(files, contracts, problems, label) {
  for (const [file, expectedLines] of contracts) {
    const lines = (files.get(file) ?? "").split(/\r?\n/);
    for (const expectedLine of expectedLines) {
      const count = lines.filter((line) => line === expectedLine).length;
      if (count !== 1) problems.push(`${file}: ${label} line must occur exactly once`);
    }
  }
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function declarationName(name, sourceFile) {
  if (!name) return "<anonymous>";
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isPrivateIdentifier(name)
  ) {
    return name.text;
  }
  return name.getText(sourceFile);
}

function collectBindingNames(name, sourceFile) {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap((element) =>
      ts.isOmittedExpression(element)
        ? []
        : collectBindingNames(element.name, sourceFile)
    );
  }
  return [name.getText(sourceFile)];
}

function collectExpoFileSystemDeclarationInventory(text, file) {
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const inventory = [];

  const collectStatement = (statement, scope = [], requireExport = true) => {
    const exported =
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement);
    if (requireExport && !exported) return;

    if (ts.isVariableStatement(statement)) {
      const kind = statement.declarationList.flags & ts.NodeFlags.Const
        ? "const"
        : statement.declarationList.flags & ts.NodeFlags.Let
          ? "let"
          : "var";
      for (const declaration of statement.declarationList.declarations) {
        for (const name of collectBindingNames(declaration.name, sourceFile)) {
          inventory.push([...scope, `${kind}:${name}`].join("."));
        }
      }
      return;
    }

    if (ts.isFunctionDeclaration(statement)) {
      inventory.push([
        ...scope,
        `function:${declarationName(statement.name, sourceFile)}`
      ].join("."));
      return;
    }

    if (ts.isClassDeclaration(statement)) {
      const className = declarationName(statement.name, sourceFile);
      const classScope = [...scope, `class:${className}`];
      inventory.push(classScope.join("."));
      for (const member of statement.members) {
        if (
          hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
          hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ||
          (member.name && ts.isPrivateIdentifier(member.name))
        ) {
          continue;
        }
        const staticPart = hasModifier(member, ts.SyntaxKind.StaticKeyword)
          ? "static:"
          : "";
        if (ts.isConstructorDeclaration(member)) {
          inventory.push([...classScope, `public:${staticPart}constructor`].join("."));
        } else if (ts.isMethodDeclaration(member)) {
          inventory.push([
            ...classScope,
            `public:${staticPart}method:${declarationName(member.name, sourceFile)}`
          ].join("."));
        } else if (ts.isGetAccessorDeclaration(member)) {
          inventory.push([
            ...classScope,
            `public:${staticPart}get:${declarationName(member.name, sourceFile)}`
          ].join("."));
        } else if (ts.isSetAccessorDeclaration(member)) {
          inventory.push([
            ...classScope,
            `public:${staticPart}set:${declarationName(member.name, sourceFile)}`
          ].join("."));
        } else if (ts.isPropertyDeclaration(member)) {
          inventory.push([
            ...classScope,
            `public:${staticPart}property:${declarationName(member.name, sourceFile)}`
          ].join("."));
        }
      }
      return;
    }

    if (ts.isEnumDeclaration(statement)) {
      const enumName = declarationName(statement.name, sourceFile);
      const enumScope = [...scope, `enum:${enumName}`];
      inventory.push(enumScope.join("."));
      for (const member of statement.members) {
        inventory.push([
          ...enumScope,
          `member:${declarationName(member.name, sourceFile)}`
        ].join("."));
      }
      return;
    }

    if (ts.isModuleDeclaration(statement)) {
      const namespaceScope = [
        ...scope,
        `namespace:${declarationName(statement.name, sourceFile)}`
      ];
      inventory.push(namespaceScope.join("."));
      let body = statement.body;
      while (body && ts.isModuleDeclaration(body)) {
        body = body.body;
      }
      if (body && ts.isModuleBlock(body)) {
        for (const nested of body.statements) {
          collectStatement(nested, namespaceScope, false);
        }
      }
      return;
    }

    if (ts.isExportDeclaration(statement)) {
      const moduleName = statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : "";
      if (!statement.exportClause) {
        inventory.push(`export-all:${moduleName}`);
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        inventory.push(
          `export-namespace:${statement.exportClause.name.text}:${moduleName}`
        );
      } else {
        for (const element of statement.exportClause.elements) {
          if (statement.isTypeOnly || element.isTypeOnly) continue;
          inventory.push(
            `export:${element.propertyName?.text ?? element.name.text}:${element.name.text}:${moduleName}`
          );
        }
      }
      return;
    }

    if (ts.isExportAssignment(statement)) {
      inventory.push(`export-assignment:${statement.isExportEquals ? "equals" : "default"}`);
    }
  };

  for (const statement of sourceFile.statements) collectStatement(statement);
  return {
    inventory: inventory.sort(),
    parseErrors: sourceFile.parseDiagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    )
  };
}

function loadInstalledExpoFileSystemTypeDeclarations(root) {
  const declarationRoot = resolve(
    root,
    "node_modules/expo-file-system/build"
  );
  return new Map(
    EXPO_FILE_SYSTEM_DECLARATION_FILES.map((file) => [
      file,
      readFileSync(resolve(declarationRoot, file), "utf8")
    ])
  );
}

function loadInstalledExpoFileSystemVersion(root) {
  const manifest = JSON.parse(
    readFileSync(
      resolve(root, "node_modules/expo-file-system/package.json"),
      "utf8"
    )
  );
  return manifest.version;
}

function checkExpoFileSystemDeclarationInventory(declarations, problems) {
  if (!(declarations instanceof Map)) {
    problems.push("expo-file-system installed declaration inventory is unavailable");
    return;
  }
  const actualFiles = [...declarations.keys()].sort();
  const expectedFiles = [...EXPECTED_EXPO_FILE_SYSTEM_DECLARATION_INVENTORY.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    problems.push("expo-file-system declaration file inventory mismatch");
    return;
  }
  for (const [file, expected] of EXPECTED_EXPO_FILE_SYSTEM_DECLARATION_INVENTORY) {
    const source = declarations.get(file);
    if (typeof source !== "string") {
      problems.push(`expo-file-system declaration inventory missing ${file}`);
      continue;
    }
    const { inventory, parseErrors } =
      collectExpoFileSystemDeclarationInventory(source, file);
    if (parseErrors.length > 0) {
      problems.push(`expo-file-system declaration inventory cannot parse ${file}`);
      continue;
    }
    const expectedSorted = [...expected].sort();
    if (JSON.stringify(inventory) !== JSON.stringify(expectedSorted)) {
      const actualCounts = new Map();
      const expectedCounts = new Map();
      for (const value of inventory) {
        actualCounts.set(value, (actualCounts.get(value) ?? 0) + 1);
      }
      for (const value of expectedSorted) {
        expectedCounts.set(value, (expectedCounts.get(value) ?? 0) + 1);
      }
      const unexpected = inventory.filter((value) => {
        const remaining = expectedCounts.get(value) ?? 0;
        if (remaining === 0) return true;
        expectedCounts.set(value, remaining - 1);
        return false;
      });
      const missing = expectedSorted.filter((value) => {
        const remaining = actualCounts.get(value) ?? 0;
        if (remaining === 0) return true;
        actualCounts.set(value, remaining - 1);
        return false;
      });
      problems.push(
        `expo-file-system public declaration inventory mismatch in ${file}` +
        ` (missing: ${missing.join(", ") || "none"};` +
        ` unexpected: ${unexpected.join(", ") || "none"})`
      );
    }
  }
}

function checkTypeScriptSecuritySurface(file, text, problems) {
  if (!/\.[cm]?[jt]sx?$/i.test(file)) return;
  const scriptKind = /\.tsx$/i.test(file) ? ts.ScriptKind.TSX : /\.jsx$/i.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);
  const evaluator = createStaticExpressionEvaluator(sourceFile);
  const lines = text.split(/\r?\n/);
  const reportedNetworkNodes = new Set();
  const reportedRemoteNodes = new Set();
  const reportedDynamicNodes = new Set();

  const lineFor = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;

  const hasNamedAncestor = (node, name) => {
    for (let current = node.parent; current; current = current.parent) {
      if (
        ts.isFunctionDeclaration(current) &&
        current.name?.text === name
      ) {
        return true;
      }
      if (
        ts.isMethodDeclaration(current) &&
        current.name &&
        (
          (ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)) &&
          current.name.text === name
        )
      ) {
        return true;
      }
      if (
        ts.isPropertyAssignment(current) &&
        (
          (ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)) &&
          current.name.text === name
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const nearestNamedAncestor = (node) => {
    for (let current = node.parent; current; current = current.parent) {
      if (
        (
          ts.isFunctionDeclaration(current) ||
          ts.isMethodDeclaration(current) ||
          ts.isPropertyAssignment(current) ||
          (
            ts.isVariableDeclaration(current) &&
            current.initializer &&
            (
              ts.isArrowFunction(unwrapExpression(current.initializer)) ||
              ts.isFunctionExpression(unwrapExpression(current.initializer))
            )
          )
        ) &&
        current.name &&
        (ts.isIdentifier(current.name) || ts.isStringLiteral(current.name))
      ) {
        return current.name.text;
      }
    }
    return undefined;
  };

  const isIdentifierNamed = (node, name) => {
    const expression = unwrapExpression(node);
    return ts.isIdentifier(expression) && expression.text === name;
  };

  const isExactBooleanObject = (node, propertyName) => {
    const expression = unwrapExpression(node);
    if (!ts.isObjectLiteralExpression(expression) || expression.properties.length !== 1) {
      return false;
    }
    const property = expression.properties[0];
    return (
      ts.isPropertyAssignment(property) &&
      (
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        property.name.text === propertyName
      ) &&
      property.initializer.kind === ts.SyntaxKind.TrueKeyword
    );
  };

  const isExactDownloadProgressCallback = (node) => {
    const callback = unwrapExpression(node);
    if (
      !ts.isArrowFunction(callback) ||
      callback.parameters.length !== 1 ||
      !ts.isObjectBindingPattern(callback.parameters[0].name) ||
      callback.parameters[0].name.elements.length !== 2 ||
      !ts.isBlock(callback.body) ||
      callback.body.statements.length !== 1
    ) {
      return false;
    }
    const bindingNames = callback.parameters[0].name.elements.map((element) =>
      (
        !element.dotDotDotToken &&
        !element.propertyName &&
        !element.initializer &&
        ts.isIdentifier(element.name)
      )
        ? element.name.text
        : ""
    );
    if (
      bindingNames[0] !== "totalBytesWritten" ||
      bindingNames[1] !== "totalBytesExpectedToWrite"
    ) {
      return false;
    }
    const statement = callback.body.statements[0];
    if (!ts.isExpressionStatement(statement)) return false;
    const call = unwrapExpression(statement.expression);
    return (
      ts.isCallExpression(call) &&
      isIdentifierNamed(call.expression, "onProgress") &&
      call.arguments.length === 2 &&
      isIdentifierNamed(call.arguments[0], "totalBytesWritten") &&
      isIdentifierNamed(call.arguments[1], "totalBytesExpectedToWrite")
    );
  };

  const isExactDownloadCreationCall = (node) => {
    if (!ts.isCallExpression(node) || node.arguments.length !== 5) return false;
    const callee = unwrapExpression(node.expression);
    return (
      ts.isPropertyAccessExpression(callee) &&
      isIdentifierNamed(callee.expression, "ExpoFileSystem") &&
      callee.name.text === "createDownloadResumable" &&
      isIdentifierNamed(node.arguments[0], "url") &&
      isIdentifierNamed(node.arguments[1], "destinationUri") &&
      ts.isObjectLiteralExpression(unwrapExpression(node.arguments[2])) &&
      unwrapExpression(node.arguments[2]).properties.length === 0 &&
      isExactDownloadProgressCallback(node.arguments[3]) &&
      isIdentifierNamed(node.arguments[4], "resumeData") &&
      hasNamedAncestor(node, "createDownload")
    );
  };

  const isExactDownloadTaskCall = (node, methodName, propertyName) => {
    if (!ts.isCallExpression(node) || node.arguments.length !== 0) return false;
    const callee = unwrapExpression(node.expression);
    if (
      !ts.isPropertyAccessExpression(callee) ||
      !isIdentifierNamed(callee.expression, "task") ||
      callee.name.text !== methodName
    ) {
      return false;
    }
    const arrow = node.parent;
    const property = arrow?.parent;
    const object = property?.parent;
    const returned = object?.parent;
    return (
      ts.isArrowFunction(arrow) &&
      arrow.parameters.length === 0 &&
      unwrapExpression(arrow.body) === node &&
      ts.isPropertyAssignment(property) &&
      (
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        property.name.text === propertyName
      ) &&
      ts.isObjectLiteralExpression(object) &&
      ts.isReturnStatement(returned) &&
      unwrapExpression(returned.expression) === object &&
      hasNamedAncestor(node, "createDownload")
    );
  };

  const isApprovedNetworkCall = (node, capability) => {
    const line = lines[lineFor(node)] ?? "";
    if (!networkLineIsExactContract(file, line)) return false;
    const callee = unwrapExpression(node.expression);
    if (!ts.isCallExpression(node) || !callee) return false;

    if (
      file === "apps/mobile/src/local-ai/modelStore.ts" &&
      capability === "createDownloadResumable" &&
      isExactDownloadCreationCall(node)
    ) {
      return true;
    }

    if (
      file === "apps/mobile/src/local-ai/modelStore.ts" &&
      capability === "downloadAsync" &&
      isExactDownloadTaskCall(node, "downloadAsync", "download")
    ) {
      return true;
    }

    if (
      file === "apps/mobile/src/legal/thirdPartyModels.ts" &&
      capability === "downloadAsync" &&
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "downloadAsync" &&
      ts.isCallExpression(unwrapExpression(callee.expression)) &&
      hasNamedAncestor(node, "getOfflineLicenseAssetUri")
    ) {
      const fromModuleCall = unwrapExpression(callee.expression);
      const fromModuleTarget = unwrapExpression(fromModuleCall.expression);
      const moduleArgument = fromModuleCall.arguments[0]
        ? unwrapExpression(fromModuleCall.arguments[0])
        : undefined;
      return (
        fromModuleCall.arguments.length === 1 &&
        ts.isPropertyAccessExpression(fromModuleTarget) &&
        ts.isIdentifier(unwrapExpression(fromModuleTarget.expression)) &&
        unwrapExpression(fromModuleTarget.expression).text === "assetFactory" &&
        fromModuleTarget.name.text === "fromModule" &&
        ts.isCallExpression(moduleArgument) &&
        ts.isPropertyAccessExpression(unwrapExpression(moduleArgument.expression)) &&
        ts.isIdentifier(
          unwrapExpression(unwrapExpression(moduleArgument.expression).expression)
        ) &&
        unwrapExpression(unwrapExpression(moduleArgument.expression).expression).text === "asset" &&
        unwrapExpression(moduleArgument.expression).name.text === "moduleLoader"
      );
    }

    return false;
  };

  const reportDynamic = (node, label) => {
    const start = node.getStart(sourceFile);
    if (reportedDynamicNodes.has(start)) return;
    reportedDynamicNodes.add(start);
    problems.push(`${file}:${lineFor(node) + 1}: forbidden dynamic capability (${label})`);
  };

  const isPropertyNameIdentifier = (node) => {
    const parent = node.parent;
    return (
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (
        (
          ts.isPropertyAssignment(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isPropertyDeclaration(parent) ||
          ts.isPropertySignature(parent) ||
          ts.isMethodSignature(parent)
        ) &&
        parent.name === node
      )
    );
  };

  const isApprovedGlobalReference = (node) => {
    const parent = node.parent;
    if (
      node.text === "globalThis" &&
      ts.isPropertyAccessExpression(parent) &&
      unwrapExpression(parent.expression) === node &&
      parent.name.text === "indexedDB" &&
      file === "src/features/workspace/workspaceRepository.ts" &&
      lines[lineFor(parent)] === "      const factory = globalThis.indexedDB;"
    ) {
      return true;
    }
    return (
      ["window", "self", "global"].includes(node.text) &&
      ts.isPropertyAccessExpression(parent) &&
      unwrapExpression(parent.expression) === node &&
      !FORBIDDEN_CAPABILITY_PROPERTIES.has(parent.name.text)
    );
  };

  const originatesFromComputedAccess = (node, resolving = new Set()) => {
    const expression = unwrapExpression(node);
    if (!expression) return false;
    if (ts.isElementAccessExpression(expression)) return true;
    if (ts.isIdentifier(expression)) {
      if (resolving.has(expression.text)) return false;
      const initializer = evaluator.resolveConstInitializer(expression);
      if (!initializer) return false;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return originatesFromComputedAccess(initializer, nextResolving);
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        originatesFromComputedAccess(expression.whenTrue, resolving) ||
        originatesFromComputedAccess(expression.whenFalse, resolving)
      );
    }
    return false;
  };

  const resolvesToBuiltInFacade = (node, resolving = new Set()) => {
    const expression = unwrapExpression(node);
    if (!expression) return false;
    if (
      ts.isIdentifier(expression) &&
      ["Object", "Reflect", "Function", "Proxy"].includes(expression.text)
    ) {
      return true;
    }
    if (ts.isIdentifier(expression)) {
      if (resolving.has(expression.text)) return false;
      const initializer = evaluator.resolveConstInitializer(expression);
      if (!initializer) return false;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return resolvesToBuiltInFacade(initializer, nextResolving);
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      return resolvesToBuiltInFacade(expression.expression, resolving);
    }
    return false;
  };

  const builtInMutationHelpers = new Set([
    "assign",
    "defineProperties",
    "defineProperty",
    "deleteProperty",
    "set",
    "setPrototypeOf"
  ]);

  const mutatesBuiltInFacade = (node) => {
    const isAssignmentOperator = (kind) =>
      kind >= ts.SyntaxKind.FirstAssignment &&
      kind <= ts.SyntaxKind.LastAssignment;
    if (
      ts.isBinaryExpression(node) &&
      isAssignmentOperator(node.operatorToken.kind)
    ) {
      return resolvesToBuiltInFacade(node.left);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (
        node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken
      )
    ) {
      return resolvesToBuiltInFacade(node.operand);
    }
    if (ts.isDeleteExpression(node)) {
      return resolvesToBuiltInFacade(node.expression);
    }
    if (!ts.isCallExpression(node) || !node.arguments[0]) return false;
    const target = unwrapExpression(node.expression);
    if (
      !ts.isPropertyAccessExpression(target) &&
      !ts.isElementAccessExpression(target)
    ) {
      return false;
    }
    const helper = evaluator.evaluatePropertyName(target);
    return (
      helper !== undefined &&
      builtInMutationHelpers.has(helper) &&
      resolvesToBuiltInFacade(node.arguments[0])
    );
  };

  const classifyNetworkMember = (expression) => {
    if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
      return undefined;
    }
    const propertyName = evaluator.evaluatePropertyName(expression);
    if (propertyName && NETWORK_CAPABILITIES.has(propertyName)) return propertyName;
    if (
      ts.isElementAccessExpression(expression) &&
      propertyName === undefined &&
      evaluator.resolvesToGlobalObject(expression.expression)
    ) {
      return "dynamic global network capability";
    }
    return undefined;
  };

  const classifyNetworkCallee = (node, resolving = new Set()) => {
    const expression = unwrapExpression(node);
    if (!expression) return undefined;
    if (ts.isIdentifier(expression)) {
      if (NETWORK_CAPABILITIES.has(expression.text)) return expression.text;
      if (resolving.has(expression.text)) return undefined;
      const initializer = evaluator.resolveConstInitializer(expression);
      if (!initializer) return undefined;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return classifyNetworkCallee(initializer, nextResolving);
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const capability = classifyNetworkMember(expression);
      if (capability) return capability;
      if (
        ts.isElementAccessExpression(expression) &&
        evaluator.evaluatePropertyName(expression) === undefined
      ) {
        return "dynamic computed call";
      }
    }
    if (ts.isCallExpression(expression)) {
      const target = unwrapExpression(expression.expression);
      if (
        (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) &&
        ["apply", "bind", "call"].includes(evaluator.evaluatePropertyName(target) ?? "")
      ) {
        return classifyNetworkCallee(target.expression, resolving);
      }
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        classifyNetworkCallee(expression.whenTrue, resolving) ??
        classifyNetworkCallee(expression.whenFalse, resolving)
      );
    }
    return undefined;
  };

  const reportNetwork = (node, capability) => {
    const lineIndex = lineFor(node);
    const line = lines[lineIndex] ?? "";
    if (!isApprovedNetworkCall(node, capability) && !reportedNetworkNodes.has(node.getStart(sourceFile))) {
      reportedNetworkNodes.add(node.getStart(sourceFile));
      problems.push(`${file}:${lineIndex + 1}: unapproved network API (${capability})`);
    }
  };

  const checkExpoFileSystemUsage = () => {
    const expectedImports = EXPECTED_EXPO_FILE_SYSTEM_IMPORTS.get(file) ?? [];
    const expectedMembers = EXPECTED_EXPO_FILE_SYSTEM_MEMBERS.get(file) ?? [];
    const observedImports = [];
    const observedMembers = [];
    const approvedBindingNodes = new Set();
    const reportedNodes = new Set();

    const report = (node, detail) => {
      const start = node.getStart(sourceFile);
      if (reportedNodes.has(start)) return;
      reportedNodes.add(start);
      problems.push(
        `${file}:${lineFor(node) + 1}: forbidden expo-file-system surface (${detail})`
      );
    };
    const isExpoFileSystemModule = (value) =>
      value === EXPO_FILE_SYSTEM_MODULE ||
      value.startsWith(`${EXPO_FILE_SYSTEM_MODULE}/`);
    const isConstDeclaration = (declaration) =>
      ts.isVariableDeclarationList(declaration.parent) &&
      Boolean(declaration.parent.flags & ts.NodeFlags.Const);
    const exactDynamicImportDescriptor = (call) => {
      if (
        call.arguments.length !== 1 ||
        !ts.isStringLiteral(call.arguments[0]) ||
        call.arguments[0].text !== EXPO_FILE_SYSTEM_LEGACY_MODULE ||
        !ts.isAwaitExpression(call.parent)
      ) {
        return undefined;
      }
      const declaration = call.parent.parent;
      if (
        !ts.isVariableDeclaration(declaration) ||
        declaration.initializer !== call.parent ||
        !ts.isIdentifier(declaration.name) ||
        !isConstDeclaration(declaration)
      ) {
        return undefined;
      }
      return {
        descriptor:
          `dynamic:${nearestNamedAncestor(call) ?? "<top-level>"}:${declaration.name.text}`,
        binding: declaration.name
      };
    };

    const scanImports = (node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        isExpoFileSystemModule(node.moduleSpecifier.text)
      ) {
        const clause = node.importClause;
        const namespace = clause?.namedBindings;
        if (
          file === "apps/mobile/src/storage/mobileWorkspaceRepository.ts" &&
          node.moduleSpecifier.text === EXPO_FILE_SYSTEM_LEGACY_MODULE &&
          clause &&
          !clause.isTypeOnly &&
          !clause.name &&
          namespace &&
          ts.isNamespaceImport(namespace) &&
          namespace.name.text === "FileSystem"
        ) {
          observedImports.push("static:FileSystem");
          approvedBindingNodes.add(namespace.name.getStart(sourceFile));
        } else {
          report(node, "unapproved static import");
        }
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        isExpoFileSystemModule(node.moduleSpecifier.text)
      ) {
        report(node, "re-export");
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression) &&
        isExpoFileSystemModule(node.moduleReference.expression.text)
      ) {
        report(node, "import-equals");
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteral(argument)) {
          report(node, "non-literal dynamic import");
        }
        const moduleName = argument
          ? evaluator.evaluateString(argument)
          : undefined;
        if (moduleName !== undefined && isExpoFileSystemModule(moduleName)) {
          const approved = exactDynamicImportDescriptor(node);
          if (
            approved &&
            expectedImports.includes(approved.descriptor)
          ) {
            observedImports.push(approved.descriptor);
            approvedBindingNodes.add(approved.binding.getStart(sourceFile));
          } else {
            report(node, "unapproved dynamic import");
          }
        }
      } else if (
        ts.isCallExpression(node) &&
        isIdentifierNamed(node.expression, "require")
      ) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteral(argument)) {
          report(node, "non-literal require");
        }
        const moduleName = argument
          ? evaluator.evaluateString(argument)
          : undefined;
        if (moduleName !== undefined && isExpoFileSystemModule(moduleName)) {
          report(node, "require import");
        }
      }
      ts.forEachChild(node, scanImports);
    };
    scanImports(sourceFile);

    const isExactDatabaseFileArgument = (node) => {
      const argument = unwrapExpression(node);
      if (
        !ts.isTemplateExpression(argument) ||
        argument.head.text !== "" ||
        argument.templateSpans.length !== 3
      ) {
        return false;
      }
      const expected = ["directory", "separator", "name"];
      return argument.templateSpans.every((span, index) =>
        isIdentifierNamed(span.expression, expected[index]) &&
        span.literal.text === ""
      );
    };

    const approvedNamespaceMember = (node, rootName, memberName, ancestor) => {
      const parent = node.parent;
      const call =
        ts.isCallExpression(parent) && unwrapExpression(parent.expression) === node
          ? parent
          : undefined;
      if (
        file === "apps/mobile/src/storage/mobileWorkspaceRepository.ts" &&
        rootName === "FileSystem" &&
        memberName === "getInfoAsync" &&
        ancestor === "databaseFileExists" &&
        call?.arguments.length === 1 &&
        isExactDatabaseFileArgument(call.arguments[0])
      ) {
        return true;
      }
      if (
        file === "apps/mobile/src/ui/LocalAiSettingsScreen.tsx" &&
        rootName === "FileSystem" &&
        memberName === "readAsStringAsync" &&
        ancestor === "openLicense" &&
        call?.arguments.length === 1 &&
        isIdentifierNamed(call.arguments[0], "uri")
      ) {
        return true;
      }
      if (
        file !== "apps/mobile/src/local-ai/modelStore.ts" ||
        rootName !== "ExpoFileSystem"
      ) {
        return false;
      }
      if (
        memberName === "documentDirectory" &&
        ancestor === "initialize" &&
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        isIdentifierNamed(parent.left, "cachedDocumentDirectory") &&
        unwrapExpression(parent.right) === node
      ) {
        return true;
      }
      if (
        memberName === "makeDirectoryAsync" &&
        ancestor === "ensureDirectory" &&
        call?.arguments.length === 2 &&
        isIdentifierNamed(call.arguments[0], "uri") &&
        isExactBooleanObject(call.arguments[1], "intermediates")
      ) {
        return true;
      }
      if (
        memberName === "getInfoAsync" &&
        ancestor === "getFileInfo" &&
        call?.arguments.length === 1 &&
        isIdentifierNamed(call.arguments[0], "uri")
      ) {
        return true;
      }
      if (
        memberName === "deleteAsync" &&
        ancestor === "delete" &&
        call?.arguments.length === 2 &&
        isIdentifierNamed(call.arguments[0], "uri") &&
        isExactBooleanObject(call.arguments[1], "idempotent")
      ) {
        return true;
      }
      return (
        memberName === "createDownloadResumable" &&
        ancestor === "createDownload" &&
        call !== undefined &&
        isExactDownloadCreationCall(call)
      );
    };

    const approvedTaskMember = (node, memberName, ancestor) => {
      const parent = node.parent;
      if (
        ancestor !== "createDownload" ||
        !ts.isCallExpression(parent) ||
        unwrapExpression(parent.expression) !== node
      ) {
        return false;
      }
      const mapping = {
        downloadAsync: "download",
        pauseAsync: "pause",
        cancelAsync: "cancel"
      };
      return (
        Object.prototype.hasOwnProperty.call(mapping, memberName) &&
        isExactDownloadTaskCall(parent, memberName, mapping[memberName])
      );
    };

    const scanMembers = (node) => {
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const root = unwrapExpression(node.expression);
        if (
          ts.isIdentifier(root) &&
          (root.text === "FileSystem" || root.text === "ExpoFileSystem")
        ) {
          const memberName = ts.isPropertyAccessExpression(node)
            ? node.name.text
            : evaluator.evaluatePropertyName(node);
          const ancestor = nearestNamedAncestor(node) ?? "<top-level>";
          if (
            ts.isPropertyAccessExpression(node) &&
            memberName &&
            approvedNamespaceMember(node, root.text, memberName, ancestor)
          ) {
            observedMembers.push(`${root.text}.${memberName}:${ancestor}`);
          } else {
            report(node, `unapproved namespace member ${memberName ?? "<computed>"}`);
          }
        } else if (
          ts.isIdentifier(root) &&
          root.text === "task" &&
          hasNamedAncestor(node, "createDownload")
        ) {
          const memberName = ts.isPropertyAccessExpression(node)
            ? node.name.text
            : evaluator.evaluatePropertyName(node);
          const ancestor = "createDownload";
          if (
            ts.isPropertyAccessExpression(node) &&
            memberName &&
            approvedTaskMember(node, memberName, ancestor)
          ) {
            observedMembers.push(`task.${memberName}:${ancestor}`);
          } else {
            report(node, `unapproved download task member ${memberName ?? "<computed>"}`);
          }
        }
      }
      if (
        ts.isIdentifier(node) &&
        (node.text === "FileSystem" || node.text === "ExpoFileSystem")
      ) {
        const parent = node.parent;
        const isApprovedBinding = approvedBindingNodes.has(node.getStart(sourceFile));
        const isNamespaceRoot =
          (
            ts.isPropertyAccessExpression(parent) ||
            ts.isElementAccessExpression(parent)
          ) &&
          unwrapExpression(parent.expression) === node;
        if (!isApprovedBinding && !isNamespaceRoot) {
          report(node, "namespace alias or exposure");
        }
      }
      ts.forEachChild(node, scanMembers);
    };
    scanMembers(sourceFile);

    const compareExact = (actual, expected, label) => {
      const actualSorted = [...actual].sort();
      const expectedSorted = [...expected].sort();
      if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
        problems.push(`${file}: exact expo-file-system ${label} inventory mismatch`);
      }
    };
    compareExact(observedImports, expectedImports, "import");
    compareExact(observedMembers, expectedMembers, "member");

    if (file === "apps/mobile/src/local-ai/modelStore.ts") {
      const adapters = [];
      const collectAdapters = (node) => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === "expoFileSystemAdapter" &&
          node.initializer &&
          ts.isObjectLiteralExpression(unwrapExpression(node.initializer))
        ) {
          adapters.push(unwrapExpression(node.initializer));
        }
        ts.forEachChild(node, collectAdapters);
      };
      collectAdapters(sourceFile);
      const createDownloads = adapters.length === 1
        ? adapters[0].properties.filter((property) =>
          ts.isMethodDeclaration(property) &&
          (
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
            property.name.text === "createDownload"
          )
        )
        : [];
      const method = createDownloads[0];
      let exactGraph = createDownloads.length === 1 && method.body?.statements.length === 3;
      if (exactGraph) {
        const [importStatement, taskStatement, returnStatement] = method.body.statements;
        const importDeclaration =
          ts.isVariableStatement(importStatement) &&
          importStatement.declarationList.declarations.length === 1
            ? importStatement.declarationList.declarations[0]
            : undefined;
        const importInitializer = importDeclaration?.initializer;
        const importCall =
          importInitializer &&
          ts.isAwaitExpression(importInitializer) &&
          ts.isCallExpression(importInitializer.expression)
            ? importInitializer.expression
            : undefined;
        const taskDeclaration =
          ts.isVariableStatement(taskStatement) &&
          taskStatement.declarationList.declarations.length === 1
            ? taskStatement.declarationList.declarations[0]
            : undefined;
        const taskCall = taskDeclaration?.initializer &&
          ts.isCallExpression(unwrapExpression(taskDeclaration.initializer))
          ? unwrapExpression(taskDeclaration.initializer)
          : undefined;
        const returnedObject =
          ts.isReturnStatement(returnStatement) &&
          returnStatement.expression &&
          ts.isObjectLiteralExpression(unwrapExpression(returnStatement.expression))
            ? unwrapExpression(returnStatement.expression)
            : undefined;
        const returnedNames = returnedObject?.properties.map((property) =>
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
            ? property.name.text
            : ""
        );
        exactGraph = Boolean(
          importDeclaration &&
          ts.isIdentifier(importDeclaration.name) &&
          importDeclaration.name.text === "ExpoFileSystem" &&
          isConstDeclaration(importDeclaration) &&
          importCall &&
          exactDynamicImportDescriptor(importCall)?.descriptor ===
            "dynamic:createDownload:ExpoFileSystem" &&
          taskDeclaration &&
          ts.isIdentifier(taskDeclaration.name) &&
          taskDeclaration.name.text === "task" &&
          isConstDeclaration(taskDeclaration) &&
          taskCall &&
          isExactDownloadCreationCall(taskCall) &&
          returnedObject &&
          returnedObject.properties.length === 3 &&
          JSON.stringify(returnedNames) ===
            JSON.stringify(["download", "pause", "cancel"]) &&
          returnedObject.properties.every((property, index) => {
            if (!ts.isPropertyAssignment(property)) return false;
            const arrow = unwrapExpression(property.initializer);
            const call = ts.isArrowFunction(arrow)
              ? unwrapExpression(arrow.body)
              : undefined;
            const methods = ["downloadAsync", "pauseAsync", "cancelAsync"];
            return (
              call !== undefined &&
              ts.isCallExpression(call) &&
              isExactDownloadTaskCall(call, methods[index], returnedNames[index])
            );
          })
        );
      }
      if (!exactGraph) {
        problems.push(
          `${file}: approved expo-file-system resumable download task graph mismatch`
        );
      }
    }
  };

  const visit = (node) => {
    const staticValue = evaluator.evaluateString(node);
    if (
      staticValue !== undefined &&
      /^https?:\/\//i.test(staticValue) &&
      !ts.isStringLiteral(node) &&
      !ts.isNoSubstitutionTemplateLiteral(node) &&
      !reportedRemoteNodes.has(node.getStart(sourceFile))
    ) {
      reportedRemoteNodes.add(node.getStart(sourceFile));
      problems.push(`${file}: statically computed remote URL surface`);
    }

    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const capability = classifyNetworkCallee(node.expression);
      if (capability) reportNetwork(node, capability);
      if (originatesFromComputedAccess(node.expression)) {
        reportDynamic(node, "computed call");
      }
    }
    if (mutatesBuiltInFacade(node)) {
      reportDynamic(node, "built-in facade mutation");
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const capability = classifyNetworkMember(node);
      const parent = node.parent;
      const isDirectInvocation =
        (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
        unwrapExpression(parent.expression) === node;
      if (capability && !isDirectInvocation) reportNetwork(node, capability);
      const propertyName = evaluator.evaluatePropertyName(node);
      if (propertyName && FORBIDDEN_CAPABILITY_PROPERTIES.has(propertyName)) {
        reportDynamic(node, `capability facade ${propertyName}`);
      }
    }
    if (
      ts.isIdentifier(node) &&
      !isPropertyNameIdentifier(node) &&
      FORBIDDEN_DYNAMIC_IDENTIFIERS.has(node.text)
    ) {
      reportDynamic(node, `dynamic code or reflection ${node.text}`);
    }
    if (
      ts.isIdentifier(node) &&
      !isPropertyNameIdentifier(node) &&
      NETWORK_CAPABILITIES.has(node.text)
    ) {
      reportNetwork(node, node.text);
    }
    if (
      ts.isIdentifier(node) &&
      !isPropertyNameIdentifier(node) &&
      ["globalThis", "window", "self", "global"].includes(node.text) &&
      !isApprovedGlobalReference(node)
    ) {
      reportDynamic(node, `global object ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  checkExpoFileSystemUsage();
}

function validateIdentity(files, problems) {
  let app;
  let mobilePackage;
  try {
    app = JSON.parse(files.get("apps/mobile/app.json") ?? "{}").expo;
    mobilePackage = JSON.parse(files.get("apps/mobile/package.json") ?? "{}");
  } catch (error) {
    problems.push(`mobile identity JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (app?.name !== "생활후견 AI") problems.push("app identity name is not exact");
  if (app?.version !== "1.1.0" || mobilePackage.version !== "1.1.0") {
    problems.push("app version is not exact 1.1.0");
  }
  if (
    app?.android?.package !== "com.sinmb.careguardianai" ||
    app?.ios?.bundleIdentifier !== "com.sinmb.careguardianai"
  ) {
    problems.push("mobile package identity is not exact");
  }
  if (
    app?.slug !== "careguardian-ai-mobile" ||
    app?.extra?.eas?.projectId !== "15b9e293-b631-4b77-8cfc-9937cd604dd4"
  ) {
    problems.push("EAS linkage is not exact");
  }
  if (app?.android?.versionCode !== 7 || app?.android?.allowBackup !== false) {
    problems.push("Android release version or backup policy is unsafe");
  }
  const permissions = app?.android?.permissions ?? [];
  if (permissions.length !== 1 || permissions[0] !== "android.permission.POST_NOTIFICATIONS") {
    problems.push("Android permissions are not minimal");
  }
  const allowedDependencies = new Set([
    "expo", "expo-asset", "expo-crypto", "expo-device", "expo-file-system", "expo-font",
    "expo-local-authentication", "expo-notifications", "expo-screen-capture", "expo-secure-store",
    "expo-sqlite", "expo-status-bar", "llama.rn", "react", "react-native", "@life-steward/life-core"
  ]);
  for (const dependency of Object.keys(mobilePackage.dependencies ?? {})) {
    if (!allowedDependencies.has(dependency)) problems.push(`unexpected mobile dependency: ${dependency}`);
    if (FORBIDDEN_CLOUD.test(dependency)) problems.push(`prohibited cloud dependency: ${dependency}`);
  }
  if (
    mobilePackage.dependencies?.["expo-file-system"] !==
    `~${EXPECTED_EXPO_FILE_SYSTEM_VERSION}`
  ) {
    problems.push("expo-file-system dependency version is not exact");
  }
}

export function validateReleasePolicy(files, options = {}) {
  const problems = [];
  let expoFileSystemTypeDeclarations;
  let expoFileSystemVersion;
  if (
    Object.prototype.hasOwnProperty.call(
      options,
      "expoFileSystemTypeDeclarations"
    )
  ) {
    expoFileSystemTypeDeclarations = options.expoFileSystemTypeDeclarations;
  } else {
    try {
      expoFileSystemTypeDeclarations =
        loadInstalledExpoFileSystemTypeDeclarations(resolve(import.meta.dirname, ".."));
    } catch {
      expoFileSystemTypeDeclarations = undefined;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(options, "expoFileSystemVersion")
  ) {
    expoFileSystemVersion = options.expoFileSystemVersion;
  } else {
    try {
      expoFileSystemVersion =
        loadInstalledExpoFileSystemVersion(resolve(import.meta.dirname, ".."));
    } catch {
      expoFileSystemVersion = undefined;
    }
  }
  if (expoFileSystemVersion !== EXPECTED_EXPO_FILE_SYSTEM_VERSION) {
    problems.push(
      `expo-file-system installed version mismatch: expected ` +
      `${EXPECTED_EXPO_FILE_SYSTEM_VERSION}`
    );
  }
  checkExpoFileSystemDeclarationInventory(
    expoFileSystemTypeDeclarations,
    problems
  );

  for (
    const expectedFile of new Set([
      ...EXPECTED_EXPO_FILE_SYSTEM_IMPORTS.keys(),
      ...EXPECTED_EXPO_FILE_SYSTEM_MEMBERS.keys()
    ])
  ) {
    if (!files.has(expectedFile)) {
      problems.push(
        `${expectedFile}: required expo-file-system usage inventory is missing`
      );
    }
  }
  for (const [file, text] of files) {
    if (!isReleaseFile(file) || isSkippedAssetOrTest(file)) continue;
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if ((FORBIDDEN_HEALTH.test(line) || FORBIDDEN_CLOUD.test(line)) && !lineIsExactContract(file, line)) {
        problems.push(`${file}:${index + 1}: unapproved health or cloud policy surface`);
      }
    }
    if (FORBIDDEN_SERVICE_IMPORT.test(text)) problems.push(`${file}: prohibited cloud service import`);
    if (text.includes("@careguardian/care-core")) problems.push(`${file}: retired care-core dependency`);

    for (const match of text.matchAll(/https?:\/\/[^\s"'`<>)\\]+/giu)) {
      const url = match[0];
      if (file !== "apps/mobile/src/local-ai/model-registry.json" || !APPROVED_MODEL_REMOTE_URLS.has(url)) {
        problems.push(`${file}: unapproved remote URL`);
      }
    }
    checkTypeScriptSecuritySurface(file, text, problems);
  }
  checkExactContractCounts(files, POLICY_LINE_CONTRACTS, problems, "policy contract");
  checkExactContractCounts(files, NETWORK_LINE_CONTRACTS, problems, "network contract");
  validateIdentity(files, problems);
  return {
    gate: "non-medical-release",
    status: problems.length === 0 ? "pass" : "fail",
    checkedFiles: [...files.keys()].filter(isReleaseFile).length,
    problems
  };
}

export function loadReleaseFiles(root) {
  const inventory = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\0")
    .filter(Boolean)
    .filter(isReleaseFile);
  return new Map(inventory.map((file) => [file, readFileSync(resolve(root, file), "utf8")]));
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const root = resolve(import.meta.dirname, "..");
  const report = validateReleasePolicy(loadReleaseFiles(root));
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

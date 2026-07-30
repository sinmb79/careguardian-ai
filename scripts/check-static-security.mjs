import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

export const EXPECTED_CSP = "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'";

const ALLOWED_POLICY_URL = "https://huggingface.co/privacy";
const URL_CANDIDATE_PATTERN = /(?:https?\s*:[\s/\\]*|[\\/][\s/\\]*)[^\s"'<>`]*/gi;
const CSS_REFERENCE_PATTERNS = [
  /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)]*?))\)?/gi,
  /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi
];
const CHARACTER_REFERENCE_PATTERN = /&(?:#x[0-9a-f]+|#\d+|[a-z][a-z\d]+);/i;

function findRemoteUrls(value) {
  return [...value.matchAll(URL_CANDIDATE_PATTERN)].flatMap(([candidate]) => {
    try {
      let normalizedInput = candidate.replace(/[\u0000-\u0020\u007f]/g, "").replaceAll("\\", "/");
      if (/^https?:/i.test(normalizedInput)) {
        normalizedInput = normalizedInput.replace(/^(https?):\/*/i, "$1://");
      }
      const isRemote = /^https?:\/\//i.test(normalizedInput) || normalizedInput.startsWith("//");
      const url = new URL(normalizedInput.startsWith("//") ? `https:${normalizedInput}` : normalizedInput, "https://static-gate.invalid/");
      return isRemote && (url.protocol === "http:" || url.protocol === "https:")
        ? [{ candidate, normalized: url.href }]
        : [];
    } catch {
      return [];
    }
  });
}

function sourceContainsCharacterReference(dom, html, node, attributeName) {
  const location = dom.nodeLocation(node);
  const attribute = attributeName ? location?.attrs?.[attributeName] : location;
  return Boolean(attribute && CHARACTER_REFERENCE_PATTERN.test(html.slice(attribute.startOffset, attribute.endOffset)));
}

function isAllowedAnchorHref(dom, html, file, element, attributeName, value, remoteUrl) {
  return file === "privacy-policy.html" &&
    element.localName === "a" &&
    attributeName === "href" &&
    value === ALLOWED_POLICY_URL &&
    remoteUrl.candidate === ALLOWED_POLICY_URL &&
    remoteUrl.normalized === ALLOWED_POLICY_URL &&
    !sourceContainsCharacterReference(dom, html, element, attributeName);
}

function isAllowedAnchorText(dom, html, file, textNode, remoteUrl) {
  return file === "privacy-policy.html" &&
    textNode.parentElement?.localName === "a" &&
    textNode.data === ALLOWED_POLICY_URL &&
    remoteUrl.candidate === ALLOWED_POLICY_URL &&
    remoteUrl.normalized === ALLOWED_POLICY_URL &&
    !sourceContainsCharacterReference(dom, html, textNode);
}

function validateStrictCsp(document, file, problems) {
  const cspMetas = [...document.querySelectorAll("meta[http-equiv]")].filter(
    (meta) => meta.getAttribute("http-equiv")?.trim().toLowerCase() === "content-security-policy"
  );
  if (cspMetas.length !== 1 || cspMetas[0].getAttribute("content") !== EXPECTED_CSP) {
    problems.push(`${file}: strict production CSP meta is absent or changed`);
  }
  if (cspMetas.some((meta) => /unsafe-inline|unsafe-eval/i.test(meta.getAttribute("content") ?? ""))) {
    problems.push(`${file}: unsafe CSP execution is enabled`);
  }
}

function validateHtmlExecution(document, file, problems) {
  if (document.querySelector("style, [style]")) problems.push(`${file}: inline style is prohibited`);
  if ([...document.querySelectorAll("script")].some((script) => !script.hasAttribute("src"))) {
    problems.push(`${file}: inline script is prohibited`);
  }
  if ([...document.querySelectorAll("*")].some((element) => [...element.attributes].some((attribute) => /^on[a-z]+$/i.test(attribute.name)))) {
    problems.push(`${file}: inline event handler is prohibited`);
  }
}

function validateHtmlRemoteUrls(dom, html, file, problems) {
  const { document, NodeFilter } = dom.window;
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      for (const remoteUrl of findRemoteUrls(attribute.value)) {
        if (!isAllowedAnchorHref(dom, html, file, element, attribute.name, attribute.value, remoteUrl)) {
          problems.push(`${file}: unexpected remote URL is present: ${remoteUrl.candidate}`);
        }
      }
    }
  }

  const textWalker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  for (let textNode = textWalker.nextNode(); textNode; textNode = textWalker.nextNode()) {
    for (const remoteUrl of findRemoteUrls(textNode.data)) {
      if (!isAllowedAnchorText(dom, html, file, textNode, remoteUrl)) {
        problems.push(`${file}: unexpected remote URL is present: ${remoteUrl.candidate}`);
      }
    }
  }
}

function decodeCssEscapes(value) {
  return value.replace(/\\([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|\\(.)/gi, (_, hex, character) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return character;
  });
}

function decodeCssReference(value) {
  const decoder = new JSDOM("<textarea></textarea>").window.document.querySelector("textarea");
  decoder.innerHTML = value;
  return decoder.value;
}

function findCssReferences(css) {
  const withoutComments = decodeCssEscapes(css).replace(/\/\*[\s\S]*?\*\//g, "");
  const references = new Set();
  for (const pattern of CSS_REFERENCE_PATTERNS) {
    for (const match of withoutComments.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? "";
      references.add(decodeCssReference(value.trim()));
    }
  }
  return references;
}

export function validateCssSecurity(css, file = "unknown.css") {
  const problems = [];
  for (const reference of findCssReferences(css)) {
    for (const remoteUrl of findRemoteUrls(reference)) {
      problems.push(`${file}: unexpected remote CSS URL is present: ${remoteUrl.candidate}`);
    }
  }
  return problems;
}

export function validateHtmlSecurity(html, file = "unknown.html") {
  const problems = [];
  const dom = new JSDOM(html, { includeNodeLocations: true });
  validateStrictCsp(dom.window.document, file, problems);
  validateHtmlExecution(dom.window.document, file, problems);
  validateHtmlRemoteUrls(dom, html, file, problems);
  return problems;
}

function listFiles(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path, extension);
    return extname(entry.name).toLowerCase() === extension ? [path] : [];
  });
}

export function validateBuiltHtmlDirectory(directory) {
  const htmlFiles = listFiles(directory, ".html");
  const cssFiles = listFiles(directory, ".css");
  const problems = [
    ...htmlFiles.flatMap((file) => validateHtmlSecurity(readFileSync(file, "utf8"), relative(directory, file).replaceAll("\\", "/"))),
    ...cssFiles.flatMap((file) => validateCssSecurity(readFileSync(file, "utf8"), relative(directory, file).replaceAll("\\", "/")))
  ];
  if (htmlFiles.length === 0) problems.push("no deployed HTML files were found");
  return {
    gate: "static-security",
    status: problems.length ? "fail" : "pass",
    checkedHtmlFiles: htmlFiles.map((file) => relative(directory, file).replaceAll("\\", "/")).sort(),
    checkedCssFiles: cssFiles.map((file) => relative(directory, file).replaceAll("\\", "/")).sort(),
    problems
  };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const report = validateBuiltHtmlDirectory(resolve(import.meta.dirname, "../dist"));
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

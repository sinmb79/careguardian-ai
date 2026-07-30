import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

export const EXPECTED_CSP = "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'";

const ALLOWED_POLICY_URL = "https://huggingface.co/privacy";
const URL_CANDIDATE_PATTERN = /(?:https?\s*:[\s/\\]*|[\\/][\s/\\]*)[^\s"'<>`]*/gi;
const CSS_ESCAPE_NORMALIZATION_LIMIT = 8;
const PERCENT_ENCODING_PATTERN = /%[0-9a-f]{2}/i;
const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

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

function getRawSource(dom, html, node, attributeName) {
  const location = dom.nodeLocation(node);
  const attribute = attributeName ? location?.attrs?.[attributeName] : location;
  return attribute ? html.slice(attribute.startOffset, attribute.endOffset) : "";
}

function isAllowedAnchorHref(dom, html, file, element, attributeName, value, remoteUrl) {
  return file === "privacy-policy.html" &&
    element.localName === "a" &&
    attributeName === "href" &&
    value === ALLOWED_POLICY_URL &&
    remoteUrl.candidate === ALLOWED_POLICY_URL &&
    remoteUrl.normalized === ALLOWED_POLICY_URL &&
    getRawSource(dom, html, element, attributeName) === `href="${ALLOWED_POLICY_URL}"`;
}

function isAllowedAnchorText(dom, html, file, textNode, remoteUrl) {
  return file === "privacy-policy.html" &&
    textNode.parentElement?.localName === "a" &&
    textNode.data === ALLOWED_POLICY_URL &&
    remoteUrl.candidate === ALLOWED_POLICY_URL &&
    remoteUrl.normalized === ALLOWED_POLICY_URL &&
    getRawSource(dom, html, textNode) === ALLOWED_POLICY_URL;
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

function decodeCssEscapesOnce(value) {
  let decoded = "";
  let malformed = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      decoded += character;
      continue;
    }

    if (index + 1 >= value.length) {
      malformed = true;
      decoded += character;
      continue;
    }

    const escaped = value[index + 1];
    if (escaped === "\n" || escaped === "\f") {
      index += 1;
      continue;
    }
    if (escaped === "\r") {
      index += value[index + 2] === "\n" ? 2 : 1;
      continue;
    }

    const hex = value.slice(index + 1).match(/^[0-9a-f]{1,6}/i)?.[0];
    if (hex) {
      const codePoint = Number.parseInt(hex, 16);
      if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        malformed = true;
        decoded += "\ufffd";
      } else {
        decoded += String.fromCodePoint(codePoint);
      }
      index += hex.length;
      if (/[ \t\r\n\f]/.test(value[index + 1] ?? "")) {
        if (value[index + 1] === "\r" && value[index + 2] === "\n") index += 1;
        index += 1;
      }
      continue;
    }

    decoded += escaped;
    index += 1;
  }
  return { decoded, malformed };
}

function decodeCssReference(value) {
  const decoder = new JSDOM("<textarea></textarea>").window.document.querySelector("textarea");
  decoder.innerHTML = value;
  return decoder.value;
}

function removeCssComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeCssForRemoteScan(css) {
  const variants = [];
  let current = removeCssComments(css);
  for (let pass = 0; pass < CSS_ESCAPE_NORMALIZATION_LIMIT; pass += 1) {
    variants.push(current);
    const escapeResult = decodeCssEscapesOnce(current);
    if (escapeResult.malformed) return { variants, malformed: true, limitReached: false };
    const normalized = removeCssComments(decodeCssReference(escapeResult.decoded));
    if (normalized === current) return { variants, malformed: false, limitReached: false };
    current = normalized;
  }
  return { variants, malformed: false, limitReached: true };
}

function findCssNetworkTokens(css) {
  const tokens = [];
  for (const string of css.matchAll(/"([^"]*)"|'([^']*)'/g)) tokens.push(string[1] ?? string[2] ?? "");
  for (const url of css.matchAll(/\burl\s*\(([^)]*)\)/gi)) tokens.push(url[1]);
  return tokens;
}

function findNonRelativeUriSchemes(css) {
  return findCssNetworkTokens(css).flatMap((token) => {
    const scheme = token.trim().match(URI_SCHEME_PATTERN)?.[0];
    return scheme ? [scheme] : [];
  });
}

export function validateCssSecurity(css, file = "unknown.css") {
  const problems = [];
  const normalized = normalizeCssForRemoteScan(css);
  if (normalized.malformed) problems.push(`${file}: malformed CSS escape is present`);
  if (normalized.limitReached) problems.push(`${file}: CSS escape normalization limit was reached`);

  const reported = new Set();
  const finalVariant = normalized.variants.at(-1) ?? "";
  for (const remoteUrl of findRemoteUrls(finalVariant)) {
    const problem = `${file}: unexpected remote CSS URL is present: ${remoteUrl.candidate}`;
    if (!reported.has(problem)) problems.push(problem);
    reported.add(problem);
  }
  for (const variant of normalized.variants) {
    if (PERCENT_ENCODING_PATTERN.test(variant)) problems.push(`${file}: unsafe CSS encoding is present`);
    for (const token of findCssNetworkTokens(variant)) {
      for (const remoteUrl of findRemoteUrls(token)) {
        const problem = `${file}: unexpected remote CSS URL is present: ${remoteUrl.candidate}`;
        if (!reported.has(problem)) problems.push(problem);
        reported.add(problem);
      }
    }
    for (const scheme of findNonRelativeUriSchemes(variant)) {
      const problem = `${file}: unexpected remote CSS URL is present: ${scheme}`;
      if (!reported.has(problem)) problems.push(problem);
      reported.add(problem);
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

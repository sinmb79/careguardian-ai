import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_CSP = "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'";

const ALLOWED_HTTP_URLS_BY_FILE = new Map([
  ["privacy-policy.html", new Set(["https://huggingface.co/privacy"])]
]);
const HTTP_URL_PATTERN = /\bhttps?:\/\/[^\s"'<>`]+/gi;
const PROTOCOL_RELATIVE_RESOURCE_PATTERN = /\b(?:href|src|srcset|action|formaction|poster|data|cite|background)\s*=\s*(?:"\s*\/\/[^\"]*"|'\s*\/\/[^']*'|\/\/[^\s>]+)/gi;

function findHttpUrls(html) {
  return [...html.matchAll(HTTP_URL_PATTERN)].map((match) => ({ url: match[0], index: match.index }));
}

function isAllowedHttpUrl(html, file, url, index) {
  if (!ALLOWED_HTTP_URLS_BY_FILE.get(file)?.has(url)) return false;

  const anchorStart = html.lastIndexOf("<a", index);
  const anchorOpenEnd = html.indexOf(">", anchorStart);
  const anchorCloseStart = html.indexOf("</a>", anchorOpenEnd);
  if (anchorStart === -1 || anchorOpenEnd === -1 || anchorCloseStart === -1 || index > anchorCloseStart) return false;

  if (index < anchorOpenEnd) {
    const openingTag = html.slice(anchorStart, anchorOpenEnd + 1);
    for (const href of openingTag.matchAll(/\bhref\s*=\s*(['"])([^'"]*)\1/gi)) {
      if (href[2] !== url) continue;
      const hrefValueIndex = anchorStart + href.index + href[0].indexOf(url);
      if (index === hrefValueIndex) return true;
    }
    return false;
  }

  return !/[<>]/.test(html.slice(anchorOpenEnd + 1, index)) &&
    !/[<>]/.test(html.slice(index + url.length, anchorCloseStart));
}

export function validateHtmlSecurity(html, file = "unknown.html") {
  const problems = [];
  const expectedMeta = `http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}"`;
  if (!html.includes(expectedMeta)) problems.push(`${file}: strict production CSP meta is absent or changed`);
  if (/unsafe-inline|unsafe-eval/i.test(html)) problems.push(`${file}: unsafe CSP execution is enabled`);
  if (/<style\b/i.test(html) || /\sstyle\s*=/i.test(html)) problems.push(`${file}: inline style is prohibited`);
  if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(html)) problems.push(`${file}: inline script is prohibited`);
  if (/\son[a-z]+\s*=/i.test(html)) problems.push(`${file}: inline event handler is prohibited`);
  for (const { url, index } of findHttpUrls(html)) {
    if (!isAllowedHttpUrl(html, file, url, index)) problems.push(`${file}: unexpected remote URL is present: ${url}`);
  }
  if (PROTOCOL_RELATIVE_RESOURCE_PATTERN.test(html)) problems.push(`${file}: unexpected remote resource is present`);
  PROTOCOL_RELATIVE_RESOURCE_PATTERN.lastIndex = 0;
  return problems;
}

function listHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(path);
    return extname(entry.name).toLowerCase() === ".html" ? [path] : [];
  });
}

export function validateBuiltHtmlDirectory(directory) {
  const files = listHtmlFiles(directory);
  const problems = files.flatMap((file) =>
    validateHtmlSecurity(readFileSync(file, "utf8"), relative(directory, file).replaceAll("\\", "/"))
  );
  if (files.length === 0) problems.push("no deployed HTML files were found");
  return {
    gate: "static-security",
    status: problems.length ? "fail" : "pass",
    checkedHtmlFiles: files.map((file) => relative(directory, file).replaceAll("\\", "/")).sort(),
    problems
  };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const report = validateBuiltHtmlDirectory(resolve(import.meta.dirname, "../dist"));
  console.log(JSON.stringify(report, null, 2));
  if (report.problems.length) process.exitCode = 1;
}

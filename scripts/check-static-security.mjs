import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_CSP = "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'";

export function validateHtmlSecurity(html, file = "unknown.html") {
  const problems = [];
  const expectedMeta = `http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}"`;
  if (!html.includes(expectedMeta)) problems.push(`${file}: strict production CSP meta is absent or changed`);
  if (/unsafe-inline|unsafe-eval/i.test(html)) problems.push(`${file}: unsafe CSP execution is enabled`);
  if (/<style\b/i.test(html) || /\sstyle\s*=/i.test(html)) problems.push(`${file}: inline style is prohibited`);
  if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(html)) problems.push(`${file}: inline script is prohibited`);
  if (/\son[a-z]+\s*=/i.test(html)) problems.push(`${file}: inline event handler is prohibited`);
  if (/\bhttps?:\/\//i.test(html)) problems.push(`${file}: unexpected remote URL is present`);
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

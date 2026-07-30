import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(import.meta.dirname, "../dist/index.html");
const html = readFileSync(file, "utf8");
const expected = "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'";
const problems = [];
if (!html.includes(`http-equiv="Content-Security-Policy" content="${expected}"`)) problems.push("strict production CSP meta is absent or changed");
if (/unsafe-inline|unsafe-eval/i.test(html)) problems.push("generated shell allows unsafe CSP execution");
if (/https?:\/\/(?!localhost)/i.test(html)) problems.push("generated shell includes an unexpected remote URL");
console.log(JSON.stringify({ gate: "static-security", status: problems.length ? "fail" : "pass", problems }, null, 2));
if (problems.length) process.exitCode = 1;

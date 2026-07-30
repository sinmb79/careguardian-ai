import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { EXPECTED_CSP, validateHtmlSecurity } from "./check-static-security.mjs";

const privacyHtml = readFileSync(resolve(import.meta.dirname, "../public/privacy-policy.html"), "utf8");

test("accepts the CSP-compatible public privacy page", () => {
  assert.deepEqual(validateHtmlSecurity(privacyHtml, "privacy-policy.html"), []);
});

test("rejects a remote script added to a public HTML file", () => {
  const mutated = privacyHtml.replace(
    "</body>",
    '<script src="https://attacker.example/payload.js"></script></body>'
  );
  assert.match(validateHtmlSecurity(mutated, "privacy-policy.html").join("\n"), /remote URL/);
});

test("rejects inline execution and style even when the exact CSP remains", () => {
  const mutated = privacyHtml
    .replace("</head>", "<style>body{display:none}</style></head>")
    .replace("</body>", '<button onclick="run()">run</button><script>run()</script></body>');
  const problems = validateHtmlSecurity(mutated, "privacy-policy.html").join("\n");
  assert.match(problems, /inline style/);
  assert.match(problems, /inline script/);
  assert.match(problems, /inline event/);
  assert.ok(mutated.includes(EXPECTED_CSP));
});

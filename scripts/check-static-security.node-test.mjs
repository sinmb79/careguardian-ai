import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { EXPECTED_CSP, validateHtmlSecurity } from "./check-static-security.mjs";

const privacyHtml = readFileSync(resolve(import.meta.dirname, "../public/privacy-policy.html"), "utf8");

test("accepts the CSP-compatible public privacy page", () => {
  assert.deepEqual(validateHtmlSecurity(privacyHtml, "privacy-policy.html"), []);
});

test("allows only the exact Hugging Face privacy URL in the public privacy page", () => {
  const problems = validateHtmlSecurity(
    `<!doctype html><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}"><a href="https://huggingface.co/privacy">https://huggingface.co/privacy</a>`,
    "privacy-policy.html"
  );
  assert.deepEqual(problems, []);
});

test("rejects the exact Hugging Face privacy URL outside the public privacy page", () => {
  const problems = validateHtmlSecurity(
    `<!doctype html><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}"><a href="https://huggingface.co/privacy">https://huggingface.co/privacy</a>`,
    "index.html"
  ).join("\n");
  assert.match(problems, /unexpected remote URL.*https:\/\/huggingface\.co\/privacy/);
});

test("rejects every mutation of the allowed HTTPS policy URL", () => {
  const mutations = [
    "http://huggingface.co/privacy",
    "https://huggingface.co/privacy?tracking=1",
    "https://huggingface.co/privacy#section",
    "https://huggingface.co/privacy/",
    "https://huggingface.co:443/privacy",
    "https://user@huggingface.co/privacy",
    "https://privacy.huggingface.co/privacy",
    "https://huggingface.co.evil.example/privacy",
    "https://huggingface.co/privacy/extra",
    "https://third-party.example/privacy"
  ];

  for (const url of mutations) {
    const problems = validateHtmlSecurity(
      `<!doctype html><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}"><a href="${url}">${url}</a>`,
      "privacy-policy.html"
    ).join("\n");
    assert.match(problems, new RegExp(`unexpected remote URL.*${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("rejects remote resources including protocol-relative references", () => {
  const resources = [
    '<script src="https://attacker.example/payload.js"></script>',
    '<link rel="stylesheet" href="https://attacker.example/site.css">',
    '<img src="https://attacker.example/pixel.png">',
    '<form action="https://attacker.example/submit"></form>',
    '<img src="//attacker.example/pixel.png">'
  ];

  for (const resource of resources) {
    const problems = validateHtmlSecurity(
      `<!doctype html><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}">${resource}`,
      "privacy-policy.html"
    ).join("\n");
    assert.match(problems, /unexpected remote (URL|resource)/);
  }
});

test("rejects the allowed policy URL when used by a remote resource", () => {
  const exactPolicyUrl = "https://huggingface.co/privacy";
  const resources = [
    `<script src="${exactPolicyUrl}"></script>`,
    `<link rel="stylesheet" href="${exactPolicyUrl}">`,
    `<img src="${exactPolicyUrl}">`,
    `<form action="${exactPolicyUrl}"></form>`
  ];

  for (const resource of resources) {
    const problems = validateHtmlSecurity(
      `<!doctype html><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}">${resource}`,
      "privacy-policy.html"
    ).join("\n");
    assert.match(problems, /unexpected remote (URL|resource)/);
  }
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

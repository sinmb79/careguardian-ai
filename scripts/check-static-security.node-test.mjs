import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { EXPECTED_CSP, validateBuiltHtmlDirectory, validateCssSecurity, validateHtmlSecurity } from "./check-static-security.mjs";

const privacyHtml = readFileSync(resolve(import.meta.dirname, "../public/privacy-policy.html"), "utf8");
const exactPolicyUrl = "https://huggingface.co/privacy";

function htmlWithCsp(body) {
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}">${body}`;
}

test("accepts the CSP-compatible public privacy page", () => {
  assert.deepEqual(validateHtmlSecurity(privacyHtml, "privacy-policy.html"), []);
});

test("allows only the exact Hugging Face privacy URL in the public privacy page", () => {
  const problems = validateHtmlSecurity(
    htmlWithCsp(`<a href="${exactPolicyUrl}">${exactPolicyUrl}</a>`),
    "privacy-policy.html"
  );
  assert.deepEqual(problems, []);
});

test("rejects the exact Hugging Face privacy URL outside the public privacy page", () => {
  const problems = validateHtmlSecurity(
    htmlWithCsp(`<a href="${exactPolicyUrl}">${exactPolicyUrl}</a>`),
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

test("requires a real strict CSP meta element instead of a comment", () => {
  const commentedCsp = `<!-- <meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}"> --><script src="/same-origin.js"></script>`;
  assert.match(validateHtmlSecurity(commentedCsp, "privacy-policy.html").join("\n"), /strict production CSP meta/);
});

test("rejects the exact policy URL on an area instead of an anchor", () => {
  const html = htmlWithCsp(`<map name="m"><area href="${exactPolicyUrl}"></map></a>`);
  assert.match(validateHtmlSecurity(html, "privacy-policy.html").join("\n"), /unexpected remote URL/);
});

test("rejects decoded entity, hex, decimal, and protocol-relative remote HTML URLs", () => {
  const vectors = [
    '<a href="https&#x3A;//attacker.example/steal">click</a>',
    '<script src="https&#58;//attacker.example/x.js"></script>',
    '<link rel="stylesheet" href="https&#58;//attacker.example/payload.css">',
    '<img src="https&#x3a;//attacker.example/pixel.png">',
    '<img srcset="https&#x3A;//attacker.example/pixel.png 1x" src="/safe.png">',
    '<object data="https&#x3A;//attacker.example/payload"></object>',
    '<meta http-equiv="refresh" content="0;url=https&#x3A;//attacker.example/next">',
    '<meta http-equiv="refresh" content="0;url=//attacker.example/next">',
    '<img src="&#47;&#47;attacker.example/pixel.png">',
    '<img srcset="&#47;&#47;attacker.example/pixel.png 1x" src="/safe.png">',
    '<meta http-equiv="refresh" content="0;url=&#47;&#47;attacker.example/next">'
  ];

  for (const vector of vectors) {
    assert.match(validateHtmlSecurity(htmlWithCsp(vector), "privacy-policy.html").join("\n"), /unexpected remote URL/);
  }
});

test("rejects semicolonless numeric references in the exact policy anchor contract", () => {
  const vectors = [
    '<a href="https&#58//huggingface.co/privacy">https&#58//huggingface.co/privacy</a>',
    '<a href="https&#x3A//huggingface.co/privacy">https&#x3A//huggingface.co/privacy</a>'
  ];

  for (const vector of vectors) {
    assert.match(validateHtmlSecurity(htmlWithCsp(vector), "privacy-policy.html").join("\n"), /unexpected remote URL/);
  }
});

test("rejects browser-normalized backslash and control-character HTML URLs", () => {
  const vectors = [
    '<img src="https:\\\\attacker.example/two.png">',
    '<img src="\\\\attacker.example/protocol.png">',
    '<img src="https:/&#x09;/attacker.example/tab.png">',
    '<img src="https:/&#x0A;/attacker.example/newline.png">',
    '<meta http-equiv="refresh" content="0;url=https:\\\\attacker.example/next">',
    '<meta http-equiv="refresh" content="0;url=https:/&#x09;/attacker.example/next">',
    '<meta http-equiv="refresh" content="0;url=https:/&#x0A;/attacker.example/next">',
    '<script src="https:\\\\attacker.example/x.js"></script>',
    '<link rel="stylesheet" href="https:\\\\attacker.example/x.css">'
  ];

  for (const vector of vectors) {
    assert.match(validateHtmlSecurity(htmlWithCsp(vector), "privacy-policy.html").join("\n"), /unexpected remote URL/);
  }
});

test("rejects remote URLs across network-capable element attributes", () => {
  const vectors = [
    '<a href="https://attacker.example/a">a</a>',
    '<iframe src="https://attacker.example/frame"></iframe>',
    '<source src="https://attacker.example/media">',
    '<audio src="https://attacker.example/audio"></audio>',
    '<video poster="https://attacker.example/poster"></video>',
    '<embed src="https://attacker.example/embed">',
    '<base href="https://attacker.example/base/">',
    '<form action="https://attacker.example/form"><button formaction="https://attacker.example/button"></button></form>',
    '<blockquote cite="https://attacker.example/citation"></blockquote>',
    '<table background="https://attacker.example/background.png"></table>'
  ];

  for (const vector of vectors) {
    assert.match(validateHtmlSecurity(htmlWithCsp(vector), "privacy-policy.html").join("\n"), /unexpected remote URL/);
  }
});

test("checks deployed CSS for remote import, URL, entity, escape, and protocol-relative references", () => {
  const directory = mkdtempSync(join(tmpdir(), "careguardian-static-security-"));
  try {
    writeFileSync(join(directory, "index.html"), htmlWithCsp('<link rel="stylesheet" href="site.css">'), "utf8");
    writeFileSync(join(directory, "site.css"), [
      '@import url("https://attacker.example/import.css");',
      '.one { background: url("https://attacker.example/asset.png"); }',
      '.two { background: url("https&#x3A;//attacker.example/entity.png"); }',
      '.three { background: url(https\\3a //attacker.example/escaped.png); }',
      '.four { background: url("//attacker.example/protocol-relative.png"); }'
    ].join("\n"), "utf8");
    const report = validateBuiltHtmlDirectory(directory);
    assert.equal(report.status, "fail");
    assert.match(report.problems.join("\n"), /site\.css: unexpected remote CSS URL/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("accepts deployed local CSS references", () => {
  const directory = mkdtempSync(join(tmpdir(), "careguardian-static-security-"));
  try {
    writeFileSync(join(directory, "index.html"), htmlWithCsp('<link rel="stylesheet" href="site.css">'), "utf8");
    writeFileSync(join(directory, "site.css"), '@import url("theme.css"); .safe { background: url("/icons/check.svg"); }', "utf8");
    assert.equal(validateBuiltHtmlDirectory(directory).status, "pass");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("accepts local escaped selectors and media feature conditions", () => {
  const localCss = String.raw`.bg-surface\/90 { color: rgb(24 37 37 / .9); }
@media (min-width: 640px) { .sm\:p-6 { padding: 1.5rem; } }`;
  assert.deepEqual(validateCssSecurity(localCss, "site.css"), []);
});

test("rejects CSS escaped URL and import identifiers plus quoted backslash URLs", () => {
  const vectors = [
    'body { background-image: u\\72l("https://attacker.example/function.png"); }',
    '@\\69mport "https://attacker.example/import.css";',
    'body { background-image: url("https:\\\\attacker.example/backslash.png"); }'
  ];

  for (const css of vectors) {
    assert.match(validateCssSecurity(css, "site.css").join("\n"), /unexpected remote CSS URL/);
  }
});

test("rejects remote schemes across image-set strings and normalized CSS tokens", () => {
  const vectors = [
    'body { background: image-set("https://attacker.example/standard.png" 1x); }',
    'body { background: -webkit-image-set("https://attacker.example/webkit.png" 1x); }',
    'body { background: image-set("https://attacker.example/quoted.png" 1x, "https://attacker.example/second.png" 2x); }',
    "body { background: image-set('https://attacker.example/single-quoted.png' 1x); }",
    'body { background: image-set(url(https://attacker.example/unquoted.png) 1x); }',
    'body { background: image-set(url("https://attacker.example/nested.png") 1x); }',
    'body { background: ImAgE-SeT( "https://attacker.example/case.png" 1x ); }',
    'body { background: image/**/-set(/**/"https://attacker.example/comment.png"/**/ 1x); }',
    'body { background: image-set(\n\t"https:/\t/attacker.example/whitespace.png" 1x); }',
    'body { background: im\\61ge-set("h\\74tps://attacker.example/escaped.png" 1x); }',
    ':root { --remote-source: "https://attacker.example/token.png"; }'
  ];

  for (const css of vectors) {
    assert.match(validateCssSecurity(css, "site.css").join("\n"), /unexpected remote CSS URL/);
  }

  const multiple = validateCssSecurity(
    'body { background: image-set("https://attacker.example/one.png" 1x, url(https://attacker.example/two.png) 2x); }',
    "site.css"
  );
  assert.ok(multiple.length >= 2);
});

test("rejects image-set remote strings in the deployed CSS gate", () => {
  const directory = mkdtempSync(join(tmpdir(), "careguardian-static-security-"));
  try {
    writeFileSync(join(directory, "index.html"), htmlWithCsp('<link rel="stylesheet" href="site.css">'), "utf8");
    writeFileSync(join(directory, "site.css"), 'body { background: -webkit-image-set("https://attacker.example/webkit.png" 1x); }', "utf8");
    const report = validateBuiltHtmlDirectory(directory);
    assert.equal(report.status, "fail");
    assert.match(report.problems.join("\n"), /site\.css: unexpected remote CSS URL/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects percent-encoded and base64 data stylesheet payloads", () => {
  const vectors = [
    '@import url("data:text/css,%40import%20url(%22https%3A%2F%2Fattacker.example%2Fnested.css%22)%3B");',
    '@import url("data:text/css;charset=utf-8,%40import%20%22https%3A%2F%2Fattacker.example%2Fnested.css%22%3B");',
    '@import url("data:application/css,%40import%20url(%22https%3A%2F%2Fattacker.example%2Fnested.css%22)%3B");',
    '@import url("data:text/css;base64,QGltcG9ydCB1cmwoImh0dHBzOi8vYXR0YWNrZXIuZXhhbXBsZS9uZXN0ZWQuY3NzIik7");'
  ];

  for (const css of vectors) {
    assert.match(validateCssSecurity(css, "site.css").join("\n"), /unexpected remote CSS URL/);
  }
});

test("rejects every non-relative CSS URI scheme and encoded scheme form", () => {
  const schemes = [
    'url("data:text/css,body{}")',
    'url("blob:opaque-identifier")',
    'url("javascript:alert(1)")',
    'url("file:///private/site.css")',
    'url("filesystem:temporary/site.css")',
    'url("ftp://attacker.example/site.css")',
    'url("custom+transport:opaque")',
    'url("d\\61ta:text/css,body{}")',
    'url("d&#97;ta:text/css,body{}")'
  ];

  for (const reference of schemes) {
    assert.match(validateCssSecurity(`body { background: ${reference}; }`, "site.css").join("\n"), /unexpected remote CSS URL/);
  }

  const percentEncodedScheme = 'body { background: url("%64%61%74%61%3Atext/css,body{}"); }';
  assert.match(validateCssSecurity(percentEncodedScheme, "site.css").join("\n"), /unsafe CSS encoding/);
});

test("normalizes CSS escapes to a bounded fixed point and fails closed on malformed input", () => {
  const twiceEscapedData = 'body { background: url("d\\5c 61ta:text/css,body{}"); }';
  assert.match(validateCssSecurity(twiceEscapedData, "site.css").join("\n"), /unexpected remote CSS URL/);

  let overLimit = 'd\\61ta:text/css,body{}';
  for (let depth = 0; depth < 10; depth += 1) overLimit = overLimit.replaceAll("\\", "\\5c ");
  assert.match(validateCssSecurity(`body { background: url("${overLimit}"); }`, "site.css").join("\n"), /CSS escape normalization limit/);

  const malformed = 'body { --local-token: "local' + "\\";
  assert.match(validateCssSecurity(malformed, "site.css").join("\n"), /malformed CSS escape/);
});

test("rejects data stylesheets in the deployed CSS gate", () => {
  const directory = mkdtempSync(join(tmpdir(), "careguardian-static-security-"));
  try {
    writeFileSync(join(directory, "index.html"), htmlWithCsp('<link rel="stylesheet" href="site.css">'), "utf8");
    writeFileSync(
      join(directory, "site.css"),
      '@import url("data:text/css,%40import%20url(%22https%3A%2F%2Fattacker.example%2Fnested.css%22)%3B");',
      "utf8"
    );
    const report = validateBuiltHtmlDirectory(directory);
    assert.equal(report.status, "fail");
    assert.match(report.problems.join("\n"), /site\.css: unexpected remote CSS URL/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
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

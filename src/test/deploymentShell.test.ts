import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const fromRepositoryRoot = (path: string) => resolve(process.cwd(), path);

describe("deployed web shell", () => {
  test("uses the life steward PWA identity", () => {
    const html = readFileSync(fromRepositoryRoot("index.html"), "utf8");
    const viteConfig = readFileSync(fromRepositoryRoot("vite.config.ts"), "utf8");

    expect(html).toContain("생활후견 AI");
    expect(viteConfig).toContain('name: "생활후견 AI"');
    expect(viteConfig).not.toMatch(/CareGuardian|caregiving/i);
  });

  test("describes only the current browser-local non-medical web behavior in privacy policy", () => {
    const policy = readFileSync(fromRepositoryRoot("public/privacy-policy.html"), "utf8");

    expect(policy).toContain("IndexedDB");
    expect(policy).not.toMatch(/localStorage/i);
    expect(policy).not.toMatch(/SpeechRecognition|CareManual|복약|릴레이|고정 passphrase/i);
  });
});

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

  test("describes the current IndexedDB workspace and legacy localStorage cleanup", () => {
    const policy = readFileSync(fromRepositoryRoot("public/privacy-policy.html"), "utf8");

    expect(policy).toContain(
      "웹 PWA의 현재 사용자 작업공간은 브라우저 IndexedDB에 저장합니다."
    );
    expect(policy).toContain(
      "이전 버전의 앱 소유 localStorage 키가 남아 있을 수 있으며 웹 삭제 기능은 이를 함께 제거합니다."
    );
    expect(policy).not.toContain(
      "현재 사용자 작업공간은 브라우저 localStorage에 저장합니다."
    );
    expect(policy).not.toMatch(/SpeechRecognition|CareManual|복약|릴레이|고정 passphrase/i);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "public/privacy-policy.html"),
  "utf8"
);
const policy = new DOMParser().parseFromString(source, "text/html");
const policyText = policy.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

describe("public privacy policy contract", () => {
  test("keeps Korean primary and exposes an English reference target", () => {
    expect(policy.documentElement.lang).toBe("ko");

    const englishLink = policy.querySelector<HTMLAnchorElement>(
      'a[href="#english"]'
    );
    expect(englishLink).not.toBeNull();
    expect(englishLink?.textContent ?? "").toContain("English");

    const englishSection = policy.querySelector<HTMLElement>("#english");
    expect(englishSection).not.toBeNull();
    expect(englishSection?.lang).toBe("en");
    expect(englishSection?.querySelector("h1")?.textContent).toBe(
      "Life Steward AI Privacy Policy"
    );
  });

  test("states the exact non-medical product scope in both languages", () => {
    expect(policyText).toContain(
      "생활후견 AI는 일반 개인 생산성 앱이며 건강·의료 기능을 제공하거나 건강 데이터를 다루지 않습니다."
    );
    expect(policyText).toContain(
      "Life Steward AI is a general personal-productivity app and does not provide health or medical features or handle health data."
    );
  });

  test("describes the two-model choice and complete local deletion boundaries", () => {
    expect(policyText).toContain(
      "승인·고정된 NAVER HyperCLOVA X GGUF 2개 중 선택한 모델 하나"
    );
    expect(policyText).toContain(
      "one selected model from two approved, pinned NAVER HyperCLOVA X GGUF files"
    );
    expect(policyText).toContain(
      "IndexedDB의 사용자 레코드를 삭제 상태를 나타내는 비식별 tombstone으로 바꾸고 이전 버전의 앱 소유 localStorage 키를 제거합니다."
    );
    expect(policyText).toContain(
      "The web deletion action replaces the IndexedDB user record with a data-free tombstone and removes app-owned legacy localStorage keys."
    );
    expect(policyText).toContain(
      "Hugging Face가 독립적으로 보관하는 외부 기록은 앱의 삭제 기능으로 지울 수 없습니다."
    );
  });

  test("scopes Android protection and boot restoration without duplicating the English summary", () => {
    expect(policyText).toContain(
      "현재 Google Play용 Android 앱은 작업공간을 SQLCipher 데이터베이스에 저장하고 데이터베이스 키를 SecureStore와 Android Keystore 경계에 분리합니다."
    );
    expect(policyText).toContain(
      "RECEIVE_BOOT_COMPLETED는 기기 재시작 또는 앱 업데이트 뒤 미래의 로컬 일정 알림을 복원하는 데만 사용합니다."
    );
    expect(policyText).toContain(
      "The current Google Play Android app stores its workspace in SQLCipher and separates the database key through SecureStore and the Android Keystore boundary."
    );
    expect(source).not.toContain(
      "<p>There are no accounts, ads, analytics SDKs, or remote push."
    );
  });
});

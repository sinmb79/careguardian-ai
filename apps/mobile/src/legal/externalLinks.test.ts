import { describe, expect, test } from "vitest";
import {
  HUGGING_FACE_PRIVACY_POLICY_URL,
  PRIVACY_POLICY_URL,
  openApprovedExternalLink
} from "./externalLinks";

describe("approved external links", () => {
  test("opens only the two exact HTTPS policy URLs", async () => {
    const opened: string[] = [];
    const opener = async (url: string) => {
      opened.push(url);
    };

    await expect(openApprovedExternalLink(PRIVACY_POLICY_URL, opener)).resolves.toEqual({
      ok: true
    });
    await expect(
      openApprovedExternalLink(HUGGING_FACE_PRIVACY_POLICY_URL, opener)
    ).resolves.toEqual({ ok: true });

    expect(opened).toEqual([PRIVACY_POLICY_URL, HUGGING_FACE_PRIVACY_POLICY_URL]);
  });

  test.each([
    "http://sinmb79.github.io/careguardian-ai/privacy-policy.html",
    "https://sinmb79.github.io/careguardian-ai/privacy-policy.html?next=https://evil.example",
    "https://sinmb79.github.io.evil.example/careguardian-ai/privacy-policy.html",
    "https://huggingface.co/privacy/",
    "https://huggingface.co.evil.example/privacy"
  ])("blocks an unapproved or altered URL: %s", async (url) => {
    const opener = async () => {
      throw new Error("must not be called");
    };

    await expect(openApprovedExternalLink(url, opener)).resolves.toEqual({
      ok: false,
      kind: "blocked"
    });
  });

  test("returns a typed failure when the platform cannot open the approved link", async () => {
    const result = await openApprovedExternalLink(PRIVACY_POLICY_URL, async () => {
      throw new Error("no browser");
    });

    expect(result).toEqual({ ok: false, kind: "open-failed" });
  });
});

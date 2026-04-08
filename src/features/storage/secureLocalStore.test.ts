import { describe, expect, test } from "vitest";
import { decryptJson, encryptJson } from "./secureLocalStore";

describe("secureLocalStore", () => {
  test("encrypts and decrypts JSON payloads", async () => {
    const encrypted = await encryptJson({ name: "수호" }, "demo-passphrase");
    const decrypted = await decryptJson<{ name: string }>(
      encrypted,
      "demo-passphrase"
    );

    expect(encrypted.cipherText).not.toContain("수호");
    expect(decrypted).toEqual({ name: "수호" });
  });
});

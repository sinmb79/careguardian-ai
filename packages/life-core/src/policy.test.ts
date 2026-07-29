import { describe, expect, test } from "vitest";
import { detectRestrictedHealthIntent } from "./index";

describe("restricted health intent policy", () => {
  test("blocks Korean medication requests after Unicode and punctuation normalization", () => {
    expect(detectRestrictedHealthIntent("약 먹을 시간 알려줘")).toMatchObject({
      allowed: false,
      reasonCode: "restricted_health_intent",
    });
  });

  test("blocks English diagnosis and prescription requests", () => {
    expect(detectRestrictedHealthIntent("Please diagnose my symptoms").allowed).toBe(false);
    expect(detectRestrictedHealthIntent("renew my prescription").allowed).toBe(false);
  });

  test("allows ordinary non-medical life management", () => {
    expect(detectRestrictedHealthIntent("외출 준비물 목록")).toEqual({ allowed: true });
  });
});

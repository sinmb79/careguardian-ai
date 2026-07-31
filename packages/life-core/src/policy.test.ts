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

  test("blocks Korean allergy intent", () => {
    expect(detectRestrictedHealthIntent("알레르기 증상을 기록해줘").allowed).toBe(false);
  });

  test("blocks Korean disease intent", () => {
    expect(detectRestrictedHealthIntent("질환 정보를 정리해줘").allowed).toBe(false);
  });

  test("blocks Korean rehabilitation intent", () => {
    expect(detectRestrictedHealthIntent("재활 일정을 추천해줘").allowed).toBe(false);
  });

  test("blocks Korean health intent", () => {
    expect(detectRestrictedHealthIntent("건강 상태를 요약해줘").allowed).toBe(false);
  });

  test("blocks health-measurement expressions", () => {
    expect(detectRestrictedHealthIntent("혈압을 기록해줘").allowed).toBe(false);
    expect(detectRestrictedHealthIntent("track my blood pressure").allowed).toBe(false);
  });

  test("allows a general-life appointment using 약속", () => {
    expect(detectRestrictedHealthIntent("친구와 약속 시간 정하기")).toEqual({ allowed: true });
  });

  test("allows a general-life reservation using 예약", () => {
    expect(detectRestrictedHealthIntent("식당 예약하기")).toEqual({ allowed: true });
  });

  test("allows ordinary non-medical life management", () => {
    expect(detectRestrictedHealthIntent("외출 준비물 목록")).toEqual({ allowed: true });
  });
});

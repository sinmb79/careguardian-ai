import { describe, expect, test } from "vitest";
import { validateExtension } from "./index";

describe("extension validation", () => {
  test("accepts a manual task extension", () => {
    expect(
      validateExtension({
        id: "trip",
        title: "외출 준비",
        fields: [{ id: "bag", label: "준비물", kind: "text" }],
        automations: [{ trigger: "manual", action: "createTask" }],
      }).ok,
    ).toBe(true);
  });

  test("rejects unknown fields, unsupported field kinds, and oversized definitions", () => {
    const result = validateExtension({
      id: "trip plan",
      title: "외출 준비",
      fields: Array.from({ length: 51 }, (_, index) => ({ id: `field-${index}`, label: "준비물", kind: "unknown" })),
      automations: [{ trigger: "automatic", action: "createTask" }],
      aiActions: ["diagnose"],
      extra: true,
    });

    expect(result.ok).toBe(false);
  });
});

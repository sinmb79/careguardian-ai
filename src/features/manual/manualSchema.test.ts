import { describe, expect, test } from "vitest";
import { createEmptyCareManual } from "./manualSchema";

describe("createEmptyCareManual", () => {
  test("returns a manual with the required Phase 0 sections", () => {
    const manual = createEmptyCareManual();

    expect(manual.subject.name).toBe("");
    expect(manual.care_manual_version).toBe("1.0");
    expect(Object.keys(manual.sections)).toEqual(
      expect.arrayContaining([
        "daily_routine",
        "medication",
        "communication",
        "emotional"
      ])
    );
  });
});

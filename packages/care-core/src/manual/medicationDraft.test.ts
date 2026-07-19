import { describe, expect, test } from "vitest";
import { updateMedicationName, updateMedicationTiming } from "./medicationDraft";

describe("medication draft updates", () => {
  test("does not invent a dose, time, or method when a medication name is entered", () => {
    expect(updateMedicationName(undefined, "가상약")).toEqual([
      {
        name: "가상약",
        dosage: "",
        timing: "",
        method: "",
        warnings: "",
        photo: ""
      }
    ]);
  });

  test("does not invent a dose or method when a time is entered first", () => {
    expect(updateMedicationTiming(undefined, "08:30")).toEqual([
      {
        name: "",
        dosage: "",
        timing: "08:30",
        method: "",
        warnings: "",
        photo: ""
      }
    ]);
  });

  test("preserves only values that were already explicitly entered", () => {
    const existing = {
      name: "가상약",
      dosage: "직접 입력한 용량",
      timing: "08:30",
      method: "직접 입력한 방법",
      warnings: "가상 주의사항",
      photo: ""
    };

    expect(updateMedicationName(existing, "가상약 B")[0]).toEqual({
      ...existing,
      name: "가상약 B"
    });
    expect(updateMedicationTiming(existing, "09:00")[0]).toEqual({
      ...existing,
      timing: "09:00"
    });
  });

  test("removes the draft when its name is cleared", () => {
    expect(updateMedicationName(undefined, "")).toEqual([]);
  });
});

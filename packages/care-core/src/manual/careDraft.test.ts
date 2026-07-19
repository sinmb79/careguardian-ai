import { describe, expect, test } from "vitest";
import {
  updateMorningRoutine,
  updateRelayTargetContact,
  updateRelayTargetName
} from "./careDraft";

describe("care draft updates", () => {
  test("does not invent care instructions for a newly named routine", () => {
    expect(updateMorningRoutine(undefined, "가상 아침 일정")).toEqual([
      { title: "가상 아침 일정", notes: "" }
    ]);
  });

  test("does not invent a family relationship for a relay target", () => {
    expect(updateRelayTargetName(undefined, "가상 연락 대상")).toEqual([
      { name: "가상 연락 대상", relation: "", contact: "", priority: 1 }
    ]);
    expect(updateRelayTargetContact(undefined, "000-0000-0000")).toEqual([
      { name: "", relation: "", contact: "000-0000-0000", priority: 1 }
    ]);
  });

  test("preserves instructions and relationships that were explicitly entered", () => {
    expect(updateMorningRoutine({ title: "기존", notes: "직접 입력한 메모" }, "변경")).toEqual([
      { title: "변경", notes: "직접 입력한 메모" }
    ]);
    expect(
      updateRelayTargetName(
        { name: "기존", relation: "직접 입력한 관계", contact: "000", priority: 2 },
        "변경"
      )
    ).toEqual([
      { name: "변경", relation: "직접 입력한 관계", contact: "000", priority: 2 }
    ]);
  });
});

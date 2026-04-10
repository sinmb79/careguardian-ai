import { describe, expect, test } from "vitest";
import { makeFixtureManual } from "../test/fixtures/manual";
import { generateCompanionReply } from "./companionEngine";

describe("generateCompanionReply", () => {
  test("answers a daily plan question with manual context", () => {
    const result = generateCompanionReply({
      manual: makeFixtureManual(),
      message: "오늘 뭐 해?"
    });

    expect(result.reply).toContain("수호");
    expect(result.reply).toContain("아침 식사");
  });

  test("suggests calming methods when anxiety is mentioned", () => {
    const result = generateCompanionReply({
      manual: makeFixtureManual(),
      message: "불안해"
    });

    expect(result.reply).toContain("조용한 목소리");
    expect(result.references).toContain("calming_methods");
  });
});

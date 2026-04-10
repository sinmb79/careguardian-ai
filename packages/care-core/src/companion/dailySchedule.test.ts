import { describe, expect, test } from "vitest";
import { makeFixtureManual } from "../test/fixtures/manual";
import { buildDailyScheduleCards } from "./dailySchedule";

describe("buildDailyScheduleCards", () => {
  test("builds schedule cards from routines and medication", () => {
    const cards = buildDailyScheduleCards(makeFixtureManual());

    expect(cards[0].title).toContain("아침");
    expect(cards.some((card) => card.kind === "medication")).toBe(true);
    expect(cards.some((card) => card.description.includes("파란 컵"))).toBe(true);
  });
});

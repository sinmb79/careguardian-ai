import { describe, expect, test } from "vitest";
import { makeFixtureManual } from "../test/fixtures/manual";
import { buildMedicationTimeline } from "./medicationReminders";

describe("buildMedicationTimeline", () => {
  test("builds reminder cards from medication timing strings", () => {
    const manual = makeFixtureManual();
    manual.sections.medication.drugs[0].timing = "08:30";

    const reminders = buildMedicationTimeline(manual, new Date(2026, 3, 9, 7, 0, 0));

    expect(reminders[0].label).toContain("08:30");
    expect(reminders[0].status).toBe("upcoming");
  });

  test("marks overdue medication when the time has passed", () => {
    const manual = makeFixtureManual();
    manual.sections.medication.drugs[0].timing = "08:30";

    const reminders = buildMedicationTimeline(manual, new Date(2026, 3, 9, 10, 0, 0));

    expect(reminders[0].status).toBe("overdue");
  });
});

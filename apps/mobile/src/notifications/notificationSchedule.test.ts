import { describe, expect, test } from "vitest";
import { makeMobileFixtureManual } from "../test/fixtureManual";
import { buildMedicationNotificationRequests } from "./notificationSchedule";

describe("buildMedicationNotificationRequests", () => {
  test("creates future-dated local notification requests from medication times", () => {
    const requests = buildMedicationNotificationRequests(
      makeMobileFixtureManual(),
      new Date(2026, 3, 10, 7, 0, 0)
    );

    expect(requests).toHaveLength(2);
    expect(requests[0].content.title).toContain("복약");
    expect(requests[0].content.body).toContain("빨간 알약");
    expect(requests[0].date.getHours()).toBe(8);
    expect(requests[0].date.getMinutes()).toBe(30);
  });

  test("rolls past times forward to the next day", () => {
    const requests = buildMedicationNotificationRequests(
      makeMobileFixtureManual(),
      new Date(2026, 3, 10, 22, 0, 0)
    );

    expect(requests[0].date.getDate()).toBe(11);
    expect(requests[0].date.getHours()).toBe(8);
    expect(requests[1].date.getDate()).toBe(11);
  });
});

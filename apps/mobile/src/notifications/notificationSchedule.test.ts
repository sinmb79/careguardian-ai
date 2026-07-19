import { describe, expect, test } from "vitest";
import { makeMobileFixtureManual } from "../test/fixtureManual";
import {
  buildMedicationNotificationRequests,
  MEDICATION_NOTIFICATION_DISCLOSURE
} from "./notificationSchedule";

describe("buildMedicationNotificationRequests", () => {
  test("creates privacy-safe daily notification requests from strictly valid medication times", () => {
    const requests = buildMedicationNotificationRequests(
      makeMobileFixtureManual(),
      new Date(2026, 3, 10, 7, 0, 0)
    );

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      schedule: { hour: 8, minute: 30 },
      content: {
        title: "복약 알림",
        body: "지금 알림을 확인해주세요.",
        data: { notificationType: "medication-reminder" }
      }
    });
    expect(JSON.stringify(requests[0].content)).not.toContain("비");
    expect(JSON.stringify(requests[0].content)).not.toContain("물");
    expect(JSON.stringify(requests[0].content)).not.toContain("08:30");
  });

  test("rejects malformed or out-of-range times instead of normalizing them", () => {
    const manual = makeMobileFixtureManual();
    manual.sections.medication.drugs = manual.sections.medication.drugs.map((drug, index) => ({
      ...drug,
      timing: ["8:30", "24:00"][index]
    }));

    expect(buildMedicationNotificationRequests(manual)).toEqual([]);
  });

  test("describes reminders as recurring attempts rather than a one-time next dose", () => {
    expect(MEDICATION_NOTIFICATION_DISCLOSURE).toContain("매일");
    expect(MEDICATION_NOTIFICATION_DISCLOSURE).toContain("누락");
    expect(MEDICATION_NOTIFICATION_DISCLOSURE).not.toContain("가장 가까운 다음");
  });
});

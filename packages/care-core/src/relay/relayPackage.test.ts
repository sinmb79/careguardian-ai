import { describe, expect, test } from "vitest";
import { makeFixtureManual } from "../test/fixtures/manual";
import { buildRelayPackage } from "./relayPackage";

describe("buildRelayPackage", () => {
  test("creates a relay summary with readiness score and key instructions", () => {
    const manual = makeFixtureManual();
    manual.subject.emergency_contacts = ["이모 010-0000-0000"];
    manual.relay_targets = [
      {
        name: "이모",
        relation: "가족",
        contact: "010-0000-0000",
        priority: 1
      }
    ];

    const relayPackage = buildRelayPackage(manual);

    expect(relayPackage.readinessScore).toBeGreaterThan(70);
    expect(relayPackage.summary).toContain("수호");
    expect(relayPackage.keyActions.some((item) => item.includes("파란 컵"))).toBe(true);
  });
});

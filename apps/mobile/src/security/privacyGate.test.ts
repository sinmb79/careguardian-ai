import { describe, expect, test } from "vitest";
import { createEmptyCareManual } from "@careguardian/care-core/manual";
import {
  createPrivacyGateState,
  isSensitiveUiVisible,
  lockedProfileStatusMessage,
  medicationConsentFingerprint,
  resolveSensitiveProfileUnlock,
  shouldLockCareManualOnBackground,
  requiresMedicationConsent
} from "./privacyGate";

describe("privacy gate", () => {
  test("keeps an existing saved profile locked until authentication succeeds", () => {
    const state = createPrivacyGateState(true);

    expect(state).toBe("locked");
    expect(isSensitiveUiVisible(state)).toBe(false);
    expect(isSensitiveUiVisible("unlocked")).toBe(true);
  });

  test("does not require authentication before a profile exists", () => {
    expect(createPrivacyGateState(false)).toBe("unlocked");
  });

  test("requires explicit consent before a named medication can be saved", () => {
    expect(requiresMedicationConsent("빨간 알약", false)).toBe(true);
    expect(requiresMedicationConsent("빨간 알약", true)).toBe(false);
    expect(requiresMedicationConsent("   ", false)).toBe(false);
  });

  test("does not expose a saved subject name while the profile is locked", () => {
    const message = lockedProfileStatusMessage("김돌봄");

    expect(message).toBe("저장된 돌봄 프로필은 기기 인증 후 열 수 있습니다.");
    expect(message).not.toContain("김돌봄");
  });

  test("locks an unsaved sensitive draft when the app leaves the foreground", () => {
    const emptyManual = createEmptyCareManual();
    const draftManual = createEmptyCareManual();
    draftManual.subject.emergency_contacts = ["010-1234-5678"];

    expect(shouldLockCareManualOnBackground(false, emptyManual)).toBe(false);
    expect(shouldLockCareManualOnBackground(false, draftManual)).toBe(true);
    expect(shouldLockCareManualOnBackground(true, emptyManual)).toBe(true);
  });

  test("authenticates before loading an encrypted stored profile", async () => {
    const events: string[] = [];
    const storedManual = createEmptyCareManual();
    storedManual.subject.name = "인증 후 표시";

    const outcome = await resolveSensitiveProfileUnlock({
      hasStoredProfile: true,
      authenticate: async () => {
        events.push("authenticate");
        return { authenticated: true, message: "인증되었습니다." };
      },
      loadStoredManual: async () => {
        events.push("load");
        return storedManual;
      }
    });

    expect(events).toEqual(["authenticate", "load"]);
    expect(outcome).toEqual({
      authenticated: true,
      message: "인증되었습니다.",
      manual: storedManual
    });
  });

  test("never loads encrypted profile data when authentication fails", async () => {
    const outcome = await resolveSensitiveProfileUnlock({
      hasStoredProfile: true,
      authenticate: async () => ({ authenticated: false, message: "인증 실패" }),
      loadStoredManual: async () => {
        throw new Error("must not load");
      }
    });

    expect(outcome).toEqual({ authenticated: false, message: "인증 실패" });
  });

  test("invalidates medication consent when any medication detail changes", () => {
    const manual = createEmptyCareManual();
    manual.sections.medication.drugs = [
      {
        name: "가상약",
        dosage: "1정",
        timing: "08:30",
        method: "물과 함께",
        warnings: "",
        photo: ""
      }
    ];
    const consentedFingerprint = medicationConsentFingerprint(
      manual.sections.medication.drugs[0]
    );

    manual.sections.medication.drugs[0].timing = "09:00";

    expect(medicationConsentFingerprint(manual.sections.medication.drugs[0])).not.toBe(
      consentedFingerprint
    );
  });
});

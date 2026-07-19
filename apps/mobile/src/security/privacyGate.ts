import type { CareManual } from "@careguardian/care-core/manual";
import type { AuthenticationResult } from "./localAuthentication";

export type PrivacyGateState = "locked" | "unlocked";

export function createPrivacyGateState(hasStoredProfile: boolean): PrivacyGateState {
  return hasStoredProfile ? "locked" : "unlocked";
}

export function isSensitiveUiVisible(state: PrivacyGateState): boolean {
  return state === "unlocked";
}

export function lockedProfileStatusMessage(_subjectName?: string): string {
  return "저장된 돌봄 프로필은 기기 인증 후 열 수 있습니다.";
}

function containsMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some(containsMeaningfulValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(containsMeaningfulValue);
  }
  return false;
}

export function shouldLockCareManualOnBackground(
  hasStoredProfile: boolean,
  manual: CareManual
): boolean {
  if (hasStoredProfile) {
    return true;
  }

  return containsMeaningfulValue({
    subject: manual.subject,
    sections: manual.sections,
    createdBy: manual.created_by,
    relayTargets: manual.relay_targets
  });
}

export interface SensitiveProfileUnlockDependencies {
  hasStoredProfile: boolean;
  authenticate: () => Promise<AuthenticationResult>;
  loadStoredManual: () => Promise<CareManual | null>;
}

export type SensitiveProfileUnlockResult = AuthenticationResult & {
  manual?: CareManual;
};

export async function resolveSensitiveProfileUnlock({
  hasStoredProfile,
  authenticate,
  loadStoredManual
}: SensitiveProfileUnlockDependencies): Promise<SensitiveProfileUnlockResult> {
  const authentication = await authenticate();
  if (!authentication.authenticated || !hasStoredProfile) {
    return authentication;
  }

  const manual = await loadStoredManual();
  if (!manual) {
    return {
      authenticated: false,
      message: "저장된 돌봄 정보를 찾지 못했습니다. 안전을 위해 잠긴 상태를 유지합니다."
    };
  }

  return { ...authentication, manual };
}

export function medicationConsentFingerprint(
  medication?: CareManual["sections"]["medication"]["drugs"][number]
): string {
  if (!medication) {
    return "";
  }

  return JSON.stringify([
    medication.name.trim(),
    medication.dosage.trim(),
    medication.timing.trim(),
    medication.method.trim(),
    medication.warnings.trim(),
    medication.photo.trim()
  ]);
}

export function requiresMedicationConsent(medicationName: string, hasConsent: boolean): boolean {
  return medicationName.trim().length > 0 && !hasConsent;
}

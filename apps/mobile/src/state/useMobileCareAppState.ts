import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { createEmptyCareManual, type CareManual } from "@careguardian/care-core/manual";
import {
  deleteMobileCareManual,
  hasMobileCareManual,
  loadMobileCareManual,
  saveMobileCareManual
} from "../storage/mobileManualRepository";
import {
  cancelCareguardianMedicationNotifications,
  syncMedicationNotifications
} from "../notifications/medicationNotifications";
import { clearMobileData } from "../security/clearMobileData";
import { authenticateForSensitiveAccess } from "../security/localAuthentication";
import {
  createPrivacyGateState,
  lockedProfileStatusMessage,
  resolveSensitiveProfileUnlock,
  shouldLockCareManualOnBackground,
  type PrivacyGateState
} from "../security/privacyGate";
import { saveMobileCareProfile } from "./mobileCareSaveFlow";

type MobileMode = "caregiver" | "companion";

function stampManual(manual: CareManual): CareManual {
  const now = new Date().toISOString();

  return {
    ...manual,
    created_at: manual.created_at || now,
    last_updated: now
  };
}

export function useMobileCareAppState() {
  const [manual, setManual] = useState<CareManual>(() => createEmptyCareManual());
  const [mode, setMode] = useState<MobileMode>("caregiver");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasStoredProfile, setHasStoredProfile] = useState(false);
  const [privacyGate, setPrivacyGate] = useState<PrivacyGateState>("unlocked");
  const [statusMessage, setStatusMessage] = useState("앱을 준비하는 중입니다.");

  useEffect(() => {
    let isActive = true;

    void hasMobileCareManual()
      .then((hasStoredManual) => {
        if (!isActive) {
          return;
        }

        if (hasStoredManual) {
          setHasStoredProfile(true);
          setPrivacyGate(createPrivacyGateState(true));
          setStatusMessage(lockedProfileStatusMessage());
          return;
        }

        setStatusMessage("새 돌봄 프로필을 작성해 주세요.");
      })
      .catch(() => {
        if (isActive) {
          setStatusMessage("저장된 정보를 확인하지 못했습니다. 안전을 위해 새 프로필 화면으로 열었습니다.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoaded(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        shouldLockCareManualOnBackground(hasStoredProfile, manual) &&
        (nextState === "background" || nextState === "inactive")
      ) {
        setPrivacyGate("locked");
        setStatusMessage("앱이 백그라운드로 전환되어 돌봄 정보를 잠갔습니다.");
      }
    });

    return () => subscription.remove();
  }, [hasStoredProfile, manual]);

  const actions = useMemo(
    () => ({
      updateManual(nextManual: CareManual) {
        setManual(nextManual);
      },
      async saveAndOpenCompanion(nextManual: CareManual) {
        setIsSaving(true);
        const stampedManual = stampManual(nextManual);

        try {
          const outcome = await saveMobileCareProfile({
            manual: stampedManual,
            save: saveMobileCareManual,
            syncNotifications: syncMedicationNotifications
          });
          setStatusMessage(outcome.message);

          if (outcome.kind === "storage-failed") {
            return;
          }

          setManual(stampedManual);
          setHasStoredProfile(true);
          setPrivacyGate("unlocked");
          setMode("companion");
        } finally {
          setIsSaving(false);
        }
      },
      async resyncNotifications() {
        const notificationCount = await syncMedicationNotifications(manual);
        setStatusMessage(
          notificationCount > 0
            ? `복약 알림 ${notificationCount}건을 다시 예약했습니다.`
            : "복약 알림을 예약하지 못했습니다."
        );
      },
      async unlockSensitiveUi() {
        setIsAuthenticating(true);
        try {
          const result = await resolveSensitiveProfileUnlock({
            hasStoredProfile,
            authenticate: authenticateForSensitiveAccess,
            loadStoredManual: loadMobileCareManual
          });
          setStatusMessage(result.message);
          if (result.authenticated) {
            if (result.manual) {
              setManual(result.manual);
              setMode("companion");
            }
            setPrivacyGate("unlocked");
          }
        } catch {
          setStatusMessage("돌봄 정보를 안전하게 열지 못했습니다. 잠긴 상태를 유지합니다.");
          setPrivacyGate("locked");
        } finally {
          setIsAuthenticating(false);
        }
      },
      async openCaregiver() {
        if (hasStoredProfile) {
          setIsAuthenticating(true);
          const result = await authenticateForSensitiveAccess();
          setIsAuthenticating(false);
          setStatusMessage(result.message);
          if (!result.authenticated) {
            return;
          }
        }
        setPrivacyGate("unlocked");
        setMode("caregiver");
      },
      async deleteAllData() {
        setIsDeleting(true);
        try {
          await clearMobileData({
            deleteManual: deleteMobileCareManual,
            cancelCareguardianNotifications: cancelCareguardianMedicationNotifications,
            resetMemory: () => {
              setManual(createEmptyCareManual());
              setMode("caregiver");
              setHasStoredProfile(false);
              setPrivacyGate("unlocked");
            }
          });
          setStatusMessage("이 기기의 돌봄 프로필과 CareGuardian 복약 알림을 삭제했습니다.");
        } catch {
          setStatusMessage("데이터를 완전히 삭제하지 못했습니다. 잠긴 상태를 유지하고 다시 시도해 주세요.");
          setPrivacyGate("locked");
        } finally {
          setIsDeleting(false);
        }
      }
    }),
    [hasStoredProfile, manual]
  );

  return {
    manual,
    mode,
    isLoaded,
    isSaving,
    isDeleting,
    isAuthenticating,
    privacyGate,
    statusMessage,
    actions
  };
}

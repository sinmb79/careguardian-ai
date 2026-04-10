import { useEffect, useMemo, useState } from "react";
import { createEmptyCareManual, type CareManual } from "@careguardian/care-core/manual";
import { loadMobileCareManual, loadMobileManualContext, saveMobileCareManual } from "../storage/mobileManualRepository";
import { syncMedicationNotifications } from "../notifications/medicationNotifications";

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
  const [statusMessage, setStatusMessage] = useState("앱을 준비하는 중입니다.");

  useEffect(() => {
    let isActive = true;

    void Promise.all([loadMobileCareManual(), loadMobileManualContext()])
      .then(([storedManual, storedContext]) => {
        if (!isActive) {
          return;
        }

        if (storedManual) {
          setManual(storedManual);
          setMode("companion");
          setStatusMessage(
            storedContext?.subjectName
              ? `${storedContext.subjectName} 프로필을 불러왔습니다.`
              : "저장된 돌봄 프로필을 불러왔습니다."
          );
          return;
        }

        setStatusMessage("새 돌봄 프로필을 작성해 주세요.");
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

  const actions = useMemo(
    () => ({
      updateManual(nextManual: CareManual) {
        setManual(nextManual);
      },
      async saveAndOpenCompanion(nextManual: CareManual) {
        setIsSaving(true);
        const stampedManual = stampManual(nextManual);
        setManual(stampedManual);

        try {
          await saveMobileCareManual(stampedManual);
          const notificationCount = await syncMedicationNotifications(stampedManual);
          setStatusMessage(
            notificationCount > 0
              ? `저장 완료. 복약 알림 ${notificationCount}건을 예약했습니다.`
              : "저장 완료. 복약 알림 권한 또는 시각 설정을 확인해 주세요."
          );
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
      openCaregiver() {
        setMode("caregiver");
      }
    }),
    [manual]
  );

  return {
    manual,
    mode,
    isLoaded,
    isSaving,
    statusMessage,
    actions
  };
}

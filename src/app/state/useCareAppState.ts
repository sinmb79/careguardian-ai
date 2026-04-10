import { useEffect, useMemo, useState } from "react";
import { createEmptyCareManual, type CareManual } from "@careguardian/care-core/manual";
import { loadCareManual, saveCareManual } from "../../features/storage/careManualRepository";

const DEMO_PASSPHRASE = "careguardian-local-demo";

export function useCareAppState() {
  const [manual, setManual] = useState<CareManual>(() => createEmptyCareManual());
  const [mode, setMode] = useState<"caregiver" | "companion">("caregiver");
  const [isLoaded, setIsLoaded] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("careguardian.manual")) {
      return;
    }

    let isActive = true;

    void loadCareManual(DEMO_PASSPHRASE)
      .then((storedManual) => {
        if (!isActive || !storedManual) {
          return;
        }

        setManual(storedManual);
        setMode("companion");
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
      replaceManual(nextManual: CareManual) {
        setManual(nextManual);
      },
      saveAndOpenCompanion(nextManual: CareManual) {
        setManual(nextManual);
        setMode("companion");
        void saveCareManual(nextManual, DEMO_PASSPHRASE);
      },
      openCaregiver() {
        setMode("caregiver");
      }
    }),
    []
  );

  return {
    manual,
    mode,
    isLoaded,
    actions
  };
}

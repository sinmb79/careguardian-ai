import { CaregiverEditor } from "../features/ui/CaregiverEditor";
import { CompanionHome } from "../features/ui/CompanionHome";
import { useCareAppState } from "./state/useCareAppState";

export function App() {
  const { manual, mode, isLoaded, actions } = useCareAppState();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand px-6 text-ink">
        돌봄 환경을 불러오는 중...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-sand px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-5">
        {mode === "caregiver" ? (
          <CaregiverEditor
            manual={manual}
            onChange={actions.updateManual}
            onImport={actions.replaceManual}
            onSave={actions.saveAndOpenCompanion}
          />
        ) : (
          <CompanionHome manual={manual} onBack={actions.openCaregiver} />
        )}
      </div>
    </main>
  );
}

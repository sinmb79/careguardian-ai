import { CaregiverEditor } from "../features/ui/CaregiverEditor";
import { CompanionHome } from "../features/ui/CompanionHome";
import { useCareAppState } from "./state/useCareAppState";

export function App() {
  const { manual, mode, isLoaded, actions } = useCareAppState();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand px-6 text-ink">
        <span className="text-5xl">{"\u{1F91D}"}</span>
        <p className="text-xl font-semibold text-ink">돌봄 환경을 준비하고 있어요...</p>
        <p className="text-base text-ink/60">잠시만 기다려 주세요.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-sand px-4 py-6 text-ink sm:px-6 lg:px-8" role="main" aria-label="돌봄 매뉴얼">
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

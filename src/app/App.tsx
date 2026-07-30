import { WorkspaceHome } from "../features/workspace/WorkspaceHome";
import { useLifeAppState } from "./state/useLifeAppState";

export function App() {
  const { workspace, statusMessage, isLoaded, isDirty, recoveryRequired, pendingConfirmation, actions } = useLifeAppState();

  return (
    <WorkspaceHome
      workspace={workspace}
      statusMessage={statusMessage}
      isLoaded={isLoaded}
      isDirty={isDirty}
      recoveryRequired={recoveryRequired}
      pendingConfirmation={pendingConfirmation}
      onChange={actions.updateWorkspace}
      onSave={actions.save}
      onRequestDelete={actions.requestDelete}
      onRequestInitialize={actions.requestInitialize}
      onCancelConfirmation={actions.cancelConfirmation}
      onConfirm={actions.confirm}
    />
  );
}

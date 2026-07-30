import { WorkspaceHome } from "../features/workspace/WorkspaceHome";
import { useLifeAppState, type LifeAppRepository } from "./state/useLifeAppState";

type AppProps = { repository?: LifeAppRepository };

export function App({ repository }: AppProps) {
  const { workspace, statusMessage, isLoaded, isDirty, isOperationBusy, recoveryRequired, pendingConfirmation, actions } = useLifeAppState(repository);

  return (
    <WorkspaceHome
      workspace={workspace}
      statusMessage={statusMessage}
      isLoaded={isLoaded}
      isDirty={isDirty}
      isOperationBusy={isOperationBusy}
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

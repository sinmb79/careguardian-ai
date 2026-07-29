import { WorkspaceHome } from "../features/workspace/WorkspaceHome";
import { useLifeAppState } from "./state/useLifeAppState";

export function App() {
  const { workspace, statusMessage, actions } = useLifeAppState();

  return (
    <WorkspaceHome
      workspace={workspace}
      statusMessage={statusMessage}
      onChange={actions.updateWorkspace}
      onSave={actions.save}
      onClear={actions.clear}
    />
  );
}

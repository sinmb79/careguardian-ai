import { useMemo, useState } from "react";
import { createEmptyWorkspace, type PersonalWorkspace } from "@life-steward/life-core";
import { clearWorkspace, loadWorkspace, saveWorkspace } from "../../features/workspace/workspaceRepository";

export function useLifeAppState() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace>(() => loadWorkspace() ?? createEmptyWorkspace());
  const [statusMessage, setStatusMessage] = useState("");

  const actions = useMemo(() => ({
    updateWorkspace(nextWorkspace: PersonalWorkspace) {
      setWorkspace(nextWorkspace);
      setStatusMessage("");
    },
    save() {
      const nextWorkspace = { ...workspace, updatedAt: new Date().toISOString() };
      try {
        saveWorkspace(nextWorkspace);
        setWorkspace(nextWorkspace);
        setStatusMessage("이 브라우저에 작업공간을 저장했습니다.");
      } catch {
        setStatusMessage("이 브라우저에 작업공간을 저장하지 못했습니다.");
      }
    },
    clear() {
      try {
        clearWorkspace();
        setWorkspace(createEmptyWorkspace());
        setStatusMessage("이 브라우저의 개인 작업공간을 삭제했습니다.");
      } catch {
        setStatusMessage("이 브라우저의 작업공간을 삭제하지 못했습니다.");
      }
    }
  }), [workspace]);

  return { workspace, statusMessage, actions };
}

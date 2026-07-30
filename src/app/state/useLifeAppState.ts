import { useEffect, useMemo, useState } from "react";
import { createEmptyWorkspace, type PersonalWorkspace } from "@life-steward/life-core";
import {
  clearWorkspace,
  initializeWorkspace,
  loadWorkspace,
  saveWorkspace,
  subscribeWorkspaceChanges,
  type WorkspaceLoadResult
} from "../../features/workspace/workspaceRepository";

type PendingConfirmation = "delete" | "initialize" | null;

function statusForLoad(result: WorkspaceLoadResult): string {
  if (result.kind === "invalid") return "저장된 작업공간을 안전하게 읽지 못했습니다.";
  if (result.kind === "unavailable") return "저장 데이터에 접근할 수 없습니다.";
  return "";
}

export function useLifeAppState() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace>(() => createEmptyWorkspace());
  const [revision, setRevision] = useState(0);
  const [loadResult, setLoadResult] = useState<WorkspaceLoadResult>({ kind: "missing" });
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);

  const applyLoadResult = (result: WorkspaceLoadResult) => {
    setLoadResult(result);
    setStatusMessage(statusForLoad(result));
    if (result.kind === "loaded") {
      setWorkspace(result.workspace);
      setRevision(result.revision);
    } else if (result.kind === "missing") {
      setWorkspace(createEmptyWorkspace());
      setRevision(0);
    }
  };

  useEffect(() => {
    let active = true;
    void loadWorkspace().then((result) => {
      if (!active) return;
      applyLoadResult(result);
      setIsLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => subscribeWorkspaceChanges(() => {
    if (isDirty) {
      setStatusMessage("다른 탭에서 작업공간이 변경되었습니다. 저장하기 전에 최신 데이터를 확인해 주세요.");
      return;
    }
    void loadWorkspace().then(applyLoadResult);
  }), [isDirty]);

  const actions = useMemo(() => ({
    updateWorkspace(nextWorkspace: PersonalWorkspace) {
      setWorkspace(nextWorkspace);
      setIsDirty(true);
      if (loadResult.kind !== "invalid" && loadResult.kind !== "unavailable") setStatusMessage("");
    },
    async save() {
      if (!isLoaded) return;
      if (loadResult.kind === "invalid") {
        setStatusMessage("저장된 작업공간을 안전하게 읽지 못했습니다. 새 작업공간으로 초기화한 후에만 저장할 수 있습니다.");
        return;
      }
      const nextWorkspace = { ...workspace, updatedAt: new Date().toISOString() };
      const result = await saveWorkspace(nextWorkspace, revision);
      if (result.kind === "saved") {
        setWorkspace(nextWorkspace);
        setRevision(result.revision);
        setLoadResult({ kind: "loaded", workspace: nextWorkspace, revision: result.revision });
        setIsDirty(false);
        setStatusMessage("이 브라우저에 작업공간을 저장했습니다.");
      } else if (result.kind === "conflict") {
        setStatusMessage("다른 탭에서 작업공간이 변경되었습니다. 최신 데이터를 다시 불러온 뒤 저장해 주세요.");
      } else {
        setStatusMessage("이 브라우저에 작업공간을 저장하지 못했습니다.");
      }
    },
    requestDelete() { setPendingConfirmation("delete"); },
    requestInitialize() { setPendingConfirmation("initialize"); },
    cancelConfirmation() { setPendingConfirmation(null); },
    async confirm() {
      if (pendingConfirmation === "initialize" && loadResult.kind === "invalid") {
        const nextWorkspace = createEmptyWorkspace();
        const result = await initializeWorkspace(nextWorkspace, loadResult.raw);
        if (result.kind === "saved") {
          setWorkspace(nextWorkspace);
          setRevision(result.revision);
          setLoadResult({ kind: "loaded", workspace: nextWorkspace, revision: result.revision });
          setIsDirty(false);
          setStatusMessage("새 작업공간을 초기화했습니다.");
        } else if (result.kind === "conflict") {
          setStatusMessage("다른 탭에서 저장 데이터가 변경되어 초기화하지 않았습니다.");
        } else {
          setStatusMessage("이 브라우저의 작업공간을 초기화하지 못했습니다.");
        }
      }
      if (pendingConfirmation === "delete") {
        const result = await clearWorkspace(revision);
        if (result.kind === "cleared") {
          setWorkspace(createEmptyWorkspace());
          setRevision(0);
          setLoadResult({ kind: "missing" });
          setIsDirty(false);
          setStatusMessage("이 브라우저의 개인 작업공간을 삭제했습니다.");
        } else if (result.kind === "conflict") {
          setStatusMessage("다른 탭에서 작업공간이 변경되어 삭제하지 않았습니다.");
        } else {
          setStatusMessage("이 브라우저의 작업공간을 삭제하지 못했습니다.");
        }
      }
      setPendingConfirmation(null);
    }
  }), [isLoaded, loadResult, pendingConfirmation, revision, workspace]);

  return { workspace, statusMessage, isLoaded, isDirty, recoveryRequired: loadResult.kind === "invalid", pendingConfirmation, actions };
}

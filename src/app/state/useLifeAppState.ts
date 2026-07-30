import { useEffect, useMemo, useRef, useState } from "react";
import { createEmptyWorkspace, type PersonalWorkspace } from "@life-steward/life-core";
import {
  clearWorkspace,
  initializeWorkspace,
  loadWorkspace,
  saveWorkspace,
  subscribeWorkspaceChanges,
  type WorkspaceLoadResult,
  type WorkspaceMutationResult,
  type WorkspaceDeletionExpectation,
  type WorkspaceInvalidExpectation
} from "../../features/workspace/workspaceRepository";

type PendingConfirmation = "delete" | "initialize" | null;
type WorkspaceOperation = "initial-load" | "sync" | "save" | "delete" | "initialize" | null;

export type LifeAppRepository = {
  loadWorkspace(): Promise<WorkspaceLoadResult>;
  saveWorkspace(workspace: PersonalWorkspace, expectedRevision: number): Promise<WorkspaceMutationResult>;
  initializeWorkspace(workspace: PersonalWorkspace, expectation: WorkspaceInvalidExpectation): Promise<WorkspaceMutationResult>;
  clearWorkspace(expectation: WorkspaceDeletionExpectation): Promise<WorkspaceMutationResult>;
  subscribeWorkspaceChanges(listener: () => void): () => void;
};

const browserRepository: LifeAppRepository = {
  loadWorkspace,
  saveWorkspace,
  initializeWorkspace,
  clearWorkspace,
  subscribeWorkspaceChanges
};

function statusForLoad(result: WorkspaceLoadResult): string {
  if (result.kind === "invalid") return "저장된 작업공간을 안전하게 읽지 못했습니다.";
  if (result.kind === "unavailable") return "저장 데이터에 접근할 수 없습니다.";
  return "";
}

export function useLifeAppState(repository: LifeAppRepository = browserRepository) {
  const [workspace, setWorkspace] = useState<PersonalWorkspace>(() => createEmptyWorkspace());
  const [revision, setRevision] = useState(0);
  const [loadResult, setLoadResult] = useState<WorkspaceLoadResult>({ kind: "missing" });
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [operation, setOperation] = useState<WorkspaceOperation>("initial-load");

  const workspaceRef = useRef(workspace);
  const revisionRef = useRef(revision);
  const loadResultRef = useRef(loadResult);
  const dirtyRef = useRef(isDirty);
  const editEpochRef = useRef(0);
  const operationRef = useRef<WorkspaceOperation>("initial-load");

  const setCurrentWorkspace = (next: PersonalWorkspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
  };
  const setCurrentRevision = (next: number) => {
    revisionRef.current = next;
    setRevision(next);
  };
  const setCurrentLoadResult = (next: WorkspaceLoadResult) => {
    loadResultRef.current = next;
    setLoadResult(next);
  };
  const setCurrentDirty = (next: boolean) => {
    dirtyRef.current = next;
    setIsDirty(next);
  };
  const beginOperation = (next: Exclude<WorkspaceOperation, null>) => {
    if (operationRef.current !== null) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  };
  const finishOperation = (finished: Exclude<WorkspaceOperation, null>) => {
    if (operationRef.current !== finished) return;
    operationRef.current = null;
    setOperation(null);
  };
  const applyLoadResult = (result: WorkspaceLoadResult) => {
    setCurrentLoadResult(result);
    setStatusMessage(statusForLoad(result));
    if (result.kind === "loaded") {
      setCurrentWorkspace(result.workspace);
      setCurrentRevision(result.revision);
    } else if (result.kind === "missing") {
      setCurrentWorkspace(createEmptyWorkspace());
      setCurrentRevision(0);
    }
    setCurrentDirty(false);
  };

  useEffect(() => {
    let active = true;
    const epoch = editEpochRef.current;
    void repository.loadWorkspace().then((result) => {
      if (!active) return;
      if (editEpochRef.current === epoch) applyLoadResult(result);
      setIsLoaded(true);
    }).catch(() => {
      if (!active) return;
      setCurrentLoadResult({ kind: "unavailable" });
      setStatusMessage("저장 데이터에 접근할 수 없습니다.");
      setIsLoaded(true);
    }).finally(() => {
      if (active) finishOperation("initial-load");
    });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => repository.subscribeWorkspaceChanges(() => {
    if (dirtyRef.current || !isLoaded || !beginOperation("sync")) {
      if (dirtyRef.current) setStatusMessage("다른 탭에서 작업공간이 변경되었습니다. 저장하기 전에 최신 데이터를 확인해 주세요.");
      return;
    }
    const epoch = editEpochRef.current;
    void repository.loadWorkspace().then((result) => {
      if (editEpochRef.current !== epoch || dirtyRef.current) {
        setStatusMessage("다른 탭에서 작업공간이 변경되었습니다. 저장하기 전에 최신 데이터를 확인해 주세요.");
        return;
      }
      applyLoadResult(result);
    }).catch(() => setStatusMessage("저장 데이터에 접근할 수 없습니다."))
      .finally(() => finishOperation("sync"));
  }), [isLoaded, repository]);

  const actions = useMemo(() => ({
    updateWorkspace(nextWorkspace: PersonalWorkspace) {
      if (!isLoaded) return;
      editEpochRef.current += 1;
      setCurrentWorkspace(nextWorkspace);
      setCurrentDirty(true);
      if (loadResultRef.current.kind !== "invalid" && loadResultRef.current.kind !== "unavailable") setStatusMessage("");
    },
    async save() {
      if (!isLoaded || !beginOperation("save")) return;
      if (loadResultRef.current.kind === "invalid") {
        setStatusMessage("저장된 작업공간을 안전하게 읽지 못했습니다. 새 작업공간으로 초기화한 후에만 저장할 수 있습니다.");
        finishOperation("save");
        return;
      }

      const epoch = editEpochRef.current;
      const nextWorkspace = { ...workspaceRef.current, updatedAt: new Date().toISOString() };
      const result = await repository.saveWorkspace(nextWorkspace, revisionRef.current);
      if (result.kind === "saved") {
        setCurrentRevision(result.revision);
        setCurrentLoadResult({ kind: "loaded", workspace: nextWorkspace, revision: result.revision });
        if (editEpochRef.current === epoch) {
          setCurrentWorkspace(nextWorkspace);
          setCurrentDirty(false);
          setStatusMessage("이 브라우저에 작업공간을 저장했습니다.");
        } else {
          setCurrentDirty(true);
          setStatusMessage("이전 상태는 저장됐고 최신 변경은 아직 저장되지 않았습니다.");
        }
      } else if (result.kind === "conflict") {
        setStatusMessage("다른 탭에서 작업공간이 변경되었습니다. 최신 데이터를 다시 불러온 뒤 저장해 주세요.");
      } else {
        setStatusMessage("이 브라우저에 작업공간을 저장하지 못했습니다.");
      }
      finishOperation("save");
    },
    requestDelete() {
      if (isLoaded && operationRef.current === null) setPendingConfirmation("delete");
    },
    requestInitialize() {
      if (isLoaded && operationRef.current === null) setPendingConfirmation("initialize");
    },
    cancelConfirmation() {
      if (operationRef.current === null) setPendingConfirmation(null);
    },
    async confirm() {
      const requested = pendingConfirmation;
      if (!requested || !isLoaded || !beginOperation(requested)) return;
      const epoch = editEpochRef.current;

      if (requested === "initialize" && loadResultRef.current.kind === "invalid") {
        const nextWorkspace = createEmptyWorkspace();
        const result = await repository.initializeWorkspace(nextWorkspace, loadResultRef.current);
        if (result.kind === "saved") {
          setCurrentRevision(result.revision);
          setCurrentLoadResult({ kind: "loaded", workspace: nextWorkspace, revision: result.revision });
          if (editEpochRef.current === epoch) {
            setCurrentWorkspace(nextWorkspace);
            setCurrentDirty(false);
            setStatusMessage("새 작업공간을 초기화했습니다.");
          } else {
            setCurrentDirty(true);
            setStatusMessage("새 작업공간은 초기화됐지만 최신 변경은 아직 저장되지 않았습니다.");
          }
        } else if (result.kind === "conflict") {
          setStatusMessage("다른 탭에서 저장 데이터가 변경되어 초기화하지 않았습니다.");
        } else {
          setStatusMessage("이 브라우저의 작업공간을 초기화하지 못했습니다.");
        }
      } else if (requested === "delete") {
        const deletionExpectation: WorkspaceDeletionExpectation =
          loadResultRef.current.kind === "invalid"
            ? loadResultRef.current
            : { kind: "revision", revision: revisionRef.current };
        const result = await repository.clearWorkspace(deletionExpectation);
        if (result.kind === "cleared") {
          setCurrentRevision(0);
          setCurrentLoadResult({ kind: "missing" });
          if (editEpochRef.current === epoch) {
            setCurrentWorkspace(createEmptyWorkspace());
            setCurrentDirty(false);
            setStatusMessage("이 브라우저의 개인 작업공간을 삭제했습니다.");
          } else {
            setCurrentDirty(true);
            setStatusMessage("이전 작업공간은 삭제됐고 최신 변경은 아직 저장되지 않았습니다.");
          }
        } else if (result.kind === "conflict") {
          setStatusMessage("다른 탭에서 작업공간이 변경되어 삭제하지 않았습니다.");
        } else {
          setStatusMessage("이 브라우저의 작업공간을 삭제하지 못했습니다.");
        }
      }
      setPendingConfirmation(null);
      finishOperation(requested);
    }
  }), [isLoaded, pendingConfirmation, repository]);

  return {
    workspace,
    statusMessage,
    isLoaded,
    isDirty,
    isOperationBusy: operation !== null,
    recoveryRequired: loadResult.kind === "invalid",
    pendingConfirmation,
    actions
  };
}

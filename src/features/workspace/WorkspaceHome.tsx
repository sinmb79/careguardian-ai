import type { PersonalWorkspace } from "@life-steward/life-core";
import { WorkspaceEditor } from "./WorkspaceEditor";

type WorkspaceHomeProps = {
  workspace: PersonalWorkspace;
  statusMessage: string;
  isDirty: boolean;
  recoveryRequired: boolean;
  pendingConfirmation: "delete" | "initialize" | null;
  onChange(workspace: PersonalWorkspace): void;
  onSave(): void;
  onRequestDelete(): void;
  onRequestInitialize(): void;
  onCancelConfirmation(): void;
  onConfirm(): void;
};

export function WorkspaceHome(props: WorkspaceHomeProps) {
  const addExtension = (extension: PersonalWorkspace["extensions"][number]) => {
    props.onChange({ ...props.workspace, extensions: [...props.workspace.extensions, extension] });
  };
  const confirmationLabel = props.pendingConfirmation === "initialize" ? "초기화 확인" : "삭제 확인";
  const confirmationText = props.pendingConfirmation === "initialize"
    ? "손상된 원본 저장 데이터를 지우고 새 빈 작업공간을 만들까요?"
    : "이 브라우저에만 보관된 작업공간을 삭제할까요? 이 작업은 되돌릴 수 없습니다.";

  return (
    <main className="workspace-page" aria-label="개인 생활 작업공간">
      <div className="workspace-layout">
        <header className="workspace-hero">
          <p className="workspace-eyebrow">LOCAL-ONLY PERSONAL WORKSPACE</p>
          <h1>생활후견 AI</h1>
          <p>생활 작업과 개인 기능을 이 브라우저 안에서만 정리합니다.</p>
        </header>

        <section className="workspace-card" aria-labelledby="workspace-title-heading">
          <h2 id="workspace-title-heading">내 작업공간</h2>
          <label className="workspace-field" htmlFor="workspace-title">
            작업공간 이름
            <input id="workspace-title" value={props.workspace.title} onChange={(event) => props.onChange({ ...props.workspace, title: event.target.value })} />
          </label>
          <p className="workspace-empty">저장 데이터는 이 브라우저에만 보관됩니다. 자동 백업이나 외부 전송을 하지 않습니다.</p>
          {props.isDirty ? <p className="workspace-dirty" role="status">저장되지 않은 변경 사항이 있습니다.</p> : null}
        </section>

        <WorkspaceEditor extensions={props.workspace.extensions} onAddExtension={addExtension} />

        <section className="workspace-card" aria-labelledby="workspace-overview-title">
          <h2 id="workspace-overview-title">생활 정리 현황</h2>
          <div className="workspace-stats">
            <p><strong>{props.workspace.lists.length}</strong>개 목록</p>
            <p><strong>{props.workspace.tasks.filter((task) => task.status === "open").length}</strong>개 열린 작업</p>
            <p><strong>{props.workspace.reminders.filter((reminder) => reminder.enabled).length}</strong>개 일반 알림</p>
          </div>
        </section>

        <section className="workspace-actions" aria-label="작업공간 저장 및 삭제">
          {props.recoveryRequired ? <button className="workspace-button" type="button" onClick={props.onRequestInitialize}>새 작업공간으로 초기화</button> : <button className="workspace-button" type="button" onClick={props.onSave}>이 브라우저에 저장</button>}
          <button className="workspace-clear-button" type="button" onClick={props.onRequestDelete}>이 브라우저의 작업공간 삭제</button>
          {props.pendingConfirmation ? <div className="workspace-confirmation" role="alert"><p>{confirmationText}</p><div><button className="workspace-clear-button" type="button" onClick={props.onConfirm}>{confirmationLabel}</button><button className="workspace-cancel-button" type="button" onClick={props.onCancelConfirmation}>취소</button></div></div> : null}
          {props.statusMessage ? <p className="workspace-message" role="status">{props.statusMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}

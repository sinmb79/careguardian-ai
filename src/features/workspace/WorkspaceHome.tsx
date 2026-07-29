import type { PersonalWorkspace } from "@life-steward/life-core";
import { WorkspaceEditor } from "./WorkspaceEditor";

type WorkspaceHomeProps = {
  workspace: PersonalWorkspace;
  statusMessage: string;
  onChange(workspace: PersonalWorkspace): void;
  onSave(): void;
  onClear(): void;
};

export function WorkspaceHome({ workspace, statusMessage, onChange, onSave, onClear }: WorkspaceHomeProps) {
  const addExtension = (extension: PersonalWorkspace["extensions"][number]) => {
    onChange({ ...workspace, extensions: [...workspace.extensions, extension] });
  };

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
            <input
              id="workspace-title"
              value={workspace.title}
              onChange={(event) => onChange({ ...workspace, title: event.target.value })}
            />
          </label>
          <p className="workspace-empty">저장 데이터는 이 브라우저에만 보관됩니다. 자동 백업이나 외부 전송을 하지 않습니다.</p>
        </section>

        <WorkspaceEditor extensions={workspace.extensions} onAddExtension={addExtension} />

        <section className="workspace-card" aria-labelledby="workspace-overview-title">
          <h2 id="workspace-overview-title">생활 정리 현황</h2>
          <div className="workspace-stats">
            <p><strong>{workspace.lists.length}</strong>개 목록</p>
            <p><strong>{workspace.tasks.filter((task) => task.status === "open").length}</strong>개 열린 작업</p>
            <p><strong>{workspace.reminders.filter((reminder) => reminder.enabled).length}</strong>개 일반 알림</p>
          </div>
        </section>

        <section className="workspace-actions" aria-label="작업공간 저장 및 삭제">
          <button className="workspace-button" type="button" onClick={onSave}>이 브라우저에 저장</button>
          <button className="workspace-clear-button" type="button" onClick={onClear}>이 브라우저의 작업공간 삭제</button>
          {statusMessage ? <p className="workspace-message" role="status">{statusMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}

import { useState } from "react";
import { validateExtension, type ExtensionDefinition } from "@life-steward/life-core";

type WorkspaceEditorProps = {
  extensions: ExtensionDefinition[];
  disabled: boolean;
  onAddExtension(extension: ExtensionDefinition): void;
};

function createExtensionId(): string {
  return `extension-${Date.now()}`;
}

export function WorkspaceEditor({ extensions, disabled, onAddExtension }: WorkspaceEditorProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  function addExtension() {
    const extension: ExtensionDefinition = {
      id: createExtensionId(),
      title: title.trim(),
      fields: [],
      automations: []
    };
    const validation = validateExtension(extension);
    if (!validation.ok) {
      setMessage("기능 이름을 확인해 주세요.");
      return;
    }

    onAddExtension(validation.value);
    setTitle("");
    setMessage("새 기능을 작업공간에 추가했습니다.");
  }

  return (
    <section className="workspace-card" aria-labelledby="extension-builder-title">
      <p className="workspace-eyebrow">PERSONAL EXTENSION</p>
      <h2 id="extension-builder-title">나만의 생활 기능 만들기</h2>
      <p>목록, 기록, 일반 알림에 쓸 개인 기능을 이 작업공간에 추가합니다.</p>
      <label className="workspace-field" htmlFor="extension-title">
        새 기능 이름
        <input
          id="extension-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 여행 준비"
          disabled={disabled}
        />
      </label>
      <button className="workspace-button workspace-button-secondary" type="button" disabled={disabled} onClick={addExtension}>
        기능 추가
      </button>
      {message ? <p className="workspace-message" role="status">{message}</p> : null}
      {extensions.length ? (
        <ul className="workspace-item-list" aria-label="추가한 생활 기능">
          {extensions.map((extension) => <li key={extension.id}>{extension.title}</li>)}
        </ul>
      ) : (
        <p className="workspace-empty">아직 만든 생활 기능이 없습니다.</p>
      )}
    </section>
  );
}

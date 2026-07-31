import type { PersonalWorkspace } from "@life-steward/life-core";

export type AssistantSourceKind = "task" | "list" | "record";

export interface AssistantSource {
  readonly kind: AssistantSourceKind;
  readonly id: string;
  readonly text: string;
}

export function listAssistantSources(
  workspace: PersonalWorkspace
): readonly AssistantSource[] {
  const tasks = workspace.tasks.map<AssistantSource>((task) => ({
    kind: "task",
    id: task.id,
    text: task.title
  }));
  const lists = workspace.lists.map<AssistantSource>((list) => ({
    kind: "list",
    id: list.id,
    text: list.title
  }));
  const records = workspace.records.map<AssistantSource>((record) => {
    const valueLines = Object.entries(record.values)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, value]) => `${key}: ${String(value)}`);
    return {
      kind: "record",
      id: record.id,
      text: [record.title, ...valueLines].join("\n")
    };
  });
  return Object.freeze(
    [...tasks, ...lists, ...records].map((source) => Object.freeze(source))
  );
}

export function resolveAssistantSource(
  workspace: PersonalWorkspace,
  candidate: AssistantSource
): AssistantSource | null {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !["task", "list", "record"].includes(candidate.kind) ||
    typeof candidate.id !== "string" ||
    typeof candidate.text !== "string"
  ) {
    return null;
  }
  const canonical = listAssistantSources(workspace).find(
    (source) => source.kind === candidate.kind && source.id === candidate.id
  );
  return canonical?.text === candidate.text ? canonical : null;
}

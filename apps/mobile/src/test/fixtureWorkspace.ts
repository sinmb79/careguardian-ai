import type { PersonalWorkspace } from "@life-steward/life-core";

export const fixtureWorkspace: PersonalWorkspace = {
  schemaVersion: 1,
  id: "personal-home",
  title: "나의 생활",
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  lists: [{ id: "errands", title: "할 일", recordIds: ["market"] }],
  records: [{ id: "market", listId: "errands", title: "장보기", values: { store: "동네 시장" } }],
  tasks: [{ id: "buy-fruit", title: "과일 사기", status: "open", dueDate: "2026-07-31" }],
  reminders: [{ id: "morning-plan", title: "아침 계획", time: "08:30", enabled: true }],
  extensions: []
};

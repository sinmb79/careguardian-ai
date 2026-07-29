import { describe, expect, test } from "vitest";
import { createEmptyWorkspace, validateWorkspace } from "./index";

describe("workspace model", () => {
  test("creates an empty versioned personal workspace at the supplied time", () => {
    expect(createEmptyWorkspace("2026-07-30T00:00:00.000Z")).toMatchObject({
      schemaVersion: 1,
      lists: [],
      tasks: [],
      extensions: [],
    });
  });

  test("accepts a complete workspace with non-medical life records", () => {
    expect(
      validateWorkspace({
        schemaVersion: 1,
        id: "home-2026",
        title: "우리 집",
        createdAt: "2026-07-30T00:00:00.000Z",
        updatedAt: "2026-07-30T00:00:00.000Z",
        lists: [{ id: "outings", title: "외출", recordIds: ["market"] }],
        records: [{ id: "market", listId: "outings", title: "장보기", values: { store: "시장" } }],
        tasks: [{ id: "buy-fruit", title: "과일 사기", status: "open", dueDate: "2026-07-31" }],
        reminders: [{ id: "leave-home", title: "외출", time: "09:30", enabled: true }],
        extensions: [],
      }).ok,
    ).toBe(true);
  });

  test("rejects unknown keys and invalid identifiers, time, dates, or oversized arrays", () => {
    const result = validateWorkspace({
      schemaVersion: 1,
      id: "bad id!",
      title: "집",
      createdAt: "not-a-date",
      updatedAt: "2026-07-30T00:00:00.000Z",
      lists: Array.from({ length: 101 }, (_, index) => ({ id: `list-${index}`, title: "목록", recordIds: [] })),
      records: [],
      tasks: [],
      reminders: [{ id: "wake", title: "기상", time: "9:30", enabled: true }],
      extensions: [],
      unexpected: true,
    });

    expect(result.ok).toBe(false);
  });
});

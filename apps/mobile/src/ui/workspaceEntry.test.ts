import { validateWorkspace } from "@life-steward/life-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { listAssistantSources } from "../local-ai/assistantSources";
import { fixtureWorkspace } from "../test/fixtureWorkspace";
import { addWorkspaceList, addWorkspaceTask } from "./workspaceEntry";

const now = "2026-07-31T01:02:03.000Z";

describe("workspace entry", () => {
  test("keeps the task and list forms in natural Korean", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/mobile/src/ui/LifeWorkspaceScreen.tsx"),
      "utf8"
    );

    expect(source).toContain('const label = isTask ? "새 작업" : "새 개인 목록"');
    expect(source).toContain('placeholder={isTask ? "무엇을 해야 하나요?" : "목록 이름"}');
    expect(source).toContain('accessibilityLabel={`${label} 제목`}');
    expect(source).toContain('accessibilityLabel={`새 ${isTask ? "작업" : "개인 목록"} 추가`}');
    expect(source).toContain('알림 날짜 (선택, 오전 9시)');
    expect(source).toContain('placeholder="YYYY-MM-DD"');
    expect(source).toContain('accessibilityLabel="알림 날짜 (선택, 오전 9시)"');
    expect(source).toContain('accessibilityHint="선택한 날짜의 기기 현지 시간 오전 9시에 알립니다."');
    expect(source).toContain('isTask ? <TextInput');
    expect(source).toContain('setDueDate("");');
    expect(source).toContain('? addWorkspaceTask(workspace, title, dueDate, createMobileWorkspaceEntryDependencies())');
  });

  test("adds an open task with a deterministic id and timestamp", () => {
    const result = addWorkspaceTask(fixtureWorkspace, "Buy flowers", {
      now: () => now,
      createId: () => "task-buy-flowers"
    });

    expect(result).toEqual({
      ok: true,
      workspace: expect.objectContaining({
        updatedAt: now,
        tasks: [...fixtureWorkspace.tasks, { id: "task-buy-flowers", title: "Buy flowers", status: "open" }]
      })
    });
  });

  test("stores a trimmed future local reminder date on a new task", () => {
    const result = addWorkspaceTask(fixtureWorkspace, "Buy flowers", " 2026-08-01 ", {
      now: () => now,
      createId: () => "task-buy-flowers"
    });

    expect(result.ok && result.workspace.tasks.at(-1)).toEqual({
      id: "task-buy-flowers", title: "Buy flowers", status: "open", dueDate: "2026-08-01"
    });
  });

  test.each(["2026-2-01", "2026-02-30", "2026-13-01", "2026-00-01"])(
    "rejects an invalid reminder date without mutating the workspace: %s",
    (dueDate) => {
      const before = structuredClone(fixtureWorkspace);
      const result = addWorkspaceTask(fixtureWorkspace, "Buy flowers", dueDate, {
        now: () => now,
        createId: () => "task-buy-flowers"
      });

      expect(result).toEqual({ ok: false, error: "알림 날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요." });
      expect(fixtureWorkspace).toEqual(before);
    }
  );

  test("rejects a reminder at or before the fixed device-local 9 AM without mutating", () => {
    const before = structuredClone(fixtureWorkspace);
    const result = addWorkspaceTask(fixtureWorkspace, "Buy flowers", "2026-07-31", {
      now: () => "2026-07-31T09:00:00+09:00",
      nowDate: () => new Date(2026, 6, 31, 9, 0, 0),
      createId: () => "task-buy-flowers"
    });

    expect(result).toEqual({ ok: false, error: "알림 날짜는 기기 시간 기준 미래로 선택해 주세요." });
    expect(fixtureWorkspace).toEqual(before);
  });

  test.each([
    ["nowDate Invalid Date", { now: (): string => "2026-07-31T01:02:03.000Z", nowDate: (): Date => new Date(Number.NaN) }],
    ["unparsable fallback now", { now: (): string => "not-a-date" }],
    ["nowDate Infinity", { now: (): string => "2026-07-31T01:02:03.000Z", nowDate: (): Date => new Date(Number.POSITIVE_INFINITY) }]
  ])("fails closed for a due date when the clock is invalid: %s", (_label, clock) => {
    const before = structuredClone(fixtureWorkspace);
    const result = addWorkspaceTask(fixtureWorkspace, "Buy flowers", "2026-08-01", {
      ...clock,
      createId: () => "task-buy-flowers"
    });

    expect(result).toEqual({ ok: false, error: "기기 시간을 확인할 수 없습니다. 알림 날짜를 다시 확인해 주세요." });
    expect(fixtureWorkspace).toEqual(before);
  });

  test("allows a task without a reminder date when the clock is invalid", () => {
    const result = addWorkspaceTask(fixtureWorkspace, "Buy flowers", {
      now: () => "2026-07-31T01:02:03.000Z",
      nowDate: () => new Date(Number.NaN),
      createId: () => "task-buy-flowers"
    });

    expect(result.ok && result.workspace.tasks.at(-1)).toEqual({
      id: "task-buy-flowers", title: "Buy flowers", status: "open"
    });
  });

  test("adds a list with no records", () => {
    const result = addWorkspaceList(fixtureWorkspace, "Weekend plans", {
      now: () => now,
      createId: () => "list-weekend-plans"
    });

    expect(result).toEqual({
      ok: true,
      workspace: expect.objectContaining({
        updatedAt: now,
        lists: [...fixtureWorkspace.lists, { id: "list-weekend-plans", title: "Weekend plans", recordIds: [] }]
      })
    });
  });

  test("trims a title before storing it", () => {
    const result = addWorkspaceTask(fixtureWorkspace, "  Trim me  ", {
      now: () => now,
      createId: () => "task-trim-me"
    });

    expect(result.ok && result.workspace.tasks.at(-1)?.title).toBe("Trim me");
  });

  test("rejects an empty title without changing the source workspace", () => {
    const result = addWorkspaceTask(fixtureWorkspace, "   ", {
      now: () => now,
      createId: () => "task-unused"
    });

    expect(result).toEqual({ ok: false, error: "제목을 입력해 주세요." });
    expect(fixtureWorkspace.tasks).toHaveLength(1);
  });

  test("rejects a title longer than 500 Unicode code units", () => {
    const result = addWorkspaceList(fixtureWorkspace, "x".repeat(501), {
      now: () => now,
      createId: () => "list-unused"
    });

    expect(result).toEqual({ ok: false, error: "제목은 500자 이하로 입력해 주세요." });
  });

  test("uses a later injected id when the first task id collides", () => {
    const ids = ["task-buy-fruit", "task-new-task"];
    const workspace = {
      ...fixtureWorkspace,
      tasks: [...fixtureWorkspace.tasks, { id: "task-buy-fruit", title: "Existing", status: "open" as const }]
    };
    const result = addWorkspaceTask(workspace, "New task", {
      now: () => now,
      createId: () => ids.shift() ?? "task-fallback"
    });

    expect(result.ok && result.workspace.tasks.at(-1)?.id).toBe("task-new-task");
  });

  test("produces a valid workspace and exposes new task and list sources", () => {
    const taskResult = addWorkspaceTask(fixtureWorkspace, "Call family", {
      now: () => now,
      createId: () => "task-call-family"
    });
    expect(taskResult.ok).toBe(true);
    if (!taskResult.ok) return;
    const listResult = addWorkspaceList(taskResult.workspace, "Family plans", {
      now: () => now,
      createId: () => "list-family-plans"
    });
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;

    expect(validateWorkspace(listResult.workspace).ok).toBe(true);
    expect(listAssistantSources(listResult.workspace)).toEqual(expect.arrayContaining([
      { kind: "task", id: "task-call-family", text: "Call family" },
      { kind: "list", id: "list-family-plans", text: "Family plans" }
    ]));
  });

  test("does not mutate the input workspace or its collections", () => {
    const before = structuredClone(fixtureWorkspace);
    const result = addWorkspaceList(fixtureWorkspace, "Private list", {
      now: () => now,
      createId: () => "list-private"
    });

    expect(result.ok).toBe(true);
    expect(fixtureWorkspace).toEqual(before);
    expect(result.ok && result.workspace).not.toBe(fixtureWorkspace);
    expect(result.ok && result.workspace.lists).not.toBe(fixtureWorkspace.lists);
  });
});

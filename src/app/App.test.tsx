import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createEmptyWorkspace } from "@life-steward/life-core";
import { WORKSPACE_STORAGE_KEY, loadWorkspace, saveWorkspace } from "../features/workspace/workspaceRepository";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  afterEach(cleanup);

  test("renders the neutral personal workspace without care or health copy", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "생활후견 AI" })).toBeInTheDocument();
    expect(screen.getByText("나만의 생활 기능 만들기")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/복약|질환|치료|피돌봄/);
  });

  test("adds a personal extension, marks it unsaved, and saves it to this browser", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("새 기능 이름"), "여행 준비");
    await user.click(screen.getByRole("button", { name: "기능 추가" }));
    expect(screen.getByText("저장되지 않은 변경 사항이 있습니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    expect(screen.getByText("여행 준비")).toBeInTheDocument();
    expect(screen.getByText("이 브라우저에 작업공간을 저장했습니다.")).toBeInTheDocument();
  });

  test("warns before leaving when there are unsaved changes", async () => {
    const user = userEvent.setup();
    const listener = vi.spyOn(window, "addEventListener");
    render(<App />);
    await user.type(screen.getByLabelText("작업공간 이름"), "새 계획");
    const beforeUnload = listener.mock.calls.find(([type]) => type === "beforeunload")?.[1] as ((event: BeforeUnloadEvent) => void);
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;

    beforeUnload(event);

    expect(event.defaultPrevented).toBe(true);
  });

  test("shows an unavailable message instead of crashing when browser storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });

    render(<App />);

    expect(screen.getByText("저장 데이터에 접근할 수 없습니다.")).toBeInTheDocument();
  });

  test("shows a save failure message when browser storage cannot be written", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    expect(screen.getByText("이 브라우저에 작업공간을 저장하지 못했습니다.")).toBeInTheDocument();
  });

  test("shows a conflict and preserves the newer browser tab workspace", async () => {
    const user = userEvent.setup();
    const initialWorkspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    saveWorkspace(initialWorkspace, 0);
    render(<App />);
    await user.clear(screen.getByLabelText("작업공간 이름"));
    await user.type(screen.getByLabelText("작업공간 이름"), "내 탭 변경");
    const newerWorkspace = { ...initialWorkspace, title: "다른 탭 변경", updatedAt: "2026-07-31T00:00:00.000Z" };
    saveWorkspace(newerWorkspace, 1);

    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    expect(screen.getByText("다른 탭에서 작업공간이 변경되었습니다. 최신 데이터를 다시 불러온 뒤 저장해 주세요.")).toBeInTheDocument();
    expect(loadWorkspace()).toEqual({ kind: "loaded", workspace: newerWorkspace, revision: 2 });
  });

  test("preserves invalid data until explicit initialization is confirmed", async () => {
    const user = userEvent.setup();
    const raw = JSON.stringify({ schemaVersion: 2 });
    localStorage.setItem(WORKSPACE_STORAGE_KEY, raw);
    render(<App />);

    expect(screen.getByText("저장된 작업공간을 안전하게 읽지 못했습니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "새 작업공간으로 초기화" }));
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
    await user.click(screen.getByRole("button", { name: "초기화 확인" }));

    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBe(raw);
  });

  test("requires a second confirmation before deleting the browser-local workspace", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    await user.click(screen.getByRole("button", { name: "이 브라우저의 작업공간 삭제" }));

    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByRole("button", { name: "삭제 확인" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));

    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  test("keeps data when deletion fails and reports the failure", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    await user.click(screen.getByRole("button", { name: "이 브라우저의 작업공간 삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));

    expect(screen.getByText("이 브라우저의 작업공간을 삭제하지 못했습니다.")).toBeInTheDocument();
  });
});

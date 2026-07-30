import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createEmptyWorkspace } from "@life-steward/life-core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  WORKSPACE_CHANGE_EVENT,
  WORKSPACE_DATABASE_NAME,
  WORKSPACE_STORAGE_KEY,
  clearWorkspace,
  loadWorkspace,
  saveWorkspace
} from "../features/workspace/workspaceRepository";
import type { LifeAppRepository } from "./state/useLifeAppState";
import { App } from "./App";

function deleteWorkspaceDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(WORKSPACE_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function waitForReady() {
  await waitFor(() => expect(screen.getByRole("button", { name: "이 브라우저에 저장" })).toBeEnabled());
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

function loadedWorkspace(title = "개인 생활", revision = 1) {
  return {
    kind: "loaded" as const,
    workspace: { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title },
    revision
  };
}

describe("App", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    await deleteWorkspaceDatabase();
  });
  afterEach(() => cleanup());

  test("renders the neutral personal workspace without care or health copy", async () => {
    render(<App />);
    await waitForReady();

    expect(screen.getByRole("heading", { name: "생활후견 AI" })).toBeInTheDocument();
    expect(screen.getByText("나만의 생활 기능 만들기")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/복약|질환|치료|피돌봄/);
  });

  test("blocks the whole editor with aria-busy until the initial load resolves", async () => {
    const pendingLoad = deferred<ReturnType<typeof loadedWorkspace>>();
    const repository: LifeAppRepository = {
      loadWorkspace: () => pendingLoad.promise,
      saveWorkspace: async () => ({ kind: "unavailable" }),
      initializeWorkspace: async () => ({ kind: "unavailable" }),
      clearWorkspace: async () => ({ kind: "unavailable" }),
      subscribeWorkspaceChanges: () => () => undefined
    };
    render(<App repository={repository} />);

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("작업공간 이름")).toBeDisabled();
    expect(screen.getByRole("button", { name: "기능 추가" })).toBeDisabled();
    await act(async () => pendingLoad.resolve(loadedWorkspace("불러온 계획")));

    await waitFor(() => expect(screen.getByLabelText("작업공간 이름")).toHaveValue("불러온 계획"));
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
  });

  test("adds a personal extension, marks it unsaved, and saves it to IndexedDB", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForReady();

    await user.type(screen.getByLabelText("새 기능 이름"), "여행 준비");
    await user.click(screen.getByRole("button", { name: "기능 추가" }));
    expect(screen.getByText("저장되지 않은 변경 사항이 있습니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    expect(screen.getByText("여행 준비")).toBeInTheDocument();
    await screen.findByText("이 브라우저에 작업공간을 저장했습니다.");
  });

  test("warns before leaving when there are unsaved changes", async () => {
    const user = userEvent.setup();
    const listener = vi.spyOn(window, "addEventListener");
    render(<App />);
    await waitForReady();
    await user.type(screen.getByLabelText("작업공간 이름"), "새 계획");
    const beforeUnload = listener.mock.calls.find(([type]) => type === "beforeunload")?.[1] as ((event: BeforeUnloadEvent) => void);
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;

    beforeUnload(event);

    expect(event.defaultPrevented).toBe(true);
  });

  test("shows an unavailable message instead of crashing when the localStorage getter is blocked", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    render(<App />);

    await screen.findByText("저장 데이터에 접근할 수 없습니다.");
  });

  test("shows a save failure message when IndexedDB is unavailable", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("indexedDB", undefined);
    render(<App />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    await screen.findByText("이 브라우저에 작업공간을 저장하지 못했습니다.");
  });

  test("shows a conflict and preserves the newer browser tab workspace", async () => {
    const user = userEvent.setup();
    const initialWorkspace = createEmptyWorkspace("2026-07-30T00:00:00.000Z");
    await saveWorkspace(initialWorkspace, 0);
    render(<App />);
    await waitForReady();
    await user.clear(screen.getByLabelText("작업공간 이름"));
    await user.type(screen.getByLabelText("작업공간 이름"), "내 탭 변경");
    const newerWorkspace = { ...initialWorkspace, title: "다른 탭 변경", updatedAt: "2026-07-31T00:00:00.000Z" };
    await saveWorkspace(newerWorkspace, 1);

    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    await screen.findByText("다른 탭에서 작업공간이 변경되었습니다. 최신 데이터를 다시 불러온 뒤 저장해 주세요.");
    await expect(loadWorkspace()).resolves.toEqual({ kind: "loaded", workspace: newerWorkspace, revision: 2 });
  });

  test("keeps an edit made while sync reload is pending instead of applying stale remote workspace", async () => {
    const user = userEvent.setup();
    const syncLoad = deferred<ReturnType<typeof loadedWorkspace>>();
    let notify: () => void = () => undefined;
    let loadCount = 0;
    const repository: LifeAppRepository = {
      loadWorkspace: () => ++loadCount === 1 ? Promise.resolve(loadedWorkspace("기존 계획")) : syncLoad.promise,
      saveWorkspace: async () => ({ kind: "unavailable" }),
      initializeWorkspace: async () => ({ kind: "unavailable" }),
      clearWorkspace: async () => ({ kind: "unavailable" }),
      subscribeWorkspaceChanges: (listener) => { notify = listener; return () => undefined; }
    };
    render(<App repository={repository} />);
    await waitForReady();

    act(() => notify());
    await user.clear(screen.getByLabelText("작업공간 이름"));
    await user.type(screen.getByLabelText("작업공간 이름"), "내 최신 편집");
    await act(async () => syncLoad.resolve(loadedWorkspace("원격 이전 결과", 2)));

    expect(screen.getByLabelText("작업공간 이름")).toHaveValue("내 최신 편집");
    await screen.findByText("다른 탭에서 작업공간이 변경되었습니다. 저장하기 전에 최신 데이터를 확인해 주세요.");
  });

  test("keeps edits made during save dirty while recording the persisted revision", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred<{ kind: "saved"; revision: number }>();
    const repository: LifeAppRepository = {
      loadWorkspace: async () => loadedWorkspace("저장 전 계획"),
      saveWorkspace: () => pendingSave.promise,
      initializeWorkspace: async () => ({ kind: "unavailable" }),
      clearWorkspace: async () => ({ kind: "unavailable" }),
      subscribeWorkspaceChanges: () => () => undefined
    };
    render(<App repository={repository} />);
    await waitForReady();
    await user.clear(screen.getByLabelText("작업공간 이름"));
    await user.type(screen.getByLabelText("작업공간 이름"), "저장 시작 상태");
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    await user.type(screen.getByLabelText("작업공간 이름"), " 최신 편집");
    await act(async () => pendingSave.resolve({ kind: "saved", revision: 2 }));

    expect(screen.getByLabelText("작업공간 이름")).toHaveValue("저장 시작 상태 최신 편집");
    expect(screen.getByText("저장되지 않은 변경 사항이 있습니다.")).toBeInTheDocument();
    await screen.findByText("이전 상태는 저장됐고 최신 변경은 아직 저장되지 않았습니다.");
  });

  test("runs at most one save, delete, or initialize operation while a matching request is pending", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred<{ kind: "saved"; revision: number }>();
    const saveWorkspace = vi.fn(() => pendingSave.promise);
    const repository: LifeAppRepository = {
      loadWorkspace: async () => loadedWorkspace(),
      saveWorkspace,
      initializeWorkspace: async () => ({ kind: "unavailable" }),
      clearWorkspace: async () => ({ kind: "unavailable" }),
      subscribeWorkspaceChanges: () => () => undefined
    };
    render(<App repository={repository} />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    expect(saveWorkspace).toHaveBeenCalledOnce();
    await act(async () => pendingSave.resolve({ kind: "saved", revision: 2 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "이 브라우저에 저장" })).toBeEnabled());
  });

  test("runs deletion only once while its confirmation is pending", async () => {
    const user = userEvent.setup();
    const pendingClear = deferred<{ kind: "cleared" }>();
    const clearWorkspace = vi.fn(() => pendingClear.promise);
    const repository: LifeAppRepository = {
      loadWorkspace: async () => loadedWorkspace(),
      saveWorkspace: async () => ({ kind: "unavailable" }),
      initializeWorkspace: async () => ({ kind: "unavailable" }),
      clearWorkspace,
      subscribeWorkspaceChanges: () => () => undefined
    };
    render(<App repository={repository} />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "이 브라우저의 작업공간 삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));
    expect(clearWorkspace).toHaveBeenCalledOnce();
    await act(async () => pendingClear.resolve({ kind: "cleared" }));
    await waitFor(() => expect(screen.getByText("이 브라우저의 개인 작업공간을 삭제했습니다.")).toBeInTheDocument());
  });

  test("deletes an invalid raw workspace with the exact record the user confirmed", async () => {
    const user = userEvent.setup();
    const raw = '{"schemaVersion":999,"private":"delete-me"}';
    const confirmationToken = "a".repeat(32);
    const clearWorkspace = vi.fn(async () => ({ kind: "cleared" as const }));
    const repository: LifeAppRepository = {
      loadWorkspace: async () => ({ kind: "invalid", raw, confirmationToken }),
      saveWorkspace: async () => ({ kind: "unavailable" }),
      initializeWorkspace: async () => ({ kind: "unavailable" }),
      clearWorkspace,
      subscribeWorkspaceChanges: () => () => undefined
    };
    render(<App repository={repository} />);
    await screen.findByRole("button", { name: "새 작업공간으로 초기화" });

    await user.click(screen.getByRole("button", { name: "이 브라우저의 작업공간 삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));

    expect(clearWorkspace).toHaveBeenCalledWith({ kind: "invalid", raw, confirmationToken });
    await screen.findByText("이 브라우저의 개인 작업공간을 삭제했습니다.");
  });

  test("runs initialization only once while its confirmation is pending", async () => {
    const user = userEvent.setup();
    const raw = "{broken";
    const confirmationToken = "b".repeat(32);
    const pendingInitialize = deferred<{ kind: "saved"; revision: number }>();
    const initializeWorkspace = vi.fn(() => pendingInitialize.promise);
    const repository: LifeAppRepository = {
      loadWorkspace: async () => ({ kind: "invalid", raw, confirmationToken }),
      saveWorkspace: async () => ({ kind: "unavailable" }),
      initializeWorkspace,
      clearWorkspace: async () => ({ kind: "unavailable" }),
      subscribeWorkspaceChanges: () => () => undefined
    };
    render(<App repository={repository} />);
    await screen.findByRole("button", { name: "새 작업공간으로 초기화" });

    await user.click(screen.getByRole("button", { name: "새 작업공간으로 초기화" }));
    await user.click(screen.getByRole("button", { name: "초기화 확인" }));
    await user.click(screen.getByRole("button", { name: "초기화 확인" }));
    expect(initializeWorkspace).toHaveBeenCalledOnce();
    await act(async () => pendingInitialize.resolve({ kind: "saved", revision: 1 }));
    await waitFor(() => expect(screen.getByText("새 작업공간을 초기화했습니다.")).toBeInTheDocument());
  });

  test("synchronizes a clean tab to an empty workspace after another tab deletes", async () => {
    const storedWorkspace = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "보관된 계획" };
    await saveWorkspace(storedWorkspace, 0);
    render(<App />);
    await waitForReady();
    expect(screen.getByLabelText("작업공간 이름")).toHaveValue("보관된 계획");

    await clearWorkspace({ kind: "revision", revision: 1 });
    window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT));

    await waitFor(() => expect(screen.getByLabelText("작업공간 이름")).toHaveValue("개인 생활"));
  });

  test("keeps dirty tab edits and warns when another tab deletes", async () => {
    const user = userEvent.setup();
    const storedWorkspace = { ...createEmptyWorkspace("2026-07-30T00:00:00.000Z"), title: "보관된 계획" };
    await saveWorkspace(storedWorkspace, 0);
    render(<App />);
    await waitForReady();
    await user.clear(screen.getByLabelText("작업공간 이름"));
    await user.type(screen.getByLabelText("작업공간 이름"), "내 미저장 계획");

    await clearWorkspace({ kind: "revision", revision: 1 });
    window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT));

    await screen.findByText("다른 탭에서 작업공간이 변경되었습니다. 저장하기 전에 최신 데이터를 확인해 주세요.");
    expect(screen.getByLabelText("작업공간 이름")).toHaveValue("내 미저장 계획");
  });

  test("preserves invalid data until explicit initialization is confirmed", async () => {
    const user = userEvent.setup();
    const raw = JSON.stringify({ schemaVersion: 2 });
    localStorage.setItem(WORKSPACE_STORAGE_KEY, raw);
    render(<App />);
    await screen.findByText("저장된 작업공간을 안전하게 읽지 못했습니다.");
    await user.click(screen.getByRole("button", { name: "새 작업공간으로 초기화" }));
    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "invalid", raw });
    await user.click(screen.getByRole("button", { name: "초기화 확인" }));

    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "loaded", revision: 1 });
  });

  test("requires a second confirmation before deleting the browser-local workspace", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForReady();
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    await screen.findByText("이 브라우저에 작업공간을 저장했습니다.");
    await user.click(screen.getByRole("button", { name: "이 브라우저의 작업공간 삭제" }));

    await expect(loadWorkspace()).resolves.toMatchObject({ kind: "loaded", revision: 1 });
    expect(screen.getByRole("button", { name: "삭제 확인" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));

    await expect(loadWorkspace()).resolves.toEqual({ kind: "missing" });
  });

  test("keeps data when IndexedDB deletion fails and reports the failure", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForReady();
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
    await screen.findByText("이 브라우저에 작업공간을 저장했습니다.");
    vi.stubGlobal("indexedDB", undefined);
    await user.click(screen.getByRole("button", { name: "이 브라우저의 작업공간 삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));

    await screen.findByText("이 브라우저의 작업공간을 삭제하지 못했습니다.");
  });
});

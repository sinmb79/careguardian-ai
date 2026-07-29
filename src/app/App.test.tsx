import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  test("renders the neutral personal workspace without care or health copy", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "생활후견 AI" })).toBeInTheDocument();
    expect(screen.getByText("나만의 생활 기능 만들기")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/복약|질환|치료|피돌봄/);
  });

  test("adds a personal extension and saves it to this browser", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("새 기능 이름"), "여행 준비");
    await user.click(screen.getByRole("button", { name: "기능 추가" }));
    await user.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));

    expect(screen.getByText("여행 준비")).toBeInTheDocument();
    expect(screen.getByText("이 브라우저에 작업공간을 저장했습니다.")).toBeInTheDocument();
  });
});

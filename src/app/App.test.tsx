import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { App } from "./App";

describe("App", () => {
  test("shows companion mode after saving caregiver data", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("피돌봄자 이름"), "수호");
    await user.type(screen.getByLabelText("아침 루틴"), "아침 식사");
    await user.type(screen.getByLabelText("복약 이름"), "빨간 알약");
    await user.click(screen.getByRole("button", { name: "저장하고 동반자 보기" }));

    expect(screen.getByText("오늘의 돌봄 동반자")).toBeInTheDocument();
    expect(screen.getAllByText(/수호/).length).toBeGreaterThan(0);
    expect(screen.getByText("복약 타임라인")).toBeInTheDocument();
    expect(screen.getByText("릴레이 준비도")).toBeInTheDocument();
  });
});

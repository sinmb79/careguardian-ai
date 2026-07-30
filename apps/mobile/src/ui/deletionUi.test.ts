import { describe, expect, test, vi } from "vitest";
import { observeDeleteAll } from "./deletionUi";

describe("delete-all UI promise observation", () => {
  test("observes a rejected controller promise so the press handler resolves", async () => {
    const failure = new AggregateError([new Error("persistent data remains")]);
    const onDeleteAll = vi.fn(async () => { throw failure; });

    await expect(observeDeleteAll(onDeleteAll)).resolves.toBeUndefined();
    expect(onDeleteAll).toHaveBeenCalledOnce();
  });
});

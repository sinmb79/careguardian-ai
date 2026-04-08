import { beforeEach, describe, expect, test } from "vitest";
import { createEmptyCareManual } from "../manual/manualSchema";
import { loadCareManual, saveCareManual } from "./careManualRepository";

describe("careManualRepository", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("saves and loads encrypted care manuals", async () => {
    const manual = createEmptyCareManual();
    manual.subject.name = "수호";

    await saveCareManual(manual, "demo-passphrase");

    const rawSavedValue = localStorage.getItem("careguardian.manual");
    const loaded = await loadCareManual("demo-passphrase");

    expect(rawSavedValue).toBeTruthy();
    expect(rawSavedValue).not.toContain("수호");
    expect(loaded?.subject.name).toBe("수호");
  });
});

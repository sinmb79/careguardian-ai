import { describe, expect, test } from "vitest";
import { makeFixtureManual } from "../../test/fixtures/manual";
import { parseManualBackup, serializeManualBackup } from "./manualBackup";

describe("manualBackup", () => {
  test("serializes and parses encrypted manual backups", async () => {
    const manual = makeFixtureManual();
    const backup = await serializeManualBackup(manual, "backup-passphrase");
    const restored = await parseManualBackup(backup, "backup-passphrase");

    expect(backup).toContain("\"cipherText\"");
    expect(restored.subject.name).toBe("수호");
  });
});

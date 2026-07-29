import { describe, expect, test, vi } from "vitest";

vi.mock("expo-sqlite/kv-store", () => ({ default: {} }));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-crypto", () => ({}));

import { fixtureWorkspace } from "../test/fixtureWorkspace";
import {
  createMobileWorkspaceRepository,
  type MobileWorkspaceStorageDependencies
} from "./mobileWorkspaceRepository";

function createHarness() {
  const rows = new Map<string, string>();
  const secure = new Map<string, string>();
  const legacy = new Map<string, string>();
  const commands: string[] = [];
  const dependencies: MobileWorkspaceStorageDependencies = {
    databaseName: "test-life-workspace.db",
    openDatabase: async () => ({
      execAsync: async (sql) => void commands.push(sql),
      runAsync: async (sql, ...params) => {
        if (sql.startsWith("DELETE")) rows.delete(String(params[0]));
        else rows.set(String(params[0]), String(params[1]));
      },
      getFirstAsync: async <T>(_: string, key: string) => {
        const value = rows.get(key);
        return value === undefined ? null : ({ value } as T);
      },
      closeAsync: async () => undefined
    }),
    deleteDatabase: async () => rows.clear(),
    legacyStorage: {
      getItem: async (key) => legacy.get(key) ?? null,
      removeItem: async (key) => void legacy.delete(key)
    },
    secureStore: {
      getItem: async (key) => secure.get(key) ?? null,
      setItem: async (key, value) => void secure.set(key, value),
      deleteItem: async (key) => void secure.delete(key)
    },
    randomBytes: async () => new Uint8Array(32).fill(0xab)
  };

  return { repository: createMobileWorkspaceRepository(dependencies), rows, secure, legacy, commands };
}

describe("mobile personal workspace repository", () => {
  test("stores a workspace without health-shaped fields", async () => {
    const harness = createHarness();

    await harness.repository.saveWorkspace(fixtureWorkspace);

    await expect(harness.repository.loadWorkspace()).resolves.toEqual(fixtureWorkspace);
    expect(JSON.stringify([...harness.rows.values()])).not.toMatch(/약|복약|질환|치료/);
  });

  test("uses a dedicated encrypted database and rejects invalid workspace payloads", async () => {
    const harness = createHarness();

    await expect(
      harness.repository.saveWorkspace({ ...fixtureWorkspace, schemaVersion: 2 } as never)
    ).rejects.toThrow("invalid personal workspace");

    await harness.repository.saveWorkspace(fixtureWorkspace);
    expect(harness.commands).toContain("PRAGMA key = \"x'" + "ab".repeat(32) + "'\";");
  });

  test("deletes only after removing the encrypted workspace and its secure key", async () => {
    const harness = createHarness();
    await harness.repository.saveWorkspace(fixtureWorkspace);

    await harness.repository.deleteWorkspace();

    await expect(harness.repository.loadWorkspace()).resolves.toBeNull();
    expect(harness.secure.size).toBe(0);
  });

  test("detects old test data without importing or converting it", async () => {
    const harness = createHarness();
    harness.legacy.set("careguardian.mobile.manual", "old-format-payload");

    await expect(harness.repository.hasPreviousTestData()).resolves.toBe(true);
    await expect(harness.repository.loadWorkspace()).resolves.toBeNull();
  });
});

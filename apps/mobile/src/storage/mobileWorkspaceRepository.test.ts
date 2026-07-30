import { describe, expect, test, vi } from "vitest";

vi.mock("expo-sqlite/kv-store", () => ({ default: {} }));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-crypto", () => ({}));
vi.mock("expo-file-system/legacy", () => ({ getInfoAsync: async () => ({ exists: false }) }));

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
  const databases = new Set<string>();
  let failContextWrite = false;
  let failNextRun = false;
  let failNextExec = false;
  let failSecureDeleteKey: string | null = null;
  let closeCalls = 0;
  let transactionSnapshot: Map<string, string> | null = null;
  const dependencies: MobileWorkspaceStorageDependencies = {
    databaseName: "test-life-workspace.db",
    databaseExists: async (name) => databases.has(name),
    openDatabase: async (name) => {
      databases.add(name);
      return {
      execAsync: async (sql) => {
        commands.push(sql);
        if (failNextExec) {
          failNextExec = false;
          throw new Error("setup unavailable");
        }
        if (sql === "BEGIN IMMEDIATE;") transactionSnapshot = new Map(rows);
        if (sql === "ROLLBACK;" && transactionSnapshot) {
          rows.clear();
          transactionSnapshot.forEach((value, key) => rows.set(key, value));
          transactionSnapshot = null;
        }
        if (sql === "COMMIT;") transactionSnapshot = null;
      },
      runAsync: async (sql, ...params) => {
        if (failNextRun) {
          failNextRun = false;
          throw new Error("write unavailable");
        }
        if (sql.startsWith("DELETE")) rows.delete(String(params[0]));
        else rows.set(String(params[0]), String(params[1]));
      },
      getFirstAsync: async <T>(_: string, key: string) => {
        const value = rows.get(key);
        return value === undefined ? null : ({ value } as T);
      },
      closeAsync: async () => { closeCalls += 1; }
      };
    },
    deleteDatabase: async (name) => { rows.clear(); databases.delete(name); },
    legacyStorage: {
      getItem: async (key) => legacy.get(key) ?? null,
      removeItem: async (key) => void legacy.delete(key)
    },
    secureStore: {
      getItem: async (key) => secure.get(key) ?? null,
      setItem: async (key, value) => {
        if (key === "life-steward.mobile.context" && failContextWrite) {
          failContextWrite = false;
          throw new Error("context unavailable");
        }
        secure.set(key, value);
      },
      deleteItem: async (key) => {
        if (key === failSecureDeleteKey) throw new Error(`secure delete failed: ${key}`);
        secure.delete(key);
      }
    },
    randomBytes: async () => new Uint8Array(32).fill(0xab)
  };

  return {
    repository: createMobileWorkspaceRepository(dependencies),
    rows,
    secure,
    legacy,
    commands,
    databases,
    failContextWrite: () => { failContextWrite = true; },
    failNextRun: () => { failNextRun = true; },
    failNextExec: () => { failNextExec = true; },
    failSecureDelete: (key: string) => { failSecureDeleteKey = key; },
    getCloseCalls: () => closeCalls
  };
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

  test.each([
    "life-steward.mobile.context",
    "life-steward.mobile.database-created",
    "life-steward.mobile.database-key"
  ])("attempts every repository-owned key deletion when %s fails", async (failedKey) => {
    const harness = createHarness();
    await harness.repository.saveWorkspace(fixtureWorkspace);
    harness.failSecureDelete(failedKey);

    await expect(harness.repository.deleteWorkspace()).rejects.toThrow(
      `secure delete failed: ${failedKey}`
    );

    expect(harness.databases.has("test-life-workspace.db")).toBe(false);
    expect(harness.rows.size).toBe(0);
    expect([...harness.secure.keys()]).toEqual([failedKey]);
  });

  test("detects old test data without importing or converting it", async () => {
    const harness = createHarness();
    harness.legacy.set("careguardian.mobile.manual", "old-format-payload");

    await expect(harness.repository.hasPreviousTestData()).resolves.toBe(true);
    await expect(harness.repository.loadWorkspace()).resolves.toBeNull();
  });

  test("cleans up encrypted state when the SecureStore context write fails", async () => {
    const harness = createHarness();
    harness.failContextWrite();

    await expect(harness.repository.saveWorkspace(fixtureWorkspace)).rejects.toThrow("context unavailable");
    expect(harness.rows.size).toBe(0);
    expect(harness.secure.has("life-steward.mobile.database-key")).toBe(false);
    await expect(harness.repository.loadWorkspace()).resolves.toBeNull();
  });

  test("fails closed instead of treating an orphaned encrypted key as no workspace", async () => {
    const harness = createHarness();
    harness.secure.set("life-steward.mobile.database-key", "ab".repeat(32));

    await expect(harness.repository.loadWorkspace()).rejects.toThrow("recovery");
    await expect(harness.repository.hasWorkspace()).rejects.toThrow("recovery");
  });

  test("fails closed when an encrypted workspace database exists without a context marker", async () => {
    const harness = createHarness();
    harness.databases.add("test-life-workspace.db");

    await expect(harness.repository.loadWorkspace()).rejects.toThrow("recovery");
  });

  test("detects an old encrypted database even when its SecureStore marker is absent", async () => {
    const harness = createHarness();
    harness.databases.add("careguardian-caremanual-encrypted.db");

    await expect(harness.repository.hasPreviousTestData()).resolves.toBe(true);
    await expect(harness.repository.loadWorkspace()).resolves.toBeNull();
  });

  test("keeps the prior valid workspace when an update write fails", async () => {
    const harness = createHarness();
    await harness.repository.saveWorkspace(fixtureWorkspace);
    const updated = { ...fixtureWorkspace, title: "수정 전용", updatedAt: "2026-07-31T00:00:00.000Z" };
    harness.failNextRun();

    await expect(harness.repository.saveWorkspace(updated)).rejects.toThrow("write unavailable");
    await expect(harness.repository.loadWorkspace()).resolves.toEqual(fixtureWorkspace);
  });

  test("keeps the prior valid workspace when an update context write fails", async () => {
    const harness = createHarness();
    await harness.repository.saveWorkspace(fixtureWorkspace);
    const updated = { ...fixtureWorkspace, title: "수정 전용", updatedAt: "2026-07-31T00:00:00.000Z" };
    harness.failContextWrite();

    await expect(harness.repository.saveWorkspace(updated)).rejects.toThrow("context unavailable");
    await expect(harness.repository.loadWorkspace()).resolves.toEqual(fixtureWorkspace);
  });

  test("closes a database handle when encrypted setup fails before it can be returned", async () => {
    const harness = createHarness();
    harness.failNextExec();

    await expect(harness.repository.saveWorkspace(fixtureWorkspace)).rejects.toThrow("setup unavailable");
    expect(harness.getCloseCalls()).toBe(1);
  });
});

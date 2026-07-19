import { describe, expect, test, vi } from "vitest";

vi.mock("expo-sqlite/kv-store", () => ({ default: {} }));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-crypto", () => ({}));
import { makeMobileFixtureManual } from "../test/fixtureManual";
import {
  createMobileManualRepository,
  type MobileManualStorageDependencies
} from "./mobileManualRepository";

const LEGACY_MANUAL_KEY = "careguardian.mobile.manual";
const DB_KEY = "careguardian.mobile.database-key";
const CONTEXT_KEY = "careguardian.mobile.context";

function createHarness() {
  const rows = new Map<string, string>();
  const legacy = new Map<string, string>();
  const secure = new Map<string, string>();
  const commands: string[] = [];
  const deletedDatabases: string[] = [];
  const secureWrites: Array<{ key: string; value: string }> = [];
  let openDatabaseCalls = 0;
  let closeDatabaseCalls = 0;
  let randomBytesCalls = 0;
  let legacyRemovalError: Error | null = null;
  const dependencies: MobileManualStorageDependencies = {
    databaseName: "test-careguardian.db",
    openDatabase: async () => {
      openDatabaseCalls += 1;
      return {
      execAsync: async (sql) => {
        commands.push(sql);
      },
      runAsync: async (sql, ...params) => {
        if (sql.startsWith("DELETE")) {
          rows.delete(String(params[0]));
          return;
        }
        rows.set(String(params[0]), String(params[1]));
      },
      getFirstAsync: async <T>(_: string, key: string) => {
        const value = rows.get(key);
        return value === undefined ? null : ({ value } as T);
      },
      closeAsync: async () => {
        closeDatabaseCalls += 1;
      }
      };
    },
    deleteDatabase: async (name) => {
      deletedDatabases.push(name);
      rows.clear();
    },
    legacyStorage: {
      getItem: async (key) => legacy.get(key) ?? null,
      removeItem: async (key) => {
        if (legacyRemovalError) {
          const error = legacyRemovalError;
          legacyRemovalError = null;
          throw error;
        }
        legacy.delete(key);
      }
    },
    secureStore: {
      getItem: async (key) => secure.get(key) ?? null,
      setItem: async (key, value) => {
        secureWrites.push({ key, value });
        secure.set(key, value);
      },
      deleteItem: async (key) => void secure.delete(key)
    },
    randomBytes: async () => {
      randomBytesCalls += 1;
      return new Uint8Array(32).fill(0xab);
    }
  };

  return {
    repository: createMobileManualRepository(dependencies),
    rows,
    legacy,
    secure,
    commands,
    deletedDatabases,
    secureWrites,
    getOpenDatabaseCalls: () => openDatabaseCalls,
    getCloseDatabaseCalls: () => closeDatabaseCalls,
    getRandomBytesCalls: () => randomBytesCalls,
    failNextLegacyRemoval: () => {
      legacyRemovalError = new Error("legacy removal failed");
    }
  };
}

describe("mobile CareManual encrypted repository", () => {
  test("generates a secure key, restricts PRAGMA key to hex, and saves a manual in its dedicated database", async () => {
    const harness = createHarness();
    const manual = makeMobileFixtureManual();

    await harness.repository.saveMobileCareManual(manual);

    expect(harness.secure.get(DB_KEY)).toBe("ab".repeat(32));
    expect(JSON.parse(harness.secure.get(CONTEXT_KEY) ?? "{}"))
      .toEqual({ savedAt: manual.last_updated });
    expect(harness.commands).toContain("PRAGMA key = \"x'" + "ab".repeat(32) + "'\";");
    expect(harness.rows.get(LEGACY_MANUAL_KEY)).toBe(JSON.stringify(manual));
    expect(harness.getCloseDatabaseCalls()).toBe(1);
  });

  test("rejects a malformed database key before putting it in a PRAGMA statement", async () => {
    const harness = createHarness();
    harness.secure.set(DB_KEY, "not-a-hex-key");

    await expect(harness.repository.loadMobileCareManual()).rejects.toThrow("invalid mobile database key");
    expect(harness.commands).toEqual([]);
  });

  test("migrates valid legacy plaintext once and removes the plaintext key", async () => {
    const harness = createHarness();
    const manual = makeMobileFixtureManual();
    harness.legacy.set(LEGACY_MANUAL_KEY, JSON.stringify(manual));

    await expect(harness.repository.loadMobileCareManual()).resolves.toEqual(manual);
    expect(harness.rows.get(LEGACY_MANUAL_KEY)).toBe(JSON.stringify(manual));
    expect(harness.legacy.get(LEGACY_MANUAL_KEY)).toBeUndefined();
    expect(harness.getCloseDatabaseCalls()).toBe(1);
  });

  test("fails closed and retries cleanup when an encrypted row has lingering legacy plaintext", async () => {
    const harness = createHarness();
    const manual = makeMobileFixtureManual();
    harness.secure.set(DB_KEY, "ab".repeat(32));
    harness.rows.set(LEGACY_MANUAL_KEY, JSON.stringify(manual));
    harness.legacy.set(LEGACY_MANUAL_KEY, JSON.stringify(manual));
    harness.failNextLegacyRemoval();

    await expect(harness.repository.loadMobileCareManual()).rejects.toThrow("legacy removal failed");
    expect(harness.legacy.has(LEGACY_MANUAL_KEY)).toBe(true);
    expect(harness.getCloseDatabaseCalls()).toBe(1);
    await expect(harness.repository.loadMobileCareManual()).resolves.toEqual(manual);
    expect(harness.legacy.has(LEGACY_MANUAL_KEY)).toBe(false);
    expect(harness.getCloseDatabaseCalls()).toBe(2);
  });

  test("does not treat an orphaned database key as a stored profile or open the database", async () => {
    const harness = createHarness();
    harness.secure.set(DB_KEY, "ab".repeat(32));

    await expect(harness.repository.hasMobileCareManual()).resolves.toBe(false);
    expect(harness.getOpenDatabaseCalls()).toBe(0);
    expect(harness.getRandomBytesCalls()).toBe(0);
  });

  test("reports a successful persistence context marker without opening the database or generating a key", async () => {
    const harness = createHarness();
    harness.secure.set(CONTEXT_KEY, JSON.stringify({ savedAt: "2026-07-20T00:00:00.000Z" }));

    await expect(harness.repository.hasMobileCareManual()).resolves.toBe(true);
    expect(harness.getOpenDatabaseCalls()).toBe(0);
    expect(harness.getRandomBytesCalls()).toBe(0);
  });

  test("reports legacy plaintext presence without opening the database or generating a key", async () => {
    const harness = createHarness();
    harness.legacy.set(LEGACY_MANUAL_KEY, JSON.stringify(makeMobileFixtureManual()));

    await expect(harness.repository.hasMobileCareManual()).resolves.toBe(true);
    expect(harness.getOpenDatabaseCalls()).toBe(0);
    expect(harness.getRandomBytesCalls()).toBe(0);
  });

  test("fails explicitly when persisted CareManual JSON is malformed", async () => {
    const harness = createHarness();
    harness.rows.set(LEGACY_MANUAL_KEY, JSON.stringify({ subject: { name: "Kim" } }));

    await expect(harness.repository.loadMobileCareManual()).rejects.toThrow("invalid persisted CareManual");
    expect(harness.getCloseDatabaseCalls()).toBe(1);
  });

  test("reads legacy context with subjectName while allowing the new minimized context", async () => {
    const harness = createHarness();
    harness.secure.set(CONTEXT_KEY, JSON.stringify({ subjectName: "Kim", savedAt: "2026-07-20T00:00:00.000Z" }));

    await expect(harness.repository.loadMobileManualContext()).resolves.toEqual({
      subjectName: "Kim",
      savedAt: "2026-07-20T00:00:00.000Z"
    });
    harness.secure.set(CONTEXT_KEY, JSON.stringify({ savedAt: "2026-07-21T00:00:00.000Z" }));
    await expect(harness.repository.loadMobileManualContext()).resolves.toEqual({
      savedAt: "2026-07-21T00:00:00.000Z"
    });
  });

  test("deletes the encrypted row, legacy plaintext, context and database key", async () => {
    const harness = createHarness();
    const manual = makeMobileFixtureManual();
    harness.legacy.set(LEGACY_MANUAL_KEY, JSON.stringify(manual));
    harness.secure.set(DB_KEY, "ab".repeat(32));
    harness.secure.set(CONTEXT_KEY, JSON.stringify({ subjectName: manual.subject.name, savedAt: manual.last_updated }));
    harness.rows.set(LEGACY_MANUAL_KEY, JSON.stringify(manual));

    await harness.repository.deleteMobileCareManual();

    expect(harness.rows.has(LEGACY_MANUAL_KEY)).toBe(false);
    expect(harness.legacy.has(LEGACY_MANUAL_KEY)).toBe(false);
    expect(harness.secure.has(DB_KEY)).toBe(false);
    expect(harness.secure.has(CONTEXT_KEY)).toBe(false);
  });

  test("deletes the encrypted database file so a new key can safely create it again", async () => {
    const harness = createHarness();
    const manual = makeMobileFixtureManual();
    await harness.repository.saveMobileCareManual(manual);

    await harness.repository.deleteMobileCareManual();
    await harness.repository.saveMobileCareManual(manual);

    expect(harness.deletedDatabases).toEqual(["test-careguardian.db"]);
    expect(harness.secureWrites.filter(({ key }) => key === DB_KEY)).toHaveLength(2);
    expect(harness.rows.get(LEGACY_MANUAL_KEY)).toBe(JSON.stringify(manual));
  });
});

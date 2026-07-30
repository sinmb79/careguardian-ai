import * as SQLite from "expo-sqlite";
import LegacyStorage from "expo-sqlite/kv-store";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import { validateWorkspace, type PersonalWorkspace } from "@life-steward/life-core";

const WORKSPACE_KEY = "life-steward.mobile.workspace";
const WORKSPACE_CONTEXT_KEY = "life-steward.mobile.context";
const DATABASE_KEY = "life-steward.mobile.database-key";
const DATABASE_CREATED_KEY = "life-steward.mobile.database-created";
const DATABASE_NAME = "life-steward-workspace-encrypted.db";
const PREVIOUS_PLAINTEXT_KEY = "careguardian.mobile.manual";
const PREVIOUS_CONTEXT_KEY = "careguardian.mobile.context";
const PREVIOUS_DATABASE_KEY = "careguardian.mobile.database-key";
const PREVIOUS_DATABASE_NAME = "careguardian-caremanual-encrypted.db";
const KEY_BYTES = 32;
const HEX_KEY = /^[0-9a-f]{64}$/;

function secureRandomBytes(length: number): Promise<Uint8Array> {
  const crypto = require("expo-crypto") as { getRandomBytesAsync(byteCount: number): Promise<Uint8Array> };
  return crypto.getRandomBytesAsync(length);
}

async function databaseFileExists(name: string): Promise<boolean> {
  const directory = SQLite.defaultDatabaseDirectory as string | null;
  if (!directory) return false;
  const separator = directory.endsWith("/") ? "" : "/";
  return (await FileSystem.getInfoAsync(`${directory}${separator}${name}`)).exists;
}

export interface MobileWorkspaceDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: string[]): Promise<T | null>;
  closeAsync?(): Promise<void>;
}

export interface MobileWorkspaceStorageDependencies {
  databaseName?: string;
  openDatabase(name: string): Promise<MobileWorkspaceDatabase>;
  deleteDatabase(name: string): Promise<void>;
  databaseExists(name: string): Promise<boolean>;
  legacyStorage: { getItem(key: string): Promise<string | null>; removeItem(key: string): Promise<void> };
  secureStore: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    deleteItem(key: string): Promise<void>;
  };
  randomBytes(length: number): Promise<Uint8Array>;
}

export interface MobileWorkspaceRepository {
  saveWorkspace(workspace: PersonalWorkspace): Promise<void>;
  loadWorkspace(): Promise<PersonalWorkspace | null>;
  deleteWorkspace(): Promise<void>;
  hasWorkspace(): Promise<boolean>;
  hasPreviousTestData(): Promise<boolean>;
  deletePreviousTestData(): Promise<void>;
  /** Deletes every app-owned current and legacy persistence namespace. */
  deleteAllKnownData(): Promise<void>;
}

/**
 * Inventory for destructive cleanup. Legacy names are intentionally retained so
 * a release install can erase health-era records without opening or migrating them.
 */
export const MOBILE_PERSISTENCE_INVENTORY = {
  current: {
    plaintextKeys: [] as readonly string[],
    secureStoreKeys: [WORKSPACE_CONTEXT_KEY, DATABASE_CREATED_KEY, DATABASE_KEY],
    databaseNames: [DATABASE_NAME]
  },
  legacyCareguardian: {
    plaintextKeys: [PREVIOUS_PLAINTEXT_KEY],
    secureStoreKeys: [PREVIOUS_CONTEXT_KEY, PREVIOUS_DATABASE_KEY],
    databaseNames: [PREVIOUS_DATABASE_NAME]
  }
} as const;

export class MobileDataDeletionError extends Error {
  constructor(readonly namespace: string, cause: unknown) {
    super(`mobile data deletion failed for ${namespace}`);
    this.name = "MobileDataDeletionError";
    this.cause = cause;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function assertDatabaseKey(key: string): void {
  if (!HEX_KEY.test(key)) throw new Error("invalid mobile database key");
}

function parseWorkspace(serialized: string): PersonalWorkspace {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { throw new Error("invalid persisted personal workspace: malformed JSON"); }
  const result = validateWorkspace(parsed);
  if (!result.ok) throw new Error("invalid persisted personal workspace");
  return result.value;
}

export function createMobileWorkspaceRepository(dependencies: MobileWorkspaceStorageDependencies): MobileWorkspaceRepository {
  const databaseName = dependencies.databaseName ?? DATABASE_NAME;
  const currentSecureStoreKeys = [WORKSPACE_CONTEXT_KEY, DATABASE_CREATED_KEY, DATABASE_KEY] as const;
  const legacySecureStoreKeys = [PREVIOUS_CONTEXT_KEY, PREVIOUS_DATABASE_KEY] as const;
  const legacyPlaintextKeys = [PREVIOUS_PLAINTEXT_KEY] as const;

  async function getOrCreateDatabaseKey(): Promise<string> {
    const existing = await dependencies.secureStore.getItem(DATABASE_KEY);
    if (existing) { assertDatabaseKey(existing); return existing; }
    const bytes = await dependencies.randomBytes(KEY_BYTES);
    if (bytes.length !== KEY_BYTES) throw new Error("could not generate a mobile database key");
    const key = toHex(bytes);
    assertDatabaseKey(key);
    await dependencies.secureStore.setItem(DATABASE_KEY, key);
    return key;
  }

  async function getExistingDatabaseKey(): Promise<string> {
    const key = await dependencies.secureStore.getItem(DATABASE_KEY);
    if (!key) throw new Error("workspace storage requires recovery");
    assertDatabaseKey(key);
    return key;
  }

  async function openDatabaseWithKey(key: string, recordCreation: boolean): Promise<MobileWorkspaceDatabase> {
    assertDatabaseKey(key);
    const database = await dependencies.openDatabase(databaseName);
    try {
      await database.execAsync(`PRAGMA key = "x'${key}'";`);
      await database.execAsync("CREATE TABLE IF NOT EXISTS personal_workspaces (storage_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
      if (recordCreation) await dependencies.secureStore.setItem(DATABASE_CREATED_KEY, "1");
      return database;
    } catch (error) {
      await database.closeAsync?.();
      throw error;
    }
  }

  async function cleanupFailedPersistence(): Promise<void> {
    await dependencies.secureStore.deleteItem(WORKSPACE_CONTEXT_KEY);
    await dependencies.deleteDatabase(databaseName);
    await dependencies.secureStore.deleteItem(DATABASE_CREATED_KEY);
    await dependencies.secureStore.deleteItem(DATABASE_KEY);
  }

  async function assertNoIncompleteStorageWithoutContext(): Promise<string | null> {
    const context = await dependencies.secureStore.getItem(WORKSPACE_CONTEXT_KEY);
    if (context) return context;
    const [key, created, databaseExists] = await Promise.all([
      dependencies.secureStore.getItem(DATABASE_KEY),
      dependencies.secureStore.getItem(DATABASE_CREATED_KEY),
      dependencies.databaseExists(databaseName)
    ]);
    if (key || created || databaseExists) throw new Error("workspace storage requires recovery");
    return null;
  }

  return {
    async saveWorkspace(workspace): Promise<void> {
      const validation = validateWorkspace(workspace);
      if (!validation.ok) throw new Error("invalid personal workspace");
      let database: MobileWorkspaceDatabase | undefined;
      const previousContext = await assertNoIncompleteStorageWithoutContext();
      const isFirstPersistence = previousContext === null;
      try {
        database = await openDatabaseWithKey(await getOrCreateDatabaseKey(), isFirstPersistence);
        await database.execAsync("BEGIN IMMEDIATE;");
        await database.runAsync("INSERT OR REPLACE INTO personal_workspaces (storage_key, value) VALUES (?, ?);", WORKSPACE_KEY, JSON.stringify(validation.value));
        await dependencies.secureStore.setItem(WORKSPACE_CONTEXT_KEY, JSON.stringify({ savedAt: validation.value.updatedAt }));
        await database.execAsync("COMMIT;");
      } catch (error) {
        try { await database?.execAsync("ROLLBACK;"); } catch { /* Rollback is best-effort after setup or native failures. */ }
        if (isFirstPersistence) {
          try {
            await database?.closeAsync?.();
            database = undefined;
            await cleanupFailedPersistence();
          } catch {
            throw new Error("workspace persistence failed; recovery required");
          }
        } else if (previousContext) {
          try {
            await dependencies.secureStore.setItem(WORKSPACE_CONTEXT_KEY, previousContext);
          } catch {
            throw new Error("workspace persistence failed; recovery required");
          }
        }
        throw error;
      } finally {
        await database?.closeAsync?.();
      }
    },

    async loadWorkspace(): Promise<PersonalWorkspace | null> {
      const context = await assertNoIncompleteStorageWithoutContext();
      if (!context) return null;
      const database = await openDatabaseWithKey(await getExistingDatabaseKey(), false);
      try {
        const stored = await database.getFirstAsync<{ value: string }>("SELECT value FROM personal_workspaces WHERE storage_key = ?;", WORKSPACE_KEY);
        if (!stored) throw new Error("workspace storage requires recovery");
        return parseWorkspace(stored.value);
      } finally {
        await database.closeAsync?.();
      }
    },

    async hasWorkspace(): Promise<boolean> {
      const context = await assertNoIncompleteStorageWithoutContext();
      if (!context) return false;
      await getExistingDatabaseKey();
      return true;
    },

    async deleteWorkspace(): Promise<void> {
      await dependencies.deleteDatabase(databaseName);
      let firstDeletionError: unknown;
      for (const key of currentSecureStoreKeys) {
        try {
          await dependencies.secureStore.deleteItem(key);
        } catch (error) {
          firstDeletionError ??= error;
        }
      }
      if (firstDeletionError) throw firstDeletionError;
    },

    async hasPreviousTestData(): Promise<boolean> {
      return (await dependencies.legacyStorage.getItem(PREVIOUS_PLAINTEXT_KEY)) !== null ||
        (await dependencies.secureStore.getItem(PREVIOUS_CONTEXT_KEY)) !== null ||
        (await dependencies.secureStore.getItem(PREVIOUS_DATABASE_KEY)) !== null ||
        await dependencies.databaseExists(PREVIOUS_DATABASE_NAME);
    },

    async deletePreviousTestData(): Promise<void> {
      await dependencies.deleteDatabase(PREVIOUS_DATABASE_NAME);
      await dependencies.legacyStorage.removeItem(PREVIOUS_PLAINTEXT_KEY);
      await dependencies.secureStore.deleteItem(PREVIOUS_CONTEXT_KEY);
      await dependencies.secureStore.deleteItem(PREVIOUS_DATABASE_KEY);
    },

    async deleteAllKnownData(): Promise<void> {
      const failures: MobileDataDeletionError[] = [];
      const allDatabases = [...new Set([databaseName, ...MOBILE_PERSISTENCE_INVENTORY.legacyCareguardian.databaseNames])];
      const allPlaintextKeys = [...legacyPlaintextKeys];
      const allSecureStoreKeys = [...currentSecureStoreKeys, ...legacySecureStoreKeys];

      for (const name of allDatabases) {
        let deletionError: unknown;
        try {
          await dependencies.deleteDatabase(name);
        } catch (error) {
          deletionError = error;
        }
        try {
          if (await dependencies.databaseExists(name)) {
            failures.push(new MobileDataDeletionError(
              `sqlite:${name}`,
              deletionError ?? new Error("database file remains after deletion")
            ));
          }
        } catch (error) {
          failures.push(new MobileDataDeletionError(`sqlite:${name}`, error));
        }
      }
      for (const key of allPlaintextKeys) {
        try {
          await dependencies.legacyStorage.removeItem(key);
          if ((await dependencies.legacyStorage.getItem(key)) !== null) throw new Error("plaintext value remains after deletion");
        } catch (error) {
          failures.push(new MobileDataDeletionError(`kv-store:${key}`, error));
        }
      }
      for (const key of allSecureStoreKeys) {
        try {
          await dependencies.secureStore.deleteItem(key);
          if ((await dependencies.secureStore.getItem(key)) !== null) throw new Error("SecureStore value remains after deletion");
        } catch (error) {
          failures.push(new MobileDataDeletionError(`secure-store:${key}`, error));
        }
      }
      if (failures.length > 0) {
        throw new AggregateError(failures, "mobile full-data deletion verification failed");
      }
    }
  };
}

const defaultRepository = createMobileWorkspaceRepository({
  openDatabase: (name) => SQLite.openDatabaseAsync(name),
  deleteDatabase: (name) => SQLite.deleteDatabaseAsync(name),
  databaseExists: databaseFileExists,
  legacyStorage: LegacyStorage,
  secureStore: { getItem: (key) => SecureStore.getItemAsync(key), setItem: (key, value) => SecureStore.setItemAsync(key, value), deleteItem: (key) => SecureStore.deleteItemAsync(key) },
  randomBytes: secureRandomBytes
});

export const saveWorkspace = defaultRepository.saveWorkspace;
export const loadWorkspace = defaultRepository.loadWorkspace;
export const deleteWorkspace = defaultRepository.deleteWorkspace;
export const hasWorkspace = defaultRepository.hasWorkspace;
export const hasPreviousTestData = defaultRepository.hasPreviousTestData;
export const deletePreviousTestData = defaultRepository.deletePreviousTestData;
export const deleteAllKnownMobileData = defaultRepository.deleteAllKnownData;

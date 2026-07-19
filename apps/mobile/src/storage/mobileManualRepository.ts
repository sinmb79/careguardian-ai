import * as SQLite from "expo-sqlite";
import LegacyStorage from "expo-sqlite/kv-store";
import * as SecureStore from "expo-secure-store";
import type { CareManual } from "@careguardian/care-core/manual";

const MOBILE_MANUAL_KEY = "careguardian.mobile.manual";
const MOBILE_CONTEXT_KEY = "careguardian.mobile.context";
const MOBILE_DATABASE_KEY = "careguardian.mobile.database-key";
const MOBILE_DATABASE_NAME = "careguardian-caremanual-encrypted.db";
const KEY_BYTES = 32;
const HEX_KEY = /^[0-9a-f]{64}$/;

function secureRandomBytes(length: number): Promise<Uint8Array> {
  // Kept lazy so non-native test environments can inject their own entropy source.
  const crypto = require("expo-crypto") as {
    getRandomBytesAsync(byteCount: number): Promise<Uint8Array>;
  };
  return crypto.getRandomBytesAsync(length);
}

export interface MobileManualContext {
  subjectName?: string;
  savedAt: string;
}

export interface MobileManualDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: string[]): Promise<T | null>;
  closeAsync?(): Promise<void>;
}

export interface MobileManualStorageDependencies {
  databaseName?: string;
  openDatabase(name: string): Promise<MobileManualDatabase>;
  deleteDatabase(name: string): Promise<void>;
  legacyStorage: {
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  };
  secureStore: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    deleteItem(key: string): Promise<void>;
  };
  randomBytes(length: number): Promise<Uint8Array>;
}

export interface MobileManualRepository {
  saveMobileCareManual(manual: CareManual): Promise<void>;
  loadMobileCareManual(): Promise<CareManual | null>;
  hasMobileCareManual(): Promise<boolean>;
  loadMobileManualContext(): Promise<MobileManualContext | null>;
  deleteMobileCareManual(): Promise<void>;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function assertDatabaseKey(key: string): void {
  if (!HEX_KEY.test(key)) {
    throw new Error("invalid mobile database key");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCareManual(serialized: string): CareManual {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("invalid persisted CareManual: malformed JSON");
  }

  if (
    !isRecord(value) ||
    typeof value.care_manual_version !== "string" ||
    !isRecord(value.subject) ||
    typeof value.subject.name !== "string" ||
    !isRecord(value.sections) ||
    typeof value.last_updated !== "string" ||
    !Array.isArray(value.relay_targets)
  ) {
    throw new Error("invalid persisted CareManual");
  }

  return value as unknown as CareManual;
}

function parseMobileManualContext(serialized: string): MobileManualContext {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("invalid persisted mobile CareManual context: malformed JSON");
  }

  if (
    !isRecord(value) ||
    typeof value.savedAt !== "string" ||
    ("subjectName" in value && typeof value.subjectName !== "string")
  ) {
    throw new Error("invalid persisted mobile CareManual context");
  }
  return typeof value.subjectName === "string"
    ? { subjectName: value.subjectName, savedAt: value.savedAt }
    : { savedAt: value.savedAt };
}

export function createMobileManualRepository(
  dependencies: MobileManualStorageDependencies
): MobileManualRepository {
  const databaseName = dependencies.databaseName ?? MOBILE_DATABASE_NAME;

  async function getOrCreateDatabaseKey(): Promise<string> {
    const existing = await dependencies.secureStore.getItem(MOBILE_DATABASE_KEY);
    if (existing) {
      assertDatabaseKey(existing);
      return existing;
    }

    const generated = await dependencies.randomBytes(KEY_BYTES);
    if (generated.length !== KEY_BYTES) {
      throw new Error("could not generate a mobile database key");
    }
    const key = toHex(generated);
    assertDatabaseKey(key);
    await dependencies.secureStore.setItem(MOBILE_DATABASE_KEY, key);
    return key;
  }

  async function openEncryptedDatabase(): Promise<MobileManualDatabase> {
    const key = await getOrCreateDatabaseKey();
    return openDatabaseWithKey(key);
  }

  async function openDatabaseWithKey(key: string): Promise<MobileManualDatabase> {
    assertDatabaseKey(key);
    const database = await dependencies.openDatabase(databaseName);
    // SQLCipher accepts a hex literal here. The key is regex-validated before interpolation.
    await database.execAsync(`PRAGMA key = "x'${key}'";`);
    await database.execAsync(
      "CREATE TABLE IF NOT EXISTS care_manuals (storage_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);"
    );
    return database;
  }

  async function persistManual(database: MobileManualDatabase, manual: CareManual): Promise<void> {
    const serialized = JSON.stringify(manual);
    await database.runAsync(
      "INSERT OR REPLACE INTO care_manuals (storage_key, value) VALUES (?, ?);",
      MOBILE_MANUAL_KEY,
      serialized
    );
    await dependencies.secureStore.setItem(
      MOBILE_CONTEXT_KEY,
      JSON.stringify({ savedAt: manual.last_updated } satisfies MobileManualContext)
    );
  }

  async function removeLegacyPlaintextIfPresent(): Promise<void> {
    if ((await dependencies.legacyStorage.getItem(MOBILE_MANUAL_KEY)) === null) {
      return;
    }
    await dependencies.legacyStorage.removeItem(MOBILE_MANUAL_KEY);
    if ((await dependencies.legacyStorage.getItem(MOBILE_MANUAL_KEY)) !== null) {
      throw new Error("legacy plaintext CareManual cleanup did not complete");
    }
  }

  return {
    async saveMobileCareManual(manual): Promise<void> {
      const database = await openEncryptedDatabase();
      try {
        await persistManual(database, manual);
      } finally {
        await database.closeAsync?.();
      }
    },

    async loadMobileCareManual(): Promise<CareManual | null> {
      const database = await openEncryptedDatabase();
      try {
        const stored = await database.getFirstAsync<{ value: string }>(
          "SELECT value FROM care_manuals WHERE storage_key = ?;",
          MOBILE_MANUAL_KEY
        );
        if (stored) {
          const manual = parseCareManual(stored.value);
          await removeLegacyPlaintextIfPresent();
          return manual;
        }

        const legacy = await dependencies.legacyStorage.getItem(MOBILE_MANUAL_KEY);
        if (!legacy) {
          return null;
        }
        const manual = parseCareManual(legacy);
        await persistManual(database, manual);
        await removeLegacyPlaintextIfPresent();
        return manual;
      } finally {
        await database.closeAsync?.();
      }
    },

    async hasMobileCareManual(): Promise<boolean> {
      if ((await dependencies.secureStore.getItem(MOBILE_CONTEXT_KEY)) !== null) {
        return true;
      }
      return (await dependencies.legacyStorage.getItem(MOBILE_MANUAL_KEY)) !== null;
    },

    async loadMobileManualContext(): Promise<MobileManualContext | null> {
      const stored = await dependencies.secureStore.getItem(MOBILE_CONTEXT_KEY);
      return stored ? parseMobileManualContext(stored) : null;
    },

    async deleteMobileCareManual(): Promise<void> {
      const key = await dependencies.secureStore.getItem(MOBILE_DATABASE_KEY);
      if (key) {
        const database = await openDatabaseWithKey(key);
        await database.runAsync("DELETE FROM care_manuals WHERE storage_key = ?;", MOBILE_MANUAL_KEY);
        await database.closeAsync?.();
      }
      await dependencies.deleteDatabase(databaseName);
      await dependencies.legacyStorage.removeItem(MOBILE_MANUAL_KEY);
      await dependencies.secureStore.deleteItem(MOBILE_CONTEXT_KEY);
      await dependencies.secureStore.deleteItem(MOBILE_DATABASE_KEY);
    }
  };
}

const defaultRepository = createMobileManualRepository({
  openDatabase: (name) => SQLite.openDatabaseAsync(name),
  deleteDatabase: (name) => SQLite.deleteDatabaseAsync(name),
  legacyStorage: LegacyStorage,
  secureStore: {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key)
  },
  randomBytes: secureRandomBytes
});

export const saveMobileCareManual = defaultRepository.saveMobileCareManual;
export const loadMobileCareManual = defaultRepository.loadMobileCareManual;
export const hasMobileCareManual = defaultRepository.hasMobileCareManual;
export const loadMobileManualContext = defaultRepository.loadMobileManualContext;
export const deleteMobileCareManual = defaultRepository.deleteMobileCareManual;

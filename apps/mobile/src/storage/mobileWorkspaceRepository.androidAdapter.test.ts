import { beforeEach, describe, expect, test, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  databaseDirectory: "/data/user/0/com.example.lifesteward/files/SQLite",
  deleteDatabaseAsync: vi.fn(),
  getInfoAsync: vi.fn()
}));

vi.mock("expo-sqlite", () => ({
  get defaultDatabaseDirectory() { return adapter.databaseDirectory; },
  deleteDatabaseAsync: adapter.deleteDatabaseAsync
}));
vi.mock("expo-sqlite/kv-store", () => ({
  default: { getItem: async () => null, removeItem: async () => undefined }
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined
}));
vi.mock("expo-file-system/legacy", () => ({ getInfoAsync: adapter.getInfoAsync }));
vi.mock("expo-crypto", () => ({}));

import { deleteAllKnownMobileData } from "./mobileWorkspaceRepository";

describe("mobile workspace database file adapter", () => {
  beforeEach(() => {
    adapter.databaseDirectory = "/data/user/0/com.example.lifesteward/files/SQLite";
    adapter.deleteDatabaseAsync.mockReset().mockRejectedValue(new Error("DatabaseNotFoundException"));
    adapter.getInfoAsync.mockReset().mockImplementation(async (uri: string) => {
      if (!uri.startsWith("file:///")) throw new Error(`legacy filesystem received non-file URI: ${uri}`);
      return { exists: false };
    });
  });

  test("normalizes Android's raw SQLite directory to file URIs before postcondition checks", async () => {
    await expect(deleteAllKnownMobileData()).resolves.toBeUndefined();

    expect(adapter.getInfoAsync.mock.calls.map(([uri]) => uri)).toEqual([
      "file:///data/user/0/com.example.lifesteward/files/SQLite/life-steward-workspace-encrypted.db",
      "file:///data/user/0/com.example.lifesteward/files/SQLite/careguardian-caremanual-encrypted.db"
    ]);
  });

  test("uses an existing file URI without adding a second file prefix", async () => {
    adapter.databaseDirectory = "file:///data/user/0/com.example.lifesteward/files/SQLite";

    await expect(deleteAllKnownMobileData()).resolves.toBeUndefined();

    expect(adapter.getInfoAsync.mock.calls.map(([uri]) => uri)).toEqual([
      "file:///data/user/0/com.example.lifesteward/files/SQLite/life-steward-workspace-encrypted.db",
      "file:///data/user/0/com.example.lifesteward/files/SQLite/careguardian-caremanual-encrypted.db"
    ]);
  });

  test("rejects an unsupported database directory before delegating to FileSystem", async () => {
    adapter.databaseDirectory = "content://untrusted/database-directory";

    await expect(deleteAllKnownMobileData()).rejects.toBeInstanceOf(AggregateError);

    expect(adapter.getInfoAsync).not.toHaveBeenCalled();
  });
});

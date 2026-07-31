import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");
const verifier = path.join(
  mobileRoot,
  "scripts",
  "verify-native-android-contracts.mjs"
);

describe("native Android entry verifier", () => {
  test("resolves the real Expo Android entry without treating the resolver file as the project root", () => {
    const result = spawnSync(process.execPath, [verifier, "entry"], {
      cwd: repositoryRoot,
      encoding: "utf8"
    });

    expect(result.status, result.stderr).toBe(0);
    expect(path.resolve(result.stdout.trim())).toBe(
      path.join(mobileRoot, "index.ts")
    );
  });
});

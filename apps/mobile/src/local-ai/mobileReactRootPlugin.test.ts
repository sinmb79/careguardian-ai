import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

function loadPlugin():
  | {
      applyMobileReactRootGradle(contents: string): string;
      MOBILE_REACT_ROOT_MARKER: string;
    }
  | null {
  try {
    return require("../../plugins/with-mobile-react-root.js");
  } catch {
    return null;
  }
}

const generatedGradleFixture = `apply plugin: "com.android.application"

def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

react {
    entryFile = file(["node", "-e", "require('expo/scripts/resolveAppEntry')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())
    bundleCommand = "export:embed"
}
`;

describe("mobile React Native Android root config plugin", () => {
  test("pins Gradle bundling to the mobile root, absolute entry, and EAS-compatible Metro environment", () => {
    const plugin = loadPlugin();
    expect(plugin?.applyMobileReactRootGradle).toBeTypeOf("function");
    if (!plugin) return;

    const result = plugin.applyMobileReactRootGradle(generatedGradleFixture);

    expect(result).toContain(plugin.MOBILE_REACT_ROOT_MARKER);
    expect(result).toContain("root = file(projectRoot)");
    expect(result).toContain(
      'entryFile = file(new File(projectRoot, "index.ts"))'
    );
    expect(result).toContain(
      'bundleConfig = file(new File(projectRoot, "metro.config.js"))'
    );
    expect(result).toContain(
      "process.env.EXPO_NO_METRO_WORKSPACE_ROOT='1';require(process.argv[1])"
    );
    expect(result).not.toContain("require('expo/scripts/resolveAppEntry')");
  });

  test("fails closed on an unknown Expo template", () => {
    const plugin = loadPlugin();
    expect(plugin?.applyMobileReactRootGradle).toBeTypeOf("function");
    if (!plugin) return;

    expect(() => plugin.applyMobileReactRootGradle("android {}\n")).toThrow(
      "Expo Android entryFile template"
    );
  });

  test("is idempotent after applying the complete release-root contract", () => {
    const plugin = loadPlugin();
    expect(plugin?.applyMobileReactRootGradle).toBeTypeOf("function");
    if (!plugin) return;

    const once = plugin.applyMobileReactRootGradle(generatedGradleFixture);
    expect(plugin.applyMobileReactRootGradle(once)).toBe(once);
  });

  test("rejects a marker that no longer protects every release-root setting", () => {
    const plugin = loadPlugin();
    expect(plugin?.applyMobileReactRootGradle).toBeTypeOf("function");
    if (!plugin) return;

    expect(() =>
      plugin.applyMobileReactRootGradle(
        `// ${plugin.MOBILE_REACT_ROOT_MARKER}\nreact {}\n`
      )
    ).toThrow("release-root marker is incomplete");
  });
});

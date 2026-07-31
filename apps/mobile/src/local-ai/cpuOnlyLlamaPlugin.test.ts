import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  applyCpuOnlyLlamaGradle,
  CPU_ONLY_LLAMA_MARKER
} = require("../../plugins/with-cpu-only-llama.js") as {
  applyCpuOnlyLlamaGradle(contents: string): string;
  CPU_ONLY_LLAMA_MARKER: string;
};

describe("CPU-only llama Android config plugin", () => {
  test("excludes every OpenCL, Hexagon, HTP, and cdsprpc artifact and disables asset sync", () => {
    const source = "apply plugin: \"com.android.application\"\n";
    const result = applyCpuOnlyLlamaGradle(source);

    expect(result).toContain(CPU_ONLY_LLAMA_MARKER);
    for (const forbidden of [
      "*hexagon*.so",
      "*_opencl*.so",
      "libOpenCL.so",
      "libcdsprpc.so",
      "libggml-htp-*.so",
      "*htp*.so",
      "ggml-hexagon/**",
      "syncRNLlamaHtpAssets"
    ]) {
      expect(result).toContain(forbidden);
    }
  });

  test("is idempotent so repeated prebuilds cannot weaken the exclusion", () => {
    const once = applyCpuOnlyLlamaGradle("android {}\n");
    expect(applyCpuOnlyLlamaGradle(once)).toBe(once);
  });
});

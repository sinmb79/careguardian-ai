import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const gradlePath = resolve(
  process.cwd(),
  valueAfter("--gradle") ?? "android/app/build.gradle"
);
const gradle = await readFile(gradlePath, "utf8");
const requiredGradleEvidence = [
  "life-steward-cpu-only-llama",
  "**/*hexagon*.so",
  "**/*_opencl*.so",
  "**/libOpenCL.so",
  "**/libcdsprpc.so",
  "**/libggml-htp-*.so",
  "**/*htp*.so",
  'assets.exclude("ggml-hexagon/**")',
  "syncRNLlamaHtpAssets"
];
const missing = requiredGradleEvidence.filter((value) => !gradle.includes(value));
if (missing.length > 0) {
  throw new Error(`CPU-only Gradle evidence is missing: ${missing.join(", ")}`);
}

const archiveListPath = valueAfter("--archive-list");
if (archiveListPath) {
  const archiveList = await readFile(resolve(process.cwd(), archiveListPath), "utf8");
  const forbidden = archiveList
    .split(/\r?\n/u)
    .filter((line) =>
      /(?:hexagon|opencl|libcdsprpc|libggml-htp)/iu.test(line)
    );
  if (forbidden.length > 0) {
    throw new Error(
      `Accelerated llama artifacts remain in release archive:\n${forbidden.join("\n")}`
    );
  }
}

console.log(
  archiveListPath
    ? "CPU-only llama Gradle and archive gates passed."
    : "CPU-only llama Gradle gate passed; archive list gate remains required."
);

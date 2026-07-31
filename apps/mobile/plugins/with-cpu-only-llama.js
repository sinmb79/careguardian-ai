const { withAppBuildGradle } = require("@expo/config-plugins");

const CPU_ONLY_LLAMA_MARKER = "life-steward-cpu-only-llama";
const CPU_ONLY_LLAMA_GRADLE = `

// ${CPU_ONLY_LLAMA_MARKER}
android {
  packagingOptions {
    jniLibs {
      excludes += [
        "**/*hexagon*.so",
        "**/*_opencl*.so",
        "**/libOpenCL.so",
        "**/libcdsprpc.so",
        "**/libggml-htp-*.so",
        "**/*htp*.so",
        "**/*Htp*.so",
        "**/*HTP*.so"
      ]
    }
  }
  sourceSets {
    main {
      assets.exclude("ggml-hexagon/**")
    }
  }
}

tasks.configureEach { task ->
  if (task.name == "syncRNLlamaHtpAssets") {
    task.enabled = false
  }
}
// end-${CPU_ONLY_LLAMA_MARKER}
`;

function applyCpuOnlyLlamaGradle(contents) {
  if (contents.includes(CPU_ONLY_LLAMA_MARKER)) return contents;
  return `${contents.trimEnd()}${CPU_ONLY_LLAMA_GRADLE}`;
}

function withCpuOnlyLlama(config) {
  return withAppBuildGradle(config, (androidConfig) => {
    if (androidConfig.modResults.language !== "groovy") {
      throw new Error("CPU-only llama plugin requires Groovy app/build.gradle");
    }
    androidConfig.modResults.contents = applyCpuOnlyLlamaGradle(
      androidConfig.modResults.contents
    );
    return androidConfig;
  });
}

module.exports = withCpuOnlyLlama;
module.exports.applyCpuOnlyLlamaGradle = applyCpuOnlyLlamaGradle;
module.exports.CPU_ONLY_LLAMA_MARKER = CPU_ONLY_LLAMA_MARKER;

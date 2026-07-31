const { withAppBuildGradle } = require("@expo/config-plugins");

const MOBILE_REACT_ROOT_MARKER = "life-steward-mobile-react-root";
const REQUIRED_RELEASE_ROOT_LINES = [
  "root = file(projectRoot)",
  'entryFile = file(new File(projectRoot, "index.ts"))',
  'bundleConfig = file(new File(projectRoot, "metro.config.js"))',
  "process.env.EXPO_NO_METRO_WORKSPACE_ROOT='1';require(process.argv[1])"
];
const DEFAULT_EXPO_ENTRY_PATTERN =
  /^([ \t]*)entryFile\s*=.*expo\/scripts\/resolveAppEntry.*$/m;

function assertCompleteReleaseRoot(contents) {
  if (
    REQUIRED_RELEASE_ROOT_LINES.some((requiredLine) =>
      !contents.includes(requiredLine)
    )
  ) {
    throw new Error(
      "Mobile React release-root marker is incomplete; refusing to generate Android"
    );
  }
}

function applyMobileReactRootGradle(contents) {
  if (contents.includes(MOBILE_REACT_ROOT_MARKER)) {
    assertCompleteReleaseRoot(contents);
    return contents;
  }

  const match = contents.match(DEFAULT_EXPO_ENTRY_PATTERN);
  if (!match) {
    throw new Error(
      "Expo Android entryFile template was not found; refusing an unpinned release root"
    );
  }

  const indentation = match[1];
  const replacement = [
    `${indentation}// ${MOBILE_REACT_ROOT_MARKER}`,
    `${indentation}root = file(projectRoot)`,
    `${indentation}entryFile = file(new File(projectRoot, "index.ts"))`,
    `${indentation}bundleConfig = file(new File(projectRoot, "metro.config.js"))`,
    `${indentation}nodeExecutableAndArgs = ["node", "-e", "process.env.EXPO_NO_METRO_WORKSPACE_ROOT='1';require(process.argv[1])"]`
  ].join("\n");
  const result = contents.replace(DEFAULT_EXPO_ENTRY_PATTERN, replacement);
  assertCompleteReleaseRoot(result);
  return result;
}

function withMobileReactRoot(config) {
  return withAppBuildGradle(config, (androidConfig) => {
    if (androidConfig.modResults.language !== "groovy") {
      throw new Error(
        "Mobile React release-root plugin requires Groovy app/build.gradle"
      );
    }
    androidConfig.modResults.contents = applyMobileReactRootGradle(
      androidConfig.modResults.contents
    );
    return androidConfig;
  });
}

module.exports = withMobileReactRoot;
module.exports.applyMobileReactRootGradle = applyMobileReactRootGradle;
module.exports.MOBILE_REACT_ROOT_MARKER = MOBILE_REACT_ROOT_MARKER;

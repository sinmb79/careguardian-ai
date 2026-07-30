import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error(
    "npm_execpath is unavailable; run this Android release gate through npm"
  );
}

function runNpmScript(script, environment, argumentsAfterSeparator = []) {
  const result = spawnSync(
    process.execPath,
    [
      npmCli,
      "run",
      script,
      ...(argumentsAfterSeparator.length
        ? ["--", ...argumentsAfterSeparator]
        : [])
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit"
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const requestedContract = process.argv[2] ?? "all";
if (!["all", "manifest"].includes(requestedContract)) {
  throw new Error(
    `Unsupported Android release verification contract "${requestedContract}". ` +
    `Use all or manifest.`
  );
}

const verificationEnvironment = { ...process.env };
delete verificationEnvironment.NODE_ENV;
if (requestedContract === "all") {
  runNpmScript("verify", verificationEnvironment);
}

runNpmScript(
  "mobile:verify:native-contracts",
  {
    ...process.env,
    NODE_ENV: "production"
  },
  requestedContract === "all" ? [] : [requestedContract]
);

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const productionProjectId = "tren-85720";
const outputDirectory = resolve("dist");
const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const argumentsByName = new Map(
  process.argv.slice(2)
    .filter((argument) => argument.startsWith("--") && argument.includes("="))
    .map((argument) => {
      const [name, value] = argument.slice(2).split(/=(.*)/s);
      return [name, value];
    })
);
const environment = String(argumentsByName.get("environment") || "").trim().toLowerCase();

if (!["staging", "production"].includes(environment)) {
  throw new Error("Use --environment=staging or --environment=production.");
}

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
// Resolve the same mode-specific files as Vite does. This keeps the artifact
// marker aligned with a documented `.env.staging.local` configuration while
// preserving higher-priority values explicitly supplied by CI/the shell.
const resolvedFirebaseEnvironment = loadEnv(environment, process.cwd(), "VITE_FIREBASE_");
const childEnvironment = {
  ...process.env,
  ...resolvedFirebaseEnvironment,
  VITE_FIREBASE_ENVIRONMENT: environment
};

if (environment === "staging" && String(childEnvironment.VITE_FIREBASE_PROJECT_ID || "").trim() === productionProjectId) {
  throw new Error("A staging artifact cannot use the production Firebase project.");
}

await new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, [vitePath, "build", "--mode", environment], {
    stdio: "inherit",
    env: childEnvironment
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) {
      resolvePromise();
      return;
    }
    reject(new Error("Vite build failed with " + (signal ? "signal " + signal : "code " + code) + "."));
  });
});

const firebaseProjectId = environment === "production"
  ? productionProjectId
  : String(childEnvironment.VITE_FIREBASE_PROJECT_ID || "").trim();

if (!firebaseProjectId) {
  throw new Error("A staging artifact requires VITE_FIREBASE_PROJECT_ID.");
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, ".workout-release.json"),
  JSON.stringify({
    schemaVersion: 1,
    environment,
    firebaseProjectId,
    version: packageJson.version
  }, null, 2) + "\n",
  "utf8"
);

console.log("Prepared " + environment + " Firebase artifact for " + firebaseProjectId + ".");

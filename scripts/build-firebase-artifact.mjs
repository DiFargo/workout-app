import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { assertClientAppearanceArtifact } from "./assert-client-appearance-artifact.mjs";

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

// Keep the search-only payload consistent with the archive and quarantine.
// This never edits old food tuples or any user data.
for (const script of ["build-basic-nutrition-foods.mjs", "build-personal-search-catalog.mjs"]) {
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), "--apply"], {stdio: "inherit"});
    child.once("error", reject);
    child.once("exit", code => code === 0 ? done() : reject(new Error(`${script}: ${code}`)));
  });
}

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

await assertClientAppearanceArtifact(outputDirectory);

if (!firebaseProjectId) {
  throw new Error("A staging artifact requires VITE_FIREBASE_PROJECT_ID.");
}

await mkdir(outputDirectory, { recursive: true });
// These source fixtures remain available in DEV, but production playback goes
// through the authenticated short-lived Storage URL endpoint, never Hosting.
const publicVideos = resolve(outputDirectory, "videos");
for (const entry of await readdir(publicVideos, { withFileTypes: true }).catch(() => [])) {
  if (entry.isFile() && /\.(mp4|mov|m4v|webm)$/i.test(entry.name)) {
    await rm(resolve(publicVideos, entry.name));
  }
}
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

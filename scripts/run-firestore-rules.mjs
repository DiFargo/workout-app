import { spawn } from "node:child_process";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

const workspacePath = process.cwd();
const cachePath = path.join(workspacePath, ".npm-cache");
const configPath = path.join(workspacePath, ".config");
const firebaseArgs = [
  "--yes",
  "--cache",
  cachePath,
  "firebase-tools@15.20.0",
  "--project",
  "demo-workout-rules",
  "emulators:exec",
  "--only",
  "firestore,storage",
  "node --test tests/firestore-rules.rules.mjs tests/exercise-cards.rules.mjs tests/admin-storage-access.rules.mjs tests/basic-workout-access.rules.mjs"
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
    });
  });
}

const isWindows = process.platform === "win32";
let cachedCli;
for (const directory of await readdir(path.join(cachePath, "_npx")).catch(() => [])) {
  const packageRoot = path.join(cachePath, "_npx", directory, "node_modules", "firebase-tools");
  const packageJson = await readFile(path.join(packageRoot, "package.json"), "utf8").then(JSON.parse).catch(() => null);
  if (packageJson?.version === "15.20.0") { cachedCli = path.join(packageRoot, "lib", "bin", "firebase.js"); break; }
}
// Use the exact already-installed CLI, without an npm registry round-trip.
// Clean CI still uses the pinned npx command below.
const command = cachedCli ? process.execPath : isWindows ? (process.env.ComSpec || "cmd.exe") : "npx";
const args = cachedCli ? [cachedCli, "--project", "demo-workout-rules", "emulators:exec", "--only", "firestore,storage",
  "node --test tests/firestore-rules.rules.mjs tests/exercise-cards.rules.mjs tests/admin-storage-access.rules.mjs tests/basic-workout-access.rules.mjs"] : isWindows
  ? ["/d", "/c", path.join(workspacePath, "scripts", "run-firestore-rules.cmd")]
  : firebaseArgs;

try {
  await run(command, args, {
    env: {
      ...process.env,
      XDG_CONFIG_HOME: configPath
    }
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

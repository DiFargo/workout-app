import { spawn } from "node:child_process";
import path from "node:path";

const workspacePath = process.cwd();
const cachePath = path.join(workspacePath, ".npm-cache");
const configPath = path.join(workspacePath, ".config");
const firebaseArgs = [
  "--yes",
  "--cache",
  cachePath,
  "firebase-tools@15.20.0",
  "emulators:exec",
  "--only",
  "firestore",
  "node tests/firestore-rules.rules.mjs"
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
const command = isWindows ? (process.env.ComSpec || "cmd.exe") : "npx";
const args = isWindows
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

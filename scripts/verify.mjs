import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const includeE2e = process.argv.includes("--e2e");

function quoteWindowsCommandArgument(value) {
  const raw = String(value);
  if (!/[\s"&|<>^()]/.test(raw)) return raw;
  return `"${raw.replace(/(\\*)"/g, "$1$1\\\"").replace(/(\\*)$/g, "$1$1")}"`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    // Windows cannot execute npm.cmd directly through child_process.spawn.
    // Run fixed gate commands through cmd.exe there without enabling a shell
    // for all platforms or concatenating unquoted arguments.
    const isWindowsBatchCommand = process.platform === "win32" && /\.cmd$/i.test(command);
    const childCommand = isWindowsBatchCommand ? (process.env.ComSpec || "cmd.exe") : command;
    const childArgs = isWindowsBatchCommand
      ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsCommandArgument).join(" ")]
      : args;
    const child = spawn(childCommand, childArgs, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
    });
  });
}

const isolatedFirebaseEnvironment = {
  VITE_FIREBASE_ENVIRONMENT: "staging",
  VITE_FIREBASE_API_KEY: "AIzaSyA12345678901234567890123456789012",
  VITE_FIREBASE_AUTH_DOMAIN: "workout-app-staging.invalid",
  VITE_FIREBASE_PROJECT_ID: "workout-app-staging",
  VITE_FIREBASE_STORAGE_BUCKET: "workout-app-staging.invalid",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:staging"
};

const checks = [
  ["Full ESLint", npmCommand, ["run", "lint"]],
  ["Unit tests", npmCommand, ["test"]],
  ["Firestore Rules tests", npmCommand, ["run", "test:rules"]],
  ["Functions syntax", npmCommand, ["run", "check:functions"]],
  ["Isolated staging build", npmCommand, ["run", "build:staging"], {
    env: { ...process.env, ...isolatedFirebaseEnvironment }
  }],
  ["Production build", npmCommand, ["run", "build:production"]],
  ["Bundle budget", npmCommand, ["run", "check:bundle"]],
  ["Root production dependency audit", npmCommand, ["run", "audit:production"]],
  ["Functions production dependency audit", npmCommand, ["run", "audit:functions"]],
  ["Whitespace errors", "git", ["diff", "--check"]]
];

if (includeE2e) {
  checks.push(["Playwright E2E", npmCommand, ["run", "test:e2e"]]);
}

try {
  for (const [label, command, args, options] of checks) {
    console.log(`\n=== ${label} ===`);
    await run(command, args, options);
  }

  console.log("\nAll release verification checks passed.");
} catch (error) {
  console.error(`\nRelease verification stopped: ${error.message}`);
  process.exitCode = 1;
}

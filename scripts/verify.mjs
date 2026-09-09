import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const option = (name) => process.argv.findLast((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const profile = option("profile") || "release";
const focusedTests = (option("tests") || "").split(",").filter(Boolean);
const browserTests = (option("browser") || "").split(",").filter(Boolean);
const profiles = ["docs", "ui", "domain", "persistence", "auth", "release", "full"];
if (!profiles.includes(profile)) throw new Error(`Unknown verification profile: ${profile}`);
if (["domain", "persistence", "auth"].includes(profile) && !focusedTests.length) throw new Error("Specify --tests=tests/relevant.test.mjs for this risk profile.");
if (process.argv.includes("--e2e") && profile !== "full" && !browserTests.length) throw new Error("Specify --browser=affected.spec.js or choose --profile=full.");

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

const checks = [];
if (profile === "full") checks.push(["ESLint", npmCommand, ["run", "lint"]]);
if (focusedTests.length) checks.push(["Focused behavior", process.execPath, ["--test", ...focusedTests]]);
else if (profile === "full") checks.push(["Unit tests", npmCommand, ["test"]]);
if (["persistence", "auth", "full"].includes(profile)) checks.push(["Relevant access boundaries", npmCommand, ["run", "test:rules"]]);
if (["auth", "full"].includes(profile)) checks.push(["Functions syntax", npmCommand, ["run", "check:functions"]]);
if (profile === "full") checks.push(["Isolated staging build", npmCommand, ["run", "build:staging"], { env: { ...process.env, ...isolatedFirebaseEnvironment } }]);
if (profile !== "docs") checks.push(["Production build", npmCommand, ["run", "build:production"]]);
if (["release", "full"].includes(profile)) checks.push(["Bundle budget", npmCommand, ["run", "check:bundle"]]);
if (profile === "full" || process.argv.includes("--dependencies")) {
  checks.push(["Root production dependencies", npmCommand, ["run", "audit:production"]], ["Functions production dependencies", npmCommand, ["run", "audit:functions"]]);
}
checks.push(["Whitespace errors", "git", ["diff", "--check"]]);
if (browserTests.length || (profile === "full" && process.argv.includes("--e2e"))) checks.push(["Browser behavior", npmCommand, ["run", "test:e2e", "--", ...browserTests]]);
console.log(`Verification profile: ${profile}. Release smoke and device acceptance are recorded separately.`);

try {
  for (const [label, command, args, options] of checks) {
    console.log(`\n=== ${label} ===`);
    await run(command, args, options);
  }

  console.log("\nSelected verification checks passed.");
} catch (error) {
  console.error(`\nRelease verification stopped: ${error.message}`);
  process.exitCode = 1;
}

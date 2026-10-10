import { spawn } from "node:child_process";
import { getFirebaseFunctionsSources } from "./firebase-functions-sources.mjs";

try {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this check with npm run audit:functions.");
  for (const source of await getFirebaseFunctionsSources()) {
    console.log(`Auditing Firebase Functions: ${source}`);
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [npmCli, "audit", "--prefix", source, "--cache", "./.npm-cache", "--omit=dev"], { stdio: "inherit" });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`Dependency audit failed for ${source} (${signal || code}).`));
      });
    });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

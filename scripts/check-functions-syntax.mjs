import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const FUNCTIONS_DIRECTORY = path.resolve("functions");

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
}

function checkSyntax(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Syntax check failed for ${path.relative(process.cwd(), file)} (${signal || code}).`));
    });
  });
}

try {
  const files = (await collectJavaScriptFiles(FUNCTIONS_DIRECTORY)).sort();
  if (!files.length) throw new Error("No Firebase Functions JavaScript files found.");

  for (const file of files) {
    console.log(`Checking ${path.relative(process.cwd(), file)}`);
    await checkSyntax(file);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

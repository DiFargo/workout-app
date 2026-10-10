import { readFile } from "node:fs/promises";

export async function getFirebaseFunctionsSources() {
  const config = JSON.parse(await readFile("firebase.json", "utf8"));
  const entries = Array.isArray(config.functions) ? config.functions : [config.functions];
  if (!entries.length || entries.some(entry => !entry || typeof entry.source !== "string" || !entry.source.trim())) {
    throw new Error("Every Firebase Functions codebase must declare a source directory.");
  }
  return [...new Set(entries.map(entry => entry.source.trim()))];
}

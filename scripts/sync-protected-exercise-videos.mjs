import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";

// Use the same signed-in Firebase CLI account as the release command. Tokens
// stay inside the CLI client and must never be written to output or artifacts.
const require = createRequire(import.meta.url);
const cliRoot = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
const { Client } = require(resolve(cliRoot, "apiv2.js"));
const account = getGlobalDefaultAccount();
if (!account) throw new Error("Sign in with the Firebase CLI before syncing protected videos.");
const project = process.argv.find(value => value.startsWith("--project="))?.slice(10) || "tren-85720";
if (!["tren-85720", "tren-85720-staging"].includes(project)) throw new Error("Only the configured release projects are allowed.");
await requireAuth({ ...account, project }, true);

const storage = new Client({ urlPrefix: "https://storage.googleapis.com" });
const bucket = `${project}.firebasestorage.app`;
const apply = process.argv.includes("--apply");
const sourceDirectory = resolve("public/videos");
const files = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && /\.(mp4|mov|m4v|webm)$/i.test(entry.name))
  .map(entry => entry.name);
let uploaded = 0;
for (const name of files) {
  const source = resolve(sourceDirectory, name);
  const objectName = `protected-workout-videos/public/${name}`;
  const objectPath = `/storage/v1/b/${bucket}/o/${encodeURIComponent(objectName)}`;
  const md5Hash = createHash("md5").update(await readFile(source)).digest("base64");
  const current = await storage.get(objectPath, { resolveOnHTTPError: true });
  if (current.status !== 200 && current.status !== 404) {
    throw new Error(`Cannot inspect protected object ${name}: HTTP ${current.status}.`);
  }
  if (current.status === 200 && current.body.md5Hash !== md5Hash) {
    throw new Error(`Existing protected object differs from local video: ${name}. No overwrite performed.`);
  }
  if (!apply) {
    console.log(`${current.status === 200 ? "verified" : "would upload"}: ${name}`);
    continue;
  }
  const contentType = /\.mov$/i.test(name) ? "video/quicktime" : /\.webm$/i.test(name) ? "video/webm" : "video/mp4";
  if (current.status === 404) {
    await storage.post(`/upload/storage/v1/b/${bucket}/o`, createReadStream(source), {
      queryParams: { uploadType: "media", name: objectName, ifGenerationMatch: 0 },
      headers: { "Content-Type": contentType },
      retries: 0
    });
    uploaded += 1;
  }
  await storage.patch(objectPath, {
    cacheControl: "private, no-store, max-age=0",
    contentType,
    contentDisposition: "inline",
    metadata: { firebaseStorageDownloadTokens: null }
  });
  const verified = await storage.get(objectPath);
  if (verified.body.md5Hash !== md5Hash || verified.body.metadata?.firebaseStorageDownloadTokens) {
    throw new Error(`Protected video verification failed: ${name}.`);
  }
  console.log(`protected: ${name}`);
}
console.log(`${apply ? "Synced" : "Inspected"} ${files.length} protected videos; ${uploaded} newly uploaded.`);

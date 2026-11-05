import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { accountToken, readCatalog } from "./exercise-preview-batch.mjs";
import { resolveProtectedExerciseVideoSource } from "../functions/protectedExerciseVideo.js";
import { planExercisePreviewCopies, copyExercisePreviewAssets } from "./lib/exercise-preview-copy.mjs";

const project = "tren-85720", bucket = `${project}.firebasestorage.app`;
assert.ok(process.argv.includes(`--project=${project}`), "Explicit project required");
const token = await accountToken();
const require = createRequire(import.meta.url);
const cli = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { Client } = require(resolve(cli, "apiv2.js"));
const storage = new Client({ urlPrefix: "https://storage.googleapis.com" });
const catalog = await readCatalog(token);
const cards = catalog.trainerExerciseCards;
const jobs = [];
for (const card of cards) {
  const provenance = card.copiedFrom;
  if (provenance?.operation !== "trainer-library-copy-v1" || provenance.collection !== "trainerExerciseCards") continue;
  const original = cards.find(candidate => candidate.id === provenance.documentId && candidate.ownerUid === provenance.ownerUid);
  if (!original || card.ownerUid === original.ownerUid || card.videoPosterTime !== original.videoPosterTime) continue;
  const originalVideo = original.video || original.videoUrl || original.videoURL;
  const copiedVideo = card.video || card.videoUrl || card.videoURL;
  if (!originalVideo || !copiedVideo) continue;
  const from = resolveProtectedExerciseVideoSource(originalVideo, bucket);
  const to = resolveProtectedExerciseVideoSource(copiedVideo, bucket);
  if (!from.objectPath.includes(`/${original.ownerUid}/`) ||
    to.objectPath !== from.objectPath.replace(`/${original.ownerUid}/`, `/${card.ownerUid}/`)) continue;
  jobs.push(...planExercisePreviewCopies([original], new Map([[from.objectPath, to.objectPath]]), bucket));
}
const unique = [...new Map(jobs.map(job => [job.destinationPreview, job])).values()];
assert.ok(unique.length > 0 && unique.length <= 200, "Bounded copied-library repair required");
const result = await copyExercisePreviewAssets(unique, { storage, bucket, apply: process.argv.includes("--apply") });
console.log(JSON.stringify({ project, apply: process.argv.includes("--apply"), ...result,
  firestoreWrites: 0, videoWrites: 0, existingPreviewsOverwritten: 0, publicAccessAdded: false }));

// Explicit, bounded library-only operation. Never reads users or workout history.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { installRuntimeImports } from "../tests/helpers/runtime-imports.mjs";
import { resolveProtectedExerciseVideoSource } from "../functions/protectedExerciseVideo.js";
import { exerciseCardLegacyKey } from "../functions/exerciseCards.js";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../src/data/basicWorkoutExerciseLibrary.js";

const project = "tren-85720";
const database = `projects/${project}/databases/(default)`;
const origin = `https://firestore.googleapis.com/v1/${database}/documents`;
const output = resolve("output/playwright/exercise-preview-selection-2026-10-25");
const hash = value => createHash("sha256").update(value).digest("hex");
const cleanup = installRuntimeImports({ "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout() { throw new Error("No application API calls in inventory"); } } });
const { buildTrainerExerciseLibraryItems } = await import("../src/utils/trainerExerciseLibrary.js");
cleanup();

export async function accountToken() {
  const require = createRequire(import.meta.url);
  const cli = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
  assert.ok(account, "Firebase CLI account required");
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
  return require(resolve(cli, "apiv2.js")).getAccessToken();
}

export function decode(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, value]) => [key, decode(value)]));
  return null;
}

export async function readCatalog(token) {
  const collections = {};
  for (const collection of ["trainerExerciseCards", "trainingTemplates", "basicExerciseOverrides"]) {
    const documents = [];
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      const url = new URL(`${origin}/${collection}`);
      url.searchParams.set("pageSize", "300");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000) });
      assert.equal(response.status, 200, `Library read failed: ${collection} HTTP ${response.status}`);
      const payload = await response.json();
      documents.push(...(payload.documents || []).map(doc => ({ id: doc.name.split("/").at(-1),
        ...Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decode(value)])),
        _document: doc.name, _updateTime: doc.updateTime })));
      pageToken = payload.nextPageToken || "";
      if (!pageToken) break;
    }
    assert.equal(pageToken, "", "Bounded library inventory was truncated");
    collections[collection] = documents;
  }
  return collections;
}

export function inventory(catalog) {
  const entries = [];
  const library = buildTrainerExerciseLibraryItems({}, catalog.trainingTemplates, { cards: catalog.trainerExerciseCards });
  for (const item of library) {
    const source = item.librarySource;
    const raw = source.type === "card" ? catalog.trainerExerciseCards.find(card => card.id === item.exerciseCardId) : catalog.trainingTemplates.find(template => template.id === source.templateId);
    entries.push({ type: source.type === "card" ? "card" : "legacy", id: source.type === "card" ? item.exerciseCardId : item.id,
      templateId: source.templateId || null, ownerUid: source.ownerUid,
      legacyHash: hash(exerciseCardLegacyKey(item)), name: item.name, video: item.video || "",
      crop: item.videoCrop || null, posterTime: item.videoPosterTime ?? null,
      hasCustomPoster: Boolean(item.videoPoster || item.videoThumbnail), revision: item.revision ?? null,
      updateTime: raw?._updateTime || null });
  }
  for (const override of catalog.basicExerciseOverrides) {
    if (override.deleted || override.deletedAt || override.videoDisabled) continue;
    const base = BASIC_WORKOUT_EXERCISE_LIBRARY.find(item => item.id === override.id);
    entries.push({ type: "basic", id: override.id, name: override.name || base?.name || override.id,
      video: override.videoUrl || "", crop: override.videoCrop || null, posterTime: override.videoPosterTime ?? null,
      hasCustomPoster: Boolean(override.videoPoster || override.videoThumbnail), updateTime: override._updateTime });
  }
  const videos = [];
  for (const entry of entries) {
    const source = entry.video;
    delete entry.video;
    if (!source) { entry.status = "no_video"; continue; }
    try {
      const media = resolveProtectedExerciseVideoSource(source);
      entry.videoRef = `gs://${media.bucket}/${media.objectPath}`;
      entry.videoKey = hash(entry.videoRef).slice(0, 16);
      entry.status = Number.isFinite(entry.posterTime) || entry.hasCustomPoster ? "preserve_existing" : "needs_selection";
      if (!videos.some(video => video.key === entry.videoKey)) videos.push({ key: entry.videoKey, ...media, names: [] });
      const video = videos.find(video => video.key === entry.videoKey);
      if (!video.names.includes(entry.name)) video.names.push(entry.name);
    } catch { entry.status = "unsupported_source"; }
  }
  videos.forEach((video, index) => { video.label = `V${String(index + 1).padStart(3, "0")}`; });
  entries.forEach(entry => { entry.videoLabel = videos.find(video => video.key === entry.videoKey)?.label || null; });
  return { project, database, capturedAt: new Date().toISOString(), collections: Object.fromEntries(Object.entries(catalog).map(([key, docs]) => [key, docs.length])),
    entries, videos, counts: entries.reduce((counts, entry) => ({ ...counts, [entry.status]: (counts[entry.status] || 0) + 1 }), {}) };
}

if (process.argv.includes("--inventory")) {
  const result = inventory(await readCatalog(await accountToken()));
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "inventory.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ collections: result.collections, counts: result.counts, uniqueVideos: result.videos.length,
    entries: result.entries.map(({ type, name, status, videoLabel, posterTime }) => ({ type, name, status, videoLabel, posterTime })) }));
}

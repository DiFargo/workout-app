import { test, after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const stored = new Map();
globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) };
const photos = new Map();
let rejectSave = true;
const responses = [];
const cleanup = installRuntimeImports({
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": { doc: (_, ...parts) => parts.join("/"), setDoc: async (ref, data) => { if (rejectSave) throw new Error("unavailable"); photos.set(ref, data); } },
  "/utils/apiClient.js": { fetchAuthorizedWithTimeout: () => new Promise((resolve) => responses.push(resolve)) }
});
after(cleanup);
const { persistProgressPhotos } = await import("../src/features/client/profile/progressPhotoPersistence.js");
const { createNutritionPhotoAiHandlers } = await import("../src/features/client/nutrition/nutritionPhotoAiHandlers.js");

test("photo retry reuses completed uploads and one stable record after a partial upload and database failure", async () => {
  const calls = [];
  let failSide = true;
  const files = Object.fromEntries(["front", "side", "back"].map((view) => [view, { name: view, size: 10, lastModified: 1 }]));
  const args = { db: {}, uid: "synthetic", files, createId: () => "session", compress: async (file) => file,
    upload: async (path) => { calls.push(path); if (path.includes("side") && failSide) throw new Error("upload"); return { url: `https://example.test/${path}` }; } };
  const first = persistProgressPhotos(args);
  assert.equal(persistProgressPhotos(args), first, "double click shares the operation");
  await assert.rejects(first, /upload/);
  failSide = false;
  await assert.rejects(persistProgressPhotos(args), /unavailable/);
  rejectSave = false;
  const saved = await persistProgressPhotos(args);
  assert.equal(saved.id, "session");
  assert.equal(photos.size, 1);
  assert.equal(calls.filter((path) => path.includes("front")).length, 1);
  assert.equal(calls.filter((path) => path.includes("side")).length, 2);
  assert.equal(calls.length, 4);
});

test("cancelled photo response cannot replace a newer result or stop its spinner", async () => {
  globalThis.Image = class { width = 20; height = 20; set src(_) { queueMicrotask(() => this.onload()); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,eA==" }) };
  const state = {};
  const handlers = createNutritionPhotoAiHandlers(new Proxy({
    auth: { currentUser: { uid: "synthetic" } }, captureAuthSession: undefined,
    nutrition: { myFoods: {} }, nutritionFoodDatabase: [], fatSecretFoods: [], nutritionPhotoInputRef: { current: null }, nutritionPhotoLastFileRef: { current: null }
  }, { get(target, name) { return name in target ? target[name] : (value) => { state[name] = typeof value === "function" ? value(state[name]) : value; }; } }));
  const file = new Blob(["image"], { type: "image/png" });
  const a = handlers.handleNutritionPhotoAiSearch({ target: { files: [file] } });
  while (responses.length < 1) await new Promise((resolve) => setImmediate(resolve));
  handlers.resetNutritionPhotoAiSearch();
  const b = handlers.handleNutritionPhotoAiSearch({ target: { files: [file] } });
  while (responses.length < 2) await new Promise((resolve) => setImmediate(resolve));
  responses[0]({ ok: false, json: async () => ({ message: "stale result" }) });
  await a;
  assert.equal(state.setNutritionPhotoAnalyzing, true);
  assert.notEqual(state.setNutritionPhotoAiResult, "stale result");
  responses[1]({ ok: false, json: async () => ({ message: "current result" }) });
  await b;
  assert.equal(state.setNutritionPhotoAiResult, "current result");
  assert.equal(state.setNutritionPhotoAnalyzing, false);
});

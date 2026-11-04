import assert from "node:assert/strict";
import { test, after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

const auth = { currentUser: { uid: "A" } };
let apiIo;
const cleanup = installRuntimeImports({
  "/firebase.js": { auth, db: {} },
  "/apiClient.js": { fetchAuthorizedWithTimeout: (...args) => apiIo(...args) },
  "/localNutritionCatalog.js": { findLocalNutritionFoodByBarcode: async () => null, searchLocalNutritionFoods: async () => [] }
});
after(cleanup);
const { createNutritionPhotoAiHandlers, createNutritionPhotoAiResetHandler } = await import("../src/features/client/nutrition/nutritionPhotoAiHandlers.js");
const flush = () => new Promise(resolve => setImmediate(resolve));
const setterNames = ["setNutritionPhotoAiCandidates", "setNutritionPhotoAiConfidence", "setNutritionPhotoAiResult", "setNutritionPhotoAnalyzing", "setNutritionPhotoName", "setNutritionPhotoNotFoundOpen", "setNutritionPhotoPreview"];

function context({ defer = false } = {}) {
  const state = { setNutritionPhotoPreview: "blob:old-photo", setNutritionPhotoAiResult: "old result", setNutritionPhotoAnalyzing: true };
  const queued = [];
  const settings = { auth, nutritionPhotoInputRef: { current: { value: "old selection" } }, nutritionPhotoLastFileRef: { current: {} } };
  for (const key of setterNames) settings[key] = update => {
    const apply = () => { state[key] = typeof update === "function" ? update(state[key]) : update; };
    if (defer) queued.push(apply); else apply();
  };
  return { settings, state, flush: () => queued.splice(0).forEach(apply => apply()) };
}

test("reset can execute before picker factory exists and cancels its later request through the same ref scope", async () => {
  advanceAuthSession(auth); const h = context();
  const revoked = [], originalRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = value => revoked.push(value);
  try {
    const earlyReset = createNutritionPhotoAiResetHandler(h.settings);
    earlyReset(); // No picker business callbacks/factory have been constructed.
    assert.deepEqual(revoked, ["blob:old-photo"]); assert.equal(h.state.setNutritionPhotoPreview, "");
    assert.equal(h.settings.nutritionPhotoLastFileRef.current, null); assert.equal(h.settings.nutritionPhotoInputRef.current.value, "");
    globalThis.Image = class { width = 20; height = 20; set src(value) { queueMicrotask(() => this.onload()); } };
    globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,eA==" }) };
    let complete, signal;
    apiIo = (_, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve; }); };
    const handlers = createNutritionPhotoAiHandlers(new Proxy({ ...h.settings, nutrition: { myFoods: {} }, fatSecretFoods: [], nutritionFoodDatabase: [], captureAuthSession: undefined }, {
      get: (target, key) => key in target ? target[key] : () => {}
    }));
    const operation = handlers.handleNutritionPhotoAiSearch({ target: { files: [new Blob(["photo"], { type: "image/png" })] } });
    await flush(); assert.equal(signal.aborted, false);
    earlyReset(); assert.equal(signal.aborted, true); assert.equal(h.settings.nutritionPhotoLastFileRef.current, null);
    complete({ ok: false, status: 503, json: async () => ({ message: "obsolete result" }) }); await operation;
    assert.equal(h.state.setNutritionPhotoAiResult, ""); assert.equal(h.state.setNutritionPhotoAnalyzing, false); assert.equal(h.state.setNutritionPhotoPreview, "");
  } finally { URL.revokeObjectURL = originalRevoke; }
});

test("early reset preserves a newer account when React applies its queued setters after auth transition", () => {
  auth.currentUser = { uid: "A" }; advanceAuthSession(auth);
  const h = context({ defer: true }), revoked = [], originalRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = value => revoked.push(value);
  try {
    createNutritionPhotoAiResetHandler(h.settings)();
    auth.currentUser = { uid: "B" }; advanceAuthSession(auth);
    h.state.setNutritionPhotoPreview = "blob:B-photo"; h.state.setNutritionPhotoAiResult = "B result";
    h.flush();
    assert.equal(h.state.setNutritionPhotoPreview, "blob:B-photo"); assert.equal(h.state.setNutritionPhotoAiResult, "B result"); assert.deepEqual(revoked, []);
  } finally { URL.revokeObjectURL = originalRevoke; }
});

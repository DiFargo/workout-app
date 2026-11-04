import assert from "node:assert/strict";
import test, { after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { runSessionResource } from "../src/utils/sessionResource.js";

let activeHooks;
const cleanup = installRuntimeImports({ react: Object.fromEntries(
  ["useCallback", "useEffect", "useEffectEvent", "useRef", "useState"].map(name => [name, (...args) => activeHooks[name](...args)])),
"/useNutritionRuntimeEffects.js": { useNutritionRuntimeEffects: () => {} } });
after(cleanup);
const { getClientResourceDemand, useClientDataDemand } = await import("../src/app/useClientDataDemand.js");
const { useClientDataRuntime } = await import("../src/app/useClientDataRuntime.js");
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const same = (a, b) => a?.length === b?.length && a.every((value, i) => Object.is(value, b[i]));
const measurementSnapshot = uid => ({ schemaVersion: 1, kind: "measurements", uid, sourceRevision: "a".repeat(64),
  coverage: { profile: "complete", measurements: "complete" }, sourceCounts: { measurements: 0 },
  measurements: { recent7: [], latestWeight: null, latestBody: null } });

function events() {
  const callbacks = new Map();
  return { visibilityState: "visible", addEventListener(name, callback) { if (!callbacks.has(name)) callbacks.set(name, new Set()); callbacks.get(name).add(callback); },
    removeEventListener(name, callback) { callbacks.get(name)?.delete(callback); }, dispatch(name) { callbacks.get(name)?.forEach(callback => callback()); } };
}

function fixture(loaders = {}, hook = useClientDataDemand) {
  globalThis.window = events(); globalThis.document = events();
  const auth = { currentUser: { uid: "client" } }; advanceAuthSession(auth);
  const calls = [];
  const context = Object.fromEntries(["loadHistory", "loadNutritionFromFirebase", "loadProfileMeasurements", "loadProfileMeasurementSnapshot", "loadClientProgressPhotos", "loadClientTrainerTasks"]
    .map(name => [name, (...args) => { calls.push([name, ...args]); return (loaders[name] ||
      (uid => Promise.resolve(name === "loadProfileMeasurementSnapshot" ? measurementSnapshot(uid) : [])))(...args); }]));
  const props = { auth, user: auth.currentUser, appLoading: false, currentUserRole: "client", page: "main", nutritionDateKey: "2026-10-30",
    todayNutritionKey: () => "2026-10-30", getContext: () => context, ...context };
  const slots = []; let index = 0, dirty = true, pending = [], result;
  activeHooks = {};
  const hooks = {
    useRef(initial) { const i = index++; slots[i] ||= { current: initial }; return slots[i]; },
    useState(initial) { const i = index++; slots[i] ||= { value: typeof initial === "function" ? initial() : initial,
      set: next => { const value = typeof next === "function" ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } } };
      return [slots[i].value, slots[i].set]; },
    useCallback(callback, dependencies) { const i = index++; if (!slots[i] || !same(slots[i].dependencies, dependencies)) slots[i] = { callback, dependencies }; return slots[i].callback; },
    useEffectEvent(callback) { const i = index++; if (!slots[i]) slots[i] = { invoke: (...args) => slots[i].callback(...args) }; slots[i].callback = callback; return slots[i].invoke; },
    useEffect(effect, dependencies) { const i = index++; if (slots[i] && same(slots[i].dependencies, dependencies)) return;
      pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { dependencies, cleanup: effect() }; }); }
  };
  const render = () => { activeHooks = hooks; index = 0; dirty = false; result = hook(props); const effects = pending; pending = []; effects.forEach(run => run()); return result; };
  const settle = async () => { for (let i = 0; i < 6; i++) { if (dirty) render(); await tick(); } if (dirty) render(); return result; };
  render();
  return { props, auth, calls, render, settle, get result() { if (dirty) render(); return result; },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); delete globalThis.window; delete globalThis.document; } };
}

test("demand статусы отличают initial loading, успешное пустое значение и отказ; строгие main loaders получают опцию", async () => {
  const nutrition = deferred(), measurement = deferred();
  const f = fixture({ loadNutritionFromFirebase: () => nutrition.promise, loadProfileMeasurementSnapshot: () => measurement.promise });
  const warn = console.warn; console.warn = () => {};
  try {
    assert.deepEqual(getClientResourceDemand({ page: "main" }), ["nutritionDay", "measurementOverview", "photos", "tasks"]);
    for (const resource of Object.values(f.result.resources)) assert.deepEqual(resource, { status: "loading", hasValue: false });
    await f.settle();
    assert.equal(f.calls.length, 2, "существующий foreground/background предел не изменён");
    nutrition.resolve(undefined); measurement.reject(new Error("synthetic snapshot failure"));
    await f.settle();
    assert.deepEqual(f.result.resources.nutritionDay, { status: "ready", hasValue: true });
    assert.deepEqual(f.result.resources.measurementOverview, { status: "error", hasValue: false });
    assert.deepEqual(f.result.resources.photos, { status: "ready", hasValue: true });
    assert.deepEqual(f.result.resources.tasks, { status: "ready", hasValue: true });
    for (const [, , options] of f.calls) assert.equal(options.throwOnError, true);
  } finally { console.warn = warn; f.dispose(); }
});

test("retry сохраняет hasValue и ошибки, инвалидирует только выбранный client-demand ресурс текущего UID", async () => {
  let failPhoto = false;
  const f = fixture({ loadClientProgressPhotos: async () => { if (failPhoto) throw new Error("photo unavailable"); return [{ id: "kept" }]; } });
  const warn = console.warn; console.warn = () => {};
  try {
    await f.settle();
    const sentinel = async () => "untouched";
    await runSessionResource(f.auth, "nutrition:client", sentinel, { maxAgeMs: 60000 });
    await runSessionResource(f.auth, "client-demand:photos:another", sentinel, { maxAgeMs: 60000 });
    failPhoto = true;
    assert.equal(f.result.retry(["photos"]), true);
    f.render();
    assert.deepEqual(f.result.resources.photos, { status: "loading", hasValue: true });
    await f.settle();
    assert.deepEqual(f.result.resources.photos, { status: "error", hasValue: true });
    assert.equal(f.calls.filter(([name]) => name === "loadClientProgressPhotos").length, 2);
    for (const name of ["loadNutritionFromFirebase", "loadProfileMeasurementSnapshot", "loadClientTrainerTasks"])
      assert.equal(f.calls.filter(([called]) => called === name).length, 1, `${name} не перечитывается из-за чужого retry`);
    const unexpected = () => { throw new Error("unrelated resource invalidated"); };
    assert.equal(await runSessionResource(f.auth, "nutrition:client", unexpected, { maxAgeMs: 60000 }), "untouched");
    assert.equal(await runSessionResource(f.auth, "client-demand:photos:another", unexpected, { maxAgeMs: 60000 }), "untouched");
    failPhoto = false;
    f.result.retry("photos"); await f.settle();
    assert.deepEqual(f.result.resources.photos, { status: "ready", hasValue: true });
  } finally { console.warn = warn; f.dispose(); }
});

test("смена аккаунта и same-UID auth epoch не принимают старые результаты, auth/user mismatch не запускает чтение", async () => {
  const old = deferred(); let first = true;
  const f = fixture({ loadNutritionFromFirebase: () => first ? (first = false, old.promise) : Promise.resolve([]) });
  try {
    await f.settle();
    f.auth.currentUser = { uid: "other" }; advanceAuthSession(f.auth);
    f.props.user = f.auth.currentUser; f.render();
    for (const resource of Object.values(f.result.resources)) assert.deepEqual(resource, { status: "loading", hasValue: false });
    old.resolve(["private old response"]); await f.settle();
    assert.equal(f.result.resources.nutritionDay.status, "ready");
    const before = f.calls.length;
    f.props.user = { uid: "stale-user" }; f.render(); await f.settle();
    assert.equal(f.calls.length, before);
    assert.equal(f.result.retry(), false);
    for (const resource of Object.values(f.result.resources)) assert.equal(resource.hasValue, false);
    f.props.user = f.auth.currentUser; advanceAuthSession(f.auth); f.render();
    assert.equal(f.result.resources.photos.hasValue, false);
    await f.settle();
    assert.equal(f.result.resources.photos.status, "ready");
  } finally { f.dispose(); }
});

test("useClientDataRuntime возвращает demand API и сохраняет ту же очередную загрузку", async () => {
  const f = fixture({}, useClientDataRuntime);
  try {
    assert.equal(typeof f.result.retry, "function");
    await f.settle();
    assert.equal(f.result.resources.nutritionDay.status, "ready");
  } finally { f.dispose(); }
});

test("measurementOverview без snapshot не выдаётся за ready, legacy nutrition null остаётся допустимым результатом", async () => {
  let missing = true;
  const f = fixture({ loadProfileMeasurementSnapshot: async uid => missing ? null : measurementSnapshot(uid), loadNutritionFromFirebase: async () => null });
  try {
    await f.settle();
    assert.deepEqual(f.result.resources.measurementOverview, { status: "error", hasValue: false });
    assert.deepEqual(f.result.resources.nutritionDay, { status: "ready", hasValue: true });
    missing = false;
    f.result.retry(["measurementOverview"]); await f.settle();
    assert.deepEqual(f.result.resources.measurementOverview, { status: "ready", hasValue: true });
    assert.equal(f.calls.filter(([name]) => name === "loadProfileMeasurementSnapshot").length, 2, "retry не переиспользует закэшированный null");
  } finally { f.dispose(); }
});

test("старый ответ после relogin того же UID не завершает loading нового demand", async () => {
  const old = deferred(), fresh = deferred(); let reads = 0;
  const f = fixture({ loadNutritionFromFirebase: () => (++reads === 1 ? old : fresh).promise });
  try {
    await f.settle();
    f.auth.currentUser = { uid: "client" }; advanceAuthSession(f.auth); f.props.user = f.auth.currentUser; f.render();
    await f.settle();
    old.resolve(["old-session-value"]); await f.settle();
    assert.deepEqual(f.result.resources.nutritionDay, { status: "loading", hasValue: false });
    fresh.resolve(null); await f.settle();
    assert.deepEqual(f.result.resources.nutritionDay, { status: "ready", hasValue: true });
  } finally { f.dispose(); }
});

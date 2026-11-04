import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let effect;
let authCallback;
const auth = { currentUser: null };
let profiles;
const cleanupImports = installRuntimeImports({
  react: { useEffect: callback => { effect = callback; } },
  "/firebase.js": { auth, db: {} },
  "/apiClient.js": { fetchAuthorizedWithTimeout: () => { throw new Error("Unexpected API write"); } },
  "firebase/auth": {
    onAuthStateChanged: (_auth, callback) => { authCallback = callback; return () => {}; },
    getIdTokenResult: async () => ({ claims: {} })
  },
  "firebase/firestore": {
    doc: (_db, ...parts) => parts.join("/"), getDoc: path => profiles.get(path.split("/").at(-1)).promise,
    setDoc: () => { throw new Error("Unexpected profile write"); }
  }
});
after(cleanupImports);
const { useAuthBootstrapEffect } = await import("../src/app/useAuthBootstrapEffect.js");
const originalNow = Date.now;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;
let now;
let timers;
let allTimers;
let nextTimer;
let dispose;

beforeEach(() => {
  auth.currentUser = null;
  profiles = new Map();
  now = 0;
  timers = new Map();
  allTimers = [];
  nextTimer = 1;
  dispose = undefined;
  Date.now = () => now;
  globalThis.window = {
    setTimeout(callback, delay) {
      const id = nextTimer++;
      const timer = { id, at: now + delay, callback };
      timers.set(id, timer);
      allTimers.push(timer);
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
});
afterEach(() => {
  dispose?.();
  Date.now = originalNow;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
});

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
async function advanceTo(target) {
  while (true) {
    const timer = [...timers.values()].filter(value => value.at <= target).sort((a, b) => a.at - b.at)[0];
    if (!timer) break;
    now = timer.at;
    timers.delete(timer.id);
    timer.callback();
    await flush();
  }
  now = target;
  await flush();
}

function harness() {
  const state = {};
  const roles = [];
  const setters = new Map();
  const workouts = new Map();
  const options = {
    auth, db: {}, APP_PAGES: { MAIN: "main", ADMIN: "trainer", ADMIN_PANEL: "admin" },
    defaultNutritionState: { goals: {}, days: {}, favorites: [] },
    createEmptyAiNutritionProfileDraft: () => ({}), createEmptyTelegramProfile: () => ({}),
    safeReadUserJsonStorage: (_key, _uid, fallback) => fallback, safeWriteUserJsonStorage() {},
    hasRequiredAiNutritionProfileFields: () => false,
    getDefaultWorkoutModePreference: () => ({ mode: "individual", remember: false }),
    normalizeAppPage: value => value, normalizeClientPrimaryPage: value => value,
    loadRecentNutritionFoods: () => [], loadWorkoutsFromFirebase: uid => workouts.get(uid).promise,
    startPerformanceCheck() {}, endPerformanceCheck() {}, refreshTelegramAvatar() {}
  };
  const context = new Proxy(options, { get(target, name) {
    if (name in target) return target[name];
    if (String(name).startsWith("set")) {
      if (!setters.has(name)) setters.set(name, value => {
        state[name] = typeof value === "function" ? value(state[name]) : value;
        if (name === "setCurrentUserRole") roles.push({ at: now, role: state[name] });
      });
      return setters.get(name);
    }
    if (String(name).startsWith("load") || String(name).startsWith("replay")) return async () => {};
    return /^[A-Z_]+$/.test(String(name)) ? name : undefined;
  } });
  // Only hook registration, Firebase responses, storage and clock are mocked.
  // The actual hook and all imported bootstrap/role/session helpers execute.
  useAuthBootstrapEffect(() => context);
  dispose = effect();
  async function signIn(uid) {
    profiles.set(uid, deferred());
    workouts.set(uid, deferred());
    auth.currentUser = { uid, email: `${uid}@example.invalid` };
    const request = authCallback(auth.currentUser);
    await flush();
    return { request };
  }
  async function verify(uid, role = "client") {
    profiles.get(uid).resolve({ exists: () => true, data: () => ({ role, firstSetupCompleted: true }) });
    await flush();
  }
  return { state, roles, workouts, signIn, verify };
}

test("a verified client opens its shell before workouts finish and survives the 9s role fallback", async () => {
  const h = harness();
  const { request } = await h.signIn("A");
  await advanceTo(7000);
  await h.verify("A");
  assert.equal(h.state.setCurrentUserRole, "client");
  await advanceTo(9000);
  assert.equal(h.state.setCurrentUserRole, "client");
  assert.equal(h.state.setAppLoading, false, "verified shell is not blocked by a slow workout request");
  assert.equal(h.state.setInitialWorkoutLoadState, "loading", "the workout section remains explicitly pending");
  await advanceTo(12000);
  await request;
  assert.equal(h.state.setAppLoading, false);
  assert.equal(h.state.setCurrentUserRole, "client");
  assert.deepEqual(h.roles, [{ at: 0, role: "resolving" }, { at: 7000, role: "client" }]);
});

test("an unverified role still fails closed at 9s and stays blocked after an invalid profile arrives", async () => {
  const h = harness();
  const { request } = await h.signIn("A");
  await advanceTo(9000);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setAppLoading, false);
  assert.equal(h.state.setIsAdminClaim, false);
  await h.verify("A", "unknown");
  await request;
  await advanceTo(9000);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
});

test("a queued timeout and late role response from account A cannot change account B", async () => {
  const h = harness();
  const { request: oldRequest } = await h.signIn("A");
  const oldTimeout = allTimers.find(timer => timer.at === 9000);
  await advanceTo(1000);
  const { request } = await h.signIn("B");
  await h.verify("B", "trainer");
  await request;
  await advanceTo(1900);
  const expected = { ...h.state };
  oldTimeout.callback(); // Already queued by the browser before clearTimeout.
  await h.verify("A");
  await oldRequest;
  assert.deepEqual(h.state, expected);
  assert.equal(h.state.setCurrentUserRole, "trainer");
  assert.equal(h.state.setUser.uid, "B");
});

test("finishing old workouts cannot cancel the new account's role timeout", async () => {
  const h = harness();
  const { request: oldRequest } = await h.signIn("A");
  await advanceTo(7000);
  await h.verify("A");
  await advanceTo(8000);
  const { request } = await h.signIn("B");
  h.workouts.get("A").resolve();
  await oldRequest;
  assert.equal(h.state.setCurrentUserRole, "resolving");
  await advanceTo(17000);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setAppLoading, false);
  await h.verify("B", "unknown");
  await request;
});

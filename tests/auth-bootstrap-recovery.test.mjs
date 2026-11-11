import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { captureAuthSession } from "../src/utils/authSession.js";

let effect;
let authCallback;
let fixture;
const auth = { currentUser: null };
const cleanupImports = installRuntimeImports({
  react: { useEffect: callback => { effect = callback; } },
  "/firebase.js": { auth, db: {} },
  "/apiClient.js": { fetchAuthorizedWithTimeout: async () => {
    fixture.recoveryCalls++;
    return { ok: false, status: 403, json: async () => ({ ok: false }) };
  } },
  "firebase/auth": {
    onAuthStateChanged: (_auth, callback) => {
      authCallback = callback;
      return () => { fixture.unsubscribed = true; };
    },
    getIdTokenResult: (user, force) => {
      fixture.claimsCalls.push({ user, force });
      return fixture.readClaims(user, force);
    }
  },
  "firebase/firestore": {
    doc: (_db, ...parts) => parts.join("/"),
    getDoc: path => readProfile(path),
    getDocFromServer: path => readProfile(path),
    setDoc: async path => {
      fixture.repairWrites.push(path);
      throw codedError("permission-denied");
    }
  }
});
after(cleanupImports);
const { useAuthBootstrapEffect } = await import("../src/app/useAuthBootstrapEffect.js");

const originalNow = Date.now;
const originals = Object.fromEntries(["window", "document", "navigator", "localStorage"].map(name =>
  [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let now;
let timers;
let allTimers;
let nextTimer;
let dispose;

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function eventSurface(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    emit(name) { for (const listener of [...(listeners.get(name) || [])]) listener({ type: name }); },
    listenerCount() { return [...listeners.values()].reduce((total, items) => total + items.size, 0); }
  };
}

beforeEach(() => {
  auth.currentUser = null;
  now = 0;
  timers = new Map();
  allTimers = [];
  nextTimer = 1;
  dispose = undefined;
  Date.now = () => now;
  fixture = {
    responses: new Map(), profileReads: [], claimsCalls: [], repairWrites: [],
    recoveryCalls: 0, reloads: 0, memberLoads: 0, unsubscribed: false,
    readClaims: async () => ({ claims: {} })
  };
  const window = eventSurface({
    setTimeout(callback, delay) {
      const id = nextTimer++;
      const timer = { id, at: now + delay, callback };
      timers.set(id, timer);
      allTimers.push(timer);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    location: { reload() { fixture.reloads++; } }
  });
  const values = {
    window,
    document: eventSurface({ visibilityState: "visible" }),
    navigator: { onLine: true },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
});

afterEach(() => {
  dispose?.();
  Date.now = originalNow;
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

const flush = async () => { for (let index = 0; index < 60; index++) await Promise.resolve(); };

async function advanceTo(target) {
  while (true) {
    const next = [...timers.values()].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    now = next.at;
    timers.delete(next.id);
    next.callback();
    await flush();
  }
  now = target;
  await flush();
}

function snapshot(role = "client", { fromCache = false, exists = true, ...data } = {}) {
  return { exists: () => exists, data: () => ({ role, firstSetupCompleted: true, ...data }),
    metadata: { fromCache, hasPendingWrites: false } };
}

function readProfile(path) {
  const uid = path.split("/").at(-1);
  fixture.profileReads.push({ uid, at: now });
  const choices = fixture.responses.get(uid);
  assert.ok(choices?.length, `Unexpected profile read for ${uid}`);
  const index = fixture.profileReads.filter(read => read.uid === uid).length - 1;
  const response = choices[Math.min(index, choices.length - 1)];
  return Promise.resolve().then(() => typeof response === "function" ? response() : response);
}

function harness() {
  const state = {};
  const updates = [];
  const setters = new Map();
  const retryRef = { current: null };
  const options = {
    auth, db: {}, roleVerificationRetryRef: retryRef,
    APP_PAGES: { MAIN: "main", ADMIN: "trainer", ADMIN_PANEL: "admin" },
    defaultNutritionState: { goals: {}, days: {}, favorites: [] },
    createEmptyAiNutritionProfileDraft: () => ({}), createEmptyTelegramProfile: () => ({}),
    safeReadUserJsonStorage: (_key, _uid, fallback) => fallback, safeWriteUserJsonStorage() {},
    hasRequiredAiNutritionProfileFields: () => false,
    getDefaultWorkoutModePreference: () => ({ mode: "individual", remember: false }),
    normalizeAppPage: value => value, normalizeClientPrimaryPage: value => value,
    loadRecentNutritionFoods: () => [],
    loadWorkoutsFromFirebase: async (_uid, configuration) => {
      fixture.memberLoads++;
      configuration?.onLoadReady?.();
      return { workouts: [] };
    },
    startPerformanceCheck() {}, endPerformanceCheck() {}, refreshTelegramAvatar() {}
  };
  const context = new Proxy(options, { get(target, name) {
    if (name in target) return target[name];
    if (String(name).startsWith("set")) {
      if (!setters.has(name)) setters.set(name, value => {
        state[name] = typeof value === "function" ? value(state[name]) : value;
        updates.push({ name, value: state[name], at: now });
      });
      return setters.get(name);
    }
    if (String(name).startsWith("load") || String(name).startsWith("replay")) return async () => {};
    return /^[A-Z_]+$/.test(String(name)) ? name : undefined;
  } });
  useAuthBootstrapEffect(() => context);
  dispose = effect();
  async function signIn(uid, responses) {
    if (responses) fixture.responses.set(uid, responses);
    const user = { uid, email: `${uid}@example.invalid` };
    auth.currentUser = user;
    const request = authCallback(user);
    await flush();
    return { user, request };
  }
  async function signOut() {
    auth.currentUser = null;
    const request = authCallback(null);
    await flush();
    return request;
  }
  async function retry() {
    assert.equal(typeof retryRef.current, "function", "a retry-in-place handler must be registered");
    const request = retryRef.current();
    await flush();
    return { request };
  }
  return { state, updates, retryRef, signIn, signOut, retry };
}

test("a current client profile is not blocked by an unnecessary forced claims refresh", async () => {
  fixture.readClaims = () => new Promise(() => {});
  const h = harness();
  await h.signIn("client", [snapshot()]);
  assert.equal(h.state.setCurrentUserRole, "client");
  assert.equal(h.state.setAppLoading, false);
  assert.equal(fixture.claimsCalls.length, 0);
  assert.equal(fixture.memberLoads, 1);
  assert.equal(h.state.setRoleVerificationIssue, null);
});

test("an administrator remains blocked until forced current claims match the server profile", async () => {
  const claims = deferred();
  fixture.readClaims = () => claims.promise;
  const h = harness();
  await h.signIn("admin", [snapshot("admin", { adminClaimVersion: "current" })]);
  assert.equal(fixture.claimsCalls.length, 1);
  assert.equal(fixture.claimsCalls[0].force, true);
  assert.notEqual(h.state.setCurrentUserRole, "admin");
  assert.equal(h.state.setIsAdminClaim, false);
  claims.resolve({ claims: { admin: true, adminClaimVersion: "current" } });
  await flush();
  assert.equal(h.state.setCurrentUserRole, "admin");
  assert.equal(h.state.setIsAdminClaim, true);
  assert.equal(fixture.memberLoads, 0);
});

test("a transient profile failure recovers automatically without reloading or changing the auth session", async () => {
  const h = harness();
  await h.signIn("client", [() => { throw codedError("unavailable"); }, snapshot()]);
  const session = captureAuthSession(auth);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setRoleVerificationIssue.kind, "connection");
  await advanceTo(1000);
  assert.equal(fixture.profileReads.length, 2);
  assert.equal(h.state.setCurrentUserRole, "client");
  assert.equal(h.state.setRoleVerificationIssue, null);
  assert.equal(session.isCurrent(), true, "network retry is not an auth transition");
  assert.equal(fixture.reloads, 0);
});

test("a timed-out role response cannot publish after a newer verification attempt starts", async () => {
  const old = deferred();
  const next = deferred();
  const h = harness();
  await h.signIn("client", [old.promise, next.promise]);
  await advanceTo(15000);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setRoleVerificationIssue.kind, "connection");
  await advanceTo(16000);
  assert.equal(fixture.profileReads.length, 2);
  old.resolve(snapshot("trainer"));
  await flush();
  assert.notEqual(h.state.setCurrentUserRole, "trainer");
  next.resolve(snapshot());
  await flush();
  assert.equal(h.state.setCurrentUserRole, "client");
  assert.equal(fixture.reloads, 0);
});

test("online and foreground events coalesce instead of multiplying pending profile requests", async () => {
  const next = deferred();
  const h = harness();
  await h.signIn("client", [() => { throw codedError("unavailable"); }, next.promise]);
  for (let index = 0; index < 20; index++) {
    window.emit("online");
    document.emit("visibilitychange");
  }
  await flush();
  await advanceTo(1000);
  assert.equal(fixture.profileReads.length, 2);
  for (let index = 0; index < 20; index++) {
    window.emit("online");
    document.emit("visibilitychange");
    h.retryRef.current?.();
  }
  await flush();
  assert.equal(fixture.profileReads.length, 2);
  next.resolve(snapshot());
  await flush();
  assert.equal(h.state.setCurrentUserRole, "client");
});

test("automatic recovery stops after three attempts and only an explicit retry starts a new budget", async () => {
  const unavailable = () => { throw codedError("unavailable"); };
  const h = harness();
  await h.signIn("client", [unavailable, unavailable, unavailable, snapshot()]);
  const session = captureAuthSession(auth);
  await advanceTo(60000);
  assert.equal(fixture.profileReads.length, 3);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setRoleVerificationIssue.willRetry, false);
  for (let index = 0; index < 10; index++) {
    window.emit("online");
    document.emit("visibilitychange");
  }
  await advanceTo(120000);
  assert.equal(fixture.profileReads.length, 3, "connectivity events cannot reset an exhausted automatic budget");
  await h.retry();
  assert.equal(fixture.profileReads.length, 4);
  assert.equal(h.state.setCurrentUserRole, "client");
  assert.equal(session.isCurrent(), true);
  assert.equal(fixture.reloads, 0);
});

test("an access denial is not retried as a network failure after guarded legacy recovery is denied", async () => {
  const h = harness();
  await h.signIn("client", [() => { throw codedError("permission-denied"); }]);
  await advanceTo(60000);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setRoleVerificationIssue.kind, "access");
  assert.equal(fixture.profileReads.length, 1);
  assert.equal(fixture.memberLoads, 0);
});

test("an online cached role is never accepted as fresh server authority", async () => {
  const h = harness();
  await h.signIn("client", [snapshot("client", { fromCache: true })]);
  await advanceTo(60000);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(fixture.memberLoads, 0);
  assert.equal(h.updates.some(update => update.name === "setCurrentUserRole" && update.value === "client"), false);
});

test("a signed-out session cancels scheduled role retries and cannot be restored by connectivity events", async () => {
  const h = harness();
  await h.signIn("client", [() => { throw codedError("unavailable"); }]);
  await h.signOut();
  const expected = { ...h.state };
  window.emit("online");
  document.emit("visibilitychange");
  await advanceTo(60000);
  assert.equal(fixture.profileReads.length, 1);
  assert.deepEqual(h.state, expected);
  assert.equal(h.state.setIsLoggedIn, false);
});

test("a new login of the same UID ignores the previous session's queued timeout and late response", async () => {
  const old = deferred();
  const h = harness();
  await h.signIn("same", [old.promise, snapshot()]);
  const oldTimeout = allTimers.find(timer => timer.at === 15000);
  const oldSession = captureAuthSession(auth);
  await advanceTo(1000);
  const current = await h.signIn("same");
  assert.equal(oldSession.isCurrent(), false);
  assert.equal(h.state.setCurrentUserRole, "client");
  const expected = { ...h.state };
  oldTimeout.callback();
  old.resolve(snapshot("trainer"));
  await flush();
  assert.deepEqual(h.state, expected);
  assert.equal(h.state.setUser, current.user);
});

test("a previous account's late rejection cannot change the next account's verified state", async () => {
  const old = deferred();
  const h = harness();
  await h.signIn("old", [old.promise]);
  await h.signIn("new", [snapshot("trainer")]);
  const expected = { ...h.state };
  old.reject(codedError("unavailable"));
  await flush();
  await advanceTo(60000);
  assert.deepEqual(h.state, expected);
  assert.equal(fixture.profileReads.length, 2);
  assert.equal(h.state.setCurrentUserRole, "trainer");
});

test("replacement of the Firebase User object with the same UID invalidates an old response even without a listener callback", async () => {
  const old = deferred();
  const h = harness();
  await h.signIn("same-object-change", [old.promise]);
  auth.currentUser = { ...auth.currentUser };
  const expected = { ...h.state };
  old.resolve(snapshot("trainer"));
  await flush();
  window.emit("online");
  await advanceTo(60000);
  assert.deepEqual(h.state, expected);
  assert.equal(fixture.memberLoads, 0);
});

test("unmount removes recovery listeners and prevents queued work from updating state", async () => {
  const h = harness();
  await h.signIn("client", [() => { throw codedError("unavailable"); }]);
  const queued = [...allTimers];
  const retry = h.retryRef.current;
  dispose();
  dispose = undefined;
  const expected = { ...h.state };
  for (const timer of queued) timer.callback();
  retry?.();
  window.emit("online");
  document.emit("visibilitychange");
  await advanceTo(60000);
  assert.deepEqual(h.state, expected);
  assert.equal(fixture.profileReads.length, 1);
  assert.equal(fixture.unsubscribed, true);
  assert.equal(window.listenerCount(), 0);
  assert.equal(document.listenerCount(), 0);
});

test("a verified pending registration stays locked and never loads client workouts", async () => {
  const h = harness();
  await h.signIn("pending", [snapshot("client", { accountAccessStatus: "awaiting_trainer", trainerAssignmentState: "unassigned" })]);
  assert.equal(h.state.setCurrentUserRole, "pending-client");
  assert.equal(h.state.setAppLoading, false);
  assert.equal(fixture.memberLoads, 0);
  assert.equal(fixture.claimsCalls.length, 0);
  assert.equal(h.state.setRoleVerificationIssue, null);
});

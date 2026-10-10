import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { hasRequiredAiNutritionProfileFields } from "../src/utils/profileDefaults.js";

let effects = [];
const cleanupImports = installRuntimeImports({
  react: { useEffect: (callback, dependencies) => effects.push({ callback, dependencies }) },
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": { doc: (_, ...parts) => parts.join("/"), onSnapshot: () => () => {}, setDoc: async () => {} }
});
after(cleanupImports);
const { useAppRuntimeEffects } = await import("../src/app/useAppRuntimeEffects.js");
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let scheduled;
let pendingTimers;
let cleared;
const local = new Map();

beforeEach(() => {
  effects = [];
  scheduled = [];
  pendingTimers = new Map();
  cleared = [];
  local.clear();
  globalThis.localStorage = { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)) };
  globalThis.setTimeout = (callback, delay) => {
    const id = scheduled.length + 1;
    scheduled.push({ id, callback, delay });
    pendingTimers.set(id, callback);
    return id;
  };
  globalThis.clearTimeout = (id) => { cleared.push(id); pendingTimers.delete(id); };
});
afterEach(() => {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

function harness(overrides = {}, deferred = false) {
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  let open = false;
  const queued = [];
  const updates = [];
  const setter = (update) => {
    updates.push(update);
    const apply = () => { open = typeof update === "function" ? update(open) : update; };
    if (deferred) queued.push(apply);
    else apply();
  };
  const options = {
    auth, user: auth.currentUser, APP_PAGES: { ADMIN: "trainer" }, appLoading: false, appTheme: "light",
    appThemeCloudReady: false, currentUserRole: "client", db: {}, firstSetupCompletedInCloud: false,
    firstSetupCompletedInSession: false, firstSetupDoneUserStorageKey: "done", firstSetupProfileHydrated: true,
    firstSetupRequiredVersion: "1", isAdminClaim: false, isLoggedIn: true, page: "main", plan: { workouts: [] },
    aiNutritionProfile: null, hasRequiredAiNutritionProfileFields,
    isClientPrimaryPage: () => true, normalizeAppPage: (page) => page,
    setAppTheme() {}, setAppThemeCloudReady() {}, setPage() {}, setSelectedUserId() {},
    setShowFirstSetupOnboarding: setter, ...overrides
  };
  useAppRuntimeEffects(options);
  // Exercise the real registered effect, with React scheduling as the I/O
  // boundary. Other unrelated runtime effects are registered but not run.
  const effect = effects.find(({ dependencies }) => dependencies.includes(setter));
  const dispose = effect.callback();
  return { auth, updates, dispose, getOpen: () => open, setOpen: (value) => { open = value; }, flush: () => queued.splice(0).forEach((apply) => apply()) };
}

test("an incomplete client opens onboarding and preserves the existing 120/600ms retries", () => {
  const h = harness();
  assert.equal(h.getOpen(), true);
  assert.deepEqual(scheduled.map(({ delay }) => delay), [120, 600]);
  scheduled.forEach(({ callback }) => callback());
  assert.equal(h.updates.length, 3);
  assert.equal(h.getOpen(), true);
  h.dispose();
});

test("effect cleanup cancels both retry timers and ignores callbacks already queued by the browser", () => {
  const h = harness();
  h.dispose();
  assert.deepEqual(cleared, [1, 2]);
  assert.equal(pendingTimers.size, 0);
  h.setOpen(false);
  scheduled.forEach(({ callback }) => callback());
  assert.equal(h.updates.length, 1);
  assert.equal(h.getOpen(), false);
});

test("a callback cannot reopen onboarding after auth changes, even before effect cleanup", () => {
  const h = harness();
  h.auth.currentUser = { uid: "B" };
  advanceAuthSession(h.auth);
  h.setOpen(false);
  scheduled.forEach(({ callback }) => callback());
  assert.equal(h.updates.length, 1);
  assert.equal(h.getOpen(), false);
  h.dispose();
});

test("deferred onboarding updates cannot reopen a later login of the same account", () => {
  const h = harness({}, true);
  const originalUser = h.auth.currentUser;
  scheduled[0].callback();
  h.auth.currentUser = null;
  advanceAuthSession(h.auth, null);
  h.auth.currentUser = originalUser;
  advanceAuthSession(h.auth, originalUser);
  h.flush();
  assert.equal(h.getOpen(), false);
  scheduled[1].callback();
  assert.equal(h.updates.length, 2);
  h.dispose();
});

test("a queued updater is invalidated by effect cleanup even without an auth transition", () => {
  const h = harness({}, true);
  h.dispose();
  h.flush();
  assert.equal(h.getOpen(), false);
});

test("a completed client profile closes onboarding without scheduling retries", () => {
  const h = harness({ firstSetupCompletedInCloud: true });
  assert.equal(h.getOpen(), false);
  assert.equal(h.updates.length, 1);
  assert.deepEqual(scheduled, []);
  assert.equal(local.get("done:A"), "1");
  h.dispose();
});

test("locally completed onboarding remains complete", () => {
  local.set("done:A", "1");
  const h = harness();
  assert.deepEqual(h.updates, []);
  assert.deepEqual(scheduled, []);
  h.dispose();
});

for (const role of ["trainer", "admin", "resolving", "unresolved"]) {
  test(`${role} never schedules client onboarding`, () => {
    const h = harness({ currentUserRole: role });
    assert.equal(h.dispose, undefined);
    assert.deepEqual(h.updates, []);
    assert.deepEqual(scheduled, []);
  });
}

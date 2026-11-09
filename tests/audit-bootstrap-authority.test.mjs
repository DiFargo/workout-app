import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let profileRead;
let profileRepair;
let recoveryFetch;
let claimsRead;
const cleanup = installRuntimeImports({
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "/apiClient.js": { fetchAuthorizedWithTimeout: (...args) => recoveryFetch(...args) },
  "firebase/auth": { getIdTokenResult: (...args) => claimsRead(...args) },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"), getDoc: (...args) => profileRead(...args), setDoc: (...args) => profileRepair(...args)
  }
});
after(cleanup);
const { loadRemoteUserBootstrapState, resolveAdminClaim, hydrateCachedUserState } = await import("../src/app/appBootstrapHelpers.js");

beforeEach(() => {
  profileRead = async () => snapshot({ role: "client" });
  profileRepair = async () => {};
  recoveryFetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  claimsRead = async () => ({ claims: {} });
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
});

const snapshot = (data) => ({ exists: () => true, data: () => data });
const permissionDenied = () => Object.assign(new Error("permission-denied"), { code: "permission-denied" });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const setterNames = [
  "setIsAdminClaim", "setCurrentUserRole", "setPage", "setProfileAccount", "setProfileAccountDraft",
  "setWorkoutModePreference", "setWorkoutModeRemember", "setAppTheme", "setAiNutritionProfile",
  "setAiNutritionProfileDraft", "setAiNutritionSavedPlan", "setProfileWorkoutCalendarData",
  "setProfileWorkoutScheduledDates", "setProfileWorkoutCalendarDraftDates", "setFirstSetupCompletedInCloud",
  "setAppThemeCloudReady", "setFirstSetupProfileHydrated", "setNutrition", "setPlan", "setRecentNutritionFoods",
  "setTelegramDraft", "setTelegramProfile", "setProfileWorkoutCalendarEditing", "setProfileWorkoutCalendarStatus"
];

function harness(adminClaims = {}) {
  let current = true;
  const updates = [];
  const writes = [];
  const state = {};
  const options = {
    user: { uid: "A", email: "a@example.invalid" }, db: {}, adminClaims,
    APP_PAGES: { MAIN: "main", ADMIN: "trainer", ADMIN_PANEL: "admin" },
    AI_NUTRITION_PROFILE_STORAGE_KEY: "profile", AI_NUTRITION_PLAN_STORAGE_KEY: "plan",
    CLIENT_LAST_PAGE_STORAGE_KEY: "page", FIRST_SETUP_REQUIRED_VERSION: "1",
    WORKOUT_CALENDAR_STORAGE_KEY: "calendar", WORKOUT_MODE_STORAGE_KEY: "mode", BASIC_WORKOUT_PLAN_STORAGE_KEY: "basic",
    NUTRITION_STORAGE_KEY: "nutrition", TELEGRAM_PROFILE_STORAGE_KEY: "telegram", STORAGE_KEY: "workouts",
    defaultNutritionState: { goals: {}, days: {}, favorites: [] },
    getDefaultWorkoutModePreference: () => ({ mode: "individual", remember: false }),
    hasRequiredAiNutritionProfileFields: (profile) => Boolean(profile?.weight),
    createEmptyTelegramProfile: () => ({}), loadRecentNutritionFoods: () => [],
    normalizeAppPage: (value) => value, normalizeClientPrimaryPage: (value) => value,
    safeReadUserJsonStorage: (_key, _uid, fallback) => fallback,
    safeWriteUserJsonStorage: (...args) => writes.push(args),
    isCurrentRun: () => current
  };
  for (const name of setterNames) options[name] = (value) => {
    updates.push([name, value]);
    if (typeof value !== "function") state[name] = value;
  };
  return { options, updates, writes, state, invalidate: () => { current = false; } };
}

test("pending remote bootstrap discards a response from an expired run", async () => {
  const read = deferred();
  profileRead = () => read.promise;
  const h = harness();
  const load = loadRemoteUserBootstrapState(h.options);
  h.invalidate();
  read.resolve(snapshot({ role: "client", aiNutritionProfile: { name: "A", weight: "81" } }));
  assert.equal(await load, null);
  assert.deepEqual(h.updates, []);
  assert.deepEqual(h.writes, []);
});

test("bootstrap ignores a remembered basic mode until the administrator grants it", async () => {
  for (const allowed of [false, true]) {
    profileRead = async () => snapshot({ role: "client", basicWorkoutAccess: allowed,
      workoutModePreference: { mode: "basic", remember: true } });
    const h = harness();
    assert.equal(await loadRemoteUserBootstrapState(h.options), "client");
    assert.equal(h.state.setWorkoutModePreference.mode, allowed ? "basic" : "individual");
  }
});

test("deferred remote profile callback preserves a new account's draft", async () => {
  profileRead = async () => snapshot({ role: "client", aiNutritionProfile: { name: "A", weight: "81", goal: "cut" } });
  const h = harness();
  assert.equal(await loadRemoteUserBootstrapState(h.options), "client");
  const update = h.updates.find(([name]) => name === "setAiNutritionProfileDraft")[1];
  h.invalidate();
  const nextDraft = { name: "B", weight: "70", goal: "maintain" };
  assert.equal(update(nextDraft), nextDraft);
});

test("pending open registrations resolve to a locked role without hydrating client data", async () => {
  profileRead = async () => snapshot({ role: "client", active: true, accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer" });
  const h = harness();
  assert.equal(await loadRemoteUserBootstrapState(h.options), "pending-client");
  assert.equal(h.updates.find(([name]) => name === "setCurrentUserRole")[1], "pending-client");
  assert.equal(h.updates.find(([name]) => name === "setPage")[1], "main");
  assert.equal(h.updates.some(([name]) => name === "setPlan"), false);
});

test("deferred cached profile callback preserves a new account's draft", () => {
  const h = harness();
  h.options.safeReadUserJsonStorage = (key, _uid, fallback) => key === "profile" ? { name: "A", weight: "81" } : fallback;
  hydrateCachedUserState(h.options);
  const update = h.updates.find(([name]) => name === "setAiNutritionProfileDraft")[1];
  assert.deepEqual(update({ name: "A", goal: "cut" }), { name: "A", goal: "cut", weight: "81" });
  h.invalidate();
  const nextDraft = { name: "B", weight: "70" };
  assert.equal(update(nextDraft), nextDraft);
});

test("failed legacy repair after an auth switch cannot send an API recovery for the new account", async () => {
  const repair = deferred();
  const enteredRepair = deferred();
  let reads = 0;
  let recoveries = 0;
  profileRead = async () => { reads++; throw permissionDenied(); };
  profileRepair = () => { enteredRepair.resolve(); return repair.promise; };
  recoveryFetch = async () => { recoveries++; return { ok: true, json: async () => ({ ok: true }) }; };
  const h = harness();
  const load = loadRemoteUserBootstrapState(h.options);
  await enteredRepair.promise;
  h.invalidate();
  repair.reject(permissionDenied());
  assert.equal(await load, null);
  assert.equal(recoveries, 0);
  assert.equal(reads, 1);
  assert.deepEqual(h.updates, []);
});

test("successful legacy repair after a switch cannot start the repeated getDoc", async () => {
  const repair = deferred();
  const enteredRepair = deferred();
  let reads = 0;
  profileRead = async () => { reads++; throw permissionDenied(); };
  profileRepair = () => { enteredRepair.resolve(); return repair.promise; };
  const h = harness();
  const load = loadRemoteUserBootstrapState(h.options);
  await enteredRepair.promise;
  h.invalidate();
  repair.resolve();
  assert.equal(await load, null);
  assert.equal(reads, 1);
  assert.deepEqual(h.updates, []);
});

for (const [name, claims, profile, expected] of [
  ["legacy administrator with no version", { admin: true }, { role: "admin" }, "admin"],
  ["current matching version", { admin: true, adminClaimVersion: "current" }, { role: "admin", adminClaimVersion: "current" }, "admin"],
  ["mismatched version", { admin: true, adminClaimVersion: "old" }, { role: "admin", adminClaimVersion: "current" }, "unresolved"],
  ["unversioned token against versioned profile", { admin: true }, { role: "admin", adminClaimVersion: "current" }, "unresolved"],
  ["versioned token against legacy profile", { admin: true, adminClaimVersion: "old" }, { role: "admin" }, "unresolved"],
  ["missing admin claim", {}, { role: "admin" }, "unresolved"],
  ["revoked profile", { admin: true }, { role: "admin", membershipStatus: "revoked" }, "unresolved"],
  ["disabled profile", { admin: true }, { role: "admin", active: false }, "unresolved"]
]) {
  test(`bootstrap authority: ${name}`, async () => {
    profileRead = async () => snapshot(profile);
    const h = harness(claims);
    assert.equal(await loadRemoteUserBootstrapState(h.options), expected);
    assert.equal(h.state.setCurrentUserRole, expected);
    assert.equal(h.state.setIsAdminClaim, expected === "admin");
  });
}

test("failed claim resolution leaves an administrator unresolved instead of granting client or admin access", async () => {
  claimsRead = async () => { throw new Error("network-unavailable"); };
  const h = harness();
  const claims = await resolveAdminClaim({ user: h.options.user, setIsAdminClaim: h.options.setIsAdminClaim, isCurrentRun: h.options.isCurrentRun });
  assert.equal(claims, null);
  profileRead = async () => snapshot({ role: "admin" });
  h.options.adminClaims = claims;
  assert.equal(await loadRemoteUserBootstrapState(h.options), "unresolved");
  assert.equal(h.state.setIsAdminClaim, false);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
});

test("an unavailable role document fails closed without publishing client profile data", async () => {
  profileRead = async () => { throw new Error("unavailable"); };
  const h = harness({ admin: true });
  assert.equal(await loadRemoteUserBootstrapState(h.options), null);
  assert.equal(h.state.setCurrentUserRole, "unresolved");
  assert.equal(h.state.setIsAdminClaim, false);
  assert.equal(h.updates.some(([name]) => name === "setAiNutritionProfile"), false);
});

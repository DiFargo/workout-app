import assert from "node:assert/strict";
import test from "node:test";
import { loadInitialSignedInUserData, resolveAdminClaim, resetAuthSessionOperations } from "../src/app/appBootstrapHelpers.js";
import { recordStartupStage } from "../src/utils/performanceChecks.js";

const flush = () => new Promise(resolve => setImmediate(resolve));

function initialDataHarness() {
  let current = true, finish;
  const states = [], calls = [];
  const options = {
    user: { uid: "test-only" }, isCurrentRun: () => current,
    onWorkoutsLoadState: state => states.push(state),
    loadWorkoutsFromFirebase: (_uid, configuration) => new Promise(resolve => {
      finish = failed => {
        if (failed === true) configuration.onLoadError(new Error("offline"));
        else if (failed !== "superseded") configuration.onLoadReady();
        resolve({ workouts: [] });
      };
    })
  };
  for (const name of ["loadHistory", "loadNutritionFromFirebase", "loadProfileMeasurements", "loadClientProgressPhotos", "loadClientTrainerTasks", "replayFailedHistorySaves", "replayFailedNutritionSync", "replayFailedMeasurementSaves"])
    options[name] = async () => { calls.push(name); };
  return { options, states, calls, finish: failed => finish(failed), switchUser: () => { current = false; } };
}

test("verified shell opens while the workout section is still loading", async () => {
  const h = initialDataHarness();
  await loadInitialSignedInUserData(h.options);
  assert.deepEqual(h.states, ["loading"]);
  assert.ok(h.calls.includes("replayFailedHistorySaves"));
  assert.ok(!h.calls.includes("loadNutritionFromFirebase"));
  assert.ok(!h.calls.includes("loadClientProgressPhotos"));
  h.finish(false); await flush();
  assert.deepEqual(h.states, ["loading", "ready"]);
});

test("a failed workout load is not presented as an empty ready plan", async () => {
  const h = initialDataHarness();
  await loadInitialSignedInUserData(h.options);
  h.finish(true); await flush();
  assert.deepEqual(h.states, ["loading", "error"]);
});

test("late initial data cannot publish readiness into another account", async () => {
  const h = initialDataHarness();
  await loadInitialSignedInUserData(h.options);
  h.switchUser(); h.finish(false); await flush();
  assert.deepEqual(h.states, ["loading"]);
});

test("a superseded bootstrap request cannot release a newer pending plan", async () => {
  const h = initialDataHarness();
  await loadInitialSignedInUserData(h.options);
  h.finish("superseded"); await flush();
  assert.deepEqual(h.states, ["loading"]);
});

test("a same-UID new session can retry even if the previous retry never settles", () => {
  const workoutRetryRef = { current: { uid: "A", session: { isCurrent: () => false } } };
  resetAuthSessionOperations({ workoutRetryRef });
  assert.equal(workoutRetryRef.current, null);
});

test("claims still require a forced current token after the startup optimization", async () => {
  const states = [], user = { uid: "test-only" };
  const claims = await resolveAdminClaim({ user, setIsAdminClaim: state => states.push(state),
    isCurrentRun: () => true, readTokenResult: async (actual, force) => {
      assert.equal(actual, user); assert.equal(force, true); return { claims: { admin: false } };
    } });
  assert.deepEqual(claims, { admin: false });
  assert.deepEqual(states, [false]);
});

test("late claims never grant the next session an administrator role", async () => {
  const states = [];
  const claims = await resolveAdminClaim({ user: {}, setIsAdminClaim: state => states.push(state),
    isCurrentRun: () => false, readTokenResult: async () => ({ claims: { admin: true } }) });
  assert.equal(claims, null); assert.deepEqual(states, [false]);
});

test("startup diagnostics are bounded and do not persist identity or content", () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.localStorage;
  let saved = "[]";
  try {
    globalThis.window = {};
    globalThis.localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
    for (let i = 0; i < 55; i++) recordStartupStage("profile-verified", {
      role: "client", userId: "private-user", token: "secret", text: "private-note", route: "https://private.invalid/secret"
    });
    const records = JSON.parse(saved);
    assert.equal(records.length, 50);
    assert.equal(records[0].role, "client");
    assert.doesNotMatch(saved, /private-user|secret|private-note|https:/);
    recordStartupStage("unknown-private-stage");
    assert.equal(JSON.parse(saved).length, 50);
  } finally { globalThis.window = oldWindow; globalThis.localStorage = oldStorage; }
});

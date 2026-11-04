import test from "node:test";
import assert from "node:assert/strict";
import { rememberOfflineClientProfile, rememberOfflineWorkoutPlan,
  readOfflineClientProfile, readOfflineWorkoutPlan } from "../src/utils/offlineWorkoutAccess.js";

test("only a previously verified same-owner client plan can start offline", () => {
  const previousStorage = globalThis.localStorage;
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  try {
    const profile = { role: "client", accountAccessStatus: "active", trainerAssignmentState: "assigned" };
    const plan = { workouts: [{ id: "day-1", assignedProgramUpdatedAt: "v1", exercises: [{ id: "exercise-1" }] }] };
    localStorage.setItem("plan:owner", JSON.stringify(plan));
    assert.equal(readOfflineClientProfile("owner"), null);
    rememberOfflineClientProfile("owner", profile, false);
    assert.equal(readOfflineClientProfile("owner"), null);
    rememberOfflineWorkoutPlan("owner", "individual", plan, profile);
    assert.equal(readOfflineClientProfile("owner").role, "client");
    rememberOfflineClientProfile("owner", { ...profile, name: "Сохранённое имя", firstSetupCompleted: true,
      firstSetupCompletedVersion: "v1", aiNutritionProfile: { weight: 80 } }, true);
    rememberOfflineWorkoutPlan("owner", "individual", plan, profile);
    assert.equal(readOfflineClientProfile("owner").firstSetupCompleted, true);
    assert.equal(readOfflineClientProfile("owner").name, "Сохранённое имя");
    assert.equal(readOfflineClientProfile("owner").aiNutritionProfile.weight, 80);
    assert.deepEqual(readOfflineWorkoutPlan("owner", "individual", "plan"), plan);
    assert.equal(readOfflineWorkoutPlan("another", "individual", "plan"), null);
    assert.equal(readOfflineWorkoutPlan("owner", "basic", "plan"), null);
    navigator.onLine = true;
    assert.equal(readOfflineWorkoutPlan("owner", "individual", "plan"), null);
    navigator.onLine = false;
    localStorage.setItem("plan:owner", JSON.stringify({ workouts: [{ id: "another-assignment" }] }));
    assert.equal(readOfflineWorkoutPlan("owner", "individual", "plan"), null);
    rememberOfflineClientProfile("owner", { ...profile, trainerAssignmentState: "unassigned" }, true);
    assert.equal(readOfflineClientProfile("owner"), null);
    rememberOfflineClientProfile("owner", { role: "admin" }, true);
    assert.equal(readOfflineClientProfile("owner"), null);
  } finally {
    globalThis.localStorage = previousStorage;
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
  }
});

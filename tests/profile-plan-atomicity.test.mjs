import { test, after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let rejectCommit = true;
const persisted = new Map();
const local = new Map();
globalThis.localStorage = { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) };
const cleanup = installRuntimeImports({
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"),
    writeBatch: () => {
      const writes = [];
      return {
        set: (...args) => writes.push(args),
        commit: async () => {
          if (rejectCommit) throw new Error("unavailable");
          for (const [ref, data] of writes) persisted.set(ref, data);
        }
      };
    }
  }
});
after(cleanup);
const { createAiNutritionPlanHandlers } = await import("../src/features/client/nutrition/aiNutritionPlanHandlers.js");

test("profile setup commits profile and nutrition goals together before publishing any local success", async () => {
  const updates = [];
  const context = {
    auth: { currentUser: { uid: "synthetic" } }, db: {}, user: { uid: "synthetic" },
    nutrition: { days: {}, goals: { calories: 2200, protein: 150, fat: 70, carbs: 240 } }, history: [],
    aiNutritionProfileDraft: { name: "Test", weight: "80", targetWeight: "78", height: "180", age: "30", sex: "male", goal: "recomp", activity: "medium", trainingDays: [1, 3, 5] },
    AI_NUTRITION_PROFILE_STORAGE_KEY: "profile", AI_NUTRITION_PLAN_STORAGE_KEY: "plan", FIRST_SETUP_DONE_USER_STORAGE_KEY: "done", FIRST_SETUP_REQUIRED_VERSION: "1"
  };
  context.defaultNutritionState = context.nutrition;
  for (const name of ["setAiNutritionProfile", "setAiNutritionProfileDraft", "setAiNutritionSavedPlan", "setFirstSetupCompletedInCloud", "setNutrition"]) context[name] = (value) => updates.push([name, value]);
  const handlers = createAiNutritionPlanHandlers(context);
  assert.equal(await handlers.saveAiNutritionPlan(), false);
  assert.equal(persisted.size, 0);
  assert.equal(local.size, 0);
  assert.equal(updates.length, 0);
  rejectCommit = false;
  assert.equal(await handlers.saveAiNutritionPlan(), true);
  assert.equal(persisted.size, 2);
  assert.deepEqual(persisted.get("users/synthetic").nutritionGoals, persisted.get("users/synthetic/nutrition/state").goals);
  assert.equal(persisted.get("users/synthetic").firstSetupCompleted, true);
  assert.ok(updates.some(([name]) => name === "setNutrition"));
});

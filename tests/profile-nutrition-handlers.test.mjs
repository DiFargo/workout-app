import assert from "node:assert/strict";
import test from "node:test";

import { createProfileNutritionHandlers } from "../src/features/client/profile/profileNutritionHandlers.js";

test("saving body metrics sends target weight to the cloud profile handler", async () => {
  const profileDraft = {
    weight: "84.5",
    targetWeight: "79",
    height: "181",
    age: "31",
    sex: "male",
    activity: "medium",
    goal: "cut"
  };
  const calls = [];
  const handlers = createProfileNutritionHandlers(() => ({
    aiNutritionProfileDraft: profileDraft,
    saveAiNutritionPlan: async (...args) => {
      calls.push(args);
      return true;
    }
  }));

  assert.equal(await handlers.saveAiBodyMetrics(), true);
  assert.deepEqual(calls, [[profileDraft, { completeFirstSetup: false }]]);
});

test("a failed cloud save is returned to the profile form", async () => {
  const handlers = createProfileNutritionHandlers(() => ({
    aiNutritionProfileDraft: { targetWeight: "79" },
    saveAiNutritionPlan: async () => false
  }));

  assert.equal(await handlers.saveAiBodyMetrics(), false);
});

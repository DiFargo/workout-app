import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { migrateLegacyUserStorage } from "../src/utils/userScopedStorage.js";
import {
  calculateAiNutritionBmr,
  calculatePersonalAiNutritionCalories,
  getAiNutritionProfileValidation
} from "../src/utils/aiNutritionCalculations.js";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("legacy local cache only migrates to its explicit owner", () => {
  globalThis.localStorage = createStorage();
  localStorage.setItem("workout_nutrition_v1", JSON.stringify({ __uid: "account-a", days: {} }));
  localStorage.setItem("basic_workout_plan_v1", JSON.stringify({ workouts: [{ id: "unknown-owner" }] }));

  migrateLegacyUserStorage(["workout_nutrition_v1", "basic_workout_plan_v1"], "account-b");

  assert.equal(localStorage.getItem("workout_nutrition_v1:account-b"), null);
  assert.equal(localStorage.getItem("workout_nutrition_v1"), null);
  assert.equal(localStorage.getItem("basic_workout_plan_v1:account-b"), null);
  assert.equal(localStorage.getItem("basic_workout_plan_v1"), null);

  localStorage.setItem("workout_nutrition_v1", JSON.stringify({ __uid: "account-a", days: {} }));
  migrateLegacyUserStorage(["workout_nutrition_v1"], "account-a");

  assert.deepEqual(JSON.parse(localStorage.getItem("workout_nutrition_v1:account-a")), {
    __uid: "account-a",
    days: {}
  });
});

test("new nutrition calorie target depends only on the current profile", () => {
  const profile = {
    weight: 80,
    height: 180,
    age: 30,
    sex: "male",
    activity: "medium",
    goal: "recomp"
  };
  const maintenance = Math.round(calculateAiNutritionBmr(profile) * 1.48);

  assert.equal(calculatePersonalAiNutritionCalories(profile), maintenance - 120);
});

test("nutrition plan requires real profile data and respects the target weight", () => {
  const baseProfile = {
    weight: 80,
    height: 180,
    age: 30,
    sex: "male",
    activity: "medium",
    goal: "recomp"
  };
  const maintenance = Math.round(calculateAiNutritionBmr(baseProfile) * 1.48);

  assert.equal(getAiNutritionProfileValidation(baseProfile).valid, false);
  assert.equal(getAiNutritionProfileValidation({ ...baseProfile, targetWeight: 70 }).valid, true);
  assert.ok(calculatePersonalAiNutritionCalories({ ...baseProfile, targetWeight: 70 }) < maintenance - 120);
  assert.ok(calculatePersonalAiNutritionCalories({ ...baseProfile, targetWeight: 90 }) > maintenance - 120);
});

test("nutrition analysis has no shared FatSecret baseline dependency", async () => {
  const source = await readFile(new URL("../src/utils/aiNutritionAnalysis.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /aiNutritionBaseline/);
  assert.match(source, /Личная история питания/);
  assert.match(source, /Стартовые цели текущего пользователя/);
});

test("auth bootstrap clears client data and rejects stale account responses", async () => {
  const [bootstrapSource, effectSource] = await Promise.all([
    readFile(new URL("../src/app/appBootstrapHelpers.js", import.meta.url), "utf8"),
    readFile(new URL("../src/app/useAuthBootstrapEffect.js", import.meta.url), "utf8")
  ]);

  assert.match(bootstrapSource, /setHistory\(\[\]\);/);
  assert.match(bootstrapSource, /setPlan\(\{ workouts: \[\] \}\);/);
  assert.match(bootstrapSource, /setProfileMeasurements\(\[\]\);/);
  assert.match(bootstrapSource, /setClientProgressPhotos\(\[\]\);/);
  assert.match(effectSource, /isCurrentRun: \(\) => !disposed && runId === bootstrapRunId/);
});

test("email change keeps the active Firebase session instead of forcing a sign-out", async () => {
  const source = await readFile(
    new URL("../src/features/client/profile/profileAccountHandlers.js", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /await verifiedUser\.reload\(\)/);
  assert.doesNotMatch(source, /verifiedUser\.getIdToken\(true\)/);
  assert.match(source, /Вы остаётесь в аккаунте/);
});

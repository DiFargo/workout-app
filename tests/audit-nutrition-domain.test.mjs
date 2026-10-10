import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const cleanup = installRuntimeImports();
after(cleanup);
const {
  calculateAiNutritionBmr, calculateAiNutritionMacros, calculatePersonalAiNutritionCalories,
  calculateAiNutritionTargetCalorieAdjustment, getAiNutritionProfileValidation
} = await import("../src/utils/aiNutritionCalculations.js");
const { buildAiNutritionMonthlyPlan } = await import("../src/utils/aiNutritionPlanBuilder.js");
const { getAiNutritionCurrentWeek, getAiNutritionWeekForDate, getAiNutritionDayMacros } = await import("../src/utils/aiNutritionSchedule.js");
const { buildTrainerNutritionPlanUpdate } = await import("../src/utils/trainerNutritionPlan.js");

const profile = { weight: "120.5", targetWeight: "110.5", height: "180", age: "30", sex: "male", goal: "cut", activity: "high", trainingDays: ["wed"] };
const energy = ({ protein, fat, carbs }) => protein * 4 + fat * 9 + carbs * 4;

test("comma body metrics retain the same personal target and macros as dot decimals", () => {
  const comma = { ...profile, weight: "120,5", targetWeight: "110,5", height: "180,5" };
  const dot = { ...comma, weight: "120.5", targetWeight: "110.5", height: "180.5" };
  assert.equal(getAiNutritionProfileValidation(comma).valid, true);
  assert.equal(calculateAiNutritionBmr(comma), calculateAiNutritionBmr(dot));
  assert.equal(calculatePersonalAiNutritionCalories(comma), calculatePersonalAiNutritionCalories(dot));
  assert.equal(calculateAiNutritionTargetCalorieAdjustment(comma), -280);
  const fromComma = buildAiNutritionMonthlyPlan(undefined, comma);
  const fromDot = buildAiNutritionMonthlyPlan(undefined, dot);
  assert.deepEqual(fromComma.weeks, fromDot.weeks);
  assert.equal(fromComma.profile.targetDeltaKg, -10);
});

test("changing activity or target recalculates a lower goal instead of retaining the old plan", () => {
  const previous = buildAiNutritionMonthlyPlan(undefined, profile);
  for (const changed of [{ ...profile, activity: "low" }, { ...profile, targetWeight: "100.5" }, { ...profile, weight: "110.5", targetWeight: "100.5" }]) {
    const fresh = buildAiNutritionMonthlyPlan(undefined, changed);
    const rebuilt = buildAiNutritionMonthlyPlan(undefined, changed, [], previous);
    assert.equal(rebuilt.start.calories, fresh.start.calories);
    assert.ok(rebuilt.start.calories < previous.start.calories);
  }
  const raisedPrevious = { ...previous, start: { ...previous.start, calories: previous.start.calories + 100 } };
  assert.equal(buildAiNutritionMonthlyPlan(undefined, profile, [], raisedPrevious).start.calories, raisedPrevious.start.calories);
});

test("AI macro allocation keeps its calorie anchor and fits minimum carbs into the budget", () => {
  const heavy = { weight: "150", targetWeight: "140", height: "150", age: "65", sex: "female", activity: "low", goal: "cut" };
  const heavyPlan = buildAiNutritionMonthlyPlan(undefined, heavy);
  assert.equal(heavyPlan.start.calories, 2297);
  assert.ok(heavyPlan.start.protein < 323);
  assert.ok(heavyPlan.start.fat < 113);
  for (const goal of ["recomp", "cut", "dry", "mass", "maintain"]) {
    for (const weight of [45, 80, 150, 350]) {
      for (const calories of [1400, 1600, 2297, 3500]) {
        const macros = calculateAiNutritionMacros(calories, weight, goal);
        assert.equal(macros.calories, calories);
        assert.ok(macros.carbs >= (goal === "dry" ? 100 : 80));
        assert.ok(Math.abs(energy(macros) - calories) <= 2, JSON.stringify({ goal, weight, ...macros }));
      }
    }
    const base = calculateAiNutritionMacros(2297, 150, goal);
    const training = getAiNutritionDayMacros(base, { goal, trainingDays: ["wed"] }, new Date(2026, 9, 7, 10));
    assert.equal(training.isTrainingDay, true);
    assert.ok(Math.abs((energy(training) - energy(base)) - (training.calories - base.calories)) <= 2);
    assert.deepEqual(getAiNutritionDayMacros(base, { goal, trainingDays: ["mon"] }, new Date(2026, 9, 7, 10)), { ...base, isTrainingDay: false });
  }
});

test("explicit trainer prescriptions keep their exact requested values", () => {
  const prescribed = { calories: 2297, protein: 323, fat: 113, carbs: 80 };
  const saved = buildTrainerNutritionPlanUpdate({ planDraft: prescribed });
  assert.deepEqual(saved.goals, prescribed);
  assert.deepEqual(saved.userPatch.nutritionGoals, prescribed);
  assert.deepEqual(saved.nutritionStatePatch.goals, prescribed);
});

test("dashboard and diary select the same week at local midnight, before the creation hour", () => {
  const plan = { createdAt: new Date(2026, 8, 30, 18).toISOString(), weeks: [2727, 2702, 2677, 2677].map((calories, i) => ({ week: i + 1, calories })) };
  for (const [day, hour, expected] of [[6, 23, 1], [7, 0, 2], [7, 10, 2], [7, 18, 2], [14, 0, 3], [21, 0, 4], [29, 10, 4]]) {
    const date = new Date(2026, 9, day, hour);
    assert.equal(getAiNutritionCurrentWeek(plan, date), expected);
    assert.equal(getAiNutritionWeekForDate(plan, date), plan.weeks[expected - 1]);
  }
  assert.equal(getAiNutritionCurrentWeek(plan, new Date(2026, 8, 29)), 1);
  assert.equal(getAiNutritionCurrentWeek({ ...plan, createdAt: "bad" }, new Date()), 1);
  assert.equal(getAiNutritionWeekForDate(plan, "bad"), plan.weeks[0]);
  assert.equal(getAiNutritionWeekForDate({ weeks: [] }), null);
});

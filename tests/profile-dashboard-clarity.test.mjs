import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardEmptyWorkoutAction, getDashboardWeightPresentation, isDashboardNutritionDayKnown, runDashboardWorkoutAction } from "../src/features/client/profile/profileDashboardPresentation.js";
import { buildProfileDashboardTasks } from "../src/features/client/profile/profileDashboardTasks.js";

test("empty workout instructions distinguish trainer assignment, basic setup and deliberate mode choice", () => {
  assert.equal(getDashboardEmptyWorkoutAction("individual").state, "awaiting-trainer");
  assert.match(getDashboardEmptyWorkoutAction("individual").dateText, /тренера/);
  assert.equal(getDashboardEmptyWorkoutAction("basic").actionLabel, "Открыть базовые тренировки");
  assert.equal(getDashboardEmptyWorkoutAction("individual", true).state, "choose");
  const [task] = buildProfileDashboardTasks({ workoutState: "create", workoutMode: "individual" });
  assert.equal(task.title, "Ожидаем программу тренера");
  assert.doesNotMatch(task.note, /созда|подготовит/);
});

test("missed workout copy allows both actions provided by the destination", () => {
  const [task] = buildProfileDashboardTasks({ workoutState: "ready", workoutScheduleStatus: "missed", workoutTitle: "Ноги", workoutDate: "29 октября" });
  assert.equal(task.title, "Вернитесь к тренировке");
  assert.match(task.note, /начать сейчас или перенести/);
});

test("mode-choice task opens mode picker, other workout actions retain the existing training entry", () => {
  const calls = [];
  const actions = { openModePicker: () => calls.push("picker"), openTraining: () => calls.push("training") };
  runDashboardWorkoutAction("choose", actions);
  for (const state of ["create", "awaiting-trainer", "ready", "complete"]) runDashboardWorkoutAction(state, actions);
  assert.deepEqual(calls, ["picker", "training", "training", "training", "training"]);
});

test("weight loading, missing value, first record and actual equality remain distinct", () => {
  assert.deepEqual(getDashboardWeightPresentation({ loadState: "loading", hasLoadedData: false }), { value: "…", note: "Загружаем вес…" });
  assert.deepEqual(getDashboardWeightPresentation({ loadState: "error", hasLoadedData: false }), { value: "—", note: "Не удалось загрузить" });
  assert.equal(getDashboardWeightPresentation({ weight: 0 }).note, "Добавьте первый вес");
  assert.equal(getDashboardWeightPresentation({ weight: 93, change: 0 }).note, "Пока без сравнения");
  assert.equal(getDashboardWeightPresentation({ weight: 93, change: 0, comparisonAvailable: true }).note, "Без изменений");
  assert.equal(getDashboardWeightPresentation({ weight: 93, change: -0.5, comparisonAvailable: true, dateText: "30.10.2026" }).note, "-0,5 кг · 30.10.2026");
  assert.equal(getDashboardWeightPresentation({ weight: 93, change: 0, loadState: "error", hasLoadedData: true }).value, "93");
});

test("unknown weight and photo history never produce false first-entry tasks", () => {
  const tasks = buildProfileDashboardTasks({ weightCheckIn: { enabled: true, isDue: true, isFirst: true, ready: false },
    progressPhotoCheckIn: { enabled: true, isDue: true, isFirst: true, ready: false } });
  assert.deepEqual(tasks, []);
});

test("offline cache of yesterday does not certify a zero-calorie diary for today", () => {
  const dayKey = "2026-10-30", uid = "client";
  const args = { ready: true, dayKey, uid, nutrition: { __uid: uid, days: { "2026-10-29": { foods: [{ calories: 500 }] } } } };
  assert.equal(isDashboardNutritionDayKnown(args), false);
  assert.equal(isDashboardNutritionDayKnown({ ...args, nutrition: { __uid: uid, days: { [dayKey]: { foods: [] } } } }), false);
  assert.equal(isDashboardNutritionDayKnown({ ...args, coverage: { uid, missingDayKeys: [dayKey] } }), true);
  assert.equal(isDashboardNutritionDayKnown({ ...args, coverage: { uid, complete: true } }), true);
  assert.equal(isDashboardNutritionDayKnown({ ...args, coverage: { uid: "other", complete: true } }), false);
  assert.equal(isDashboardNutritionDayKnown({ ...args, nutrition: { __uid: uid, days: { [dayKey]: { foods: [{ calories: 500 }] } } } }), true);
  assert.equal(isDashboardNutritionDayKnown({ ...args, nutrition: { __uid: uid, days: { [dayKey]: { foods: [], updatedAt: "2026-10-30T10:00:00Z" } } } }), true);
  assert.equal(isDashboardNutritionDayKnown({ ...args, nutrition: { __uid: "other", days: { [dayKey]: { foods: [{ calories: 500 }] } } } }), false);
});

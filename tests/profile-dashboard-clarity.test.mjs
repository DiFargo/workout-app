import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardEmptyWorkoutAction, getDashboardResumeWorkoutId, getDashboardWorkoutPresentation, getDashboardWeightPresentation, isDashboardNutritionDayKnown, runDashboardWorkoutAction } from "../src/features/client/profile/profileDashboardPresentation.js";
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
  for (const state of ["create", "awaiting-trainer", "ready", "draft", "complete"]) runDashboardWorkoutAction(state, actions);
  assert.deepEqual(calls, ["picker", "training", "training", "training", "training", "training"]);
});

test("dashboard workout actions match the overview's date and completion states", () => {
  assert.deepEqual(getDashboardWorkoutPresentation({ scheduleStatus: "upcoming" }), { state: "ready", actionLabel: "Начать раньше" });
  assert.equal(getDashboardWorkoutPresentation({ scheduleStatus: "today" }).actionLabel, "Начать тренировку");
  assert.equal(getDashboardWorkoutPresentation({ scheduleStatus: "missed" }).actionLabel, "Начать сейчас");
  assert.equal(getDashboardWorkoutPresentation({ scheduleStatus: "missed", mode: "basic" }).actionLabel, "Начать тренировку");
  assert.equal(getDashboardWorkoutPresentation({ scheduleStatus: "unscheduled" }).actionLabel, "Выбрать тренировку");
  for (const scheduleStatus of ["today", "upcoming", "missed", "unscheduled"]) {
    assert.deepEqual(getDashboardWorkoutPresentation({ scheduleStatus, hasDraft: true }), { state: "draft", actionLabel: "Продолжить тренировку" });
  }
  assert.deepEqual(getDashboardWorkoutPresentation({ complete: true, hasDraft: true }), { state: "complete", actionLabel: "Посмотреть результаты" });
});

test("dashboard continuation uses only a resumable draft of an unfinished current-assignment workout", () => {
  const workouts = [{ id: "completed" }, { id: "next" }, { id: "started", assignedProgramUpdatedAt: "current" }];
  const slots = workouts.map((workout, index) => ({ workoutId: workout.id, isCompleted: index === 0 }));
  const draft = { workoutId: "started", assignmentVersion: "current", plan: { workouts: [workouts[2]] } };
  assert.equal(getDashboardResumeWorkoutId(workouts, slots, [draft], "current"), "started");
  assert.equal(getDashboardResumeWorkoutId(workouts, slots, [{ ...draft, assignmentVersion: "old" }], "current"), null);
  assert.equal(getDashboardResumeWorkoutId(workouts, slots, [{ ...draft, plan: null }], "current"), null);
  assert.equal(getDashboardResumeWorkoutId(workouts, slots, [{ ...draft, workoutId: "completed" }], "current"), null);
  assert.equal(getDashboardResumeWorkoutId(workouts, slots, [{ ...draft, workoutId: "another-plan" }], "current"), null);
  const [task] = buildProfileDashboardTasks({ workoutState: "draft", workoutTitle: "Тренировка 6", workoutScheduleStatus: "upcoming" });
  assert.equal(task.actionLabel, "Продолжить тренировку");
  assert.match(task.note, /Тренировка 6/);
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

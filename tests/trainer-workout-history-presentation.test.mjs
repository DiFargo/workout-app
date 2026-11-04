import test from "node:test";
import assert from "node:assert/strict";
import { buildTrainerWorkoutHistoryRows, filterTrainerWorkoutHistoryRows } from "../src/utils/trainerWorkoutHistoryPresentation.js";

test("history sorts newest first immutably and searches only loaded rows", () => {
  const history = [{ id: "old", workoutName: "Ноги", completedAt: "2026-05-05T12:00:00Z", programName: "Сила" },
    { id: "new", workoutName: "Верх", completedAt: "2026-10-28T12:00:00Z" }];
  const rows = buildTrainerWorkoutHistoryRows(history);
  assert.equal(rows[0].entry.id, "new");
  assert.equal(history[0].id, "old");
  assert.deepEqual(filterTrainerWorkoutHistoryRows(rows, "сила 2026").map((row) => row.entry.id), ["old"]);
  assert.deepEqual(filterTrainerWorkoutHistoryRows(rows, "05.05.2026").map((row) => row.entry.id), ["old"]);
  assert.equal(filterTrainerWorkoutHistoryRows(rows, "неизвестная").length, 0);
});

test("saved prescription uses only the history snapshot and matches renamed stable ids", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{
    id: "h", plannedSnapshot: { exercises: [{ id: "leg", name: "Разгибание ног", sets: [{ weight: 30, reps: 12 }] }] },
    plannedExercises: [{ name: "Неверный запасной план", sets: [{ reps: 99 }] }],
    exercises: [{ id: "leg", name: "Разгибание ног в тренажёре", sets: [{ completed: true, reps: 12, weight: 35 }] }]
  }]);
  assert.equal(row.hasSavedPlan, true);
  assert.equal(row.comparison[0].plannedText, "1 подх. · 30 кг × 12");
  assert.equal(row.comparison[0].actualText, "1 подх. · 35 кг × 12");
  assert.match(row.comparison[0].note, /В плане: Разгибание ног/);
  assert.deepEqual(row.unmatchedPlanNames, []);
  assert.equal(row.volumeLabel, "420 кг");
});

test("explicit false wins over stored prescription and explicit zero never falls back", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{ exercises: [
    { name: "Жим", sets: [{ completed: false, reps: 12, weight: 100 }] },
    { name: "Тяга", sets: [{ completed: true, enteredReps: 0, reps: 12, enteredWeight: 0, weight: 80 }] }
  ] }]);
  assert.equal(row.exercisesCount, 1);
  assert.equal(row.setsCount, 1);
  assert.equal(row.volumeLabel, "0 кг");
  assert.equal(row.comparison[0].actualText, "Не выполнено");
  assert.equal(row.comparison[1].actualText, "1 подх. · 0 кг × 0");
});

test("legacy unique normalized names match, ambiguous names stay unpaired without a skipped claim", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{ plannedExercises: [
    { name: "СГИБАНИЕ НОГ В ТРЕНАЖЁРЕ", sets: [{ reps: 12 }] },
    { name: "Жим", sets: [{ reps: 10 }] }, { name: "Жим", sets: [{ reps: 8 }] }
  ], exercises: [{ name: "сгибание ног в тренажере", sets: [{ reps: 12 }] }, { name: "Жим", sets: [{ reps: 10 }] }] }]);
  assert.equal(row.comparison[0].plannedText, "1 подх. · 12 повт.");
  assert.equal(row.comparison[1].plannedText, "—");
  assert.match(row.comparison[1].note, /Нет однозначного соответствия/);
  assert.deepEqual(row.unmatchedPlanNames, ["Жим", "Жим"]);
  assert.equal("skippedExercises" in row, false);
});

test("missing saved plan and feedback do not become made-up targets or a normal rating", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{ workoutName: "Тренировка", personalNote: "Личное", exercises: [{ name: "Присед", sets: [{ reps: 10 }] }] }]);
  assert.equal(row.hasSavedPlan, false);
  assert.equal(row.comparison[0].plannedText, "—");
  assert.equal(row.feedbackTitle, "");
  assert.equal(row.readinessTitle, "");
  assert.equal(row.clientComment, "");
  assert.equal(row.volumeLabel, "—");
  assert.equal(row.dateLabel, "Дата не указана");
  const [unknown] = buildTrainerWorkoutHistoryRows([{ exercises: [{ name: "Без данных", sets: [{}] }] }]);
  assert.equal(unknown.comparison[0].actualText, "—");
  assert.equal(unknown.comparison[0].note, "");
});

test("post-workout feedback and readiness remain separate, duration sets stay meaningful", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{ durationSeconds: 1200, postWorkoutFeedback: { title: "Тяжело" }, readiness: { title: "Полон сил" }, clientComment: "Снизил вес",
    plannedSnapshot: { exercises: [{ id: "p", name: "Планка", sets: [{ durationSeconds: 60 }] }] },
    exercises: [{ id: "p", name: "Планка", sets: [{ completed: true, durationSeconds: 45 }] }] }]);
  assert.equal(row.feedbackTitle, "Тяжело");
  assert.equal(row.readinessTitle, "Полон сил");
  assert.equal(row.clientComment, "Снизил вес");
  assert.equal(row.comparison[0].plannedText, "1 подх. · 60 с");
  assert.equal(row.comparison[0].actualText, "1 подх. · 45 с");
  assert.equal(row.summary, "20 мин · 1 упражнение · 1 подход");
  assert.equal(row.volumeLabel, "—");
});

test("all actual exercises remain visible even when a saved plan cannot be matched", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{ plannedSnapshot: { exercises: [{ name: "Махи вперёд", sets: [{ reps: 12 }] }] },
    exercises: [{ name: "Махи в стороны", sets: [{ reps: 12, weight: 10 }] }, { name: "Тяга", sets: [{ reps: 10, weight: 50 }] }] }]);
  assert.equal(row.comparison.length, 2);
  assert.deepEqual(row.unmatchedPlanNames, ["Махи вперёд"]);
  assert.equal(row.exercisesCount, 2);
  assert.equal(row.setsCount, 2);
});

test("actual set numbers survive unfinished gaps even for identical completed values", () => {
  const [row] = buildTrainerWorkoutHistoryRows([{ exercises: [
    { name: "Жим", sets: [{ set: 1, completed: false, weight: 50, reps: 12 },
      { set: 2, completed: true, weight: 50, reps: 12 }, { set: 3, completed: true, weight: 50, reps: 12 }] },
    { name: "Тяга", sets: [{ completed: true, weight: 30, reps: 12 }, null,
      { completed: true, weight: 35, reps: 10 }] },
    { name: "Присед", completedSets: [{ set: 2, completed: true, weight: 40, reps: 12 },
      { set: 3, completed: true, weight: 40, reps: 12 }] }
  ] }]);
  assert.equal(row.comparison[0].actualText, "2: 50 кг × 12; 3: 50 кг × 12");
  assert.equal(row.comparison[1].actualText, "1: 30 кг × 12; 3: 35 кг × 10");
  assert.equal(row.comparison[2].actualText, "2: 40 кг × 12; 3: 40 кг × 12");
  assert.equal(row.setsCount, 6);
});

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const cleanupImports = installRuntimeImports();
after(cleanupImports);
const { buildWorkoutRunStageModel } = await import("../src/features/client/workouts/workoutRunStageModel.js");

const finishedAt = Date.parse("2026-10-24T10:30:00.000Z");
const exercises = Array.from({ length: 7 }, (_, index) => ({
  id: `exercise-${index + 1}`,
  name: `Упражнение ${index + 1}`,
  sets: [{ reps: 10, weight: 20 }, { reps: 10, weight: 20 }]
}));
const workout = { id: "day-1", name: "День 1", exercises };
const completedExercises = exercises.map(exercise => ({
  ...exercise,
  sets: exercise.sets.map(set => ({ ...set, completed: true }))
}));
const savedResult = {
  workoutId: workout.id,
  finishedAt: new Date(finishedAt).toISOString(),
  date: new Date(finishedAt).toISOString(),
  exercises: completedExercises
};

function model(overrides = {}) {
  return buildWorkoutRunStageModel({
    currentExerciseIndex: exercises.length + 1,
    history: [savedResult],
    isWorkoutSaved: true,
    normalizeExercise: exercise => exercise,
    openVideoId: null,
    plan: { workouts: [workout] },
    workout,
    workoutDurationText: "30 мин",
    workoutFinishedAt: finishedAt,
    workoutHistorySyncState: "synced",
    workoutStarted: true,
    ...overrides
  });
}

test("saved finish summary retains all seven completed exercises after the server plan refresh", () => {
  const result = model();
  assert.equal(result.completedExercisesCount, 7);
  assert.deepEqual(result.incompleteExerciseNames, []);
  assert.equal(result.finishStats.find(stat => stat.label === "Подходы").value, 14);
  assert.equal(result.finishStats.find(stat => stat.label === "Объём").value.replace(/\s/g, ""), "2800кг");
  assert.doesNotMatch(result.finishAdviceText, /заполни вес и повторы/);
  assert.equal(workout.exercises[0].sets[0].completed, undefined, "The refreshed prescription stays untouched");
});

test("local saved history and partial completions use actual saved sets without inventing completed exercises", () => {
  const partialExercises = completedExercises.map((exercise, index) => ({
    ...exercise,
    sets: exercise.sets.map(set => ({ ...set, completed: index < 3 }))
  }));
  const result = model({
    history: [{ ...savedResult, exercises: partialExercises, pendingSync: true }],
    workoutHistorySyncState: "local"
  });
  assert.equal(result.completedExercisesCount, 3);
  assert.equal(result.incompleteExerciseNames.length, 4);
  assert.equal(result.finishStats.find(stat => stat.label === "Подходы").value, 6);
  assert.match(result.finishSyncText, /Сохранено на устройстве/);
});

test("an unsaved or missing current-session result never borrows completion from another run", () => {
  const otherResults = [
    { ...savedResult, finishedAt: new Date(finishedAt - 60000).toISOString() },
    { ...savedResult, workoutId: "day-2" }
  ];
  assert.equal(model({ history: otherResults }).completedExercisesCount, 0);
  assert.equal(model({ isWorkoutSaved: false }).completedExercisesCount, 0);
  assert.equal(model({ workoutFinishedAt: null }).completedExercisesCount, 0);
});

test("the live completed result remains available before save and when history is not yet loaded", () => {
  const completedWorkout = { ...workout, exercises: completedExercises };
  for (const isWorkoutSaved of [false, true]) {
    const result = model({ workout: completedWorkout, history: [], isWorkoutSaved });
    assert.equal(result.completedExercisesCount, 7);
    assert.doesNotMatch(result.finishAdviceText, /заполни вес и повторы/);
  }
});

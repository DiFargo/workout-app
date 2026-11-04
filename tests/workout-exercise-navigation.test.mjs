import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkoutExercisePickerItems } from "../src/utils/workoutExerciseNavigation.js";
import { getWorkoutExecutionSteps } from "../src/utils/workoutPlanNormalization.js";

test("выбор упражнения не меняет подходы и показывает их настоящий статус", () => {
  const workout = { exercises: [{ id: "a", name: "Первое", sets: [{ completed: true }, {}] },
    { id: "b", name: "Второе", sets: [{}] }, { id: "c", name: "Третье", sets: [{ completed: true }] }] };
  const copy = structuredClone(workout);
  const rows = buildWorkoutExercisePickerItems(workout, getWorkoutExecutionSteps(workout), 2);
  assert.deepEqual(rows.map(row => [row.stepIndex, row.current, row.status]), [[1, false, "partial"], [2, true, "pending"], [3, false, "completed"]]);
  assert.deepEqual(workout, copy);
});

test("суперсет имеет по одной строке на упражнение и выбирает незавершённый круг", () => {
  const group = { id: "g", type: "group", groupMode: "superset", rounds: 3, exerciseIds: ["a", "b"] };
  const workout = { taskBlocks: [group], exercises: ["a", "b"].map(id => ({ id, name: id,
    taskBlockType: "group", taskBlockId: "g", taskBlockConfig: group,
    sets: [{ completed: true }, {}, {}] })) };
  const steps = getWorkoutExecutionSteps(workout);
  const rows = buildWorkoutExercisePickerItems(workout, steps, 4);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.stepIndex, row.current]), [[3, false], [4, true]]);
  assert.match(rows[0].detail, /круг 2 из 3/);
});

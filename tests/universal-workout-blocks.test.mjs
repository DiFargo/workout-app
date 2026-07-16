import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExecutableWorkout,
  createWorkoutTaskBlock,
  moveExerciseToTaskBlock,
  normalizeWorkoutTaskBlocks,
  WORKOUT_BLOCK_TYPES
} from "../src/utils/universalWorkoutBlocks.js";

test("legacy flat workouts receive compatible exercise blocks", () => {
  const workout = normalizeWorkoutTaskBlocks({
    id: "day_1",
    exercises: [{ id: "bench", name: "Bench", sets: [{ reps: 10, weight: 50 }] }]
  });
  assert.equal(workout.workoutBlockSchemaVersion, 1);
  assert.equal(workout.taskBlocks.length, 1);
  assert.equal(workout.taskBlocks[0].type, "exercise");
  assert.deepEqual(workout.taskBlocks[0].exerciseIds, ["bench"]);
  assert.equal(workout.exercises[0].sets[0].weight, 50);
});

test("executable workouts keep group order and expose interval and instruction steps", () => {
  const executable = buildExecutableWorkout({
    id: "day_3",
    exercises: [{ id: "row", name: "Row", sets: [] }, { id: "press", name: "Press", sets: [] }],
    taskBlocks: [
      createWorkoutTaskBlock("group", { id: "pair", exerciseIds: ["press", "row"], rounds: 4 }),
      createWorkoutTaskBlock("interval", { id: "run", rounds: 6, workTime: "30 sec", restTime: "15 sec" }),
      createWorkoutTaskBlock("free", { id: "coach", instruction: "Stop at technical failure" })
    ]
  });

  assert.deepEqual(executable.exercises.map((exercise) => exercise.id), ["press", "row", "day_3_run", "day_3_coach"]);
  assert.equal(executable.exercises[0].taskBlockType, "group");
  assert.equal(executable.exercises[2].taskBlockConfig.rounds, 6);
  assert.equal(executable.exercises[3].instruction, "Stop at technical failure");
});

test("group, interval and free blocks preserve their universal configuration", () => {
  const workout = normalizeWorkoutTaskBlocks({
    id: "day_2",
    exercises: [{ id: "a1" }, { id: "a2" }],
    taskBlocks: [
      createWorkoutTaskBlock("group", { id: "group", exerciseIds: ["a1", "a2"], groupMode: "superset", rounds: 4 }),
      createWorkoutTaskBlock("interval", { id: "interval", rounds: 8, workTime: "40 сек", restTime: "20 сек" }),
      createWorkoutTaskBlock("free", { id: "free", instruction: "До технического отказа" })
    ]
  });
  assert.equal(workout.taskBlocks[0].rounds, 4);
  assert.equal(workout.taskBlocks[1].workTime, "40 сек");
  assert.equal(workout.taskBlocks[2].instruction, "До технического отказа");
});

test("moving an exercise between blocks does not duplicate it", () => {
  const blocks = [
    createWorkoutTaskBlock(WORKOUT_BLOCK_TYPES.EXERCISE, { id: "single", exerciseIds: ["bench"] }),
    createWorkoutTaskBlock(WORKOUT_BLOCK_TYPES.GROUP, { id: "superset", exerciseIds: ["row"] })
  ];
  const moved = moveExerciseToTaskBlock(blocks, "bench", "superset");
  assert.equal(moved.length, 1);
  assert.deepEqual(moved[0].exerciseIds, ["row", "bench"]);
});

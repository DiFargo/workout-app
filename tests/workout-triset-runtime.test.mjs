import assert from "node:assert/strict";
import test from "node:test";

import {
  getWorkoutExecutionSteps,
  normalizeExercise
} from "../src/utils/workoutPlanNormalization.js";

function createTrisetWorkout() {
  const block = {
    id: "triset-1",
    type: "group",
    groupMode: "triset",
    rounds: 2,
    restAfterRound: "75 сек",
    exerciseIds: ["a1", "a2", "a3"]
  };

  return {
    id: "workout-1",
    taskBlocks: [block],
    exercises: block.exerciseIds.map((id, index) => ({
      id,
      name: `Упражнение ${index + 1}`,
      taskBlockId: block.id,
      taskBlockType: "group",
      taskBlockConfig: block,
      taskBlockExerciseIndex: index,
      taskBlockExerciseCount: block.exerciseIds.length,
      sets: [{ reps: 10, weight: "20" }]
    }))
  };
}

test("triset executes one set from each exercise before the next round", () => {
  const workout = createTrisetWorkout();
  const steps = getWorkoutExecutionSteps(workout);

  assert.deepEqual(
    steps.map((step) => [step.exerciseId, step.setIndex]),
    [
      ["a1", 0], ["a2", 0], ["a3", 0],
      ["a1", 1], ["a2", 1], ["a3", 1]
    ]
  );
  assert.equal(normalizeExercise(workout.exercises[0]).sets.length, 2);
});

test("ordinary exercises stay on their usual multi-set execution step", () => {
  const steps = getWorkoutExecutionSteps({
    exercises: [{ id: "ordinary", name: "Присед", sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] }]
  });

  assert.deepEqual(steps, [{
    exerciseId: "ordinary",
    exerciseIndex: 0,
    setIndex: null,
    group: null
  }]);
});

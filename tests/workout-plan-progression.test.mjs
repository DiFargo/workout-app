import test from "node:test";
import assert from "node:assert/strict";

import { applyWorkoutProgressionToFuturePlan } from "../src/features/client/workouts/workoutPlanUpdateHandlers.js";

test("completed edited set weights are copied to future matching workouts", () => {
  const plan = {
    workouts: [
      {
        id: "day-1",
        exercises: [
          {
            name: "Жим лежа",
            sets: [
              { weight: "40", enteredWeight: "45", completed: true },
              { weight: "40", enteredWeight: "47.5", completed: true },
              { weight: "40", enteredWeight: "50", completed: true }
            ]
          }
        ]
      },
      {
        id: "day-2",
        exercises: [
          {
            name: "Жим лежа",
            sets: [
              { weight: "40" },
              { weight: "40" },
              { weight: "40" }
            ]
          }
        ]
      }
    ]
  };

  const result = applyWorkoutProgressionToFuturePlan(plan, plan.workouts[0], {
    updatedAt: "2026-06-24T00:00:00.000Z"
  });

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.plan.workouts[1].exercises[0].sets.map((set) => set.weight),
    ["45", "47.5", "50"]
  );
  assert.equal(result.plan.workouts[0].exercises[0].sets[0].weight, "40");
});

test("uncompleted edited sets do not change future workouts", () => {
  const plan = {
    workouts: [
      {
        id: "day-1",
        exercises: [
          {
            name: "Тяга",
            sets: [{ weight: "60", enteredWeight: "70", completed: false }]
          }
        ]
      },
      {
        id: "day-2",
        exercises: [
          {
            name: "Тяга",
            sets: [{ weight: "60" }]
          }
        ]
      }
    ]
  };

  const result = applyWorkoutProgressionToFuturePlan(plan, plan.workouts[0]);

  assert.equal(result.changed, false);
  assert.equal(result.plan.workouts[1].exercises[0].sets[0].weight, "60");
});

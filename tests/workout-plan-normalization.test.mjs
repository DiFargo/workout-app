import test from "node:test";
import assert from "node:assert/strict";

import { buildClientWorkoutsFromTemplate } from "../src/utils/workoutPlanNormalization.js";

test("client workouts are built from structured template weeks", () => {
  const workouts = buildClientWorkoutsFromTemplate({
    months: [
      {
        microcycles: [
          {
            weeks: [
              {
                workouts: [
                  {
                    id: "w1",
                    name: "День A",
                    order: 1,
                    exercises: [{ id: "e1", name: "Пресс" }]
                  },
                  {
                    id: "w2",
                    name: "День B",
                    sortOrder: 2,
                    exercises: [{ id: "e2", name: "Жим гантелей", sets: [{ reps: 10, weight: 12 }] }]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(workouts.length, 2);
  assert.equal(workouts[0].name, "День A");
  assert.equal(workouts[0].exercises[0].requiresWeight, false);
  assert.deepEqual(workouts[0].exercises[0].sets, [{ reps: 15, weight: "" }]);
  assert.equal(workouts[1].sortOrder, 2);
  assert.equal(workouts[1].exercises[0].requiresWeight, true);
  assert.deepEqual(workouts[1].exercises[0].sets, [{ reps: 10, weight: "12" }]);
});

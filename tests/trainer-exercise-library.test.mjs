import test from "node:test";
import assert from "node:assert/strict";

import { buildTrainerExerciseLibraryItems } from "../src/utils/trainerExerciseLibrary.js";

test("trainer exercise library merges current plan and templates", () => {
  const items = buildTrainerExerciseLibraryItems({
    workouts: [
      {
        exercises: [
          { id: "plan-press", name: "Жим лёжа", sets: [] },
          { id: "plan-row", name: "Тяга блока", video: "/row.mp4" }
        ]
      }
    ]
  }, [
    {
      workouts: [
        {
          exercises: [
            { id: "template-press", name: "Жим лежа", video: "/press.mp4" }
          ]
        }
      ],
      blocks: [
        {
          weeks: [
            {
              workouts: [
                { exercises: [{ id: "template-squat", name: "Присед", videoUrl: "/squat.mp4" }] }
              ]
            }
          ]
        }
      ]
    }
  ]);

  assert.deepEqual(items.map((item) => item.id), ["template-press", "plan-row", "template-squat"]);
  assert.equal(items[0].video, "/press.mp4");
});

test("trainer exercise library reads month microcycle templates", () => {
  const items = buildTrainerExerciseLibraryItems({}, [
    {
      months: [
        {
          microcycles: [
            {
              weeks: [
                {
                  workouts: [
                    { exercises: [{ id: "deadlift", name: "Становая тяга", videoURL: "/deadlift.mp4" }] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "deadlift");
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerExerciseLibraryItems,
  patchExerciseInTrainerTemplate
} from "../src/utils/trainerExerciseLibrary.js";

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
  assert.deepEqual(items[0].librarySource, { type: "template", templateId: "" });
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

test("template library exercises can be patched without changing sibling exercises", () => {
  const template = {
    id: "template-1",
    workouts: [{ exercises: [
      { id: "press", name: "Жим", sets: [{ reps: 10 }] },
      { id: "row", name: "Тяга", sets: [{ reps: 12 }] }
    ] }]
  };

  const updated = patchExerciseInTrainerTemplate(template, "press", { name: "Жим лёжа" });

  assert.equal(updated.workouts[0].exercises[0].name, "Жим лёжа");
  assert.equal(updated.workouts[0].exercises[1].name, "Тяга");
  assert.equal(template.workouts[0].exercises[0].name, "Жим");
});

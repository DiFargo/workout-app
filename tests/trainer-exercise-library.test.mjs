import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerExerciseLibraryItems,
  mergeTrainerExerciseLibraryItems,
  patchExerciseInTrainerTemplate
} from "../src/utils/trainerExerciseLibrary.js";
import { exerciseLibraryNameKey } from "../functions/exerciseLibraryIdentity.js";
import { findExerciseLibraryMatch } from "../src/utils/auditSafety.js";

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

test("reviewed duplicate names prefer the filmed source, without modifying programmes", () => {
  const pairs = [
    ["Приседания с гантелью", "Присед с гантелью"],
    ["Жим гантелей лёжа", "Жим лёжа с гантелями"],
    ["Сгибание рук на скамье Скотта в тренажёре", "Сгибание рук в тренажере Скотта"],
    ["Отведение рук с гантелями сидя на скамье в наклоне", "Отведение рук с гантелями сидя в наклоне"],
    ["Разгибание рук в кроссовере с косичкой через рога", "Разгибание рук в кроссовере через рога с косичкой"],
    ["Шаги альпиниста", "Пресс Шаги альпиниста"],
    ["Пресс Скручивания", "Скручивания на пресс"],
    ["Горизонтальная тяга блока", "Тяга нижнего блока"],
    ["Жим в тренажёре на грудь", "Жим сидя в тренажёре на грудь"]
  ];
  for (const [emptyName, filmedName] of pairs) {
    const empty = { id: "empty", name: emptyName, sets: [{ reps: 12, weight: 30 }], muscleGroup: "saved", sourceWorkoutId: "client-day" };
    const filmed = { id: "filmed", name: filmedName, videoUrl: "demo.mp4", sets: [{ reps: 8 }], librarySource: { type: "template", templateId: "owned" } };
    const before = structuredClone([empty, filmed]);
    for (const input of [[empty, filmed], [filmed, empty]]) {
      const library = mergeTrainerExerciseLibraryItems(input);
      assert.equal(library.length, 1, emptyName);
      assert.equal(library[0].id, "filmed");
      assert.equal(library[0].videoUrl, "demo.mp4");
      assert.equal(library[0].sourceWorkoutId, undefined);
      assert.deepEqual(library[0].librarySource, filmed.librarySource);
      assert.deepEqual(library[0].sets, filmed.sets);
      assert.equal(library[0].muscleGroup, "saved");
      assert.equal(findExerciseLibraryMatch(library, emptyName)?.id, "filmed");
    }
    assert.deepEqual([empty, filmed], before);
  }
});

test("different videos stay separate even for identical names and IDs", () => {
  const first = { id: "shared", name: "Разведения гантелей в стороны", video: "first.mp4", librarySource: { type: "template", templateId: "first" } };
  const second = { ...first, name: "Отведение рук с гантелями", video: "second.mp4", librarySource: { type: "template", templateId: "second" } };
  const library = mergeTrainerExerciseLibraryItems([{ id: "empty", name: first.name }, first, second, { ...first }]);
  assert.deepEqual(library, [first, second]);
  assert.equal(findExerciseLibraryMatch(library, first.name), null);
  assert.deepEqual(mergeTrainerExerciseLibraryItems(library), library);
});

test("different equipment, posture, grip and angles never merge", () => {
  const names = ["Жим лёжа с гантелями", "Жим лёжа со штангой", "Жим лёжа с гантелями на наклонной скамье",
    "Отведение рук с гантелями стоя в наклоне", "Отведение рук с гантелями сидя в наклоне",
    "Тяга верхнего блока", "Тяга верхнего блока обратным хватом", "Тяга верхнего блока узким хватом",
    "Разгибание рук в кроссовере с косичкой", "Разгибание рук в кроссовере с косичкой над головой"];
  assert.equal(mergeTrainerExerciseLibraryItems(names.map((name) => ({ name }))).length, names.length);
  assert.equal(exerciseLibraryNameKey(' Свидение рук в тренажёре «бабочка» '), exerciseLibraryNameKey("Сведение рук в тренажере бабочка"));
});

test("workspace resolves editable source without mixing a template video with a client ID", () => {
  const item = { id: "local", name: "Жим ногами", video: "" };
  const sourced = { ...item, sourceWorkoutId: "day", librarySource: { type: "plan", workoutId: "day" } };
  assert.deepEqual(mergeTrainerExerciseLibraryItems([item, sourced]), [sourced]);
  const template = { id: "video-id", name: item.name, video: "video.mp4", librarySource: { type: "template", templateId: "template" } };
  assert.deepEqual(mergeTrainerExerciseLibraryItems([template, sourced]), [template]);
});

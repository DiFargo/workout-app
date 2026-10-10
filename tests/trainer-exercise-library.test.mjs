import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerExerciseLibraryItems,
  mergeTrainerExerciseLibraryItems,
  patchExerciseInTrainerTemplate
} from "../src/utils/trainerExerciseLibrary.js";
import { exerciseLibraryNameKey } from "../functions/exerciseLibraryIdentity.js";
import { findExerciseLibraryMatch } from "../src/utils/auditSafety.js";
import { exerciseCardLegacyKey } from "../functions/exerciseCards.js";

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

const libraryTemplate = (exercises, ownerUid = "trainer") => ({
  id: `template-${ownerUid}`, ownerUid, workouts: [{ id: "day", exercises }]
});
const libraryCard = (name, patch = {}) => ({
  id: "saved-card", ownerUid: "trainer", name, video: "/demo.mp4", technique: "",
  revision: 2, updatedAt: "2026-09-19T07:00:00.000Z", ...patch
});

test("card-backed library suppresses blank legacy copies for every movement and preserves the editable source", () => {
  const names = ["Отведение рук с гантелями сидя в наклоне", "Отведение рук с гантелями стоя в наклоне", "Жим ногами", "Скручивания на пресс"];
  const cards = names.map((name, index) => libraryCard(name, { id: `card-${index}`, video: `/demo-${index}.mp4` }));
  const templates = [libraryTemplate(names.flatMap((name, index) => [
    { id: `blank-${index}`, name, video: "", sets: [{ reps: 12, weight: 20 }] },
    { id: `filmed-${index}`, name, video: `/demo-${index}.mp4`, sets: [{ reps: 8, weight: 30 }] }
  ]))];
  const before = structuredClone({ cards, templates });
  const items = buildTrainerExerciseLibraryItems({}, templates, { cards });
  assert.deepEqual(items.map(item => item.exerciseCardId), cards.map(card => card.id));
  for (const item of items) {
    assert.deepEqual(item.librarySource, { type: "card", ownerUid: "trainer" });
    assert.equal("sets" in item, false);
    assert.equal(item.revision, 2);
  }
  assert.deepEqual(mergeTrainerExerciseLibraryItems(items), items, "workspace's second pass must stay stable");
  assert.deepEqual({ cards, templates }, before);
});

test("card-enabled consumers still deduplicate legacy items before any shared card has been saved", () => {
  const template = libraryTemplate([
    { id: "blank", name: "Жим гантелей лёжа", video: "" },
    { id: "filmed", name: "Жим лёжа с гантелями", video: "/press.mp4" }
  ]);
  const items = buildTrainerExerciseLibraryItems({}, [template], { cards: [] });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "filmed");
  assert.equal(items[0].librarySource.templateId, template.id);
});

test("new shared video supersedes an old copy but preserves techniques, positions and owners", () => {
  const name = "Отведение рук с гантелями сидя в наклоне";
  const card = libraryCard(name);
  const otherCard = libraryCard(name, { id: "other-owner", ownerUid: "other" });
  const otherPosition = libraryCard("Отведение рук с гантелями стоя в наклоне", { id: "standing" });
  const techniques = libraryTemplate([
    { id: "different-video", name, video: "/second.mp4" },
    { id: "different-technique", name, video: "/demo.mp4", technique: "Другая техника выполнения" },
    { id: "blank", name, video: "" }
  ]);
  const items = buildTrainerExerciseLibraryItems({}, [techniques], { cards: [card, otherCard, otherPosition] });
  assert.equal(items.length, 4);
  assert.ok(!items.some(item => item.id === "different-video"));
  assert.ok(items.some(item => item.id === "different-technique"));
  assert.ok(items.some(item => item.id === "other-owner"));
  assert.ok(items.some(item => item.id === "standing"));
});

test("shared-card deletion does not resurrect legacy filmed or empty copies and restoration stays unique", () => {
  const blank = { id: "blank", name: "Жим ногами", video: "" };
  const filmed = { id: "filmed", name: blank.name, video: "/demo.mp4" };
  const templates = [libraryTemplate([blank, filmed])];
  const deleted = libraryCard(blank.name, { deletedAt: "2026-09-19", legacyKeys: [exerciseCardLegacyKey(filmed)] });
  assert.equal(buildTrainerExerciseLibraryItems({}, templates, { cards: [deleted] }).length, 0);
  const archived = buildTrainerExerciseLibraryItems({}, templates, { cards: [deleted], includeDeleted: true });
  assert.equal(archived.length, 1);
  assert.equal(archived[0].exerciseCardId, deleted.id);
  const restored = buildTrainerExerciseLibraryItems({}, templates, { cards: [{ ...deleted, deletedAt: "" }] });
  assert.equal(restored.length, 1);
  assert.equal(restored[0].exerciseCardId, deleted.id);
});

test("identical shared cards use the most recently edited source consistently, including its deletion", () => {
  const old = libraryCard("Жим ногами", { id: "old", updatedAt: "2026-09-18T07:00:00.000Z" });
  const latest = libraryCard("Жим ногами", { id: "latest" });
  for (const cards of [[old, latest], [latest, old]]) {
    const items = buildTrainerExerciseLibraryItems({}, [], { cards });
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "latest");
  }
  assert.equal(buildTrainerExerciseLibraryItems({}, [], { cards: [old, { ...latest, deletedAt: "2026-09-19" }] }).length, 0);
});

test("same-named empty copies with different explicit techniques or owners never disappear", () => {
  const name = "Жим ногами";
  const templates = [libraryTemplate([
    { id: "different-instructions", name, video: "", technique: "Особая техника" }
  ]), libraryTemplate([{ id: "foreign-blank", name, video: "" }], "other")];
  assert.equal(buildTrainerExerciseLibraryItems({}, templates, { cards: [libraryCard(name)] }).length, 3);
});

test("old empty and filmed copies stay hidden after the shared card is renamed, re-filmed or its technique is updated", () => {
  const original = { id: "source", name: "Отведение рук с гантелями сидя в наклоне", video: "/old.mp4", technique: "" };
  const card = libraryCard("Обновлённое отведение рук сидя", {
    video: "/new.mp4", technique: "Новая техника", legacyKeys: [exerciseCardLegacyKey(original), "invalid old key"]
  });
  const templates = [libraryTemplate([original, { ...original, id: "blank", video: "" },
    { ...original, id: "different-technique", video: "", technique: "Иная техника" },
    { ...original, id: "different-video", video: "/private.mp4" }
  ])];
  const items = buildTrainerExerciseLibraryItems({}, templates, { cards: [card] });
  assert.deepEqual(items.map(item => item.id), [card.id, "different-technique"]);
  const deleted = buildTrainerExerciseLibraryItems({}, templates, { cards: [{ ...card, deletedAt: "2026-09-19" }] });
  assert.deepEqual(deleted.map(item => item.id), ["different-technique", "different-video"]);
});

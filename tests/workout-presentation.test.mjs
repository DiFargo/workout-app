import test from "node:test";
import assert from "node:assert/strict";

import {
  getWorkoutPresentation,
  getWorkoutPresentationImage,
  getWorkoutPresentationTitle,
  WORKOUT_MENU_ITEMS
} from "../src/domain/workoutPresentation.js";

test("workout presentation title prefers explicit workout name segment", () => {
  assert.equal(
    getWorkoutPresentationTitle({ name: "Неделя 1 · День 2 · Спина + плечи" }, 2),
    "Спина и плечи"
  );
});

test("workout presentation title falls back to detected exercise groups", () => {
  assert.equal(
    getWorkoutPresentationTitle({
      exercises: [
        { name: "Жим лежа" },
        { name: "Разгибание рук" }
      ]
    }, 1),
    "Грудь и руки"
  );
});

test("workout presentation image prefers direct image and then fallback groups", () => {
  assert.equal(
    getWorkoutPresentationImage({ image: "/custom.png" }, "Спина"),
    "/custom.png"
  );

  assert.equal(
    getWorkoutPresentationImage({ image: "/workout-covers/1arms.webp" }, "Руки"),
    "/workout-covers/arms.webp"
  );

  assert.equal(
    getWorkoutPresentationImage({ exercises: [{ name: "Тяга нижнего блока" }] }, "Спина"),
    WORKOUT_MENU_ITEMS[0].image
  );
});

test("workout presentation builds stable day metadata and counters", () => {
  const presentation = getWorkoutPresentation({
    id: "week_2_day_3",
    name: "Неделя 2 · День 3 · Грудь + руки",
    trainerNote: "Работаем спокойно.",
    exercises: [
      { name: "Жим лежа", sets: [{ reps: 10 }, { reps: 10 }] },
      { name: "Разгибание рук", sets: [{ reps: 12 }] }
    ]
  });

  assert.equal(presentation.day, "Неделя 2 · День 3");
  assert.equal(presentation.title, "Грудь и руки");
  assert.equal(presentation.trainerTip, "Работаем спокойно.");
  assert.equal(presentation.exerciseCount, 2);
  assert.equal(presentation.setCount, 3);
  assert.equal(presentation.image, WORKOUT_MENU_ITEMS[1].image);
});

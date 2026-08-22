import assert from "node:assert/strict";
import test from "node:test";

import {
  getBasicWorkoutCompositionIssues,
  orderBasicWorkoutExercises
} from "../functions/basicWorkoutPlanOrder.js";

test("basic workout order puts a compound leg movement first and core last", () => {
  const ordered = orderBasicWorkoutExercises([
    { name: "Жим от груди в тренажёре" },
    { name: "Разгибание рук с канатом" },
    { name: "Жим ногами" },
    { name: "Скручивания лёжа" },
    { name: "Разгибание ног в тренажёре" }
  ]);

  assert.deepEqual(ordered.map((exercise) => exercise.name), [
    "Жим ногами",
    "Жим от груди в тренажёре",
    "Разгибание ног в тренажёре",
    "Разгибание рук с канатом",
    "Скручивания лёжа"
  ]);
});

test("basic workout order starts with a compound upper-body movement when legs are isolated only", () => {
  const ordered = orderBasicWorkoutExercises([
    { name: "Сгибание рук с гантелями" },
    { name: "Разгибание ног в тренажёре" },
    { name: "Тяга верхнего блока" },
    { name: "Планка" }
  ]);

  assert.deepEqual(ordered.map((exercise) => exercise.name), [
    "Тяга верхнего блока",
    "Разгибание ног в тренажёре",
    "Сгибание рук с гантелями",
    "Планка"
  ]);
});

test("basic workout composition rejects duplicate primary patterns and duplicate core work", () => {
  const issues = getBasicWorkoutCompositionIssues([
    { name: "Гоблет-присед с гантелью" },
    { name: "Жим гантелей лёжа" },
    { name: "Жим от груди в тренажёре" },
    { name: "Жим ногами" },
    { name: "Разгибание гантели из-за головы" },
    { name: "Скручивания лёжа" },
    { name: "Планка" }
  ]);

  assert.deepEqual(issues, [
    "двух упражнений на кор",
    "двух похожих базовых упражнений на квадрицепс",
    "двух жимов на грудь"
  ]);
});

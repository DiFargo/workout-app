import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerLibraryMuscle } from "../src/utils/trainerLibraryMuscleGroups.js";

test("personal library groups known exercises and preserves unclassified ones", () => {
  for (const [name, group] of [["Жим ногами", "legs"], ["Тяга верхнего блока", "back"], ["Жим лёжа с гантелями", "chest"], ["Пресс", "core"], ["Моё новое упражнение", "other"]]) {
    assert.equal(getTrainerLibraryMuscle({ name }), group);
  }
  assert.equal(getTrainerLibraryMuscle({ name: "Своё движение", muscleGroup: "biceps" }), "biceps");
});

test("all six ungrouped exercises observed in the trainer library are classified", () => {
  for (const [name, group] of [
    ["Подъём гантелей вперёд", "shoulders"], ["Шаги альпиниста", "core"],
    ["Свеление рук с гантелями на наклонной скамье", "chest"], ["Жим одной ногой", "legs"],
    ["Разведение ног в тренажере", "legs"], ["Сведение ног в тренажере", "legs"]
  ]) assert.equal(getTrainerLibraryMuscle({ name }), group, name);
});

test("manual group wins and shoulder variations are not mistaken for chest flyes", () => {
  assert.equal(getTrainerLibraryMuscle({ name: "Тяга блока", muscleGroup: "Трицепс" }), "triceps");
  assert.equal(getTrainerLibraryMuscle({ name: "Жим ногами", muscleGroup: "other" }), "other");
  assert.equal(getTrainerLibraryMuscle({ name: "Новое упражнение", muscleGroup: "shoulders" }), "shoulders");
  assert.equal(getTrainerLibraryMuscle({ name: "Тяга", muscleGroup: "Задняя поверхность бедра" }), "legs");
  for (const name of ["Отведение рук с гантелями сидя в наклоне", "Отведение рук с гантелями стоя в наклоне", "Разведения гантелей в стороны"])
    assert.equal(getTrainerLibraryMuscle({ name }), "shoulders", name);
  assert.equal(getTrainerLibraryMuscle({ name: "Сведение рук с гантелями лёжа" }), "chest");
});

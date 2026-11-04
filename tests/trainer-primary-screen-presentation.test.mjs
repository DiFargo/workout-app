import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerListProgressScore, getTrainerListStatusLabel } from "../src/utils/trainerPrimaryScreenPresentation.js";

test("unknown progress scores stay unknown, while a real zero is preserved", () => {
  for (const value of [null, undefined, "", "  ", false, true, NaN, Infinity, "неизвестно"]) {
    assert.equal(getTrainerListProgressScore(value), null);
  }
  assert.equal(getTrainerListProgressScore(0), 0);
  assert.equal(getTrainerListProgressScore("0"), 0);
  assert.equal(getTrainerListProgressScore(87.6), 88);
  assert.equal(getTrainerListProgressScore(-1), 0);
  assert.equal(getTrainerListProgressScore(101), 100);
});

test("client row labels describe state rather than promising a different navigation action", () => {
  assert.equal(getTrainerListStatusLabel({ id: "active" }), "Без сигналов");
  assert.equal(getTrainerListStatusLabel({ id: "noProgram" }), "Без программы");
  assert.equal(getTrainerListStatusLabel({ id: "taskAssigned" }), "Задача у клиента");
  assert.equal(getTrainerListStatusLabel({ id: "attention" }), "Нужна проверка");
  assert.equal(getTrainerListStatusLabel({ id: "lost" }), "Нужна проверка");
  assert.equal(getTrainerListStatusLabel({ id: "attention" }, false), "Без программы");
});

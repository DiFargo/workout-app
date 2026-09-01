import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrainerClientProgramName,
  normalizeTrainerClientProgramName
} from "../src/utils/trainerClientProgramName.js";

test("creates a readable client-specific program name", () => {
  assert.equal(
    buildTrainerClientProgramName("Фулл бади", { name: "Илья Михайлов" }),
    "Программа Фулл бади — Илья"
  );
});

test("does not duplicate the program prefix or require a client name", () => {
  assert.equal(
    buildTrainerClientProgramName("Программа Сила", {}),
    "Программа Сила"
  );
});

test("normalizes the manually changed client program name", () => {
  assert.equal(
    normalizeTrainerClientProgramName("  Программа   Фулл бади — Илья  "),
    "Программа Фулл бади — Илья"
  );
});

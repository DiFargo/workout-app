import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTrainerMonthProgram } from "../src/utils/trainerMonthProgramNormalization.js";

const fixedOptions = {
  getFallbackId: () => "month_fixed",
  getNowIso: () => "2026-06-20T00:00:00.000Z"
};

test("normalizes an empty trainer month program into the default two microcycles", () => {
  const program = normalizeTrainerMonthProgram({}, fixedOptions);

  assert.equal(program.id, "month_fixed");
  assert.equal(program.name, "Программа на месяц");
  assert.equal(program.blocks.length, 2);
  assert.equal(program.months.length, 1);
  assert.equal(program.months[0].microcycles.length, 2);
  assert.deepEqual(
    program.blocks.flatMap((block) => block.weeks.map((week) => week.name)),
    ["Неделя 1", "Неделя 2", "Неделя 3", "Неделя 4"]
  );
});

test("keeps structured month microcycles and attaches inherited month ids", () => {
  const program = normalizeTrainerMonthProgram({
    id: "program_1",
    name: "tren+",
    months: [
      {
        id: "month_a",
        name: "Месяц A",
        microcycles: [
          {
            id: "cycle_a",
            name: "Цикл 1",
            weeks: [
              { id: "week_a", name: "Неделя A", workouts: [{ id: "workout_a" }] }
            ]
          }
        ]
      }
    ]
  }, fixedOptions);

  assert.equal(program.id, "program_1");
  assert.equal(program.blocks[0].monthId, "month_a");
  assert.equal(program.months[0].microcycles[0].id, "cycle_a");
  assert.deepEqual(program.blocks[0].weeks[0].workouts, [{ id: "workout_a" }]);
});

test("renames legacy block labels without changing saved workouts", () => {
  const program = normalizeTrainerMonthProgram({
    id: "legacy",
    months: [{ id: "month_1", name: "Блок Месяц 1" }],
    blocks: [
      {
        id: "block_1",
        name: "Блок 1",
        monthId: "month_1",
        weeks: [{ workouts: [{ id: "w1", exercises: [{ id: "e1" }] }] }]
      }
    ]
  }, fixedOptions);

  assert.equal(program.months[0].name, "Месяц 1");
  assert.equal(program.blocks[0].name, "Микроцикл 1");
  assert.deepEqual(program.months[0].microcycles[0].weeks[0].workouts[0].exercises, [{ id: "e1" }]);
});

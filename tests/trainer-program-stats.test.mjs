import test from "node:test";
import assert from "node:assert/strict";

import { getTrainerProgramTemplateStats } from "../src/utils/trainerProgramStats.js";

test("trainer program stats count flat workouts", () => {
  const stats = getTrainerProgramTemplateStats({
    workouts: [
      { exercises: [{}, {}] },
      { exercises: [{}] }
    ]
  });

  assert.deepEqual(stats, {
    workoutsCount: 2,
    exercisesCount: 3,
    weeksCount: 4,
    blocksCount: 1
  });
});

test("trainer program stats count structured microcycles", () => {
  const stats = getTrainerProgramTemplateStats({
    blocks: [
      {
        weeks: [
          { workouts: [{ exercises: [{}, {}] }] },
          { workouts: [{ exercises: [{}] }, { exercises: [] }] }
        ]
      },
      {
        weeks: [
          { workouts: [{ exercises: [{}] }] }
        ]
      }
    ]
  });

  assert.deepEqual(stats, {
    workoutsCount: 4,
    exercisesCount: 4,
    weeksCount: 3,
    blocksCount: 2
  });
});

test("trainer program stats read month microcycle templates", () => {
  const stats = getTrainerProgramTemplateStats({
    months: [
      {
        microcycles: [
          {
            weeks: [
              { workouts: [{ exercises: [{}, {}, {}] }] }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(stats.workoutsCount, 1);
  assert.equal(stats.exercisesCount, 3);
  assert.equal(stats.weeksCount, 1);
  assert.equal(stats.blocksCount, 1);
});

import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../src/data/basicWorkoutExerciseLibrary.js";

const MANNEQUIN_ASSET_ROOT = new URL("../public/basic-workout/exercises/mannequin/", import.meta.url);
const CATALOGUE_ASSET_ROOT = new URL("../public/basic-workout/exercises/catalogue/v1/", import.meta.url);

test("every compact-library exercise has an individual illustration", async () => {
  assert.equal(BASIC_WORKOUT_EXERCISE_LIBRARY.length, 99);

  await Promise.all(
    BASIC_WORKOUT_EXERCISE_LIBRARY.map((exercise) => {
      const root = exercise.sourceId ? CATALOGUE_ASSET_ROOT : MANNEQUIN_ASSET_ROOT;
      const file = exercise.sourceId
        ? `${exercise.sourceId}.webp`
        : `${exercise.illustrationId || exercise.id}.png`;

      return access(new URL(file, root));
    })
  );
});

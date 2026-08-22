import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadBasicWorkoutFullExerciseCatalogue,
  searchBasicWorkoutFullExerciseCatalogue
} from "../src/data/basicWorkoutFullExerciseCatalogue.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await fs.readFile(
  path.resolve(testDirectory, "../public/basic-workout/exercise-catalogue.v1.json"),
  "utf8"
));
const BASIC_WORKOUT_FULL_CATALOGUE_META = fixture.meta;
const BASIC_WORKOUT_FULL_EXERCISE_CATALOGUE = fixture.exercises;
const BASIC_WORKOUT_FULL_EXERCISE_COUNT = BASIC_WORKOUT_FULL_EXERCISE_CATALOGUE.length;

test("full exercise catalogue contains the complete imported public-domain dataset", () => {
  assert.equal(BASIC_WORKOUT_FULL_EXERCISE_COUNT, 873);
  assert.equal(BASIC_WORKOUT_FULL_CATALOGUE_META.exerciseCount, 873);
  assert.equal(BASIC_WORKOUT_FULL_CATALOGUE_META.source.license, "Unlicense / public domain");
  assert.match(BASIC_WORKOUT_FULL_CATALOGUE_META.source.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(new Set(BASIC_WORKOUT_FULL_EXERCISE_CATALOGUE.map((exercise) => exercise.catalogId)).size, 873);
});

test("full exercise catalogue stores original Russian app copy, not source instructions or image paths", () => {
  BASIC_WORKOUT_FULL_EXERCISE_CATALOGUE.forEach((exercise) => {
    assert.ok(exercise.catalogId.startsWith("fedb:"), `${exercise.sourceId} needs a stable catalogue id`);
    assert.ok(exercise.sourceName, `${exercise.catalogId} needs canonical source name`);
    assert.ok(exercise.description.includes("Основная нагрузка"), `${exercise.catalogId} needs an original description`);
    assert.ok(exercise.techniqueCue, `${exercise.catalogId} needs an original technique cue`);
    assert.ok(exercise.safetyCue, `${exercise.catalogId} needs a safety cue`);
    assert.equal("instructions" in exercise, false, `${exercise.catalogId} must not retain source instructions`);
    assert.equal("images" in exercise, false, `${exercise.catalogId} must not retain source images`);
    assert.equal(exercise.basicPlanEligible, false, `${exercise.catalogId} must not bypass the reviewed plan allowlist`);
  });
});

test("full exercise catalogue stays lazy and supports Russian semantic search with an English fallback", async () => {
  const fetcher = async () => ({ ok: true, json: async () => fixture });
  const catalogue = await loadBasicWorkoutFullExerciseCatalogue({ fetcher });
  assert.equal(catalogue.exercises.length, 873);

  const russianResults = await searchBasicWorkoutFullExerciseCatalogue("мышцы живота", { limit: 5, fetcher });
  assert.ok(russianResults.length > 0);
  assert.ok(russianResults.every((exercise) => exercise.searchableText.includes("мышцы живота")));

  const sourceResults = await searchBasicWorkoutFullExerciseCatalogue("Ab Crunch Machine", { limit: 5, fetcher });
  assert.ok(sourceResults.some((exercise) => exercise.sourceId === "Ab_Crunch_Machine"));
});

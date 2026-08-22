import assert from "node:assert/strict";
import test from "node:test";

import {
  BASIC_WORKOUT_AI_CATALOGUE_COUNT,
  findBasicWorkoutAiCatalogueExercise,
  getBasicWorkoutAiCatalogueGuidance,
  getBasicWorkoutAiCatalogueIssues
} from "../functions/basicWorkoutAiCatalogue.js";
import { getBasicWorkoutCompositionIssues } from "../functions/basicWorkoutPlanOrder.js";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../src/data/basicWorkoutExerciseLibrary.js";

test("AI basic-workout catalogue stays compatible with the reviewed client library", () => {
  assert.ok(BASIC_WORKOUT_AI_CATALOGUE_COUNT >= 60);

  const clientExerciseIds = new Set(BASIC_WORKOUT_EXERCISE_LIBRARY.map((exercise) => exercise.id));
  const guidance = getBasicWorkoutAiCatalogueGuidance("gym");
  const listedIds = [...guidance.matchAll(/(?:^|; |: )([a-z][a-z0-9_]+) —/gmu)].map((match) => match[1]);

  assert.ok(listedIds.length >= 60);
  listedIds.forEach((id) => assert.ok(clientExerciseIds.has(id), `${id} must resolve in the client library`));
});

test("AI catalogue resolves canonical names and existing aliases", () => {
  const canonical = findBasicWorkoutAiCatalogueExercise({ catalogueId: "smith_bench_press" });
  const alias = findBasicWorkoutAiCatalogueExercise({ name: "Жим в Смите лёжа" });

  assert.equal(canonical?.name, "Жим лёжа в Смите");
  assert.equal(alias?.id, "smith_bench_press");
});

test("AI catalogue guidance excludes gym-only exercises for home plans", () => {
  const homeGuidance = getBasicWorkoutAiCatalogueGuidance("home");

  assert.equal(homeGuidance.includes("assisted_pullup —"), false);
  assert.equal(homeGuidance.includes("leg_press —"), false);
  assert.equal(homeGuidance.includes("pushup — Отжимания от пола"), true);
});

test("AI catalogue guidance exposes the validator movement role for every choice", () => {
  const guidance = getBasicWorkoutAiCatalogueGuidance("gym");

  assert.match(guidance, /\[role: hipDominantCompound; max 1 per workout\]/u);
  assert.match(guidance, /\[role: lowerAccessory\]/u);
  assert.match(guidance, /back_extension — Гиперэкстензия/u);
});

test("AI catalogue validation rejects invented and unavailable exercises before a plan is saved", () => {
  const issues = getBasicWorkoutAiCatalogueIssues({
    weeks: [{
      workouts: [{
        exercises: [
          { catalogueId: "leg_press", name: "Жим ногами" },
          { catalogueId: "made_up", name: "Космический жим" }
        ]
      }]
    }]
  }, "home");

  assert.equal(issues.length, 2);
  assert.match(issues[0], /недоступно/u);
  assert.match(issues[1], /отсутствует/u);
});

test("catalogue movement roles drive composition validation without name heuristics", () => {
  const issues = getBasicWorkoutCompositionIssues([
    { name: "Первый жим", basicMovementRole: "chestPress" },
    { name: "Второй жим", basicMovementRole: "chestPress" },
    { name: "Кор", basicMovementRole: "core" },
    { name: "Ещё кор", basicMovementRole: "core" }
  ]);

  assert.deepEqual(issues, ["двух упражнений на кор", "двух жимов на грудь"]);
});

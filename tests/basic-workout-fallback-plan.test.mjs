import assert from "node:assert/strict";
import test from "node:test";

import { buildBasicWorkoutFallbackDraft } from "../functions/basicWorkoutFallbackPlan.js";
import { getBasicWorkoutAiCatalogueIssues } from "../functions/basicWorkoutAiCatalogue.js";
import { getBasicWorkoutCompositionIssues } from "../functions/basicWorkoutPlanOrder.js";
import { BASIC_WORKOUT_AI_CATALOGUE } from "../functions/basicWorkoutAiCatalogue.generated.js";

const TARGETS = { "30": 3, "45": 5, "60": 6, "90": 7 };
const BY_ID = new Map(BASIC_WORKOUT_AI_CATALOGUE.map((exercise) => [exercise.id, exercise]));
const RESTRICTION_BLOCKED_ROLES = {
  knees: new Set(["kneeDominantCompound", "hipDominantCompound", "lowerAccessory"]),
  shoulders: new Set([
    "chestPress",
    "chestAccessory",
    "verticalPull",
    "horizontalPull",
    "shoulderPress",
    "shoulderAccessory"
  ])
};
const BACK_BLOCKED_IDS = new Set([
  "db_rdl",
  "romanian_deadlift",
  "hip_thrust",
  "back_extension",
  "cable_crunch",
  "floor_crunch",
  "hanging_knee_raise",
  "reverse_crunch"
]);

test("deterministic fallback produces valid drafts for every supported basic-plan profile", () => {
  for (const location of ["gym", "home"]) {
    for (const days of [2, 3, 4, 5]) {
      for (const duration of Object.keys(TARGETS)) {
        const structures = days === 2 ? ["recovery_split", "balanced_full_body"] : ["recovery_split"];

        for (const goal of ["general_fitness", "fat_loss", "muscle", "strength"]) {
          for (const level of ["beginner", "returning", "experienced"]) {
            for (const restrictions of ["none", "back", "knees", "shoulders", "other"]) {
              for (const twoDayStructure of structures) {
                const draft = buildBasicWorkoutFallbackDraft({
                  location,
                  days,
                  duration,
                  goal,
                  level,
                  restrictions,
                  twoDayStructure
                });

              assert.equal(draft.weeks.length, 2, `${location}/${days}/${duration} has two base weeks`);
              assert.equal(getBasicWorkoutAiCatalogueIssues(draft, location).length, 0);
              assert.equal(
                restrictions === "none",
                !/медицинск.+реабилитац/iu.test(draft.safetyNote),
                `${location}/${days}/${duration}/${restrictions} has the right safety note`
              );

                draft.weeks.forEach((week) => {
                  assert.equal(week.workouts.length, days);
                  week.workouts.forEach((workout) => {
                    const roles = workout.exercises.map((exercise) => BY_ID.get(exercise.catalogueId)?.movementRole);
                    const expectedSetCount = duration === "30" || (duration === "45" && level === "beginner") ? 2 : 3;

                    assert.equal(workout.exercises.length, TARGETS[duration]);
                    assert.equal(new Set(workout.exercises.map((exercise) => exercise.catalogueId)).size, workout.exercises.length);
                    assert.ok(workout.exercises.every((exercise) => exercise.sets.length === expectedSetCount));
                    workout.exercises.forEach((exercise) => {
                      const catalogueExercise = BY_ID.get(exercise.catalogueId);
                      if (Number(catalogueExercise?.durationSeconds) > 0) return;

                      const expectedReps = /Compound$/u.test(catalogueExercise?.movementRole || "") ? 8 : 10;
                      assert.deepEqual(
                        exercise.sets.map((set) => set.reps),
                        Array(expectedSetCount).fill(expectedReps),
                        `${exercise.name} has consistent working-set reps without implicit warm-up sets`
                      );
                    });
                    assert.equal(roles.at(-1), "core", `${location}/${days}/${duration}/${restrictions} keeps core last`);
                    assert.deepEqual(getBasicWorkoutCompositionIssues(workout.exercises.map((exercise) => ({
                      name: exercise.name,
                      basicMovementRole: BY_ID.get(exercise.catalogueId)?.movementRole
                    }))), []);

                    if (days === 2 && !["knees", "shoulders"].includes(restrictions)) {
                      const lowerExerciseCount = roles.filter((role) => (
                        ["kneeDominantCompound", "hipDominantCompound", "lowerAccessory"].includes(role)
                      )).length;
                      assert.equal(lowerExerciseCount, 1, `${location}/${twoDayStructure}/${duration} has one lower-body exercise`);
                    }

                    const blockedRoles = RESTRICTION_BLOCKED_ROLES[restrictions] || new Set();
                    assert.ok(roles.every((role) => !blockedRoles.has(role)));
                    if (restrictions === "back") {
                      assert.ok(workout.exercises.every((exercise) => !BACK_BLOCKED_IDS.has(exercise.catalogueId)));
                    }
                  });
                });
              }
            }
          }
        }
      }
    }
  }
});

test("fallback rotates approved alternatives for the second gym week when they exist", () => {
  const draft = buildBasicWorkoutFallbackDraft({ location: "gym", days: 2, duration: "90" });
  const firstWeek = draft.weeks[0].workouts[0].exercises.map((exercise) => exercise.catalogueId);
  const secondWeek = draft.weeks[1].workouts[0].exercises.map((exercise) => exercise.catalogueId);

  assert.notDeepEqual(secondWeek, firstWeek);
});

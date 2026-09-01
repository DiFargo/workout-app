import assert from "node:assert/strict";
import test from "node:test";

import { BASIC_WORKOUT_AI_CATALOGUE } from "../functions/basicWorkoutAiCatalogue.generated.js";
import {
  BASIC_WORKOUT_TODAY_TARGETS as SERVER_TARGETS,
  buildBasicWorkoutTodayFallbackDraft,
  getBasicWorkoutTodayCompositionIssues,
  getBasicWorkoutTodayExerciseTarget
} from "../functions/basicWorkoutTodayPlan.js";
import {
  BASIC_WORKOUT_TODAY_TARGETS as CLIENT_TARGETS,
  buildBasicWorkoutTodayLocalFallback
} from "../src/utils/basicWorkoutTodayFallback.js";

const CATALOGUE_BY_ID = new Map(BASIC_WORKOUT_AI_CATALOGUE.map((exercise) => [exercise.id, exercise]));

test("today-workout fallback covers all nine selectable targets from the reviewed catalogue", () => {
  assert.equal(Object.keys(SERVER_TARGETS).length, 9);
  assert.equal(CLIENT_TARGETS.length, 9);

  for (const [targetId, target] of Object.entries(SERVER_TARGETS)) {
    for (const location of ["gym", "home"]) {
      const profile = { todayTarget: targetId, location, duration: "45", level: "beginner", readiness: "normal", restrictions: "none" };
      const draft = buildBasicWorkoutTodayFallbackDraft(profile);
      const exercises = draft.workout.exercises;

      assert.equal(exercises.length, getBasicWorkoutTodayExerciseTarget(profile), `${targetId}/${location} exercise count`);
      assert.ok(exercises.some((exercise) => target.groups.includes(CATALOGUE_BY_ID.get(exercise.catalogueId)?.groupId)));
      assert.equal(new Set(exercises.map((exercise) => exercise.catalogueId)).size, exercises.length);
      assert.ok(exercises.every((exercise) => CATALOGUE_BY_ID.get(exercise.catalogueId)?.locations.includes(location)));
    }
  }
});

test("local today-workout fallback creates a startable one-session basic plan", () => {
  const plan = buildBasicWorkoutTodayLocalFallback({
    todayTargets: ["biceps", "triceps"],
    location: "home",
    duration: "30",
    readiness: "low"
  });

  assert.equal(plan.structure, "on_demand");
  assert.equal(plan.workouts.length, 1);
  assert.equal(plan.workouts[0].exercises.length, 3);
  assert.ok(plan.workouts[0].exercises.some((exercise) => exercise.basicExerciseGroupId === "biceps"));
  assert.ok(plan.workouts[0].exercises.some((exercise) => exercise.basicExerciseGroupId === "triceps"));
  assert.ok(plan.workouts[0].exercises.every((exercise) => exercise.sets.length === 2));
});

test("today-workout fallbacks keep every selected zone and make full body balanced", () => {
  const combined = buildBasicWorkoutTodayFallbackDraft({
    todayTargets: ["chest", "back"],
    location: "gym",
    duration: "45",
    level: "beginner",
    readiness: "normal",
    restrictions: "none"
  });
  const combinedGroups = new Set(combined.workout.exercises.map((exercise) => CATALOGUE_BY_ID.get(exercise.catalogueId)?.groupId));
  assert.ok(["chest_press", "chest_incline", "chest_fly"].some((groupId) => combinedGroups.has(groupId)));
  assert.ok(["vertical_pull", "horizontal_pull", "rear_delts"].some((groupId) => combinedGroups.has(groupId)));
  assert.deepEqual(getBasicWorkoutTodayCompositionIssues(combined.workout, {
    todayTargets: ["chest", "back"],
    location: "gym",
    duration: "45",
    level: "beginner",
    readiness: "normal",
    restrictions: "none"
  }), []);

  const fullBody = buildBasicWorkoutTodayFallbackDraft({
    todayTargets: ["full_body"],
    location: "gym",
    duration: "45",
    level: "beginner",
    readiness: "normal",
    restrictions: "none"
  });
  const fullBodyGroups = new Set(fullBody.workout.exercises.map((exercise) => CATALOGUE_BY_ID.get(exercise.catalogueId)?.groupId));
  assert.ok(["quads", "posterior_chain", "calves"].some((groupId) => fullBodyGroups.has(groupId)));
  assert.ok(["chest_press", "chest_incline", "chest_fly", "shoulder_press"].some((groupId) => fullBodyGroups.has(groupId)));
  assert.ok(["vertical_pull", "horizontal_pull"].some((groupId) => fullBodyGroups.has(groupId)));
  assert.deepEqual(getBasicWorkoutTodayCompositionIssues(fullBody.workout, {
    todayTargets: ["full_body"],
    location: "gym",
    duration: "45",
    level: "beginner",
    readiness: "normal",
    restrictions: "none"
  }), []);
});

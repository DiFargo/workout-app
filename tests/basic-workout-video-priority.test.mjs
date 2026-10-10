import assert from "node:assert/strict";
import test from "node:test";
import { buildHybridWorkoutContext, applyHybridWorkoutChoices } from "../functions/basicWorkoutGemini.js";
import { BASIC_WORKOUT_EXERCISE_LIBRARY as library } from "../src/data/basicWorkoutExerciseLibrary.js";
import { BASIC_WORKOUT_AI_CATALOGUE as catalogue } from "../functions/basicWorkoutAiCatalogue.generated.js";
import { getBasicWorkoutAlternatives } from "../src/utils/basicWorkoutAlternatives.js";
import { buildDefaultBasicWorkoutSchedule } from "../src/utils/basicWorkoutSchedule.js";
import { buildLocalHybridWorkoutPlan } from "../functions/basicWorkoutHybridPlan.js";
import { summarizeWorkoutEmphasis } from "../functions/basicWorkoutEmphasis.js";
import { resolveQuizWorkoutEmphasis } from "../src/utils/basicWorkoutQuizDraft.js";

const profile = { mode: "plan", goal: "general_fitness", level: "beginner", location: "gym", days: "3", duration: "45", restrictions: "none",
  registration: { sex: "female", age: 35, height: 168, weight: 70, activity: "medium" } };
test("one workout per week schedules four sessions seven days apart", () => {
  assert.deepEqual(buildDefaultBasicWorkoutSchedule(4, 1, new Date(2026, 8, 21)), ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
});
test("video-first candidates and defaults remain compatible across one to five days", () => {
  for (const location of ["gym", "home"]) for (const days of ["1", "2", "3", "4", "5"]) {
    const input = { ...profile, location, days };
    const context = buildHybridWorkoutContext(input);
    const choices = context.slots.map(slot => ({ slotId: slot.id, catalogueId: slot.baseId }));
    assert.doesNotThrow(() => applyHybridWorkoutChoices(context, choices, input));
    for (const slot of context.slots) {
      assert.ok(slot.candidates.every(card => card.locations.includes(location)));
      const selected = slot.candidates.find(card => card.id === slot.baseId);
      if (slot.candidates.every(card => card.hasVideo)) assert.equal(selected.hasVideo, true);
    }
    assert.ok(context.draft.weeks.flatMap(week => week.workouts).flatMap(workout => workout.exercises).every(exercise => exercise.sets.length === 3));
  }
});
test("all approved trainer additions are candidates, with Scott extension kept distinct", () => {
  assert.equal(catalogue.find(card => card.id === "scott_triceps_extension").movementRole, "triceps");
  assert.equal(catalogue.find(card => card.id === "machine_preacher_curl").movementRole, "biceps");
  assert.equal(library.filter(card => card.hasVideo).length, 53);
  for (const id of ["hip_adduction_machine", "hip_abduction_machine", "db_front_raise", "scott_triceps_extension", "single_leg_press"]) assert.ok(catalogue.some(card => card.id === id));
});
test("alternatives never exceed two or introduce gym-only equipment into a home plan", () => {
  for (const card of library.filter(item => item.sectionId === "strength")) {
    const exercise = { ...card, basicExerciseId: card.id };
    const alternatives = getBasicWorkoutAlternatives(exercise, { exercises: [exercise] }, { profile: { location: "home" } });
    assert.ok(alternatives.length <= 2);
    assert.ok(alternatives.every(item => item.id !== card.id && library.find(entry => entry.id === item.id).locations.includes("home")));
  }
});

test("3 + 3 + 1 has seven exercises and exactly nine lower, nine upper and three core sets in every session", () => {
  for (const days of ["1", "2"]) for (const duration of ["60", "90"]) {
    const input = { ...profile, level: "returning", days, duration, trainingEmphasis: "full_body_331" };
    const plan = buildLocalHybridWorkoutPlan(input);
    assert.equal(plan.workouts.length, Number(days) * 4);
    for (const workout of plan.workouts) {
      assert.equal(workout.exercises.length, 7);
      assert.deepEqual(summarizeWorkoutEmphasis([workout]), { lower: 9, upper: 9, core: 3 });
      assert.equal(workout.exercises.at(-1).basicMovementRole, "core");
      assert.ok(workout.exercises.every(exercise => exercise.sets.length === 3));
    }
  }
  for (const changed of [{ days:"3" }, { duration:"30" }, { location:"home" }]) {
    assert.throws(() => buildLocalHybridWorkoutPlan({ ...profile, days:"2", duration:"60", trainingEmphasis:"full_body_331", ...changed }), /Формат 3 \+ 3 \+ 1/);
  }
});

test("3 + 3 + 1 recommendation is limited to the requested answers and never overrides an explicit focus", () => {
  const answers = { ...profile, level:"returning", days:"2", duration:"60", trainingEmphasis:"classic" };
  assert.equal(resolveQuizWorkoutEmphasis(answers, { sex:"female" }), "full_body_331");
  assert.equal(resolveQuizWorkoutEmphasis(answers, { sex:"male" }), "classic");
  assert.equal(resolveQuizWorkoutEmphasis({ ...answers, trainingEmphasisChosen:true }, { sex:"female" }), "classic");
  assert.equal(resolveQuizWorkoutEmphasis({ ...answers, trainingEmphasis:"upper" }, { sex:"female" }), "upper");
  for (const changed of [{ level:"beginner" }, { goal:"strength" }, { days:"3" }, { duration:"45" }, { location:"home" }]) {
    assert.equal(resolveQuizWorkoutEmphasis({ ...answers, ...changed }, { sex:"female" }), "classic");
  }
  assert.equal(resolveQuizWorkoutEmphasis({ ...answers, days:"5", trainingEmphasis:"full_body_331" }, {sex:"female"}), "balanced");
});

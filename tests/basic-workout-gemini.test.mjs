import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildHybridWorkoutContext, applyHybridWorkoutChoices, generateHybridWorkoutDraft } from "../functions/basicWorkoutGemini.js";
import { buildLocalHybridWorkoutPlan, finalizeHybridWorkoutPlan } from "../functions/basicWorkoutHybridPlan.js";
import { BASIC_WORKOUT_AI_CATALOGUE } from "../functions/basicWorkoutAiCatalogue.generated.js";
import { assertBasicWorkoutGenerationAllowed, getBasicWorkoutGenerationNotice } from "../src/utils/basicWorkoutGeneration.js";
import { applyBasicWorkoutStartingWeights } from "../src/utils/basicWorkoutStartingWeights.js";
import { buildBasicWorkoutPlanFromQuiz } from "../src/utils/basicWorkoutPlanBuilder.js";
import { getBasicWorkoutMicrocycles } from "../src/utils/basicWorkoutPlanStructure.js";

const profile = { mode: "plan", goal: "general_fitness", level: "beginner", location: "gym", days: "3", duration: "45", restrictions: "none",
  registration: { sex: "female", age: 35, height: 168, weight: 70, activity: "medium", goal: "recomp" } };
const defaults = (context) => context.slots.map((slot) => ({ slotId: slot.id, catalogueId: slot.baseId }));
const response = (choices) => ({ ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ choices }) }] } }] }) });

test("hybrid template matrix keeps all days, catalogue, equipment, loads and repeat weeks stable", () => {
  const byId = new Map(BASIC_WORKOUT_AI_CATALOGUE.map((card) => [card.id, card]));
  for (const location of ["gym", "home"]) for (const days of ["1", "2", "3", "4", "5"]) {
    for (const duration of ["30", "45", "60", "90"]) for (const level of ["beginner", "returning", "experienced"]) {
      const input = { ...profile, location, days, duration, level };
      const plan = buildLocalHybridWorkoutPlan(input);
      assert.equal(plan.workouts.length, Number(days) * 4);
      assert.equal(getBasicWorkoutMicrocycles(plan).flatMap((cycle) => cycle.items).length, plan.workouts.length);
      plan.workouts.forEach((workout) => {
        assert.equal(new Set(workout.exercises.map((item) => item.basicExerciseId)).size, workout.exercises.length);
        workout.exercises.forEach((exercise) => {
          assert.ok(byId.get(exercise.basicExerciseId).locations.includes(location));
          assert.equal(exercise.sets.length, 3);
          assert.ok(exercise.sets.every((set) => set.weight === "" && !set.completed));
        });
      });
      const exerciseData = (workout) => workout.exercises.map(({ id: _id, ...exercise }) => exercise);
      for (let index = 0; index < Number(days) * 2; index++) {
        assert.deepEqual(exerciseData(plan.workouts[index]), exerciseData(plan.workouts[index + Number(days) * 2]));
      }
    }
  }
});

test("today templates satisfy the same selection validator for each focus and location", () => {
  for (const location of ["gym", "home"]) for (const duration of ["30", "45", "60", "90"]) {
    for (const todayTarget of ["chest", "back", "shoulders", "legs", "glutes", "biceps", "triceps", "core", "full_body"]) {
      const plan = buildLocalHybridWorkoutPlan({ ...profile, mode: "today", location, duration, todayTarget });
      assert.equal(plan.workouts.length, 1, `${location}/${duration}/${todayTarget}`);
      assert.match(plan.workouts[0].scheduledDate, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

test("model can choose an allowed alternative but cannot inject loads or change the template", () => {
  const context = buildHybridWorkoutContext(profile);
  const before = structuredClone(context.draft);
  const choices = defaults(context);
  const slot = context.slots.find((s) => s.candidates.some((candidate) => candidate.id !== s.baseId && !choices.some((choice) => choice.slotId.startsWith(s.id.split("s")[0] + "s") && choice.catalogueId === candidate.id)));
  const alternative = slot.candidates.find((candidate) => candidate.id !== slot.baseId && !choices.some((choice) => choice.slotId.startsWith(slot.id.split("s")[0] + "s") && choice.catalogueId === candidate.id));
  Object.assign(choices.find((choice) => choice.slotId === slot.id), { catalogueId: alternative.id, sets: [{ weight: 9999 }], restSeconds: 1, video: "https://evil.example" });
  const draft = applyHybridWorkoutChoices(context, choices, profile);
  const changed = draft.weeks.flatMap((week) => week.workouts)[slot.workoutIndex].exercises[slot.exerciseIndex];
  assert.equal(changed.catalogueId, alternative.id);
  assert.deepEqual(changed.sets, before.weeks.flatMap((week) => week.workouts)[slot.workoutIndex].exercises[slot.exerciseIndex].sets);
  assert.equal(changed.video, undefined);
  assert.equal(changed.restSeconds, Math.max(90, alternative.restSeconds));
  assert.deepEqual(context.draft, before);
});

test("invalid, missing, duplicated or out-of-pool model choices are rejected", () => {
  const context = buildHybridWorkoutContext(profile);
  for (const mutate of [
    (choices) => choices.pop(),
    (choices) => { choices[0].catalogueId = "invented"; },
    (choices) => { choices[0].catalogueId = "weighted_back_extension"; },
    (choices) => { choices[0].slotId = choices[1].slotId; },
    (choices) => { choices[0].catalogueId = choices[1].catalogueId; }
  ]) {
    const choices = defaults(context); mutate(choices);
    assert.throws(() => applyHybridWorkoutChoices(context, choices, profile), { code: "invalid_selection" });
  }
});

test("provider receives relevant profile and preferences but never identity or contacts", async () => {
  let calls = 0; let limited = 0;
  const input = { ...profile, registration: { ...profile.registration, weight: 124, name: "PRIVATE_NAME", email: "secret@example.com" },
    requestedBy: "PRIVATE_UID", planPreferences: "Предпочитаю тренажёры. secret@example.com" };
  const result = await generateHybridWorkoutDraft(input, { apiKey: "test-key", beforeGenerate: async () => limited++,
    fetchImpl: async (url, options) => {
      calls++;
      assert.match(url, /generativelanguage\.googleapis\.com/);
      assert.equal(options.headers["x-goog-api-key"], "test-key");
      assert.doesNotMatch(options.body, /PRIVATE_|secret@example/);
      const sent = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).profile;
      assert.equal(sent.registration.sex, "female");
      assert.equal(sent.registration.weight, 124);
      assert.equal(sent.registration.age, 35);
      assert.match(sent.preferences, /Предпочитаю тренажёры/);
      assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, "application/json");
      return response(defaults(buildHybridWorkoutContext(input)));
    } });
  assert.equal(calls, 1); assert.equal(limited, 1);
  assert.equal(result.generationProvider, "gemini");
  assert.equal(result.generationFallback, false);
  const plan = finalizeHybridWorkoutPlan(result, input, "PRIVATE_UID");
  assert.equal(plan.profile.requestedBy, "PRIVATE_UID");
  assert.match(getBasicWorkoutGenerationNotice(plan), /Gemini подобрал/);
});

test("missing key, quota, malformed and truncated responses fall back once without another provider", async () => {
  let calls = 0;
  const missing = await generateHybridWorkoutDraft(profile, { fetchImpl: async () => { calls++; } });
  assert.equal(missing.generationReason, "not_configured"); assert.equal(calls, 0);
  for (const mock of [
    async () => ({ ok: false, status: 429 }),
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS" }] }) }),
    async () => response([{ slotId: "d1s1", catalogueId: "invalid" }]),
    async () => { throw new Error("timeout"); }
  ]) {
    let count = 0;
    const result = await generateHybridWorkoutDraft(profile, { apiKey: "test", fetchImpl: async (...args) => { count++; return mock(...args); } });
    assert.equal(count, 1); assert.equal(result.generationFallback, true);
    assert.equal(result.generationProvider, "templates");
  }
  const rateLimited = await generateHybridWorkoutDraft(profile, { apiKey: "test", beforeGenerate: async () => { throw Object.assign(new Error("quota"), { status: 429 }); }, fetchImpl: async () => { calls++; } });
  assert.equal(rateLimited.generationReason, "rate_limited"); assert.equal(calls, 0);
});

test("health restrictions and under-18 profiles cannot use either remote or local automatic generation", async () => {
  for (const input of [{ ...profile, restrictions: "knees" }, { ...profile, restrictionDetails: "medical detail" }, { ...profile, registration: { age: 17 } }]) {
    let calls = 0;
    await assert.rejects(generateHybridWorkoutDraft(input, { apiKey: "test", fetchImpl: async () => calls++ }), { code: "basic_workout_review_required" });
    assert.equal(calls, 0);
    assert.throws(() => buildLocalHybridWorkoutPlan(input), { code: "basic_workout_review_required" });
    assert.throws(() => assertBasicWorkoutGenerationAllowed(input, input.registration), { noLocalFallback: true });
  }
});

test("preview and history do not fill manual weights; edits and completed sets are preserved", () => {
  const plan = buildLocalHybridWorkoutPlan(profile);
  const first = plan.workouts[0].exercises[0];
  const history = [{ date: "2026-09-14", exercises: [{ name: first.name, sets: [{ weight: 220, completed: true }] }] }];
  const preview = buildBasicWorkoutPlanFromQuiz({ ...profile, generatedPlan: plan }, undefined, { profile: { weight: 124 }, history });
  assert.ok(preview.workouts.flatMap((workout) => workout.exercises).every((exercise) => exercise.sets.every((set) => set.weight === "")));
  first.sets[0].weight = "110"; first.sets[0].completed = true;
  assert.equal(applyBasicWorkoutStartingWeights(plan, { history }), plan);
  assert.equal(first.sets[0].weight, "110");
});

test("Gemini endpoint remains behind existing authentication and shares rate-limit buckets", async () => {
  const source = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("export const aiBasicWorkoutPlan ="), source.indexOf("async function fetchOpenAiNutritionFoods"));
  assert.match(handler, /secrets: \[OPENAI_API_KEY, GEMINI_API_KEY\]/);
  assert.ok(handler.indexOf("await requireAuthenticatedUser(req)") < handler.indexOf('req.body?.provider === "gemini"'));
  assert.match(source, /"ai-basic-workout-today-daily-v1" : "ai-basic-workout-plan-daily-v2"/);
});

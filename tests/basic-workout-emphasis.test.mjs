import assert from "node:assert/strict";
import test from "node:test";
import { buildBasicWorkoutFallbackDraft } from "../functions/basicWorkoutFallbackPlan.js";
import { buildLocalHybridWorkoutPlan, finalizeHybridWorkoutPlan } from "../functions/basicWorkoutHybridPlan.js";
import { generateHybridWorkoutDraft } from "../functions/basicWorkoutGemini.js";
import { getBasicWorkoutCompositionIssues } from "../functions/basicWorkoutPlanOrder.js";
import { getBasicWorkoutQuizDraft, getBasicWorkoutQuizStepHint } from "../src/utils/basicWorkoutQuizDraft.js";
import { buildBasicWorkoutPlanFromQuiz } from "../src/utils/basicWorkoutPlanBuilder.js";

const base = { mode: "plan", goal: "general_fitness", level: "experienced", location: "gym", days: "3", duration: "45",
  restrictions: "none", registration: { sex: "female", age: 30, height: 170, weight: 70, activity: "medium" } };
const targets = { 30: 3, 45: 5, 60: 6, 90: 7 };

test("emphasis changes actual weekly sets at every supported frequency, duration, level and location", () => {
  for (const location of ["gym", "home"]) for (const days of [2, 3, 4, 5]) {
    for (const duration of [30, 45, 60, 90]) for (const level of ["beginner", "experienced"]) {
      const plans = ["balanced", "lower", "upper"].map((trainingEmphasis) => buildLocalHybridWorkoutPlan({
        ...base, location, days, duration, level, trainingEmphasis
      }));
      const [balanced, lower, upper] = plans.map((plan) => plan.weeklySetDistribution);
      const description = `${location}/${days}/${duration}/${level}`;
      assert.ok(lower.lower > balanced.lower && balanced.lower > upper.lower, description);
      assert.ok(upper.upper > balanced.upper && balanced.upper > lower.upper, description);
      assert.equal(Object.values(lower).reduce((a, b) => a + b), Object.values(upper).reduce((a, b) => a + b), description);
      for (const plan of plans) {
        assert.equal(plan.workouts.length, days * 4);
        assert.ok(plan.weeklySetDistribution.lower > 0 && plan.weeklySetDistribution.upper > 0);
        for (const week of [1, 2, 3, 4]) {
          const workouts = plan.workouts.filter((workout) => workout.weekNumber === week);
          const roles = workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.basicMovementRole));
          assert.ok(roles.includes("chestPress"), description);
          assert.ok(roles.includes("horizontalPull") || roles.includes("verticalPull"), description);
          assert.ok(roles.includes("kneeDominantCompound") || roles.includes("hipDominantCompound"), description);
          for (const workout of workouts) {
            assert.equal(workout.exercises.length, targets[duration]);
            assert.deepEqual(getBasicWorkoutCompositionIssues(workout.exercises), []);
            assert.ok(workout.exercises.every((exercise) => exercise.sets.every((set) => set.weight === "" && !set.completed)));
          }
        }
      }
    }
  }
});

test("missing and invalid emphasis preserve the original split exactly, including two-day settings", () => {
  for (const days of [2, 3, 4, 5]) for (const twoDayStructure of ["recovery_split", "balanced_full_body"]) {
    const profile = { ...base, days, twoDayStructure };
    const before = buildBasicWorkoutFallbackDraft(profile);
    assert.deepEqual(before, buildBasicWorkoutFallbackDraft({ ...profile, trainingEmphasis: "classic" }));
    assert.deepEqual(before, buildBasicWorkoutFallbackDraft({ ...profile, trainingEmphasis: "unknown" }));
  }
  assert.deepEqual(buildBasicWorkoutFallbackDraft(base).weeks[0].workouts.map((workout) => workout.name),
    ["Ноги и кор", "Жимовой верх", "Тяговой верх"]);
});

test("Gemini and offline templates honor the same explicit emphasis and volumes", async () => {
  for (const trainingEmphasis of ["classic", "balanced", "lower", "upper"]) {
    const profile = { ...base, trainingEmphasis };
    const result = await generateHybridWorkoutDraft(profile, { apiKey: "fake-test-key", fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      const data = JSON.parse(request.contents[0].parts[0].text);
      assert.equal(data.profile.trainingEmphasis, trainingEmphasis);
      return { ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({
        choices: data.slots.map((slot) => ({ slotId: slot.slotId, catalogueId: slot.defaultId }))
      }) }] } }] }) };
    } });
    assert.equal(result.generationFallback, false);
    const plan = finalizeHybridWorkoutPlan(result, profile);
    const local = buildLocalHybridWorkoutPlan(profile);
    assert.equal(plan.trainingEmphasis, trainingEmphasis);
    assert.deepEqual(plan.weeklySetDistribution, local.weeklySetDistribution);
    assert.deepEqual(plan.workouts.map((workout) => workout.exercises.map((exercise) => exercise.basicExerciseId)),
      local.workouts.map((workout) => workout.exercises.map((exercise) => exercise.basicExerciseId)));
  }
});

test("explicit preference survives questionnaire editing without overriding legacy two-day format", () => {
  for (const trainingEmphasis of ["balanced", "lower", "upper"]) {
    const quiz = getBasicWorkoutQuizDraft({ longPlanAnswers: { days: "2", trainingEmphasis } });
    assert.equal(quiz.trainingEmphasis, trainingEmphasis);
    assert.equal(getBasicWorkoutQuizStepHint("planPreferences", quiz), "");
    assert.notEqual(getBasicWorkoutQuizStepHint("planPreferences", { ...quiz, trainingEmphasis: "classic" }), "");
  }
  assert.equal(getBasicWorkoutQuizDraft({}).trainingEmphasis, "classic");
});

test("saved plans and today targets are not rewritten by a new weekly preference", () => {
  const saved = buildLocalHybridWorkoutPlan({ ...base, trainingEmphasis: "classic" });
  saved.workouts[0].exercises[0].sets[0].weight = 110;
  saved.workouts[0].exercises[0].sets[0].completed = true;
  const original = structuredClone(saved);
  const preview = buildBasicWorkoutPlanFromQuiz({ trainingEmphasis: "lower", generatedPlan: saved });
  assert.deepEqual(saved, original);
  assert.equal(preview.trainingEmphasis, "classic");
  assert.deepEqual(preview.workouts[0].exercises[0].sets, saved.workouts[0].exercises[0].sets);
  const today = { ...base, mode: "today", todayTargets: ["chest"] };
  const a = buildLocalHybridWorkoutPlan(today), b = buildLocalHybridWorkoutPlan({ ...today, trainingEmphasis: "lower" });
  assert.deepEqual(a.workouts[0].exercises.map((exercise) => exercise.basicExerciseId), b.workouts[0].exercises.map((exercise) => exercise.basicExerciseId));
  assert.equal(b.trainingEmphasis, undefined);
});

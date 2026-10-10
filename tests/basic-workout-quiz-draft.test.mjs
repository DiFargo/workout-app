import test from "node:test";
import assert from "node:assert/strict";
import { getBasicWorkoutQuizDraft, getBasicWorkoutQuizStepHint } from "../src/utils/basicWorkoutQuizDraft.js";

test("fresh questionnaire selects visible slider defaults without inheriting quick-workout answers", () => {
  const quiz = getBasicWorkoutQuizDraft({ goal: "muscle", level: "beginner", days: "3", restrictions: "none" });
  for (const [key, value] of Object.entries({ goal: "general_fitness", level: "beginner", location: "gym", days: "1", duration: "30" })) {
    assert.equal(quiz[key], value);
    assert.equal(getBasicWorkoutQuizStepHint(key, quiz), "");
  }
  for (const key of ["restrictions", "twoDayStructure", "specialStatus"]) {
    assert.equal(quiz[key], "");
  }
  assert.ok(getBasicWorkoutQuizStepHint("restrictions", quiz));
});

test("saved answers win and unsupported slider answers use their visible default", () => {
  const quiz = getBasicWorkoutQuizDraft({ longPlanAnswers: { goal: "fat_loss", level: "middle", days: 2 } });
  assert.equal(quiz.goal, "fat_loss");
  assert.equal(quiz.level, "beginner");
  assert.equal(quiz.days, "2");
  assert.equal(getBasicWorkoutQuizStepHint("goal", quiz), "");
  assert.equal(getBasicWorkoutQuizStepHint("level", quiz), "");
});

test("complete saved answers and generated plans are not overwritten by defaults", () => {
  const answers = { goal: "strength", level: "experienced", location: "home", days: "5", duration: "90",
    restrictions: "back", trainingEmphasis: "upper", trainingEmphasisChosen: true };
  const generatedPlan = { workouts: [{ exercises: [{ sets: [{ reps: 12, weight: 110 }] }] }] };
  const source = { longPlanAnswers: answers, generatedPlan };
  const before = structuredClone(source);
  const quiz = getBasicWorkoutQuizDraft(source);
  for (const [key, value] of Object.entries(answers)) assert.equal(quiz[key], value);
  assert.deepEqual(source, before);
});

test("other restriction needs details and two days need an explicit structure", () => {
  const quiz = getBasicWorkoutQuizDraft({ longPlanAnswers: { restrictions: "other", days: "2" } });
  assert.ok(getBasicWorkoutQuizStepHint("restrictions", quiz));
  assert.ok(getBasicWorkoutQuizStepHint("planPreferences", quiz));
  assert.equal(getBasicWorkoutQuizStepHint("restrictions", { ...quiz, restrictionDetails: "Без прыжков" }), "");
  assert.equal(getBasicWorkoutQuizStepHint("planPreferences", { ...quiz, twoDayStructure: "balanced_full_body" }), "");
  assert.equal(getBasicWorkoutQuizStepHint("planPreferences", { ...quiz, days: "3" }), "");
});

test("legacy generated-plan answers remain editable with defaults only for missing sliders", () => {
  const quiz = getBasicWorkoutQuizDraft({ goal: "strength", generatedPlan: { workouts: [] } });
  assert.equal(quiz.goal, "strength");
  assert.equal(quiz.days, "1");
  assert.equal(quiz.restrictions, "");
});

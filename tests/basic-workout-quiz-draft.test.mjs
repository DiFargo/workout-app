import test from "node:test";
import assert from "node:assert/strict";
import { getBasicWorkoutQuizDraft, getBasicWorkoutQuizStepHint } from "../src/utils/basicWorkoutQuizDraft.js";

test("fresh questionnaire does not inherit defaults from quick workouts", () => {
  const quiz = getBasicWorkoutQuizDraft({ goal: "muscle", level: "beginner", days: "3", restrictions: "none" });
  for (const key of ["goal", "level", "location", "days", "duration", "restrictions", "twoDayStructure"]) {
    assert.equal(quiz[key], "");
  }
  assert.ok(getBasicWorkoutQuizStepHint("goal", quiz));
});

test("only explicit answers are restored and unsupported answers stay empty", () => {
  const quiz = getBasicWorkoutQuizDraft({ longPlanAnswers: { goal: "fat_loss", level: "middle", days: 2 } });
  assert.equal(quiz.goal, "fat_loss");
  assert.equal(quiz.level, "");
  assert.equal(quiz.days, "2");
  assert.equal(getBasicWorkoutQuizStepHint("goal", quiz), "");
  assert.ok(getBasicWorkoutQuizStepHint("level", quiz));
});

test("other restriction needs details and two days need an explicit structure", () => {
  const quiz = getBasicWorkoutQuizDraft({ longPlanAnswers: { restrictions: "other", days: "2" } });
  assert.ok(getBasicWorkoutQuizStepHint("restrictions", quiz));
  assert.ok(getBasicWorkoutQuizStepHint("planPreferences", quiz));
  assert.equal(getBasicWorkoutQuizStepHint("restrictions", { ...quiz, restrictionDetails: "Без прыжков" }), "");
  assert.equal(getBasicWorkoutQuizStepHint("planPreferences", { ...quiz, twoDayStructure: "balanced_full_body" }), "");
  assert.equal(getBasicWorkoutQuizStepHint("planPreferences", { ...quiz, days: "3" }), "");
});

test("existing generated plan answers remain editable without defaults for missing fields", () => {
  const quiz = getBasicWorkoutQuizDraft({ goal: "strength", generatedPlan: { workouts: [] } });
  assert.equal(quiz.goal, "strength");
  assert.equal(quiz.days, "");
});

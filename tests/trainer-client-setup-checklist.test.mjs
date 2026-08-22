import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildNextTrainerClientSetupChecklist,
  getTrainerClientSetupChecklist,
  hasCompletedClientQuestionnaire
} from "../src/utils/trainerClientSetupChecklist.js";

test("trainer setup opens only after the client completed the onboarding questionnaire", () => {
  assert.equal(hasCompletedClientQuestionnaire({ role: "client", aiNutritionProfile: { weight: 67.7, height: 175, age: 35, sex: "female" } }), true);
  assert.equal(hasCompletedClientQuestionnaire({ role: "client", aiNutritionProfile: { weight: 67.7, height: 175, age: 35 } }), false);
  assert.equal(hasCompletedClientQuestionnaire({ role: "trainer", firstSetupCompleted: true }), false);
});

test("trainer setup progresses in the intended subscription-program-nutrition-notifications order", () => {
  const first = getTrainerClientSetupChecklist({});
  assert.equal(first.currentStep, "subscription");
  const second = buildNextTrainerClientSetupChecklist(first, "subscription", "2026-08-13T10:00:00.000Z");
  assert.equal(second.currentStep, "program");
  const third = buildNextTrainerClientSetupChecklist(second, "program", "2026-08-13T10:01:00.000Z");
  assert.equal(third.currentStep, "nutrition");
  const fourth = buildNextTrainerClientSetupChecklist(third, "nutrition", "2026-08-13T10:02:00.000Z");
  const complete = buildNextTrainerClientSetupChecklist(fourth, "notifications", "2026-08-13T10:03:00.000Z");
  assert.equal(complete.status, "completed");
  assert.equal(complete.currentStep, null);

  const reopened = getTrainerClientSetupChecklist({
    trainerSetupChecklist: JSON.parse(JSON.stringify(complete))
  });
  assert.equal(reopened.status, "completed");
  assert.equal(reopened.currentStep, null);
  assert.deepEqual(reopened.completedSteps, complete.completedSteps);
});

test("trainer setup adjusts the client copy before assigning a selected program", async () => {
  const source = await readFile("src/components/trainer/TrainerClientSetupFlowModal.jsx", "utf8");

  assert.match(source, /const \[programAdjustmentOpen, setProgramAdjustmentOpen\] = useState\(false\)/);
  assert.match(source, /buildClientWorkoutsFromTemplate\(selectedProgram \|\| \{\}\)/);
  assert.match(source, /getTrainerProgramAssignmentExercises\(programWorkouts\)/);
  assert.match(source, /setProgramAdjustmentOpen\(true\)/);
  assert.match(source, /onAssignProgram\?\.\(\{ loadAdjustments, skipConfirmation: true \}\)/);
});

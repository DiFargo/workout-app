import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildNextTrainerClientSetupChecklist,
  getTrainerClientSetupChecklist,
  hasCompletedClientQuestionnaire
} from "../src/utils/trainerClientSetupChecklist.js";
import { buildSubscriptionFromTrainerSetupSchedule } from "../src/utils/trainerSetupSchedule.js";

test("trainer setup opens only after the client completed the onboarding questionnaire", () => {
  assert.equal(hasCompletedClientQuestionnaire({ role: "client", aiNutritionProfile: { weight: 67.7, height: 175, age: 35, sex: "female" } }), true);
  assert.equal(hasCompletedClientQuestionnaire({ role: "client", aiNutritionProfile: { weight: 67.7, height: 175, age: 35 } }), false);
  assert.equal(hasCompletedClientQuestionnaire({ role: "trainer", firstSetupCompleted: true }), false);
});

test("trainer setup progresses from program to dates, nutrition and notifications", () => {
  const first = getTrainerClientSetupChecklist({});
  assert.equal(first.version, 2);
  assert.equal(first.currentStep, "program");
  const second = buildNextTrainerClientSetupChecklist(first, "program", "2026-08-13T10:00:00.000Z");
  assert.equal(second.currentStep, "schedule");
  const third = buildNextTrainerClientSetupChecklist(second, "schedule", "2026-08-13T10:01:00.000Z");
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

test("trainer setup stays closed for legacy clients with an assigned program and schedule", () => {
  const checklist = getTrainerClientSetupChecklist({
    assignedProgramId: "legacy_program",
    workoutCalendar: {
      scheduledDates: ["2026-08-25", "2026-08-29"]
    }
  });

  assert.equal(checklist.status, "completed");
  assert.equal(checklist.currentStep, null);
  assert.deepEqual(checklist.completedSteps, {
    program: true,
    schedule: true,
    nutrition: true,
    notifications: true
  });
});

test("a current incomplete checklist is not silently completed from its saved data", () => {
  const checklist = getTrainerClientSetupChecklist({
    assignedProgramId: "current_program",
    workoutCalendar: {
      scheduledDates: ["2026-08-25", "2026-08-29"]
    },
    trainerSetupChecklist: {
      version: 2,
      completedSteps: { program: true, schedule: false, nutrition: false, notifications: false }
    }
  });

  assert.equal(checklist.status, "in_progress");
  assert.equal(checklist.currentStep, "schedule");
});

test("the schedule creates an aligned subscription period and session count", () => {
  const subscription = buildSubscriptionFromTrainerSetupSchedule({ usedSessions: 2 }, [
    "2026-09-18",
    "2026-09-03",
    "2026-09-11",
    "2026-09-11"
  ]);

  assert.equal(subscription.startDate, "2026-09-03");
  assert.equal(subscription.endDate, "2026-09-18");
  assert.equal(subscription.purchasedSessions, 3);
  assert.equal(subscription.usedSessions, 2);
  assert.equal(subscription.remainingSessions, 1);
});

test("trainer setup adjusts the client copy before assigning a selected program", async () => {
  const source = await readFile("src/components/trainer/TrainerClientSetupFlowModal.jsx", "utf8");

  assert.match(source, /const \[programAdjustmentOpen, setProgramAdjustmentOpen\] = useState\(false\)/);
  assert.match(source, /buildClientWorkoutsFromTemplate\(selectedProgram \|\| \{\}\)/);
  assert.match(source, /getTrainerProgramAssignmentExercises\(programWorkouts\)/);
  assert.match(source, /setProgramAdjustmentOpen\(true\)/);
  assert.match(source, /onAssignProgram\?\.\(\{ loadAdjustments, skipConfirmation: true \}\)/);
  assert.match(source, /const STEPS = \["program", "schedule", "nutrition", "notifications"\]/);
  assert.match(source, /title: "Назначьте даты тренировок"/);
  assert.match(source, /onSaveWorkoutSchedule\?\.\(scheduleDates, \{ assignmentKey: assignedProgramKey \}\)/);
  assert.match(source, /Абонемент сформируется автоматически/);
  assert.match(source, /programAdjustmentOpen \? "Назад к выбору" : "Назад"/);
  assert.match(source, /type="number"\s*\n\s*min="0"\s*\n\s*inputMode="decimal"/);
  assert.match(source, /sanitizeExerciseWeightInput\(event\.target\.value\)/);
});

test("trainer setup asks before closing unfinished client configuration", async () => {
  const source = await readFile("src/components/trainer/TrainerClientSetupFlowModal.jsx", "utf8");

  assert.match(source, /const \[closeWarningOpen, setCloseWarningOpen\] = useState\(false\)/);
  assert.match(source, /const PENDING_STEP_LABELS/);
  assert.match(source, /function requestClose\(\)/);
  assert.match(source, /Закрыть первичную настройку\?/);
  assert.match(source, /Продолжить настройку/);
  assert.match(source, /Закрыть мастер/);
});

test("trainer setup offers ready nutrition presets alongside manual values", async () => {
  const source = await readFile("src/components/trainer/TrainerClientSetupFlowModal.jsx", "utf8");

  assert.match(source, /nutritionPlanOptions = \[\]/);
  assert.match(source, /Вариант плана питания/);
  assert.match(source, /function selectNutritionPreset\(value\)/);
  assert.match(source, /Индивидуальные значения/);
  assert.match(source, /disabled=\{!isIndividualNutritionPreset\}/);
});

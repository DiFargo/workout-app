import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildNextTrainerClientSetupChecklist,
  getTrainerClientSetupChecklist,
  hasCompletedClientQuestionnaire
} from "../src/utils/trainerClientSetupChecklist.js";
import { buildSubscriptionFromTrainerSetupSchedule } from "../src/utils/trainerSetupSchedule.js";
import { buildClientProgramLifecycleMetadata } from "../src/utils/trainerProgramLifecycle.js";

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

const durableAssignment = {
  assignedProgramId: "trainer_program",
  assignedProgramAssignedByUid: "trainer-fixture",
  assignedProgramAddedAt: "2026-10-17T12:00:00.000Z",
  assignedProgramLifecycleStatus: "active",
  assignedProgramVisibility: "client_active",
  trainerSetupChecklist: {
    version: 2,
    completedSteps: { program: false, schedule: false, nutrition: false, notifications: false }
  }
};

test("remount recovers only the program step from a durable trainer assignment", () => {
  const client = JSON.parse(JSON.stringify(durableAssignment));
  const checklist = getTrainerClientSetupChecklist(client);
  assert.equal(checklist.status, "in_progress");
  assert.equal(checklist.currentStep, "schedule");
  assert.deepEqual(checklist.completedSteps, {
    program: true, schedule: false, nutrition: false, notifications: false
  });
  assert.equal(client.trainerSetupChecklist.completedSteps.program, false, "normalization does not mutate saved input");
});

test("assignment writer lifecycle metadata and profile fields recover the committed program after remount", () => {
  const assignedAt = "2026-10-17T12:00:00.000Z";
  const savedProfile = {
    trainerSetupChecklist: durableAssignment.trainerSetupChecklist,
    assignedProgramId: "trainer_program",
    assignedProgramAt: assignedAt,
    assignedProgramAddedAt: assignedAt,
    assignedProgramUpdatedAt: assignedAt,
    assignedWorkoutCount: 3,
    ...buildClientProgramLifecycleMetadata({ assignedAt, assignedByUid: "trainer-fixture" })
  };
  const checklist = getTrainerClientSetupChecklist(JSON.parse(JSON.stringify(savedProfile)));
  assert.equal(checklist.currentStep, "schedule");
  assert.deepEqual(checklist.completedSteps, {
    program: true, schedule: false, nutrition: false, notifications: false
  });
});

for (const stampField of ["assignedProgramAddedAt", "assignedProgramAt", "assignedProgramPublishedAt"]) {
  test(`durable assignment recovery accepts ${stampField}`, () => {
    const client = { ...durableAssignment, assignedProgramAddedAt: undefined, [stampField]: "2026-10-17T12:00:00.000Z" };
    assert.equal(getTrainerClientSetupChecklist(client).currentStep, "schedule");
  });
}

for (const [name, patch] of [
  ["missing program", { assignedProgramId: "" }],
  ["missing assigner", { assignedProgramAssignedByUid: "" }],
  ["blank assigner", { assignedProgramAssignedByUid: "  " }],
  ["missing assignment stamp", { assignedProgramAddedAt: undefined }],
  ["blank assignment stamp", { assignedProgramAddedAt: "  " }],
  ["archived lifecycle", { assignedProgramLifecycleStatus: "archived" }],
  ["client archived visibility", { assignedProgramVisibility: "client_archived" }],
  ["trainer archived visibility", { assignedProgramVisibility: "trainer_archived" }],
  ["archived visibility", { assignedProgramVisibility: "archived" }],
  ["basic program ID", { assignedProgramId: "basic_strength" }],
  ["basic program version", { assignedProgramUpdatedAt: "basic:strength" }]
]) {
  test(`program recovery excludes ${name}`, () => {
    const checklist = getTrainerClientSetupChecklist({ ...durableAssignment, ...patch });
    assert.equal(checklist.currentStep, "program");
    assert.deepEqual(checklist.completedSteps, durableAssignment.trainerSetupChecklist.completedSteps);
  });
}

test("program recovery preserves explicitly completed other steps without inferring the rest", () => {
  const checklist = getTrainerClientSetupChecklist({
    ...durableAssignment,
    workoutCalendar: { scheduledDates: ["2026-10-18"] },
    nutritionPlan: { calories: 2000 },
    telegramNotificationsEnabled: true,
    trainerSetupChecklist: {
      version: 2,
      completedSteps: { program: false, schedule: true, nutrition: false, notifications: true }
    }
  });
  assert.equal(checklist.currentStep, "nutrition");
  assert.deepEqual(checklist.completedSteps, {
    program: true, schedule: true, nutrition: false, notifications: true
  });
});

test("saving a schedule does not create or replace subscription counters and period", () => {
  const original = { usedSessions: 2 };
  const subscription = buildSubscriptionFromTrainerSetupSchedule(original, [
    "2026-09-18",
    "2026-09-03",
    "2026-09-11",
    "2026-09-11"
  ]);

  assert.deepEqual(subscription, original);
});

test("trainer setup adjusts the client copy before assigning a selected program", async () => {
  const source = await readFile("src/components/trainer/TrainerClientSetupFlowModal.jsx", "utf8");

  assert.match(source, /const \[programAdjustmentOpen, setProgramAdjustmentOpen\] = useState\(false\)/);
  assert.match(source, /buildClientWorkoutsFromTemplate\(selectedProgram \|\| \{\}\)/);
  assert.match(source, /getTrainerProgramAssignmentExercises\(programWorkouts\)/);
  assert.match(source, /setProgramAdjustmentOpen\(true\)/);
  assert.match(source, /onAssignProgram\?\.\(\{ loadAdjustments, skipConfirmation: true, throwOnError: true \}\)/);
  assert.match(source, /const STEPS = \["program", "schedule", "nutrition", "notifications"\]/);
  assert.match(source, /title: "Назначьте даты тренировок"/);
  assert.match(source, /workoutDates: scheduleValidation.workoutDates/);
  assert.match(source, /assignedWorkouts, \{ throwOnError: true \}/);
  assert.match(source, /Расписание и абонемент — отдельно/);
  assert.match(source, /programAdjustmentOpen && !pendingProgramStep \? "Назад к выбору" : "Назад"/);
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

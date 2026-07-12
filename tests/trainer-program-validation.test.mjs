import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validateTrainerWorkoutScheduleDates,
  validateTrainerWorkoutsForAssignment
} from "../src/utils/trainerProgramValidation.js";

const validTemplate = {
  id: "program_1",
  name: "MVP program",
  workouts: [
    {
      id: "day_1",
      name: "Day 1",
      exercises: [
        {
          id: "ex_1",
          name: "Squat",
          sets: [
            { reps: 8, weight: "40" },
            { reps: "8-10", weight: "" }
          ]
        }
      ]
    }
  ]
};

test("trainer program validation accepts a complete assignable program", () => {
  const result = validateTrainerWorkoutsForAssignment({
    programName: validTemplate.name,
    template: validTemplate,
    workouts: validTemplate.workouts
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("trainer program validation rejects missing program name", () => {
  const result = validateTrainerWorkoutsForAssignment({
    template: { ...validTemplate, name: "" },
    workouts: validTemplate.workouts
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "program_name_required");
  assert.equal(result.message, "У программы должно быть название перед назначением.");
});

test("trainer program validation rejects workouts without exercises", () => {
  const result = validateTrainerWorkoutsForAssignment({
    template: {
      name: "Broken",
      workouts: [{ id: "day_1", name: "Day 1", exercises: [] }]
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "workout_exercises_required");
});

test("trainer program validation rejects empty source workout and exercise names", () => {
  const result = validateTrainerWorkoutsForAssignment({
    template: {
      name: "Broken",
      workouts: [
        {
          id: "day_1",
          name: "",
          exercises: [{ id: "ex_1", name: "", sets: [{ reps: 8, weight: "" }] }]
        }
      ]
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "workout_name_required"), true);
  assert.equal(result.errors.some((error) => error.code === "exercise_name_required"), true);
});

test("trainer program validation rejects negative reps and invalid weight", () => {
  const result = validateTrainerWorkoutsForAssignment({
    template: {
      name: "Broken",
      workouts: [
        {
          id: "day_1",
          name: "Day 1",
          exercises: [
            { id: "ex_1", name: "Squat", sets: [{ reps: -1, weight: "heavy" }] }
          ]
        }
      ]
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "set_reps_invalid"), true);
  assert.equal(result.errors.some((error) => error.code === "set_weight_invalid"), true);
});

test("trainer schedule validation requires exact unique dates", () => {
  const duplicateResult = validateTrainerWorkoutScheduleDates(["2026-07-10", "2026-07-10", "2026-07-12"], 2);
  const invalidResult = validateTrainerWorkoutScheduleDates(["2026-07-10", "tomorrow"], 2);
  const mismatchResult = validateTrainerWorkoutScheduleDates(["2026-07-10"], 2);
  const validResult = validateTrainerWorkoutScheduleDates(["2026-07-12", "2026-07-10"], 2);

  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicateResult.errors.some((error) => error.code === "schedule_date_duplicate"), true);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.errors.some((error) => error.code === "schedule_date_invalid"), true);
  assert.equal(mismatchResult.ok, false);
  assert.equal(mismatchResult.errors.some((error) => error.code === "schedule_date_count_mismatch"), true);
  assert.equal(validResult.ok, true);
  assert.deepEqual(validResult.cleanDates, ["2026-07-10", "2026-07-12"]);
});

test("trainer validation messages stay readable", () => {
  const programResult = validateTrainerWorkoutsForAssignment({
    template: {
      name: "Broken",
      workouts: [{ id: "day_1", name: "Day 1", exercises: [] }]
    }
  });
  const scheduleResult = validateTrainerWorkoutScheduleDates(["tomorrow"], 1);
  const messages = [
    programResult.message,
    scheduleResult.message,
    ...programResult.errors.map((error) => error.message),
    ...scheduleResult.errors.map((error) => error.message)
  ];

  messages.forEach((message) => {
    assert.doesNotMatch(message, /Ð|Ñ|â|Â/);
  });
  assert.match(programResult.message, /упражнение/);
  assert.match(scheduleResult.message, /дата/);
});

test("trainer handlers block assignment through validation before writes", () => {
  const assignSource = readFileSync("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");
  const calendarSource = readFileSync("src/features/trainer/trainerClientCalendarHandlers.js", "utf8");

  assert.match(assignSource, /validateTrainerWorkoutsForAssignment/);
  assert.match(assignSource, /programValidation\.ok/);
  assert.match(calendarSource, /validateTrainerWorkoutScheduleDates/);
  assert.match(calendarSource, /scheduleValidation\.ok/);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  isBasicWorkoutPlanItem,
  isWorkoutPlanForMode,
  resolveWorkoutPlanMode
} from "../src/utils/workoutPlanMode.js";

test("workout mode keeps the explicitly selected individual plan", () => {
  assert.equal(resolveWorkoutPlanMode({
    options: { mode: "individual" },
    workoutModePreference: { mode: "basic" }
  }), "individual");
});

test("workout mode uses the saved basic preference when no mode is requested", () => {
  assert.equal(resolveWorkoutPlanMode({
    workoutModePreference: { mode: "basic" }
  }), "basic");
});

test("basic workouts are identified without treating trainer workouts as basic", () => {
  assert.equal(isBasicWorkoutPlanItem({ source: "basic" }), true);
  assert.equal(isBasicWorkoutPlanItem({ assignedProgramUpdatedAt: "basic:ai_plan" }), true);
  assert.equal(isBasicWorkoutPlanItem({ assignedProgramUpdatedAt: "trainer:program_1" }), false);
});

test("dashboard plan matches the selected workout mode", () => {
  const basicPlan = {
    source: "basic",
    workouts: [{ id: "basic_1", source: "basic" }]
  };
  const individualPlan = {
    assignedProgramUpdatedAt: "trainer:program_1",
    workouts: [{ id: "individual_1", assignedProgramUpdatedAt: "trainer:program_1" }]
  };

  assert.equal(isWorkoutPlanForMode(basicPlan, "basic"), true);
  assert.equal(isWorkoutPlanForMode(basicPlan, "individual"), false);
  assert.equal(isWorkoutPlanForMode(individualPlan, "individual"), true);
  assert.equal(isWorkoutPlanForMode(individualPlan, "basic"), false);
});

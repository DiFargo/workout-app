import test from "node:test";
import assert from "node:assert/strict";

import { buildBasicWorkoutPlanFromQuiz } from "../src/utils/basicWorkoutPlanBuilder.js";

const plans = {
  beginner: {
    id: "beginner",
    name: "Beginner",
    description: "Start plan",
    workouts: [
      { id: "b2", name: "Day 2", order: 2 },
      { id: "b1", name: "Day 1", order: 1 },
      { id: "b3", name: "Day 3", order: 3 }
    ]
  },
  muscle: {
    id: "muscle",
    name: "Muscle",
    description: "Muscle plan",
    workouts: [
      { id: "m1", name: "Day 1", order: 1 },
      { id: "m2", name: "Day 2", order: 2 },
      { id: "m3", name: "Day 3", order: 3 },
      { id: "m4", name: "Day 4", order: 4 }
    ]
  }
};

test("basic workout quiz chooses beginner plan and limits days", () => {
  const plan = buildBasicWorkoutPlanFromQuiz({ goal: "health", days: "2" }, plans);

  assert.equal(plan.id, "beginner");
  assert.deepEqual(plan.workouts.map((workout) => workout.id), ["b1", "b2"]);
});

test("basic workout quiz chooses muscle plan for muscle goal or four days", () => {
  assert.equal(buildBasicWorkoutPlanFromQuiz({ goal: "muscle", days: "3" }, plans).id, "muscle");
  assert.equal(buildBasicWorkoutPlanFromQuiz({ goal: "health", days: "4" }, plans).id, "muscle");
});

test("basic workout quiz falls back to all days when day count is invalid", () => {
  const plan = buildBasicWorkoutPlanFromQuiz({ goal: "health", days: "" }, plans);

  assert.deepEqual(plan.workouts.map((workout) => workout.id), ["b1", "b2", "b3"]);
});

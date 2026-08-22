import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBasicWorkoutStartingWeightFeedback,
  applyBasicWorkoutStartingWeights
} from "../src/utils/basicWorkoutStartingWeights.js";

function createPlan() {
  return {
    source: "basic",
    workouts: [
      {
        id: "day_1",
        exercises: [
          {
            id: "leg_press_today",
            name: "Жим ногами",
            sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }]
          },
          {
            id: "abs_today",
            name: "Пресс",
            sets: [{ reps: 15, weight: "" }]
          }
        ]
      },
      {
        id: "day_2",
        exercises: [
          {
            id: "leg_press_next",
            name: "Жим ногами",
            sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }]
          }
        ]
      }
    ]
  };
}

const profile = {
  weight: "80",
  height: "180",
  age: "30",
  activity: "medium",
  sex: "male",
  goal: "recomp"
};

const quiz = {
  goal: "general_fitness",
  level: "beginner",
  restrictions: "none"
};

test("basic plans receive a conservative starting-weight estimate from the registration profile", () => {
  const plan = applyBasicWorkoutStartingWeights(createPlan(), { profile, quiz });
  const [legPress, abs] = plan.workouts[0].exercises;

  assert.equal(plan.startingWeightProfile.source, "profile");
  assert.equal(legPress.sets[0].weight, "24.5");
  assert.equal(legPress.sets[0].startingWeightSource, "estimate");
  assert.equal(legPress.sets[0].startingWeightConfirmed, false);
  assert.equal(abs.sets[0].weight, "");
  assert.equal(abs.sets[0].startingWeightSource, undefined);
});

test("completed history wins over an estimated basic starting weight", () => {
  const plan = applyBasicWorkoutStartingWeights(createPlan(), {
    profile,
    quiz,
    history: [{
      date: "2026-08-01T12:00:00.000Z",
      exercises: [{
        name: "Жим ногами",
        sets: [{ completed: true, reps: 12, weight: "72.5" }]
      }]
    }]
  });
  const legPress = plan.workouts[0].exercises[0];

  assert.equal(legPress.sets[0].weight, "72.5");
  assert.equal(legPress.sets[0].startingWeightSource, "history");
  assert.equal(legPress.sets[0].startingWeightConfirmed, true);
});

test("first-set feedback calibrates the remaining and future matching basic exercises", () => {
  const estimatedPlan = applyBasicWorkoutStartingWeights(createPlan(), { profile, quiz });
  estimatedPlan.workouts[0].exercises[0].sets[0].completed = true;

  const result = applyBasicWorkoutStartingWeightFeedback(
    estimatedPlan,
    "day_1",
    "leg_press_today",
    "too_easy"
  );
  const currentSets = result.plan.workouts[0].exercises[0].sets;
  const futureSets = result.plan.workouts[1].exercises[0].sets;

  assert.equal(result.changed, true);
  assert.equal(result.weight, "27");
  assert.equal(currentSets[0].weight, "24.5");
  assert.equal(currentSets[1].weight, "27");
  assert.equal(currentSets[0].startingWeightConfirmed, true);
  assert.equal(futureSets[0].weight, "27");
  assert.equal(futureSets[0].startingWeightSource, "calibrated");
});

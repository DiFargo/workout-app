import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBasicWorkoutPlanFromQuiz,
  getBasicWorkoutExpectedWorkoutCount,
  mergeBasicWorkoutPlanWithSavedWorkouts
} from "../src/utils/basicWorkoutPlanBuilder.js";
import { getBasicWorkoutMicrocycles, getBasicWorkoutSummary } from "../src/utils/basicWorkoutPlanStructure.js";
import {
  applyBasicWorkoutSchedule,
  buildDefaultBasicWorkoutSchedule,
  hasCompleteBasicWorkoutSchedule
} from "../src/utils/basicWorkoutSchedule.js";

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

test("ready fallback plan honors five selected workout days", () => {
  const plan = buildBasicWorkoutPlanFromQuiz({ goal: "health", days: "5" }, plans);

  assert.equal(plan.id, "muscle");
  assert.deepEqual(plan.workouts.map((workout) => workout.id), ["m1", "m2", "m3", "m4", "b1"]);
  assert.deepEqual(plan.workouts.map((workout) => workout.order), [1, 2, 3, 4, 5]);
});

test("basic workout quiz falls back to all days when day count is invalid", () => {
  const plan = buildBasicWorkoutPlanFromQuiz({ goal: "health", days: "" }, plans);

  assert.deepEqual(plan.workouts.map((workout) => workout.id), ["b1", "b2", "b3"]);
});

test("basic workout quiz keeps an AI-generated plan and its profile", () => {
  const plan = buildBasicWorkoutPlanFromQuiz({
    goal: "general_fitness",
    level: "beginner",
    location: "home",
    days: "2",
    duration: "90",
    restrictions: "knees",
    twoDayStructure: "balanced_full_body",
    planPreferences: "Больше упражнений на спину",
    generatedPlan: {
      id: "basic_ai_plan",
      name: "Personal plan",
      durationWeeks: 4,
      workouts: [
        {
          id: "ai_day_2",
          name: "Week 1 · Day 2",
          order: 2,
          exercises: [{ name: "Планка", sets: [{ reps: "", weight: "", durationSeconds: 30 }] }]
        },
        { id: "ai_day_1", name: "Week 1 · Day 1", order: 1, exercises: [] }
      ]
    }
  }, plans);

  assert.equal(plan.id, "basic_ai_plan");
  assert.equal(plan.generatedBy, "ai");
  assert.equal(plan.source, "basic");
  assert.equal(plan.quizProfile.location, "home");
  assert.equal(plan.quizProfile.duration, "90");
  assert.equal(plan.quizProfile.restrictions, "knees");
  assert.equal(plan.quizProfile.twoDayStructure, "balanced_full_body");
  assert.equal(plan.quizProfile.planPreferences, "Больше упражнений на спину");
  assert.equal(plan.workouts[1].exercises[0].sets[0].durationSeconds, 30);
  assert.deepEqual(plan.workouts.map((workout) => workout.id), ["ai_day_1", "ai_day_2"]);
});

test("basic workout quiz keeps the source of a safe fallback plan", () => {
  const plan = buildBasicWorkoutPlanFromQuiz({
    goal: "general_fitness",
    generatedPlan: {
      id: "basic_fallback_plan",
      name: "Fallback plan",
      generatedBy: "fallback",
      workouts: [{ id: "fallback_day_1", name: "Day 1", exercises: [] }]
    }
  }, plans);

  assert.equal(plan.generatedBy, "fallback");
  assert.equal(plan.source, "basic");
});

test("basic plan keeps all four weeks when Firebase has only part of the workout documents", () => {
  const fullPlan = {
    id: "basic_ai_full",
    basicPlanId: "basic_ai_full",
    durationWeeks: 4,
    profile: { days: "4" },
    workouts: Array.from({ length: 16 }, (_, index) => ({
      id: `week_${Math.floor(index / 4) + 1}_day_${(index % 4) + 1}`,
      order: index + 1,
      name: `Неделя ${Math.floor(index / 4) + 1} · День ${(index % 4) + 1}`,
      exercises: [{ id: `exercise_${index + 1}`, name: "Планка", sets: [] }]
    }))
  };

  const merged = mergeBasicWorkoutPlanWithSavedWorkouts(fullPlan, [
    {
      id: "week_1_day_1",
      status: "completed",
      exercises: [{ id: "exercise_1", name: "Планка", sets: [{ durationSeconds: 35 }] }]
    },
    { id: "week_1_day_2", status: "planned", exercises: [] }
  ]);

  assert.equal(merged.workouts.length, 16);
  assert.equal(merged.workouts[0].status, "completed");
  assert.deepEqual(merged.workouts[0].exercises[0].sets, [{ durationSeconds: 35 }]);
  assert.equal(merged.workouts[2].id, "week_1_day_3");
  assert.equal(merged.workouts[15].id, "week_4_day_4");
  assert.equal(getBasicWorkoutExpectedWorkoutCount(merged), 16);
});

test("partial four-week snapshot cannot be interpreted as a completed plan", () => {
  assert.equal(getBasicWorkoutExpectedWorkoutCount({
    source: "basic",
    durationWeeks: 4,
    profile: { days: "4" },
    workouts: [{ id: "week_1_day_1" }, { id: "week_1_day_2" }]
  }), 16);
});

test("basic plan groups four weeks into two compact microcycles", () => {
  const plan = {
    structure: "variants_then_progression",
    quizProfile: { days: "2" },
    microcycles: [
      { number: 1, label: "Микроцикл 1 · Недели 1–2" },
      { number: 2, label: "Микроцикл 2 · Недели 3–4" }
    ],
    workouts: [
      { id: "w1d1", order: 1, weekNumber: 1, dayNumber: 1 },
      { id: "w1d2", order: 2, weekNumber: 1, dayNumber: 2 },
      { id: "w2d1", order: 3, weekNumber: 2, dayNumber: 1 },
      { id: "w2d2", order: 4, weekNumber: 2, dayNumber: 2 },
      { id: "w3d1", order: 5, weekNumber: 3, dayNumber: 1 },
      { id: "w3d2", order: 6, weekNumber: 3, dayNumber: 2 },
      { id: "w4d1", order: 7, weekNumber: 4, dayNumber: 1 },
      { id: "w4d2", order: 8, weekNumber: 4, dayNumber: 2 }
    ]
  };
  const microcycles = getBasicWorkoutMicrocycles(plan);

  assert.deepEqual(microcycles.map((cycle) => cycle.label), [
    "Микроцикл 1 · Недели 1–2",
    "Микроцикл 2 · Недели 3–4"
  ]);
  assert.deepEqual(microcycles.map((cycle) => cycle.items.map((item) => item.workout.id)), [
    ["w1d1", "w1d2", "w2d1", "w2d2"],
    ["w3d1", "w3d2", "w4d1", "w4d2"]
  ]);
});

test("basic plan summary shows exercises, sets and repetitions", () => {
  assert.equal(getBasicWorkoutSummary({
    exercises: [
      { sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] },
      { sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] }
    ]
  }), "2 упражнения · 3 подхода · 12 повторений");
});

test("basic plan gets an editable default schedule and keeps dates on workouts", () => {
  const dates = buildDefaultBasicWorkoutSchedule(4, 2, new Date(2026, 7, 4));
  const plan = applyBasicWorkoutSchedule({
    workouts: [{ id: "one" }, { id: "two" }, { id: "three" }, { id: "four" }]
  }, dates);

  assert.deepEqual(dates, ["2026-08-04", "2026-08-07", "2026-08-11", "2026-08-14"]);
  assert.deepEqual(plan.workouts.map((workout) => workout.scheduledDate), dates);
  assert.deepEqual(plan.workouts.map((workout) => workout.plannedDate), dates);
});

test("basic plan schedule must include one date for every workout before it can be saved", () => {
  assert.equal(hasCompleteBasicWorkoutSchedule(["2026-08-04", "2026-08-07"], 3), false);
  assert.equal(hasCompleteBasicWorkoutSchedule(["2026-08-04", "2026-08-07", "2026-08-11"], 3), true);
  assert.equal(hasCompleteBasicWorkoutSchedule(["2026-08-04", "2026-08-07", "2026-08-11", "2026-08-14"], 3), false);
});

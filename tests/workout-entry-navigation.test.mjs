import test from "node:test";
import assert from "node:assert/strict";

import { createWorkoutEntryNavigation } from "../src/features/client/workouts/workoutEntryNavigation.js";

function createNavigation(plan) {
  const openedPages = [];
  const originalWindow = global.window;
  global.window = {
    requestAnimationFrame(callback) { callback(); },
    scrollTo() {}
  };

  const navigation = createWorkoutEntryNavigation({
    APP_PAGES: {
      WORKOUTS: "workouts",
      BASIC_WORKOUT_TODAY: "basicWorkoutToday",
      BASIC_WORKOUT_QUIZ: "basicWorkoutQuiz"
    },
    auth: { currentUser: null },
    user: null,
    plan,
    workoutModePreference: { mode: "basic" },
    workoutModeRemember: false,
    setWorkoutModePreference() {},
    setWorkoutModeRemember() {},
    setSelectedWorkoutId() {},
    setIndividualWorkoutIndex() {},
    setIndividualWorkoutIndexInitialized() {},
    setPlan() {},
    setPage(page) { openedPages.push(page); },
    loadWorkoutsFromFirebase: async () => plan
  });

  return {
    navigation,
    openedPages,
    restoreWindow() { global.window = originalWindow; }
  };
}

test("basic entry opens an existing basic plan instead of the generator", () => {
  const harness = createNavigation({
    source: "basic",
    workouts: [{ id: "basic-1", source: "basic" }]
  });
  try {
    harness.navigation.openSavedBasicWorkoutsOrQuiz();
    assert.deepEqual(harness.openedPages, ["workouts"]);
  } finally {
    harness.restoreWindow();
  }
});

test("basic entry opens today's constructor when no plan is saved", () => {
  const harness = createNavigation({ source: "basic", workouts: [] });
  try {
    harness.navigation.openSavedBasicWorkoutsOrQuiz();
    assert.deepEqual(harness.openedPages, ["basicWorkoutToday"]);
  } finally {
    harness.restoreWindow();
  }
});

test("basic plan settings open the four-week questionnaire", () => {
  const harness = createNavigation({ source: "basic", workouts: [] });
  try {
    harness.navigation.openBasicWorkoutQuiz();
    assert.deepEqual(harness.openedPages, ["basicWorkoutQuiz"]);
  } finally {
    harness.restoreWindow();
  }
});

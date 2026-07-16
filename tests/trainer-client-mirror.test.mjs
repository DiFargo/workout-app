import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminClientNutritionStateFromRoot,
  getTrainerClientMirrorPayload
} from "../src/utils/trainerClientMirror.js";

test("admin client nutrition state keeps trainer goals aligned with root values", () => {
  const state = buildAdminClientNutritionStateFromRoot({
    nutritionGoals: {
      calories: 2300,
      protein: 180,
      fat: 70,
      carbs: 260
    },
    nutritionState: {
      goals: {
        calories: 2100,
        protein: 150,
        fat: 60,
        carbs: 220
      },
      days: {
        "2026-06-19": { foods: [{ calories: 500 }] }
      }
    }
  });

  assert.deepEqual(state.goals, {
    calories: 2300,
    protein: 180,
    fat: 70,
    carbs: 260,
    water: 2500
  });
  assert.deepEqual(Object.keys(state.days), ["2026-06-19"]);
});

test("admin client nutrition state falls back to ai plan start macros", () => {
  const state = buildAdminClientNutritionStateFromRoot({
    aiNutritionPlan: {
      start: {
        calories: 2550,
        protein: 190,
        fat: 80,
        carbs: 300
      }
    }
  });

  assert.equal(state.goals.calories, 2550);
  assert.equal(state.goals.protein, 190);
  assert.equal(state.goals.fat, 80);
  assert.equal(state.goals.carbs, 300);
});

test("trainer client mirror payload normalizes identifiers and embedded nutrition", () => {
  const payload = getTrainerClientMirrorPayload({
    uid: "client_1",
    email: "client@example.com",
    assignedTrainerId: "trainer_1",
    assignedTrainerEmail: "TRAINER@EXAMPLE.COM",
    name: "Client Name",
    nutritionGoals: {
      calories: 2400,
      protein: 170,
      fat: 75,
      carbs: 270
    },
    workoutCalendar: {
      trainingDays: ["mon", "fri"],
      workoutTime: "18:00"
    }
  });

  assert.equal(payload.clientId, "client_1");
  assert.equal(payload.trainerId, "trainer_1");
  assert.equal(payload.trainerEmail, "trainer@example.com");
  assert.deepEqual(payload.trainingDays, ["mon", "fri"]);
  assert.deepEqual(payload.nutritionState.goals, {
    calories: 2400,
    protein: 170,
    fat: 75,
    carbs: 270,
    water: 2500
  });
  assert.match(payload.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

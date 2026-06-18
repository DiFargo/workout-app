import assert from "node:assert/strict";
import test from "node:test";
import { getClientAttentionState } from "../src/utils/trainerAttention.js";

test("future scheduled workouts do not trigger attention before they are due", () => {
  const now = new Date("2026-06-16T12:00:00");
  const attention = getClientAttentionState(
    {
      assignedProgramId: "program_1",
      workoutCalendar: {
        scheduledDates: ["2026-06-17", "2026-06-20"]
      }
    },
    {
      assignedProgramId: "program_1",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00",
      workouts7: 0,
      nutritionDays7: 4,
      lastNutritionAt: "2026-06-16"
    },
    now
  );

  assert.equal(attention, null);
});

test("past planned workout without completion requires trainer attention", () => {
  const now = new Date("2026-06-18T12:00:00");
  const attention = getClientAttentionState(
    {
      assignedProgramId: "program_1",
      workoutCalendar: {
        scheduledDates: ["2026-06-17", "2026-06-20"]
      }
    },
    {
      assignedProgramId: "program_1",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00",
      workoutDateKeysCurrentWeek: [],
      nutritionDays7: 4,
      lastNutritionAt: "2026-06-18"
    },
    now
  );

  assert.deepEqual(attention, {
    type: "workout",
    reason: "Не закрыта плановая тренировка"
  });
});

test("weekly training pattern waits until planned weekday has passed", () => {
  const tuesday = new Date("2026-06-16T12:00:00");
  const thursday = new Date("2026-06-18T12:00:00");
  const client = {
    assignedProgramId: "program_1",
    trainingDays: ["wed", "sat"]
  };
  const summary = {
    assignedProgramId: "program_1",
    assignedProgramUpdatedAt: "2026-06-10T10:00:00",
    nutritionDays7: 4,
    lastNutritionAt: "2026-06-16"
  };

  assert.equal(getClientAttentionState(client, summary, tuesday), null);
  assert.deepEqual(getClientAttentionState(client, { ...summary, workoutDateKeysCurrentWeek: [] }, thursday), {
    type: "workout",
    reason: "Не закрыта плановая тренировка"
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { getClientAttentionItems, getClientAttentionState, pluralizeRu } from "../src/utils/trainerAttention.js";

test("russian day pluralization matches trainer labels", () => {
  assert.equal(pluralizeRu(1, "день", "дня", "дней"), "день");
  assert.equal(pluralizeRu(3, "день", "дня", "дней"), "дня");
  assert.equal(pluralizeRu(11, "день", "дня", "дней"), "дней");
  assert.equal(pluralizeRu(25, "день", "дня", "дней"), "дней");
});

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

test("active trainer tasks are a client execution status, not trainer attention", () => {
  const now = new Date("2026-06-16T12:00:00");
  const attention = getClientAttentionState(
    {
      assignedProgramId: "program_1",
      workoutCalendar: {
        scheduledDates: ["2026-06-17"]
      }
    },
    {
      assignedProgramId: "program_1",
      activeTrainerTasksCount: 2,
      assignedProgramUpdatedAt: "2026-06-10T10:00:00",
      nutritionDays7: 4,
      lastNutritionAt: "2026-06-16"
    },
    now
  );

  assert.equal(attention, null);
});

test("workout feedback attention is shown before nutrition checks", () => {
  const now = new Date("2026-06-16T12:00:00");
  const attention = getClientAttentionState(
    {
      assignedProgramId: "program_1",
      workoutCalendar: {
        scheduledDates: ["2026-06-17"]
      }
    },
    {
      assignedProgramId: "program_1",
      workoutFeedbackAttention: {
        id: "pain",
        reason: "Клиент сообщил о боли после тренировки"
      },
      assignedProgramUpdatedAt: "2026-06-10T10:00:00",
      nutritionDays7: 0,
      lastNutritionAt: "2026-06-01"
    },
    now
  );

  assert.deepEqual(attention, {
    type: "feedback",
    reason: "Клиент сообщил о боли после тренировки"
  });
});

test("client control exposes every independent issue in priority order", () => {
  const items = getClientAttentionItems(
    {
      assignedProgramId: "program_1",
      workoutCalendar: { scheduledDates: ["2026-06-17"] }
    },
    {
      assignedProgramId: "program_1",
      workoutFeedbackAttention: {
        id: "pain",
        reason: "Клиент сообщил о боли после тренировки"
      },
      nutritionDays7: 0,
      lastNutritionAt: "2026-06-01",
      lastMeasurementAt: "2026-05-25",
      paymentAttention: { id: "overdue", label: "Абонемент требует проверки" }
    },
    new Date("2026-06-16T12:00:00")
  );

  assert.deepEqual(items, [
    { type: "feedback", reason: "Клиент сообщил о боли после тренировки" },
    { type: "nutrition", reason: "Нет питания 15 дней" },
    { type: "measure", reason: "Не взвешивался 22 дня" },
    { type: "payment", reason: "Абонемент требует проверки" }
  ]);
});

test("program ending attention is shown before nutrition checks", () => {
  const now = new Date("2026-06-16T12:00:00");
  const attention = getClientAttentionState(
    {
      assignedProgramId: "program_1",
      workoutCalendar: {
        scheduledDates: ["2026-06-17"]
      }
    },
    {
      assignedProgramId: "program_1",
      programEndingAttention: {
        id: "endingSoon",
        reason: "До конца программы: 1 тренировка"
      },
      assignedProgramUpdatedAt: "2026-06-10T10:00:00",
      nutritionDays7: 0,
      lastNutritionAt: "2026-06-01"
    },
    now
  );

  assert.deepEqual(attention, {
    type: "programEnding",
    reason: "До конца программы: 1 тренировка"
  });
});

test("stale weighing is described separately from a weight plateau", () => {
  const now = new Date("2026-06-30T12:00:00");
  const attention = getClientAttentionState(
    {
      assignedProgramId: "program_1",
      workoutCalendar: { scheduledDates: ["2026-07-01"] }
    },
    {
      assignedProgramId: "program_1",
      nutritionDays7: 4,
      lastNutritionAt: "2026-06-30",
      lastMeasurementAt: "2026-06-08",
      plateau: { isPlateau: true, days: 22 }
    },
    now
  );

  assert.deepEqual(attention, {
    type: "measure",
    reason: "Не взвешивался 22 дня"
  });
});

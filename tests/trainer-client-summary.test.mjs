import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerDashboardSummary,
  getClientActivityStatus,
  getClientAttentionReasons,
  getTrainerCompletedWorkoutCountForAssignment,
  getTrainerClientEmptySummary,
  getTrainerClientFastSummary,
  getTrainerDayWord,
  getTrainerNutritionSummary
} from "../src/utils/trainerClientSummary.js";
import { getTrainerSummaryDateKey } from "../src/utils/trainerSummaryDates.js";

function dateKeyOffset(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return getTrainerSummaryDateKey(date.getTime());
}

test("trainer nutrition summary excludes today from seven day average", () => {
  const today = dateKeyOffset(0);
  const yesterday = dateKeyOffset(-1);
  const twoDaysAgo = dateKeyOffset(-2);
  const eightDaysAgo = dateKeyOffset(-8);
  const summary = getTrainerNutritionSummary({
    days: {
      [today]: { foods: [{ calories: 5000 }] },
      [yesterday]: { foods: [{ calories: 2000 }] },
      [twoDaysAgo]: { foods: [{ calories: 1000 }] },
      [eightDaysAgo]: { foods: [{ calories: 3000 }] }
    }
  });

  assert.equal(summary.lastNutritionAt, today);
  assert.equal(summary.nutritionDays7, 2);
  assert.equal(summary.averageCalories7, 1500);
});

test("trainer completed workout count matches current assignment version", () => {
  const assignedAt = "2026-06-20T10:00:00.000Z";
  const history = [
    { workoutId: "w1", assignedProgramUpdatedAt: assignedAt },
    { workoutId: "w1", assignedProgramUpdatedAt: assignedAt },
    { workoutId: "w2", assignmentVersion: assignedAt },
    { workoutId: "old", assignedProgramUpdatedAt: "2026-06-01T10:00:00.000Z" },
    { assignedProgramUpdatedAt: assignedAt }
  ];

  assert.equal(getTrainerCompletedWorkoutCountForAssignment(history, assignedAt), 2);
  assert.equal(getTrainerCompletedWorkoutCountForAssignment(history, ""), 0);
});

test("trainer client activity status detects missing program, lost and active states", () => {
  assert.deepEqual(getClientActivityStatus({}), { id: "noProgram", label: "Без программы" });
  assert.deepEqual(
    getClientActivityStatus({ assignedProgramId: "p1", lastWorkoutAt: dateKeyOffset(-15) }),
    { id: "lost", label: "Пропал" }
  );
  assert.deepEqual(
    getClientActivityStatus({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7)
    }),
    { id: "active", label: "Активный" }
  );
});

test("trainer client attention reasons stay compact and readable", () => {
  assert.deepEqual(getClientAttentionReasons({}), ["нет программы"]);
  assert.deepEqual(
    getClientAttentionReasons({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-8),
      lastNutritionAt: dateKeyOffset(-6),
      lastMeasurementAt: dateKeyOffset(-31)
    }),
    [
      `нет тренировок 8 ${getTrainerDayWord(8)}`,
      `нет питания 6 ${getTrainerDayWord(6)}`,
      `нет замера 31 ${getTrainerDayWord(31)}`
    ]
  );
});

test("trainer empty client summary preserves assigned program hints", () => {
  const summary = getTrainerClientEmptySummary({
    id: "client_1",
    assignedProgramId: "program_1",
    assignedProgramUpdatedAt: "2026-06-10",
    assignedWorkoutCount: "8"
  });

  assert.equal(summary.clientId, "client_1");
  assert.equal(summary.assignedProgramId, "program_1");
  assert.equal(summary.assignedWorkoutCount, 8);
  assert.equal(summary.completedWorkoutCount, 0);
  assert.equal(summary.programCompletionPercent, null);
  assert.deepEqual(summary.recentEvents, []);
});

test("trainer fast summary merges client fields with previous loaded summary", () => {
  const summary = getTrainerClientFastSummary({
    id: "client_1",
    weeklyWorkouts: 2,
    assignedWorkoutCount: 8,
    assignedCompletedWorkoutCount: 3,
    nutritionState: {
      days: {
        [dateKeyOffset(-1)]: { foods: [{ calories: 1800 }] }
      }
    }
  }, {
    lastWorkoutAt: "2026-06-10",
    lastMeasurementAt: "2026-06-11",
    assignedProgramId: "program_1",
    recentEvents: [{ type: "note" }]
  });

  assert.equal(summary.clientId, "client_1");
  assert.equal(summary.workouts7, 2);
  assert.equal(summary.nutritionDays7, 1);
  assert.equal(summary.assignedWorkoutCount, 8);
  assert.equal(summary.completedWorkoutCount, 3);
  assert.equal(summary.programCompletionPercent, 38);
  assert.equal(summary.assignedProgramId, "program_1");
  assert.deepEqual(summary.recentEvents, [{ type: "note" }]);
});

test("trainer dashboard summary builds counts, focus and recent events", () => {
  const clients = [
    { id: "lost", name: "Lost" },
    { id: "plain", name: "Plain" },
    { id: "active", name: "Active" }
  ];
  const dashboard = buildTrainerDashboardSummary(clients, {
    lost: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-15),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-1),
      recentEvents: [{ id: "e1", date: dateKeyOffset(-1), title: "event" }]
    },
    active: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(0),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-1),
      workouts7: 2,
      nutritionDays7: 4
    }
  });

  assert.equal(dashboard.statusCounts.lost, 1);
  assert.equal(dashboard.statusCounts.noProgram, 1);
  assert.equal(dashboard.statusCounts.active, 1);
  assert.equal(dashboard.statusCounts.activeToday, 1);
  assert.deepEqual(dashboard.problemClients.map((item) => item.client.id), ["lost", "plain"]);
  assert.equal(dashboard.focusItems[0].client.id, "lost");
  assert.equal(dashboard.focusItems.at(-1).text, "2 тренировок за 7 дней · питание 4/7");
  assert.equal(dashboard.recentEvents[0].clientName, "Lost");
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerClientRecentEvents,
  buildTrainerDashboardSummary,
  canLoadTrainerClientDeepSummary,
  getClientActivityStatus,
  getClientAttentionReasons,
  getTrainerAssignedWorkoutCount,
  getTrainerCompletedWorkoutCountForAssignment,
  getTrainerClientEmptySummary,
  getTrainerClientFastSummary,
  getTrainerClientSummaryFromMap,
  getTrainerDayWord,
  getTrainerLastMeasurementAt,
  getTrainerNutritionSummary,
  getTrainerProgramCompletionPercent,
  getTrainerProgramEndingAttention,
  getTrainerSettledCollectionItems,
  getTrainerSettledDocumentData,
  getTrainerSummaryReadFailures,
  getTrainerSortedHistory,
  getTrainerSortedMeasurements,
  getTrainerWorkoutFeedbackAttention,
  getTrainerWorkoutActivitySummary
} from "../src/utils/trainerClientSummary.js";
import {
  getTrainerSummaryDateKey,
  getTrainerSummaryDayStart,
  getTrainerSummaryWeekStart
} from "../src/utils/trainerSummaryDates.js";

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

test("trainer completed workout count includes manual calendar statuses", () => {
  const assignedAt = "2026-06-20T10:00:00.000Z";
  const history = [
    { workoutId: "w1", assignedProgramUpdatedAt: assignedAt },
    { workoutId: "w2", assignedProgramUpdatedAt: assignedAt }
  ];
  const calendar = {
    assignedProgramUpdatedAt: assignedAt,
    plannedWorkouts: [
      { workoutId: "w3", order: 3, status: "completed" },
      { workoutId: "w4", order: 4, status: "completed_off_date" },
      { workoutId: "w5", order: 5, status: "missed" }
    ]
  };

  assert.equal(getTrainerCompletedWorkoutCountForAssignment(history, assignedAt, calendar), 4);
  assert.equal(getTrainerCompletedWorkoutCountForAssignment([], "new-assignment", calendar), 0);
});

test("trainer workout activity summary counts recent and weekly workout days", () => {
  const today = dateKeyOffset(0);
  const yesterday = dateKeyOffset(-1);
  const eightDaysAgo = dateKeyOffset(-8);
  const thirtyOneDaysAgo = dateKeyOffset(-31);
  const summary = getTrainerWorkoutActivitySummary([
    { date: eightDaysAgo },
    { completedAt: today },
    { date: yesterday },
    { date: yesterday },
    { createdAt: thirtyOneDaysAgo },
    {}
  ], {
    weekStart: getTrainerSummaryWeekStart(),
    sevenDayStart: getTrainerSummaryDayStart() - 6 * 24 * 60 * 60 * 1000,
    thirtyDayStart: getTrainerSummaryDayStart() - 29 * 24 * 60 * 60 * 1000
  });

  assert.equal(summary.lastWorkoutAt, getTrainerSummaryDayStart(today) + 12 * 60 * 60 * 1000);
  assert.equal(summary.workouts7, 3);
  assert.equal(summary.workouts30, 4);
  assert.deepEqual(
    summary.workoutDateKeysCurrentWeek,
    [...new Set([today, yesterday].filter((date) => getTrainerSummaryDayStart(date) >= getTrainerSummaryWeekStart()))]
  );
});

test("trainer history is sorted by workout recency", () => {
  const history = [
    { id: "created", createdAt: "2026-06-12T10:00:00.000Z" },
    { id: "date", date: "2026-06-20T10:00:00.000Z" },
    { id: "completed", completedAt: "2026-06-18T10:00:00.000Z" },
    { id: "bad", date: "bad-date" }
  ];

  assert.deepEqual(getTrainerSortedHistory(history).map((item) => item.id), [
    "date",
    "completed",
    "created",
    "bad"
  ]);
});

test("trainer measurements are sorted by recency and expose latest date", () => {
  const measurements = [
    { id: "old", date: "2026-06-01T10:00:00.000Z" },
    { id: "saved", savedAt: "2026-06-12T10:00:00.000Z" },
    { id: "latest", createdAt: "2026-06-20T10:00:00.000Z" },
    { id: "bad", date: "bad-date" }
  ];

  const sorted = getTrainerSortedMeasurements(measurements);
  assert.deepEqual(sorted.map((item) => item.id), ["latest", "saved", "old", "bad"]);
  assert.equal(getTrainerLastMeasurementAt(measurements), "2026-06-20T10:00:00.000Z");
  assert.equal(getTrainerLastMeasurementAt([]), "");
});

test("trainer program completion percent stays bounded and optional", () => {
  assert.equal(getTrainerProgramCompletionPercent(8, 3), 38);
  assert.equal(getTrainerProgramCompletionPercent(8, 20), 100);
  assert.equal(getTrainerProgramCompletionPercent(0, 3), null);
  assert.equal(getTrainerProgramCompletionPercent(8, 3, false), null);
});

test("trainer program ending attention detects nearly finished programs", () => {
  assert.equal(getTrainerProgramEndingAttention(8, 4), null);
  assert.deepEqual(getTrainerProgramEndingAttention(8, 6), {
    id: "endingSoon",
    reason: "До конца программы: 2 тренировки",
    remainingWorkouts: 2,
    completedWorkoutCount: 6,
    assignedWorkoutCount: 8
  });
  assert.deepEqual(getTrainerProgramEndingAttention(8, 8), {
    id: "completed",
    reason: "Программа завершена, назначьте следующий блок",
    remainingWorkouts: 0,
    completedWorkoutCount: 8,
    assignedWorkoutCount: 8
  });
});

test("trainer assigned workout count prefers actual client workouts over stale root count", () => {
  const workouts = Array.from({ length: 8 }, (_, index) => ({ id: `w${index + 1}` }));

  assert.equal(getTrainerAssignedWorkoutCount({ assignedWorkoutCount: 4 }, workouts), 8);
  assert.equal(getTrainerAssignedWorkoutCount({
    assignedWorkoutCount: 4,
    workoutCalendar: { plannedWorkouts: workouts }
  }, []), 8);
  assert.equal(getTrainerProgramCompletionPercent(getTrainerAssignedWorkoutCount({ assignedWorkoutCount: 4 }, workouts), 1), 13);
});

test("trainer fast summary keeps actual calendar plan count when root count is stale", () => {
  const summary = getTrainerClientFastSummary({
    id: "client_1",
    assignedProgramId: "program_1",
    assignedProgramUpdatedAt: "2026-06-20T10:00:00.000Z",
    assignedWorkoutCount: 4,
    workoutCalendar: {
      assignedProgramUpdatedAt: "2026-06-20T10:00:00.000Z",
      plannedWorkouts: Array.from({ length: 8 }, (_, index) => ({
        workoutId: `w${index + 1}`,
        order: index + 1,
        status: index === 0 ? "completed" : "planned"
      }))
    }
  });

  assert.equal(summary.assignedWorkoutCount, 8);
  assert.equal(summary.completedWorkoutCount, 1);
  assert.equal(summary.programCompletionPercent, 13);
});

test("trainer summary read failures preserve failed names and reasons", () => {
  const error = new Error("no access");
  const failures = getTrainerSummaryReadFailures({
    history: { status: "fulfilled", value: [] },
    nutrition: { status: "rejected", reason: error },
    measurements: { status: "fulfilled", value: [] }
  });

  assert.deepEqual(failures.names, ["nutrition"]);
  assert.equal(failures.reasons.history, null);
  assert.equal(failures.reasons.nutrition, error);
});

test("trainer settled collection items read fulfilled snapshots only", () => {
  const snapshot = {
    forEach(callback) {
      callback({ id: "one", data: () => ({ name: "First" }) });
      callback({ id: "two", data: () => ({ name: "Second" }) });
    }
  };

  assert.deepEqual(getTrainerSettledCollectionItems({ status: "fulfilled", value: snapshot }), [
    { id: "one", name: "First" },
    { id: "two", name: "Second" }
  ]);
  assert.deepEqual(getTrainerSettledCollectionItems({ status: "rejected", reason: new Error("x") }), []);
});

test("trainer settled document data reads fulfilled existing docs with fallback", () => {
  const fallback = { source: "fallback" };
  const value = {
    exists: () => true,
    data: () => ({ source: "doc" })
  };
  const missing = {
    exists: () => false,
    data: () => ({ source: "ignored" })
  };

  assert.deepEqual(getTrainerSettledDocumentData({ status: "fulfilled", value }, fallback), { source: "doc" });
  assert.equal(getTrainerSettledDocumentData({ status: "fulfilled", value: missing }, fallback), fallback);
  assert.equal(getTrainerSettledDocumentData({ status: "rejected", reason: new Error("x") }, fallback), fallback);
});

test("trainer client recent events combine workouts nutrition and measurements", () => {
  const events = buildTrainerClientRecentEvents({
    clientId: "client_1",
    historyList: [
      { id: "old", workoutName: "Old workout", date: "2026-06-01T10:00:00.000Z" },
      { id: "new", workoutName: "New workout", completedAt: "2026-06-20T10:00:00.000Z" }
    ],
    nutritionSummary: { lastNutritionAt: "2026-06-19" },
    measurements: [
      { id: "m1", savedAt: "2026-06-18T10:00:00.000Z" }
    ]
  });

  assert.deepEqual(events.map((event) => event.id), [
    "workout_new",
    "workout_old",
    "nutrition_client_1_2026-06-19",
    "measurement_m1"
  ]);
  assert.deepEqual(events.map((event) => event.type), ["workout", "workout", "nutrition", "measurement"]);
  assert.equal(events[0].title, "New workout");
});

test("trainer workout feedback attention highlights pain and bad feedback", () => {
  const now = new Date("2026-06-20T12:00:00").getTime();

  assert.deepEqual(getTrainerWorkoutFeedbackAttention([
    {
      id: "pain",
      date: "2026-06-19T10:00:00.000Z",
      clientComment: "После жима болит плечо"
    }
  ], now), {
    id: "pain",
    reason: "Клиент сообщил о боли после тренировки",
    date: "2026-06-19T10:00:00.000Z",
    comment: "После жима болит плечо"
  });

  assert.deepEqual(getTrainerWorkoutFeedbackAttention([
    { id: "bad_1", date: "2026-06-19T10:00:00.000Z", postWorkoutFeedback: { id: "bad" } },
    { id: "bad_2", date: "2026-06-18T10:00:00.000Z", readiness: { id: "bad" } }
  ], now), {
    id: "badFeedback",
    reason: "2 тяжелые оценки после тренировок",
    date: "2026-06-19T10:00:00.000Z"
  });
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
  assert.deepEqual(
    getClientAttentionReasons({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      activeTrainerTasksCount: 2
    }),
    ["2 активные задачи"]
  );
});

test("trainer client activity status treats active tasks as attention", () => {
  assert.deepEqual(
    getClientActivityStatus({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      activeTrainerTasksCount: 1
    }),
    { id: "attention", label: "Требует внимания" }
  );
});

test("trainer client activity status treats workout feedback as attention", () => {
  assert.deepEqual(
    getClientActivityStatus({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      workoutFeedbackAttention: { id: "comment", reason: "Есть комментарий клиента после тренировки" }
    }),
    { id: "attention", label: "Требует внимания" }
  );
  assert.ok(getClientAttentionReasons({
    assignedProgramId: "p1",
    lastWorkoutAt: dateKeyOffset(-1),
    lastNutritionAt: dateKeyOffset(-1),
    lastMeasurementAt: dateKeyOffset(-7),
    workoutFeedbackAttention: { id: "comment", reason: "Есть комментарий клиента после тренировки" }
  }).includes("есть комментарий клиента после тренировки"));
});

test("trainer client activity status treats ending programs as attention", () => {
  assert.deepEqual(
    getClientActivityStatus({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      programEndingAttention: { id: "endingSoon", reason: "До конца программы: 1 тренировка" }
    }),
    { id: "attention", label: "Требует внимания" }
  );

  assert.ok(getClientAttentionReasons({
    assignedProgramId: "p1",
    lastWorkoutAt: dateKeyOffset(-1),
    lastNutritionAt: dateKeyOffset(-1),
    lastMeasurementAt: dateKeyOffset(-7),
    programEndingAttention: { id: "completed", reason: "Программа завершена, назначьте следующий блок" }
  }).includes("программа завершена, назначьте следующий блок"));
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
  assert.equal(summary.activeTrainerTasksCount, 0);
  assert.equal(summary.workoutFeedbackAttention, null);
  assert.equal(summary.programEndingAttention, null);
  assert.equal(summary.programCompletionPercent, null);
  assert.deepEqual(summary.recentEvents, []);
});

test("trainer client summary map returns loaded data or a safe fallback", () => {
  const loadedSummary = { clientId: "client_1", workouts7: 3 };

  assert.equal(
    getTrainerClientSummaryFromMap({ id: "client_1" }, { client_1: loadedSummary }),
    loadedSummary
  );
  assert.equal(getTrainerClientSummaryFromMap({ id: "client_2" }, {}).clientId, "client_2");
});

test("trainer fast summary merges client fields with previous loaded summary", () => {
  const summary = getTrainerClientFastSummary({
    id: "client_1",
    weeklyWorkouts: 2,
    assignedWorkoutCount: 8,
    assignedCompletedWorkoutCount: 3,
    activeTrainerTasksCount: 2,
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
  assert.equal(summary.activeTrainerTasksCount, 2);
  assert.equal(summary.programCompletionPercent, 38);
  assert.equal(summary.assignedProgramId, "program_1");
  assert.deepEqual(summary.recentEvents, [{ type: "note" }]);
});

test("trainer mirror-only clients skip deep private summary reads", () => {
  assert.equal(canLoadTrainerClientDeepSummary({ id: "client_1" }), true);
  assert.equal(canLoadTrainerClientDeepSummary({ id: "client_2", trainerLinkOnly: true }), false);
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

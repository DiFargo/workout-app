import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkoutHistoryAchievements } from "../src/features/client/workouts/workoutHistoryAchievements.js";
import { buildProfileAchievements, getConfirmedProfileAchievementItems } from "../src/features/client/profile/profileAchievements.js";

const now = new Date(2026, 9, 30, 12);
const build = history => buildWorkoutHistoryAchievements(history, { now });

test("история достижений: пустые данные не создают сессий, минут и подходов", () => {
  for (const history of [[], null, undefined]) {
    assert.deepEqual(build(history), { ...buildProfileAchievements(history, { now }), confirmedItems: [],
      durationMinutesKnown: 0, durationRecordCount: 0, totalSets: 0 });
  }
});

test("все назначения и базовые тренировки входят в достижения, подтверждённая лента идёт новые→старые", () => {
  const history = [
    { id: "old-program", assignedProgramId: "old", workoutId: "legs", date: "2025-01-05", durationSeconds: 1800 },
    { id: "current-program", assignedProgramId: "current", workoutId: "legs", date: "2026-10-29", durationSeconds: 3600 },
    { id: "basic", source: "basic", workoutId: "basic-1", date: "2026-05-12", durationSeconds: 1200 },
    { id: "middle-program", assignedProgramId: "middle", workoutId: "upper", date: "2026-01-15", durationSeconds: 2400 }
  ];
  const before = JSON.stringify(history);
  const result = build(history);
  assert.equal(result.completedCount, 4);
  assert.deepEqual(result.confirmedItems.map(item => item.id), ["current-program", "basic", "middle-program", "old-program"]);
  assert.equal(result.durationMinutesKnown, 150);
  assert.equal(result.durationRecordCount, 4);
  assert.equal(result.firstDate, "2025-01-05");
  assert.equal(result.lastDate, "2026-10-29");
  const { confirmedItems: _items, durationMinutesKnown: _minutes, durationRecordCount: _count, totalSets: _sets, ...profileFields } = result;
  assert.deepEqual(profileFields, buildProfileAchievements(history, { now }));
  assert.equal(JSON.stringify(history), before);
});

test("повторы, pending и черновики используют общий профильный фильтр; разные назначения остаются независимыми", () => {
  const run = { workoutId: "shared-day", startedAt: "2026-10-01T09:00:00Z", assignedProgramUpdatedAt: "assignment-v1" };
  const history = [
    { ...run, id: "old-copy", finishedAt: "2026-10-01T10:00:00Z", durationSeconds: 9999 },
    { ...run, id: "confirmed", finishedAt: "2026-10-01T10:01:00Z", durationSeconds: 600 },
    { ...run, id: "pending-copy", pendingSync: true, finishedAt: "2026-10-01T10:02:00Z", durationSeconds: 9999 },
    { ...run, id: "other-assignment", assignedProgramUpdatedAt: "assignment-v2", finishedAt: "2026-10-01T10:01:00Z", durationSeconds: 1200 },
    { id: "pending-new", pendingSync: true, date: "2026-10-02", durationSeconds: 9999 },
    ...["draft", "active", "in-progress", "cancelled", "incomplete"].map(status => ({ id: status, status, durationSeconds: 9999 })),
    { id: "not-completed", completed: false }, { id: "deleted", deleted: true }, null, {}, []
  ];
  const result = build(history);
  assert.equal(result.completedCount, 2);
  assert.equal(result.pendingCount, 1);
  assert.equal(result.durationRecordCount, 2);
  assert.equal(result.durationMinutesKnown, 30);
  assert.deepEqual(result.confirmedItems, getConfirmedProfileAchievementItems(history));
  assert.equal(result.confirmedItems.some(item => item.id === "old-copy" || item.pendingSync), false);
});

test("известная длительность берётся только из сохранённых секунд; неизвестные значения не становятся нулевыми измерениями", () => {
  const unknown = [undefined, null, "", " ", true, false, -10, NaN, Infinity, "unknown", "10 minutes"];
  const history = unknown.map((durationSeconds, index) => ({ id: `unknown-${index}`, date: "2026-10-01", durationSeconds }));
  history.push(
    { id: "known-zero", durationSeconds: 0 },
    { id: "known-string", durationSeconds: "90" },
    { id: "known-number", durationSeconds: 30 },
    { id: "planned-duration", plannedSnapshot: { durationSeconds: 9999 } },
    { id: "date-gap-is-not-duration", startedAt: "2026-10-01T09:00:00Z", finishedAt: "2026-10-01T11:00:00Z" }
  );
  const result = build(history);
  assert.equal(result.durationRecordCount, 3);
  assert.equal(result.durationMinutesKnown, 2);
  assert.equal(result.completedCount, history.length);
});

test("подходы считаются только по actual completed=true, а не по плану, заполненным весам или статусу всей тренировки", () => {
  const result = build([
    { id: "actual", status: "completed", exercises: [{ sets: [
      { completed: true }, { completed: false, weight: 100, reps: 10 }, { weight: 120, reps: 10 },
      { completed: "true" }, { isCompleted: true }, null
    ] }, null, { sets: [{ completed: true, durationSeconds: 30 }] }],
    plannedSnapshot: { exercises: [{ sets: [{ completed: true }, { completed: true }] }] } },
    { id: "legacy-no-flags", exercises: [{ sets: [{ weight: 20, reps: 10 }] }] },
    { id: "bad-shape", exercises: { sets: [{ completed: true }] } },
    { id: "pending", pendingSync: true, exercises: [{ sets: [{ completed: true }] }] },
    { id: "draft", status: "draft", exercises: [{ sets: [{ completed: true }] }] }
  ]);
  assert.equal(result.totalSets, 2);
  assert.equal(result.completedCount, 3);
  assert.equal(Object.hasOwn(result, "maxWeight"), false);
});

test("подтверждённые записи используют общий safe date fallback, unknown даты идут последними без подстановки createdAt", () => {
  const history = [
    { id: "created-only", createdAt: "2026-10-30" },
    { id: "invalid", date: "2026-02-30" },
    { id: "older", date: "2026-10-01" },
    { id: "timestamp", completedAt: { seconds: new Date(2026, 9, 29, 12).getTime() / 1000 } },
    { id: "fallback", finishedAt: "bad", completedAt: new Date(2026, 9, 30, 10) },
    { id: "newest", finishedAt: { toDate: () => new Date(2026, 9, 30, 11) } }
  ];
  const result = build(history);
  assert.deepEqual(result.confirmedItems.map(item => item.id), ["newest", "fallback", "timestamp", "older", "created-only", "invalid"]);
  assert.equal(result.undatedCount, 2);
});

test("независимые legacy строки без ID не схлопываются и источник не получает выдуманные ID", () => {
  const history = [{ date: "2026-10-01", durationSeconds: 60 }, { date: "2026-10-02", durationSeconds: 120 }];
  const result = build(history);
  assert.equal(result.completedCount, 2);
  assert.equal(result.confirmedItems.length, 2);
  assert.equal(result.durationMinutesKnown, 3);
  assert.equal(Object.hasOwn(history[0], "id"), false);
  assert.equal(Object.hasOwn(history[1], "id"), false);
});

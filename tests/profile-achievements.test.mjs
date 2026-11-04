import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildProfileAchievements } from "../src/features/client/profile/profileAchievements.js";

const now = new Date(2026, 9, 29, 12);
const build = history => buildProfileAchievements(history, { now });

test("пустая история не создаёт достижений и дат", () => {
  assert.deepEqual(build([]), {
    completedCount: 0, pendingCount: 0, datedCount: 0, undatedCount: 0,
    firstDate: null, lastDate: null, activeWeeks: 0, bestWeek: null,
    recent30Count: 0, milestone: 0, monthSeries: []
  });
  assert.equal(build(null).completedCount, 0);
});

test("полная история использует подтверждённые сессии и не считает отменённые и черновики", () => {
  const result = build([
    { id: "legacy", date: "2026-10-01" },
    { id: "done", status: "completed", date: "2026-10-10" },
    { id: "cancelled", status: "cancelled", date: "2026-10-11" },
    { id: "false", completed: false, date: "2026-10-12" },
    { id: "active", status: "in-progress", date: "2026-10-13" },
    { id: "pending", pendingSync: true, date: "2026-10-14" },
    null, {}, []
  ]);
  assert.equal(result.completedCount, 2);
  assert.equal(result.pendingCount, 1);
  assert.equal(result.datedCount, 2);
  assert.equal(result.milestone, 1);
});

test("повторные сохранения одной сессии дедуплицируются, независимые попытки сохраняются", () => {
  const run = { workoutId: "legs", assignedProgramUpdatedAt: "v1", startedAt: "2026-10-01T09:00:00Z" };
  const result = build([
    { ...run, id: "a", finishedAt: "2026-10-01T10:00:00Z" },
    { ...run, id: "b", finishedAt: "2026-10-01T10:01:00Z" },
    { ...run, id: "pending-duplicate", pendingSync: true, finishedAt: "2026-10-01T10:02:00Z" },
    { ...run, id: "second-attempt", startedAt: "2026-10-02T09:00:00Z", date: "2026-10-02" },
    { id: "pending-new", pendingSync: true, date: "2026-10-03" }
  ]);
  assert.equal(result.completedCount, 2);
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(result.monthSeries, [{ key: "2026-10", count: 2, total: 2 }]);
});

test("недатированные и будущие записи не получают выдуманных дат", () => {
  const result = build([
    { id: "without-date", createdAt: "2026-10-01" },
    { id: "invalid", date: "2026-02-30" },
    { id: "future", date: "2026-10-30" },
    { id: "fallback", finishedAt: "bad", completedAt: "2026-10-20", date: "2026-10-01" },
    { id: "start", startedAt: "2026-10-21" }
  ]);
  assert.equal(result.completedCount, 5);
  assert.equal(result.undatedCount, 3);
  assert.equal(result.datedCount, 2);
  assert.equal(result.firstDate, "2026-10-20");
  assert.equal(result.lastDate, "2026-10-21");
  assert.equal(result.recent30Count, 2);
  assert.equal(result.milestone, 5);
});

test("календарные недели и накопительные месяцы используют реальные занятия, включая пустые месяцы", () => {
  const result = build([
    { id: "may", date: "2026-05-05" },
    { id: "sep", date: "2026-09-30" },
    { id: "oct-a", date: "2026-10-01" },
    { id: "oct-b", date: "2026-10-04" },
    { id: "oct-c", date: "2026-10-05" },
    { id: "oct-d", date: "2026-10-29" }
  ]);
  assert.equal(result.activeWeeks, 4);
  assert.deepEqual(result.bestWeek, { start: "2026-09-28", count: 3 });
  assert.equal(result.recent30Count, 5);
  assert.deepEqual(result.monthSeries, [
    { key: "2026-05", count: 1, total: 1 },
    { key: "2026-06", count: 0, total: 1 },
    { key: "2026-07", count: 0, total: 1 },
    { key: "2026-08", count: 0, total: 1 },
    { key: "2026-09", count: 1, total: 2 },
    { key: "2026-10", count: 4, total: 6 }
  ]);
});

test("граница 30 дней включительна и лучшая неделя при равенстве самая свежая", () => {
  const result = build([
    { id: "old", date: "2026-09-29" },
    { id: "edge", date: "2026-09-30" },
    { id: "today", date: "2026-10-29" },
    { id: "today-two", date: "2026-10-29" }
  ]);
  assert.equal(result.recent30Count, 3);
  assert.deepEqual(result.bestWeek, { start: "2026-10-26", count: 2 });
});

test("ISO-время переводится в местный день, date-only не сдвигается между часовыми поясами", () => {
  const moduleUrl = new URL("../src/features/client/profile/profileAchievements.js", import.meta.url).href;
  const runIn = timezone => {
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { buildProfileAchievements } from ${JSON.stringify(moduleUrl)};
      process.stdout.write(JSON.stringify(buildProfileAchievements([
        {id:"iso", date:"2026-10-01T22:30:00Z"},
        {id:"plain", date:"2026-10-02"}
      ], {now:new Date("2026-10-29T12:00:00Z")})));
    `], { env: { ...process.env, TZ: timezone }, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  };
  assert.equal(runIn("Europe/Minsk").firstDate, "2026-10-02");
  assert.equal(runIn("America/New_York").firstDate, "2026-10-01");
  assert.equal(runIn("America/New_York").lastDate, "2026-10-02");
});

test("Timestamp, Date и локальные записи без ID обрабатываются без изменения источника", () => {
  const history = [
    { date: new Date(2026, 9, 1, 12) },
    { date: "2026-10-02" },
    { id: "timestamp", finishedAt: { toDate: () => new Date(2026, 9, 3, 12) } }
  ];
  const result = build(history);
  assert.equal(result.completedCount, 3);
  assert.equal(result.datedCount, 3);
  assert.equal(result.lastDate, "2026-10-03");
  assert.equal(Object.hasOwn(history[0], "id"), false);
});

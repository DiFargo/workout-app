import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeleteEmptyProgramHistoryAssignment,
  canArchiveEmptyHistoricalAssignment,
  getCurrentProgramHistoryAssignment,
  getProgramHistoryArchiveState,
  getProgramHistoryStatus,
  getProgramHistorySections,
  getProgramHistoryWorkoutRows,
  sortProgramHistoryAssignments
} from "../src/utils/trainerProgramHistoryPresentation.js";

const emptyArchive = () => ({ key: "time:2026-10-01", status: "archived", archived: true,
  completedCount: 0, completion: 0, completedWorkoutIds: [], history: [],
  workouts: [{ id: "w1", status: "planned", assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived",
    exercises: [{ name: "Жим", sets: [{ weight: 30, reps: 12 }] }] }] });

test("archive tab separates persisted archives from old read-only assignments without hiding data", () => {
  const archive = emptyArchive();
  const historical = { ...emptyArchive(), key: "time:2026-09-01", assignedAt: "2026-09-01", workouts: [{ id: "old", assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active" }] };
  const legacy = { ...emptyArchive(), key: "time:2026-08-01", workouts: [{ id: "legacy", assignedProgramLifecycleStatus: "archived" }] };
  const current = { key: "current", status: "current", timestamp: 100 };
  const input = [historical, legacy, archive, current];
  const sections = getProgramHistorySections(input, "current");
  assert.equal(sections.current, current);
  assert.deepEqual(sections.others.map(item => item.key), [historical.key]);
  assert.deepEqual(new Set(sections.archived.map(item => item.key)), new Set([archive.key, legacy.key]));
  assert.equal(getProgramHistoryStatus(legacy), "В архиве");
  assert.equal([sections.current, ...sections.others, ...sections.archived].length, input.length);
  assert.equal(input[0], historical);
});

test("history sorts newest first without changing source or hiding duplicate titles", () => {
  const input = [{ key: "old", name: "Программа", assignedAt: "2026-08-02" },
    { key: "new", name: "Программа", assignedAt: "2026-10-17" }];
  assert.deepEqual(sortProgramHistoryAssignments(input).map(item => item.key), ["new", "old"]);
  assert.equal(input[0].key, "old");
});

test("current assignment uses profile identity then original execution queue", () => {
  const items = [{ key: "later", status: "current", timestamp: 30 },
    { key: "first", status: "current", timestamp: 10 },
    { key: "future", status: "future", timestamp: 5 },
    { key: "archive", status: "archived", archived: true, timestamp: 40 }];
  assert.equal(getCurrentProgramHistoryAssignment(items, "later").key, "later");
  assert.equal(getCurrentProgramHistoryAssignment(items).key, "first");
  assert.equal(getCurrentProgramHistoryAssignment(items, "archive").key, "first");
  assert.equal(getCurrentProgramHistoryAssignment([{ key: "basic", isBasic: true, status: "current" }]), null);
});

test("delete hint only permits a known archived assignment with no activity", () => {
  assert.equal(canDeleteEmptyProgramHistoryAssignment(emptyArchive()), true);
  for (const patch of [{ isBasic: true }, { status: "current", archived: false }, { status: "current" }, { status: "future" },
    { completedCount: 1 }, { completion: 25 }, { missedCount: 1 },
    { completedWorkoutIds: ["w1"] }, { history: [{ workoutId: "w1" }] },
    { history: undefined }, { key: "legacy:0" }, { workouts: [] }]) {
    assert.equal(canDeleteEmptyProgramHistoryAssignment({ ...emptyArchive(), ...patch }), false);
  }
  for (const workout of [{ status: "completed" }, { startedAt: "2026-10-02" },
    { exercises: [{ sets: [{ done: true }] }] }, { blocks: [{ exercises: [{ sets: [{ actualReps: 1 }] }] }] }]) {
    assert.equal(canDeleteEmptyProgramHistoryAssignment({ ...emptyArchive(), workouts: [{ id: "w1", ...workout }] }), false);
  }
});

test("read-only workout details use saved exercises and exact completed ids", () => {
  const assignment = { completedWorkoutIds: ["a"], workouts: [
    { id: "a", name: "День 1", exercises: [{ name: "Жим", sets: [{ reps: 12 }, { reps: 10 }] }] },
    { id: "b", name: "День 2", blocks: [{ exercises: [{ name: "Тяга", sets: [{ reps: 12 }] }] }] }
  ] };
  const rows = getProgramHistoryWorkoutRows(assignment);
  assert.deepEqual(rows.map(row => [row.name, row.completed, row.exercises.length, row.setsCount]), [
    ["День 1", true, 1, 2], ["День 2", false, 1, 1]
  ]);
  assert.equal(getProgramHistoryStatus({ status: "future" }), "Ещё не начата");
  assert.equal(getProgramHistoryStatus({ status: "past", completion: 100 }), "Пройдена");
});

test("read-only historical plans are not presented as persisted archives", () => {
  const explicit = emptyArchive();
  const historical = { ...explicit, workouts: explicit.workouts.map(workout => ({ ...workout,
    assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active" })) };
  assert.equal(getProgramHistoryArchiveState(explicit), "archived");
  assert.equal(getProgramHistoryStatus(explicit), "В архиве");
  assert.equal(getProgramHistoryArchiveState(historical), "historical");
  assert.equal(getProgramHistoryStatus(historical), "Прошлая программа");
  assert.equal(canDeleteEmptyProgramHistoryAssignment(historical), false);
  assert.equal(canArchiveEmptyHistoricalAssignment(historical), true);
  assert.equal(canArchiveEmptyHistoricalAssignment(explicit), false);
  assert.equal(canArchiveEmptyHistoricalAssignment({ ...historical, status: "current", archived: false }), false);
  assert.equal(canArchiveEmptyHistoricalAssignment({ ...historical, history: [{ workoutId: "w1" }] }), false);
  assert.equal(canArchiveEmptyHistoricalAssignment({ ...historical, isBasic: true }), false);
});

test("legacy and mixed archive metadata needs explicit archive confirmation before deletion", () => {
  for (const patch of [
    { assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "" },
    { assignedProgramLifecycleStatus: "", assignedProgramVisibility: "trainer_archived" },
    { assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "client_active" },
    { assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "trainer_archived" }
  ]) {
    const assignment = emptyArchive(); Object.assign(assignment.workouts[0], patch);
    assert.notEqual(getProgramHistoryArchiveState(assignment), "archived");
    assert.equal(canDeleteEmptyProgramHistoryAssignment(assignment), false);
    assert.equal(canArchiveEmptyHistoricalAssignment(assignment), true);
  }
  const assignment = emptyArchive();
  assignment.workouts.push({ id: "w2", status: "planned", assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active" });
  assert.equal(getProgramHistoryArchiveState(assignment), "historical");
  assert.equal(canDeleteEmptyProgramHistoryAssignment(assignment), false);
  assert.equal(canArchiveEmptyHistoricalAssignment(assignment), true);
});

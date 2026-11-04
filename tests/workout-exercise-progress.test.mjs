import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkoutExerciseProgress } from "../src/utils/workoutExerciseProgress.js";

const entry = (id, day, sets, extra = {}) => ({ id, date: `2026-10-${String(day).padStart(2, "0")}T09:00:00.000Z`, sets, summary: `Запись ${id}`, ...extra });

test("weight facts span programme assignments and show 30 → 35 → 30 without a regression verdict", () => {
  const rows = [entry("third", 3, [{ weight: 30, reps: 12 }], { assignedProgramId: "new" }),
    entry("first", 1, [{ weight: 30, reps: 12 }], { assignedProgramId: "old" }),
    entry("second", 2, [{ weight: 32, reps: 12 }, { weight: 35, reps: 12 }], { assignedProgramId: "old" })];
  const before = structuredClone(rows), result = buildWorkoutExerciseProgress(rows, { complete: true });
  assert.deepEqual(result.metric, { kind: "weight", label: "Максимальный рабочий вес", unit: "кг" });
  assert.deepEqual(result.points.map(point => point.value), [30, 35, 30]);
  assert.equal(result.first, 30); assert.equal(result.latest, 30); assert.equal(result.best, 35); assert.equal(result.delta, 0);
  assert.equal(result.complete, true); assert.equal(result.scopeLabel, "За всё время");
  assert.equal(Object.hasOwn(result, "status"), false); assert.equal(Object.hasOwn(result, "oneRepMax"), false);
  assert.deepEqual(rows, before);
});

test("missing or zero weight stays a gap rather than a false drop to zero", () => {
  const result = buildWorkoutExerciseProgress([entry("first", 1, [{ enteredWeight: "30,5", weight: 99, reps: 12 }]),
    entry("missing", 2, [{ enteredWeight: "", weight: 99, reps: 12 }]),
    entry("zero", 3, [{ weight: 0, reps: 12 }]), entry("last", 4, [{ weight: 32, reps: 12 }]),
    entry("unknown", 5, [{ weight: "не записан", reps: 12 }])]);
  assert.deepEqual(result.points.map(point => point.value), [30.5, null, null, 32, null]);
  assert.equal(result.first, 30.5); assert.equal(result.latest, 32); assert.equal(result.best, 32); assert.equal(result.delta, 1.5);
  assert.equal(result.scopeLabel, "По загруженным записям"); assert.equal(result.complete, false);
});

test("bodyweight uses maximum working repetitions and ignores only explicit warmup or unfinished sets", () => {
  const sets = [{ type: "warmup", reps: 80, weight: 200 }, { setType: "разминочный", reps: 70 }, { reps: 12, weight: 0 },
    { reps: 15, completed: false }, { reps: 14, setType: "work" }];
  const result = buildWorkoutExerciseProgress([entry("bodyweight", 1, sets), entry("second", 2, [{ reps: "16" }])]);
  assert.equal(result.metric.kind, "reps"); assert.equal(result.metric.unit, "повт.");
  assert.deepEqual(result.points.map(point => point.value), [14, 16]);
  assert.equal(result.points[0].sets, sets); assert.equal(result.points[0].sets[0].type, "warmup");
  assert.equal(result.delta, 2);
});

test("timed-only records use seconds, not their legacy repetition field", () => {
  const result = buildWorkoutExerciseProgress([entry("first", 1, [{ durationSeconds: 30, reps: 30 }]),
    entry("second", 2, [{ actualDurationSeconds: "45", durationSeconds: 60, reps: 45 }, { durationSeconds: 40 }]),
    entry("unknown", 3, [{ durationSeconds: null, reps: null }])]);
  assert.deepEqual(result.metric, { kind: "duration", label: "Максимальная длительность подхода", unit: "с" });
  assert.deepEqual(result.points.map(point => point.value), [30, 45, null]);
  assert.equal(result.first, 30); assert.equal(result.latest, 45); assert.equal(result.best, 45);
});

test("mixed units never join durations or repetitions into a weight/repetition line", () => {
  const mixed = [entry("timed", 1, [{ durationSeconds: 60, reps: 60 }]), entry("reps", 2, [{ reps: 12 }])];
  const repetitions = buildWorkoutExerciseProgress(mixed);
  assert.equal(repetitions.metric.kind, "reps"); assert.deepEqual(repetitions.points.map(point => point.value), [null, 12]);
  assert.equal(repetitions.delta, null);
  const weighted = buildWorkoutExerciseProgress([...mixed, entry("weighted", 3, [{ weight: 20, reps: 12 }])]);
  assert.equal(weighted.metric.kind, "weight"); assert.deepEqual(weighted.points.map(point => point.value), [null, null, 20]);
  assert.equal(weighted.delta, null);
});

test("duplicate IDs select the latest valid date then richer facts, while equal-date different workouts remain separate", () => {
  const rows = [entry("same", 1, [{ weight: 80, reps: 12 }, { weight: 90, reps: 12 }]),
    entry("same", 3, [{ weight: 50, reps: 12 }]), entry("same", 3, [{ weight: 30, reps: 12 }, { weight: 35, reps: 12 }]),
    entry("different", 3, [{ weight: 40, reps: 12 }]), { id: "same", date: "invalid", sets: [{ weight: 1000 }] }];
  const result = buildWorkoutExerciseProgress(rows);
  assert.deepEqual(result.points.map(point => [point.id, point.value]), [["same", 35], ["different", 40]]);
  assert.equal(result.points[0].date, result.points[1].date);
  assert.equal(result.best, 40);
});

test("empty, invalid and unmeasured records never become zero facts or imply completeness", () => {
  const empty = buildWorkoutExerciseProgress(null);
  assert.deepEqual(empty.points, []); assert.equal(empty.metric.kind, null);
  for (const field of ["first", "latest", "best", "delta"]) assert.equal(empty[field], null);
  const result = buildWorkoutExerciseProgress([null, { id: "bad", date: "invalid", sets: [{ reps: 12 }] }, { id: "boolean-date", date: false, sets: [{ reps: 12 }] },
    entry("unknown", 1, [{ reps: null, weight: null }, { reps: true, weight: Infinity }]),
    entry("entry-3", 1, []), { ...entry("", 2, []), id: "" }, { ...entry("", 2, []), id: "" }], { complete: true });
  assert.equal(result.points.length, 4);
  assert.equal(new Set(result.points.map(point => point.id)).size, 4);
  assert.equal(result.points.every(point => point.value === null), true);
  assert.equal(result.metric.kind, null); assert.equal(result.best, null); assert.equal(result.complete, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainerExerciseHistoryChart } from "../src/utils/trainerExerciseHistoryChart.js";
import { analyzeExerciseProgress } from "../src/utils/exerciseProgress.js";

const session = (day, fields = {}) => ({ date: new Date(Date.UTC(2026, 0, day, 10)), bestWeight: 20, e1rm: 25,
  volume: 200, totalReps: 10, actualSets: [{ completed: true, weight: 20, reps: 10 }], bodyweightOnly: false,
  weightMultiplier: 1, weightConvention: "total_external_load", weightConventionLabel: "Общий внешний вес", ...fields });

test("график тренера: пустой/неверный вход не создаёт измерений", () => {
  for (const source of [[], null, undefined, [null, false, []]]) {
    const result = buildTrainerExerciseHistoryChart(source);
    assert.equal(result.defaultMetric, "reps");
    assert.equal(result.records.length, 0);
    assert.equal(result.measuredCount, 0);
    assert.equal(result.minimum, null);
    assert.deepEqual(result.segments, []);
  }
});

test("график тренера: вся история сортируется копией по реальным датам, без slice и изменения входных sessions", () => {
  const history = Array.from({ length: 125 }, (_, index) => session(125 - index));
  const first = history[0], last = history.at(-1);
  const result = buildTrainerExerciseHistoryChart(history);
  assert.equal(result.records.length, 125);
  assert.equal(result.measuredCount, 125);
  assert.equal(result.records[0].session, last);
  assert.equal(result.records.at(-1).session, first);
  assert.equal(history[0], first);
  assert.equal(history.at(-1), last);
  assert.ok(result.records.every((record, index) => !index || record.time >= result.records[index - 1].time));
});

test("график тренера: default вес при weighted данных, иначе повторы; bodyweight не создаёт кг", () => {
  const bodyweight = [session(1, { bodyweightOnly: true, bestWeight: 0, e1rm: 0, volume: 0, totalReps: 15 })];
  const result = buildTrainerExerciseHistoryChart(bodyweight);
  assert.equal(result.metric.key, "reps");
  assert.equal(result.records[0].value, 15);
  for (const key of ["weight", "e1rm", "volume"]) assert.equal(buildTrainerExerciseHistoryChart(bodyweight, key).records[0].value, null);
  assert.equal(buildTrainerExerciseHistoryChart([...bodyweight, session(2)]).metric.key, "weight");
});

test("график тренера: zero/unknown вес, e1rm и объём — пропуски, а не нулевые измерения", () => {
  for (const [key, field] of [["weight", "bestWeight"], ["e1rm", "e1rm"], ["volume", "volume"]]) {
    const values = [0, null, undefined, "", " ", false, -5, NaN, Infinity, "unknown"];
    const result = buildTrainerExerciseHistoryChart(values.map((value, index) => session(index + 1, { [field]: value })), key);
    assert.equal(result.measuredCount, 0);
    assert.ok(result.records.every(record => record.value === null));
    assert.deepEqual(result.segments, []);
  }
  assert.equal(buildTrainerExerciseHistoryChart([session(1, { totalReps: 0 })], "reps").records[0].value, 0);
});

test("график тренера: линия разрывается на пропуске и при смене convention либо multiplier", () => {
  const gap = buildTrainerExerciseHistoryChart([session(1), session(2, { bestWeight: 0 }), session(3), session(4)]);
  assert.deepEqual(gap.segments.map(segment => segment.length), [1, 2]);
  const changed = buildTrainerExerciseHistoryChart([
    session(1), session(2), session(3, { weightConvention: "per_hand", weightMultiplier: 2 }),
    session(4, { weightConvention: "per_hand", weightMultiplier: 2 }), session(5, { weightConvention: "per_hand", weightMultiplier: 1 })
  ]);
  assert.deepEqual(changed.segments.map(segment => segment.length), [2, 2, 1]);
  assert.equal(changed.hasConventionChanges, true);
  assert.deepEqual(buildTrainerExerciseHistoryChart([session(1)]).segments.map(segment => segment.length), [1]);
});

test("график тренера: неизвестная дата остаётся записью, но не получает выдуманную позицию на оси", () => {
  const result = buildTrainerExerciseHistoryChart([session(3), session(1), session(2, { date: new Date(NaN) })]);
  assert.equal(result.records.length, 3);
  assert.equal(result.measuredCount, 2);
  assert.equal(result.undatedCount, 1);
  assert.equal(result.records.at(-1).time, null);
  assert.equal(result.records.at(-1).value, 20);
});

test("график тренера: использует реальные analysed sessions, не перемножает volume второй раз", () => {
  const history = [1, 2].map(day => ({ date: `2026-01-0${day}`, exercises: [{ name: "Жим гантелей", weightMode: "per_hand",
    sets: [{ weight: day * 10, reps: 10, completed: true }] }] }));
  const analysed = analyzeExerciseProgress(history)[0].sessions;
  const volume = buildTrainerExerciseHistoryChart(analysed, "volume");
  assert.deepEqual(volume.records.map(record => record.value), [200, 400]);
  assert.deepEqual(buildTrainerExerciseHistoryChart(analysed, "weight").records.map(record => record.value), [10, 20]);
  assert.equal(volume.records[0].session, analysed[0]);
});

test("график тренера: stable key выбранной даты не меняется при догрузке более ранних сессий", () => {
  const history = [session(5), session(5, { bestWeight: 22 }), session(10)];
  const first = buildTrainerExerciseHistoryChart(history);
  const appended = buildTrainerExerciseHistoryChart([session(1), ...history]);
  assert.deepEqual(appended.records.filter(record => history.includes(record.session)).map(record => record.key), first.records.map(record => record.key));
  assert.equal(new Set(first.records.map(record => record.key)).size, history.length);
});

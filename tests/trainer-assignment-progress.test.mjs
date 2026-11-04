import test from "node:test";
import assert from "node:assert/strict";
import { buildTrainerAssignmentProgress, formatTrainerProgressNumber, prepareTrainerAssignmentProgressHistory } from "../src/utils/trainerAssignmentProgress.js";

const exercise = { id: "bench", name: "Жим" };
const set = (weight = 30, reps = 12, extra = {}) => ({ weight, reps, completed: true, ...extra });
function session(day, actual = [set()], { planned = [{ weight: 30, reps: 12 }], programId = "program-a", exercisePatch = {} } = {}) {
  return {
    date: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`, assignedProgramId: programId,
    exercises: [{ ...exercise, ...exercisePatch, sets: actual }],
    ...(planned === null ? {} : { plannedSnapshot: { exercises: [{ ...exercise, sets: planned }] } })
  };
}
const build = history => buildTrainerAssignmentProgress(history, exercise);

test("zero and one completed session remain explicit without invented comparisons", () => {
  const empty = build([]);
  assert.equal(empty.sessionCount, 0);
  assert.deepEqual(empty.sessions, []);
  assert.equal(empty.current, null);
  assert.equal(empty.previous, null);
  assert.equal(empty.trend.key, "insufficient");
  const one = build([session(1)]);
  assert.equal(one.planStatus.key, "fulfilled");
  assert.equal(one.trend.key, "single");
  assert.equal(one.previous, null);
  assert.equal(one.returnToPlan, false);
});

test("30 to 35 to 30 at twelve reps describes a return to the saved plan, not regression", () => {
  const result = build([session(1), session(8, [set(35)]), session(15)]);
  assert.equal(result.sessionCount, 3);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.equal(result.trend.key, "lower");
  assert.equal(result.trend.label, "Ниже прошлой");
  assert.equal(result.returnToPlan, true);
  assert.match(result.comparisonText, /35 → 30 кг \(−5 кг\)/);
  assert.match(result.comparisonText, /Повторы: 12 → 12/);
  assert.match(result.baselineText, /К первой из показанных \(01\.10\.2026\): без изменений/);
  assert.match(result.baselineText, /30 → 30 кг \(0 кг\)/);
  assert.doesNotMatch(JSON.stringify(result), /регресс|стала слабее|сила снизилась/i);
});

test("three different sets within one session are shown individually, not as three sessions", () => {
  const result = build([session(1, [set(30), set(35), set(30)], { planned: [set(), set(), set()] })]);
  assert.equal(result.sessionCount, 1);
  assert.equal(result.trend.key, "single");
  assert.equal(result.planStatus.key, "above");
  assert.equal(result.current.chartActualWeight, 35);
  assert.equal(result.current.chartPlannedWeight, 30);
  assert.equal(result.current.factText, "1: 30 кг × 12; 2: 35 кг × 12; 3: 30 кг × 12");
  assert.equal(result.current.volume, 1140);
});

test("a matching maximum cannot conceal lower or mixed individual sets", () => {
  const planned = [set(), set()];
  const lower = build([session(1, [set(30), set(20)], { planned })]);
  assert.equal(lower.current.chartActualWeight, 30);
  assert.equal(lower.current.chartPlannedWeight, 30);
  assert.equal(lower.planStatus.key, "below");
  const mixed = build([session(1, [set(35), set(25)], { planned })]);
  assert.equal(mixed.planStatus.key, "different");
  assert.notEqual(mixed.planStatus.label, "План выполнен");
});

test("fewer, additional, and explicitly unfinished working sets do not fulfill the plan", () => {
  const planned = [set(), set(), set()];
  for (const actual of [[set(), set()], [set(), set(), set(), set()], [set(), set(30, 12, { completed: false }), set()]]) {
    const result = build([session(1, actual, { planned })]);
    assert.equal(result.planStatus.key, "different");
  }
});

test("warmups are excluded and original set indices are used after filtering", () => {
  const warmup = set(15, 10, { setType: "warmup" });
  const result = build([session(1, [warmup, set(30), set(35)], { planned: [warmup, set(30), set(35)] })]);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.equal(result.current.factsComplete, true);
  assert.deepEqual(result.current.actualSets.map(item => item.index), [1, 2]);
  const wrongIndex = build([session(1, [set(30), set(30, 12, { setType: "warmup" })], { planned: [warmup, set(30)] })]);
  assert.equal(wrongIndex.planStatus.key, "different");
});

test("different working set types do not silently satisfy a prescription", () => {
  const result = build([session(1, [set(30, 12, { setType: "drop" })])]);
  assert.equal(result.planStatus.key, "different");
  assert.match(result.planStatus.description, /Типы рабочих подходов/);
});

test("legacy history without a snapshot never borrows the new template prescription", () => {
  const result = buildTrainerAssignmentProgress([session(1, [set(35)], { planned: null })], { ...exercise, sets: [set(35)] });
  assert.equal(result.planStatus.key, "unknown");
  assert.equal(result.current.chartPlannedWeight, null);
  assert.equal(result.current.chartActualWeight, 35);
  assert.match(result.current.planText, /не сохранён/);
  assert.match(result.current.factText, /35 кг × 12/);
});

test("absent or invalid prescribed weight is unknown, never an implicit zero", () => {
  for (const weight of [undefined, null, "", " ", "30kg", -1, Infinity]) {
    const result = build([session(1, [set()], { planned: [{ weight, reps: 12 }] })]);
    assert.equal(result.planStatus.key, "unknown");
    assert.equal(result.current.chartPlannedWeight, null);
  }
});

test("explicit zero-load bodyweight plans compare reps and sets without kilogram claims", () => {
  const history = [session(1, [set(0, 10)], { planned: [{ weight: 0, reps: "8–12" }] }), session(8, [set(0, 12)], { planned: [{ weight: 0, reps: "8–12" }] })];
  const result = build(history);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.equal(result.trend.key, "higher");
  assert.equal(result.current.chartActualWeight, null);
  assert.equal(result.current.chartPlannedWeight, null);
  assert.doesNotMatch(result.comparisonText + result.current.factText + result.current.planText, /кг/);
});

test("absent actual load cannot masquerade as an explicit zero bodyweight fact", () => {
  for (const weight of [undefined, null, "", "30oops"]) {
    const result = build([session(1, [{ weight, reps: 12, completed: true }], { planned: [{ weight: 0, reps: 12 }] })]);
    assert.equal(result.planStatus.key, "unknown");
  }
});

test("an invalid or missing actual weight remains unknown even when parsed legacy metrics look complete", () => {
  const result = build([session(1, [set("30oops")])]);
  assert.equal(result.current.bestWeight, 30);
  assert.equal(result.planStatus.key, "unknown");
  assert.equal(result.current.chartActualWeight, null);
  assert.equal(result.current.factsComplete, false);
  assert.match(result.current.factText, /Неполная запись/);
  const comparison = build([session(1), session(8, [{ reps: 12, completed: true }])]);
  assert.equal(comparison.trend.key, "incomparable");
  assert.doesNotMatch(comparison.comparisonText, /→ 0 кг/);
});

test("rep ranges and decimal-comma weights are compared per working set", () => {
  const result = build([session(1, [set("30,5", 10)], { planned: [{ weight: "30,5", reps: "8–12" }] })]);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.match(result.current.planText, /30,5 кг × 8–12/);
  assert.equal(build([session(1, [set(30, 13)], { planned: [{ weight: 30, reps: "8-12" }] })]).planStatus.key, "above");
  assert.equal(build([session(1, [set(25, 15)], { planned: [{ weight: 30, reps: 12 }] })]).planStatus.key, "different");
});

test("program changes preserve the per-session plan result but prevent a trend verdict", () => {
  const result = build([session(1, [set(35)]), session(8, [set()], { programId: "program-b" })]);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.equal(result.trend.key, "incomparable");
  assert.match(result.trend.description, /программа/);
  assert.equal(result.returnToPlan, false);
});

test("changed historical rep ranges and weight conventions are incomparable", () => {
  const changedReps = build([session(1), session(8, [set(30, 8)], { planned: [{ weight: 30, reps: 8 }] })]);
  assert.equal(changedReps.planStatus.key, "fulfilled");
  assert.equal(changedReps.trend.key, "incomparable");
  assert.match(changedReps.trend.description, /диапазон повторений/);
  const changedConvention = build([session(1), session(8, [set()], { exercisePatch: { weightMode: "per_hand" } })]);
  assert.equal(changedConvention.trend.key, "incomparable");
  assert.equal(changedConvention.planStatus.key, "fulfilled");
});

test("the same reps-range envelope cannot conceal changed per-set targets", () => {
  const result = build([
    session(1, [set(30, 8), set(30, 12)], { planned: [set(30, 8), set(30, 12)] }),
    session(8, [set(30, 12), set(30, 8)], { planned: [set(30, 12), set(30, 8)] })
  ]);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.equal(result.trend.key, "incomparable");
});

test("RIR differences are preserved as facts but never converted to a strength diagnosis", () => {
  const result = build([session(1, [set(30, 12, { rir: 3 })]), session(8, [set(30, 12, { rir: 0 })])]);
  assert.equal(result.trend.key, "same");
  assert.equal(result.current.actualSets[0].rir, 0);
  assert.match(result.trend.description, /Запас повторов.*не оцениваются/);
});

test("mixed load/repetition changes and fewer completed sets are described without a regression label", () => {
  const mixed = build([session(1, [set(35, 10)]), session(8, [set(30, 15)])]);
  assert.equal(mixed.trend.key, "mixed");
  const fewer = build([session(1, [set(), set(), set()], { planned: [set(), set(), set()] }), session(8, [set()], { planned: [set(), set(), set()] })]);
  assert.equal(fewer.trend.key, "lower");
  assert.equal(fewer.planStatus.key, "different");
  assert.equal(fewer.returnToPlan, false);
});

test("repeated lower facts require two consecutive comparable declines", () => {
  const result = build([session(1, [set(40)]), session(8, [set(35)]), session(15)]);
  assert.equal(result.trend.key, "repeated_lower");
  assert.equal(result.returnToPlan, true);
  const changed = build([session(1, [set(40)], { programId: "older" }), session(8, [set(35)]), session(15)]);
  assert.equal(changed.trend.key, "lower");
});

test("a changed historical load plan does not manufacture a return to the same prescription", () => {
  const result = build([session(1, [set(35)], { planned: [{ weight: 20, reps: 12 }] }), session(8)]);
  assert.equal(result.planStatus.key, "fulfilled");
  assert.equal(result.previous.planStatus.key, "above");
  assert.equal(result.returnToPlan, false);
});

test("only the last eight sessions are exposed while the total count and newest pair are retained", () => {
  const result = build(Array.from({ length: 10 }, (_, index) => session(index + 1, [set(20 + index)])));
  assert.equal(result.sessionCount, 10);
  assert.equal(result.sessions.length, 8);
  assert.equal(result.sessions[0].date.toISOString().slice(0, 10), "2026-10-03");
  assert.equal(result.current, result.sessions.at(-1));
  assert.equal(result.previous, result.sessions.at(-2));
  assert.match(result.baselineText, /К первой из показанных \(03\.10\.2026\)/);
  assert.match(result.baselineText, /22 → 29 кг \(\+7 кг\)/);
  assert.doesNotMatch(result.baselineText, /20 → 29/);
});

test("baseline stays generic after any intermediate condition change or incomplete fact in the shown window", () => {
  for (const middle of [
    session(8, [set(35)], { programId: "different-program" }),
    session(8, [set(35)], { exercisePatch: { weightMode: "per_hand" } }),
    session(8, [set(35, 8)], { planned: [{ weight: 30, reps: 8 }] }),
    session(8, [{ reps: 12, completed: true }])
  ]) {
    const result = build([session(1), middle, session(15)]);
    assert.doesNotMatch(result.baselineText, /К первой из показанных|без изменений/);
    assert.match(result.baselineText, /а не план новой программы/);
  }
});

test("changes outside the eight shown sessions do not change its baseline anchor", () => {
  const history = Array.from({ length: 10 }, (_, index) => session(index + 1));
  history[0].assignedProgramId = "older-program";
  history[1].exercises[0].sets[0].weight = undefined;
  const result = build(history);
  assert.match(result.baselineText, /К первой из показанных \(03\.10\.2026\): без изменений/);
});

test("sourceExercise identity and legacy actual-set fields stay compatible", () => {
  const record = session(1);
  record.actualExercises = [{ ...exercise, completedSets: [{ actualWeight: 30, actualReps: 12, completed: true }] }];
  record.exercises = [];
  const result = buildTrainerAssignmentProgress([record], { name: "Новое отображаемое имя", sourceExercise: exercise });
  assert.equal(result.sessionCount, 1);
  assert.equal(result.planStatus.key, "fulfilled");
});

test("input history, source exercise, snapshots, comments and dates are not mutated", () => {
  const history = [session(8, [set(35, 12, { note: "Контроль", rir: 2 })]), session(1)];
  history[0].clientComment = "Без изменений";
  const before = JSON.stringify(history);
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  const result = buildTrainerAssignmentProgress(freeze(history), freeze({ ...exercise }));
  assert.equal(JSON.stringify(history), before);
  assert.equal(result.current.clientComment, "Без изменений");
  assert.ok(result.current.date instanceof Date);
  assert.equal(result.current.actualSets[0].note, "Контроль");
  assert.equal(result.current.actualSets[0].rir, 2);
});

test("number formatting is finite, compact and locale-friendly", () => {
  assert.equal(formatTrainerProgressNumber(30.5), "30,5");
  assert.equal(formatTrainerProgressNumber(30), "30");
  assert.equal(formatTrainerProgressNumber(NaN), "—");
});

test("prepared history preserves fallback behavior across cards without changing input data", () => {
  const history = [session(1), session(8, [set(35)]), session(15)];
  const before = JSON.stringify(history);
  const prepared = prepareTrainerAssignmentProgressHistory(history);
  assert.equal(prepared.history, history);
  for (const target of [exercise, { name: "Other", sourceExercise: exercise }, { name: "Missing" }]) {
    assert.deepEqual(buildTrainerAssignmentProgress(history, target, prepared), buildTrainerAssignmentProgress(history, target));
  }
  assert.equal(JSON.stringify(history), before);
});

test("prepared tokens cannot validate another history or a forged payload", () => {
  const complete = [session(1)];
  const incomplete = [session(1, [{ reps: 12, completed: true }], { planned: [{ weight: 0, reps: 12 }] })];
  const old = prepareTrainerAssignmentProgressHistory(complete);
  for (const token of [old, { history: incomplete, strict: complete }, null, "invalid-token"]) {
    const result = buildTrainerAssignmentProgress(incomplete, exercise, token);
    assert.equal(result.planStatus.key, "unknown");
    assert.equal(result.current.factsComplete, false);
    assert.equal(result.current.chartActualWeight, null);
  }
});

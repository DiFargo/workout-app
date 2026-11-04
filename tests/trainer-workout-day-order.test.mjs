import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { getTrainerWorkoutDayMoveTarget, moveTrainerWorkoutDay } from "../src/utils/trainerWorkoutDayOrder.js";
import { createTrainerWorkspaceHandlers } from "../src/features/trainer/trainerWorkspaceHandlers.js";

const cleanup = installRuntimeImports({
  "firebase/firestore": { runTransaction() { assert.fail("Reordering must not access Firestore"); } },
  "/src/utils/firebaseStorage.js": { uploadStorageFile() { assert.fail("Reordering must not upload"); } },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout() { assert.fail("Reordering must not request an API"); } }
});
after(cleanup);
const { createTrainerPlanEditorHandlers } = await import("../src/features/trainer/trainerPlanEditorHandlers.js");
const workouts = () => ["a", "b", "c"].map((id, index) => ({ id, name: id, order: index + 1,
  plannedDate: `2026-10-${20 + index}`, exercises: [{ id: `e-${id}`, sets: [{ id: `s-${id}`, reps: 8, weight: 20 }] }] }));

test("day movement swaps adjacent editable positions without mutating IDs, dates or prescriptions", () => {
  const source = workouts(), snapshot = structuredClone(source);
  const next = moveTrainerWorkoutDay(source, "c", -1);
  assert.deepEqual(next.map(row => row.id), ["a", "c", "b"]);
  assert.equal(next[1], source[2]);
  assert.deepEqual(source, snapshot);
  assert.deepEqual(moveTrainerWorkoutDay(next, "c", 1), source);
});

test("completed and missed positions remain pinned even between two editable days", () => {
  for (const patch of [{ status: "completed" }, { status: "completed_off_date" }, { status: "missed" }, { completed: true }, { completedAt: "2026-10-17" }]) {
    const rows = workouts(); rows[1] = { ...rows[1], ...patch };
    const next = moveTrainerWorkoutDay(rows, "c", -1);
    assert.deepEqual(next.map(row => row.id), ["c", "b", "a"]);
    assert.equal(next[1], rows[1]);
    assert.equal(moveTrainerWorkoutDay(rows, "b", -1), rows);
  }
  const rows = workouts();
  assert.equal(moveTrainerWorkoutDay(rows, "b", 1, new Set(["b"])), rows);
  assert.deepEqual(moveTrainerWorkoutDay(rows, "c", -1, ["b"]).map(row => row.id), ["c", "b", "a"]);
});

test("bounds, unknown or ambiguous identity and invalid directions are no-ops", () => {
  const rows = workouts();
  for (const [id, direction] of [["a", -1], ["c", 1], ["missing", -1], ["a", 0], ["a", 2], ["a", "1"]]) {
    assert.equal(getTrainerWorkoutDayMoveTarget(rows, id, direction), -1);
    assert.equal(moveTrainerWorkoutDay(rows, id, direction), rows);
  }
  for (const invalid of [[rows[0], rows[0]], [{ name: "No ID" }, rows[0]], []]) assert.equal(moveTrainerWorkoutDay(invalid, "a", 1), invalid);
});

test("a computed overdue label does not lock an otherwise editable planned day", () => {
  const rows = workouts();
  rows[1] = { ...rows[1], status: "planned", displayStatus: "missed" };
  assert.deepEqual(moveTrainerWorkoutDay(rows, "b", -1).map(row => row.id), ["b", "a", "c"]);
});

test("actual workspace handler changes only the draft, supports rapid repeated moves and never autosaves", () => {
  let plan = { assignedProgramName: "My plan", workouts: workouts() };
  const source = structuredClone(plan);
  const handlers = createTrainerWorkspaceHandlers({ ...createTrainerPlanEditorHandlers({
    plan, draftOnly: true, completedWorkoutIds: ["a"],
    setPlan: update => { plan = typeof update === "function" ? update(plan) : update; },
    saveWorkoutsToFirebase() { assert.fail("Move is draft-only until explicit Save"); }
  }) });
  assert.equal(handlers.onMoveDay("c", -1), true);
  assert.deepEqual(plan.workouts.map(row => row.id), ["a", "c", "b"]);
  assert.equal(handlers.onMoveDay("c", -1), true); // stale event is revalidated against the latest draft
  assert.deepEqual(plan.workouts.map(row => row.id), ["a", "c", "b"]);
  assert.deepEqual(source.workouts.map(row => row.id), ["a", "b", "c"]);
});

test("reordering cannot opt a non-draft plan into implicit persistence", () => {
  const handlers = createTrainerPlanEditorHandlers({ plan: { workouts: workouts() }, setPlan() { assert.fail("Not a client editor draft"); } });
  assert.equal(handlers.moveTrainerNextWorkoutDay("c", -1), false);
  assert.equal(createTrainerWorkspaceHandlers({}).onMoveDay("c", -1), false);
});

import assert from "node:assert/strict";
import { accountToken, decode } from "./exercise-preview-batch.mjs";
import { resolveTrainerAssignmentWorkoutOrder } from "../src/utils/trainerAssignmentWorkoutOrder.js";

// Read-only, bounded inspection. Never prints email, tokens or exercise data.
const email = process.env.ORDER_AUDIT_EMAIL;
assert.ok(email, "ORDER_AUDIT_EMAIL is required");
const base = "https://firestore.googleapis.com/v1/projects/tren-85720/databases/(default)/documents";
const token = await accountToken();
async function query(path, structuredQuery) {
  const response = await fetch(`${base}${path}:runQuery`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }), signal: AbortSignal.timeout(20000)
  });
  assert.equal(response.status, 200, "Read-only query failed");
  return (await response.json()).filter(item => item.document).map(({ document }) => ({
    id: document.name.split("/").at(-1),
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]))
  }));
}
const users = await query("", {
  from: [{ collectionId: "users" }],
  select: { fields: [{ fieldPath: "__name__" }, { fieldPath: "workoutCalendar.plannedWorkouts" }] },
  where: { fieldFilter: { field: { fieldPath: "email" }, op: "EQUAL", value: { stringValue: email } } }, limit: 2
});
assert.equal(users.length, 1, "Expected one matching account");
const fields = ["name", "order", "sortOrder", "originalWorkoutId", "assignedProgramId", "assignedProgramName", "assignedProgramAddedAt", "assignedProgramUpdatedAt", "status"];
const workouts = await query(`/users/${users[0].id}`, {
  from: [{ collectionId: "workouts" }], select: { fields: fields.map(fieldPath => ({ fieldPath })) },
  ...(process.env.ORDER_AUDIT_ASSIGNMENT ? { where: { fieldFilter: { field: { fieldPath: "assignedProgramAddedAt" }, op: "EQUAL", value: { stringValue: process.env.ORDER_AUDIT_ASSIGNMENT } } } } : {}), limit: 200
});
assert.ok(workouts.length < 200, "Inspection limit reached");
const latestAssignment = workouts.map(workout => workout.assignedProgramAddedAt || "").sort().at(-1);
const selected = workouts.filter(workout => workout.assignedProgramAddedAt === latestAssignment);
const selectedIds = new Set(selected.map(workout => workout.id));
const slots = (users[0].workoutCalendar?.plannedWorkouts || []).filter(slot => selectedIds.has(slot.workoutId))
  .map(({ workoutId, order, index }) => ({ workoutId, order, index }));
const before = [...selected].sort((left, right) => Number(left.order) - Number(right.order));
const resolved = resolveTrainerAssignmentWorkoutOrder(before, users[0].workoutCalendar);
console.log(JSON.stringify({ readOnly: true, before: before.map(({ name, order }) => ({ name, order })), after: resolved.map(({ name, order }) => ({ name, storedOrderUnchanged: order })), slotsConfirmed: slots.length }, null, 2));

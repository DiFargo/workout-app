import test from "node:test";
import assert from "node:assert/strict";
import { resolveTrainerAssignmentWorkoutOrder } from "../src/utils/trainerAssignmentWorkoutOrder.js";

function fixture() {
  const workouts = Array.from({ length: 4 }, (_, index) => ({
    id: `day-${index + 1}_assignment-a`, name: `Тренировка ${index + 1}`,
    order: index === 3 ? 4 : index + 33,
    sortOrder: index === 3 ? 4 : index + 33,
    assignedProgramAddedAt: "assignment-a", assignedProgramId: "program-a",
    assignedProgramUpdatedAt: "queue-old", status: index < 3 ? "completed" : "planned"
  }));
  const calendar = {
    plannedWorkouts: workouts.map((workout, index) => ({
      workoutId: workout.id, order: index + 1, index,
      assignedProgramAddedAt: "assignment-a", assignedProgramId: "program-a",
      assignedProgramUpdatedAt: "queue-new", date: `2026-11-${10 + index}`
    }))
  };
  return { workouts, calendar, input: [workouts[3], ...workouts.slice(0, 3)] };
}
const ids = workouts => workouts.map(workout => workout.id);

test("mixed global/local saved order 33,34,35,4 is restored by exact calendar identities", () => {
  const { workouts, calendar, input } = fixture();
  const result = resolveTrainerAssignmentWorkoutOrder(input, calendar);
  assert.deepEqual(ids(result), ids(workouts));
  assert.notEqual(result, input);
  assert.ok(result.every((workout, index) => workout === workouts[index]));
});

test("a valid contiguous local or global manual order is never overridden by names or calendar", () => {
  for (const offset of [0, 32]) {
    const { workouts, calendar } = fixture();
    const manual = [workouts[2], workouts[0], workouts[3], workouts[1]].map((workout, index) => ({
      ...workout, order: offset + index + 1, sortOrder: offset + index + 1
    }));
    const result = resolveTrainerAssignmentWorkoutOrder(manual, calendar);
    assert.deepEqual(ids(result), ids(manual));
    assert.notEqual(result, manual);
  }
});

test("incomplete, unkeyed, duplicate or ambiguous calendar positions preserve the input", () => {
  const transforms = [
    slots => slots.slice(0, -1),
    slots => slots.map(({ workoutId: _id, ...slot }) => slot),
    slots => [...slots, { ...slots[0] }],
    slots => slots.map((slot, index) => index === 3 ? { ...slot, order: 3, index: 2 } : slot),
    slots => slots.map((slot, index) => index === 3 ? { ...slot, order: 4, index: 0 } : slot),
    slots => slots.map((slot, index) => index === 3 ? { ...slot, order: 0 } : slot),
    slots => slots.map((slot, index) => index === 3 ? { ...slot, order: 5, index: 4 } : slot)
  ];
  for (const transform of transforms) {
    const { input, calendar } = fixture();
    const result = resolveTrainerAssignmentWorkoutOrder(input, { plannedWorkouts: transform(calendar.plannedWorkouts) });
    assert.deepEqual(ids(result), ids(input));
  }
});

test("an explicit foreign durable assignment or program cannot order these days", () => {
  for (const foreign of [{ assignedProgramAddedAt: "assignment-b" }, { assignedProgramId: "program-b" }]) {
    const { input, calendar } = fixture();
    calendar.plannedWorkouts[0] = { ...calendar.plannedWorkouts[0], ...foreign };
    assert.deepEqual(ids(resolveTrainerAssignmentWorkoutOrder(input, calendar)), ids(input));
  }
});

test("complete exact IDs work with missing legacy assignment metadata and changed queue versions", () => {
  const { input, workouts, calendar } = fixture();
  calendar.plannedWorkouts = calendar.plannedWorkouts.map(({ assignedProgramAddedAt: _assignment, assignedProgramId: _program, order: _order, ...slot }) => slot);
  calendar.assignedProgramAddedAt = "another-root-assignment";
  assert.deepEqual(ids(resolveTrainerAssignmentWorkoutOrder(input, calendar)), ids(workouts));
});

test("unrelated calendar slots do not affect the assignment's complete exact-ID order", () => {
  const { input, workouts, calendar } = fixture();
  calendar.plannedWorkouts.unshift({ workoutId: "foreign-day", order: 1, index: 0, assignedProgramAddedAt: "assignment-b" });
  assert.deepEqual(ids(resolveTrainerAssignmentWorkoutOrder(input, calendar)), ids(workouts));
});

test("missing IDs, mixed assignments, inconsistent order fields or unconfirmed legacy orders are not guessed", () => {
  const transforms = [
    workouts => workouts.map((workout, index) => index === 0 ? { ...workout, id: "" } : workout),
    workouts => workouts.map((workout, index) => index === 0 ? { ...workout, id: workouts[1].id } : workout),
    workouts => workouts.map((workout, index) => index === 0 ? { ...workout, assignedProgramAddedAt: "assignment-b" } : workout),
    workouts => workouts.map((workout, index) => index === 0 ? { ...workout, order: 17, sortOrder: 18 } : workout),
    workouts => workouts.map(({ order: _order, sortOrder: _sortOrder, ...workout }) => workout),
    workouts => workouts.map((workout, index) => ({ ...workout, order: index * 10 + 1, sortOrder: index * 10 + 1 }))
  ];
  for (const transform of transforms) {
    const { input, calendar } = fixture();
    const legacy = transform(input);
    assert.deepEqual(ids(resolveTrainerAssignmentWorkoutOrder(legacy, calendar)), ids(legacy));
  }
});

test("resolution never mutates source records, calendar, selected IDs or completion facts", () => {
  const { input, workouts, calendar } = fixture();
  const selectedWorkoutId = workouts[3].id;
  const before = JSON.stringify({ input, calendar });
  input.forEach(Object.freeze);
  calendar.plannedWorkouts.forEach(Object.freeze);
  Object.freeze(input);
  Object.freeze(calendar.plannedWorkouts);
  const result = resolveTrainerAssignmentWorkoutOrder(input, calendar);
  assert.equal(JSON.stringify({ input, calendar }), before);
  assert.equal(result.find(workout => workout.id === selectedWorkoutId), workouts[3]);
  assert.equal(result.filter(workout => workout.status === "completed").length, 3);
  assert.ok(result.every(workout => input.includes(workout)));
});

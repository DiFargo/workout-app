import test from "node:test";
import assert from "node:assert/strict";
import { getClientAssignedProgramRefreshKey } from "../src/features/client/workouts/useClientAssignedWorkoutRefresh.js";

test("assigned workout refresh key changes for a newly assigned trainer program", () => {
  const previous = getClientAssignedProgramRefreshKey({
    assignedProgramId: "program_a",
    assignedProgramUpdatedAt: "2026-08-24T10:00:00.000Z",
    assignedWorkoutCount: 4
  });
  const next = getClientAssignedProgramRefreshKey({
    assignedProgramId: "program_b",
    assignedProgramUpdatedAt: "2026-08-24T10:05:00.000Z",
    assignedWorkoutCount: 6
  });

  assert.notEqual(next, previous);
});

test("assigned workout refresh key stays stable for unrelated profile changes", () => {
  const first = getClientAssignedProgramRefreshKey({
    assignedProgramId: "program_a",
    assignedProgramUpdatedAt: "2026-08-24T10:00:00.000Z",
    assignedWorkoutCount: 4,
    displayName: "Анна"
  });
  const second = getClientAssignedProgramRefreshKey({
    assignedProgramId: "program_a",
    assignedProgramUpdatedAt: "2026-08-24T10:00:00.000Z",
    assignedWorkoutCount: 4,
    displayName: "Анна Петрова"
  });

  assert.equal(second, first);
});

test("assigned workout refresh key changes when the trainer updates the calendar", () => {
  const first = getClientAssignedProgramRefreshKey({
    assignedProgramId: "program_a",
    assignedProgramUpdatedAt: "2026-08-24T10:00:00.000Z",
    workoutCalendar: { updatedAt: "2026-08-24T10:00:00.000Z" }
  });
  const second = getClientAssignedProgramRefreshKey({
    assignedProgramId: "program_a",
    assignedProgramUpdatedAt: "2026-08-24T10:00:00.000Z",
    workoutCalendar: { updatedAt: "2026-08-24T10:03:00.000Z" }
  });

  assert.notEqual(second, first);
});

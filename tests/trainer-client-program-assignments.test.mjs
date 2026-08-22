import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrainerClientProgramTimeline,
  getNextTrainerClientActiveProgramAssignment,
  getTrainerClientProgramAssignmentKey,
  isTrainerClientBasicWorkout,
  isTrainerClientCurrentAssignmentWorkout,
  isTrainerClientProgramAssignmentMatch
} from "../src/utils/trainerClientProgramAssignments.js";

const CURRENT_ASSIGNMENT = "2026-08-10T10:00:00.000Z";
const FUTURE_ASSIGNMENT = "2026-08-20T10:00:00.000Z";

test("separates past, current and future assignments without relying on program names", () => {
  const timeline = buildTrainerClientProgramTimeline({
    workouts: [
      {
        id: "current-done",
        assignedProgramId: "strength",
        assignedProgramName: "Сила",
        assignedProgramAddedAt: CURRENT_ASSIGNMENT
      },
      {
        id: "current-next",
        assignedProgramId: "strength",
        assignedProgramName: "Сила",
        assignedProgramAddedAt: CURRENT_ASSIGNMENT
      },
      {
        id: "future-1",
        assignedProgramId: "strength",
        assignedProgramName: "Сила",
        assignedProgramAddedAt: FUTURE_ASSIGNMENT
      }
    ],
    archivedWorkouts: [{
      id: "past-1",
      status: "completed",
      assignedProgramId: "old-strength",
      assignedProgramName: "Сила",
      assignedProgramAddedAt: "2026-07-01T10:00:00.000Z"
    }],
    history: [{ workoutId: "current-done" }]
  });

  assert.deepEqual(timeline.map((item) => item.status), ["archived", "current", "future"]);
  assert.equal(timeline[1].completedCount, 1);
  assert.equal(timeline[1].workoutCount, 2);
  assert.equal(timeline[2].completion, 0);
});

test("assignment identity keeps appended versions distinct even when templates share a name", () => {
  const first = {
    assignedProgramId: "same-template",
    assignedProgramName: "Новая программа",
    assignedProgramAddedAt: CURRENT_ASSIGNMENT
  };
  const next = {
    assignedProgramId: "same-template",
    assignedProgramName: "Новая программа",
    assignedProgramAddedAt: FUTURE_ASSIGNMENT
  };

  assert.notEqual(getTrainerClientProgramAssignmentKey(first), getTrainerClientProgramAssignmentKey(next));
  assert.equal(isTrainerClientProgramAssignmentMatch(first, getTrainerClientProgramAssignmentKey(first)), true);
  assert.equal(isTrainerClientProgramAssignmentMatch(next, getTrainerClientProgramAssignmentKey(first)), false);
});

test("client loads only the exact active copy of a repeated template", () => {
  const completedCopy = {
    assignedProgramId: "same-template",
    assignedProgramAddedAt: "2026-08-01T10:00:00.000Z"
  };
  const freshCopy = {
    assignedProgramId: "same-template",
    assignedProgramAddedAt: "2026-08-16T10:00:00.000Z"
  };
  const profile = {
    assignedProgramId: "same-template",
    assignedProgramAddedAt: "2026-08-16T10:00:00.000Z",
    // Queue versions may be changed while editing a plan. They must not
    // replace the durable assignment identity.
    assignedProgramUpdatedAt: "2026-08-20T10:00:00.000Z"
  };

  assert.equal(isTrainerClientCurrentAssignmentWorkout(completedCopy, profile), false);
  assert.equal(isTrainerClientCurrentAssignmentWorkout(freshCopy, profile), true);
  assert.equal(isTrainerClientCurrentAssignmentWorkout(freshCopy, {}), false);
});

test("profile identity keeps a freshly assigned copy future and retires an older unstarted copy", () => {
  const timeline = buildTrainerClientProgramTimeline({
    workouts: [
      {
        id: "old-unstarted-day",
        assignedProgramId: "same-template",
        assignedProgramName: "Старая копия",
        assignedProgramAddedAt: CURRENT_ASSIGNMENT,
        status: "planned"
      },
      {
        id: "fresh-day",
        assignedProgramId: "same-template",
        assignedProgramName: "Новая копия",
        assignedProgramAddedAt: FUTURE_ASSIGNMENT,
        status: "planned"
      }
    ],
    clientProfile: {
      assignedProgramId: "same-template",
      assignedProgramAddedAt: FUTURE_ASSIGNMENT,
      assignedProgramUpdatedAt: "2026-08-21T10:00:00.000Z"
    }
  });

  assert.equal(timeline[0].status, "past");
  assert.equal(timeline[1].status, "future");
  assert.equal(
    getNextTrainerClientActiveProgramAssignment(
      timeline.flatMap((assignment) => assignment.workouts),
      [],
      { assignedProgramId: "same-template", assignedProgramAddedAt: FUTURE_ASSIGNMENT }
    )?.key,
    timeline[1].key
  );
});

test("completed assignments are never selected as the client's active program", () => {
  const oldAssignment = "2026-08-01T10:00:00.000Z";
  const freshAssignment = "2026-08-16T10:00:00.000Z";

  assert.equal(getNextTrainerClientActiveProgramAssignment([{
    id: "old-day",
    assignedProgramId: "same-template",
    assignedProgramAddedAt: oldAssignment,
    status: "completed"
  }]), null);

  const next = getNextTrainerClientActiveProgramAssignment([{
    id: "old-day",
    assignedProgramId: "same-template",
    assignedProgramAddedAt: oldAssignment,
    status: "completed"
  }, {
    id: "new-day",
    assignedProgramId: "same-template",
    assignedProgramName: "Новая программа",
    assignedProgramAddedAt: freshAssignment,
    status: "planned"
  }]);

  assert.equal(next?.name, "Новая программа");
  assert.equal(next?.workoutCount, 1);
});

test("history keeps a completed legacy assignment from becoming active after a future copy is deleted", () => {
  const completedAssignment = "2026-08-01T10:00:00.000Z";
  const remainingWorkouts = ["day-1", "day-2"].map((id) => ({
    id,
    assignedProgramId: "same-template",
    assignedProgramName: "Завершённая программа",
    assignedProgramAddedAt: completedAssignment,
    // Old client saves only wrote the completion fact to history.
    status: "planned"
  }));
  const history = remainingWorkouts.map((workout) => ({
    workoutId: workout.id,
    assignedProgramId: workout.assignedProgramId,
    assignedProgramAddedAt: completedAssignment,
    finishedAt: "2026-08-12T10:00:00.000Z"
  }));

  assert.equal(
    getNextTrainerClientActiveProgramAssignment(remainingWorkouts, history),
    null
  );
});

test("does not transfer a prior program completion to a newly assigned program", () => {
  const timeline = buildTrainerClientProgramTimeline({
    workouts: [
      {
        id: "shared-day-1",
        assignedProgramId: "previous-program",
        assignedProgramName: "Предыдущая",
        assignedProgramAddedAt: "2026-08-01T10:00:00.000Z"
      },
      {
        id: "shared-day-1",
        assignedProgramId: "new-program",
        assignedProgramName: "Новая",
        assignedProgramAddedAt: "2026-08-15T10:00:00.000Z"
      }
    ],
    history: [{
      workoutId: "shared-day-1",
      assignedProgramId: "previous-program",
      assignedProgramAddedAt: "2026-08-01T10:00:00.000Z"
    }]
  });

  assert.equal(timeline[0].completion, 100);
  assert.equal(timeline[1].completion, 0);
  assert.equal(timeline[1].status, "future");
});

test("keeps legacy history on the prior assignment instead of a fresh copy", () => {
  const timeline = buildTrainerClientProgramTimeline({
    workouts: [{
      id: "day-1",
      assignedProgramId: "tren-plus",
      assignedProgramAddedAt: "2026-08-01T10:00:00.000Z"
    }, {
      id: "day-1",
      assignedProgramId: "tren-plus",
      assignedProgramAddedAt: "2026-08-15T10:00:00.000Z"
    }],
    history: [{
      workoutId: "day-1",
      assignedProgramId: "tren-plus",
      date: "2026-08-10T18:00:00.000Z"
    }]
  });

  assert.equal(timeline[0].completedCount, 1);
  assert.equal(timeline[1].completedCount, 0);
  assert.equal(timeline[1].status, "future");
});

test("marks a client-created basic workout plan so it is not confused with a trainer assignment", () => {
  const [assignment] = buildTrainerClientProgramTimeline({
    archivedWorkouts: [{
      id: "basic-day-1",
      source: "basic",
      assignedProgramId: "basic_custom",
      assignedProgramName: "Базовый 4-недельный тренировочный план",
      assignedProgramUpdatedAt: "basic:basic_custom"
    }]
  });

  assert.equal(assignment.isBasic, true);
  assert.equal(assignment.status, "archived");
});

test("identifies only explicit client basic plans for trainer history filtering", () => {
  assert.equal(isTrainerClientBasicWorkout({ source: "basic" }), true);
  assert.equal(isTrainerClientBasicWorkout({ assignedProgramUpdatedAt: "basic:custom" }), true);
  assert.equal(isTrainerClientBasicWorkout({ assignedProgramId: "basic_4weeks" }), true);
  assert.equal(isTrainerClientBasicWorkout({ assignedProgramId: "trainer_strength" }), false);
});

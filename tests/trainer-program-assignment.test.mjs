import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildAppendedAssignmentWorkoutDocumentPlan,
  isCompletedAssignedWorkoutDoc
} from "../src/utils/trainerProgramAssignment.js";
import {
  buildTrainerClientProgramTimeline,
  getNextTrainerClientActiveProgramAssignment
} from "../src/utils/trainerClientProgramAssignments.js";

test("completed assigned workout documents are protected during reassignment", () => {
  assert.equal(isCompletedAssignedWorkoutDoc({ status: "completed" }), true);
  assert.equal(isCompletedAssignedWorkoutDoc({ status: "completed_off_date" }), true);
  assert.equal(isCompletedAssignedWorkoutDoc({ completedAt: "2026-07-10T12:00:00.000Z" }), true);
  assert.equal(isCompletedAssignedWorkoutDoc({ status: "planned" }), false);
});

test("new assignment appends workouts without deleting the prior queue", () => {
  const appended = buildAppendedAssignmentWorkoutDocumentPlan([
    { id: "day-1", data: () => ({ name: "Old push", order: 1, status: "planned" }) },
    { id: "day-2", data: () => ({ name: "Old pull", order: 2, status: "completed" }) }
  ], [
    { id: "day-1", name: "New legs" },
    { id: "day-2", name: "New core" }
  ], "2026-08-13T12:00:00.000Z");

  assert.equal(appended.previousCount, 2);
  assert.equal(appended.protectedCount, 1);
  assert.equal(appended.allWorkouts.length, 4);
  assert.deepEqual(appended.allWorkouts.slice(0, 2).map((workout) => workout.id), ["day-1", "day-2"]);
  assert.notEqual(appended.assignedWorkouts[0].id, "day-1");
  assert.notEqual(appended.assignedWorkouts[1].id, "day-2");
  assert.deepEqual(appended.assignedWorkouts.map((workout) => workout.order), [3, 4]);
});

test("every assignment creates fresh planned workout documents even without an existing id collision", () => {
  const appended = buildAppendedAssignmentWorkoutDocumentPlan([], [{
    id: "template-day-1",
    name: "Новый день",
    status: "completed",
    completed: true,
    completedAt: "2026-08-01T12:00:00.000Z",
    scheduledDate: "2026-08-01"
  }], "2026-08-16T12:00:00.000Z");

  const [workout] = appended.assignedWorkouts;
  assert.notEqual(workout.id, "template-day-1");
  assert.equal(workout.originalWorkoutId, "template-day-1");
  assert.equal(workout.status, "planned");
  assert.equal(workout.completed, false);
  assert.equal(workout.completedAt, undefined);
  assert.equal(workout.scheduledDate, undefined);
});

test("a new assignment keeps its own version instead of inheriting a prior program state", async () => {
  const source = await readFile("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");

  assert.match(source, /const queueVersion = String\(assignedProgramUpdatedAt \|\| ""\)\.trim\(\);/);
  assert.match(source, /assignedProgramAddedAt: assignedProgramUpdatedAt,/);
  assert.doesNotMatch(source, /currentClientData\?\.assignedProgramUpdatedAt \|\|\s*currentClientData\?\.assignedProgramAt \|\|\s*assignedProgramUpdatedAt/);
});

test("trainers can delete only a program the client has not started", async () => {
  const source = await readFile("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");

  assert.match(source, /matchedAssignment\?\.status !== "future"/);
});

test("archive, delete and legacy reset target one durable assignment only", async () => {
  const source = await readFile("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");

  assert.match(source, /function getClientProfileProgramAssignment\(client = \{\}\)/);
  assert.match(source, /getClientProgramAssignmentSnapshot\(workoutsSnapshot\.docs, assignmentKey, assignment\)/);
  assert.match(source, /updateProgramAssignmentLocally\(clientId, assignmentKey, "archive", clientPatch, now, \{\s*assignment\s*\}\)/s);
  assert.match(source, /updateProgramAssignmentLocally\(clientId, assignmentKey, "delete", clientPatch, "", \{\s*assignment\s*\}\)/s);
  assert.match(source, /const assignment = getClientProfileProgramAssignment\(clientData\);/);
  assert.doesNotMatch(source, /await clearClientAssignedWorkouts\(clientId\)/);
});

test("a fully missed older assignment cannot shadow a freshly assigned program", () => {
  const timeline = buildTrainerClientProgramTimeline({
    workouts: [
      {
        id: "old-day-1",
        assignedProgramId: "program-ilya",
        assignedProgramName: "Программа Илья",
        assignedAt: "2026-08-10T09:00:00.000Z",
        assignedProgramAddedAt: "2026-08-10T09:00:00.000Z",
        status: "missed"
      },
      {
        id: "old-day-2",
        assignedProgramId: "program-ilya",
        assignedProgramName: "Программа Илья",
        assignedAt: "2026-08-10T09:00:00.000Z",
        assignedProgramAddedAt: "2026-08-10T09:00:00.000Z",
        status: "missed"
      },
      {
        id: "fresh-day-1",
        assignedProgramId: "program-ilya",
        assignedProgramName: "Программа Илья",
        assignedAt: "2026-08-17T09:00:00.000Z",
        assignedProgramAddedAt: "2026-08-17T09:00:00.000Z",
        status: "planned"
      }
    ]
  });

  assert.equal(timeline[0].status, "past");
  assert.equal(timeline[0].completion, 0);
  assert.equal(timeline[1].status, "future");
  assert.equal(getNextTrainerClientActiveProgramAssignment(timeline.flatMap((item) => item.workouts))?.key, timeline[1].key);
});

test("client workout loader keeps only the active individual assignment", async () => {
  const source = await readFile("src/features/client/workouts/workoutFirebaseLoadHandlers.js", "utf8");

  assert.match(source, /const workoutAssignmentVersion = String\(data\.assignedProgramUpdatedAt \|\| assignedProgramUpdatedAt \|\| ""\)\.trim\(\);/);
  assert.match(source, /isTrainerProgramClientVisible/);
  assert.match(source, /if \(!isClientVisibleLifecycle\) return;/);
  assert.match(source, /isTrainerClientCurrentAssignmentWorkout\(data, profileData\)/);
  assert.match(source, /if \(!isCurrentAssignment\) return;/);
  assert.match(source, /activeIndividualProgramCompleted/);
  assert.match(source, /buildTrainerClientProgramTimeline\(\{/);
  assert.match(source, /history: workoutHistory/);
  assert.match(source, /clientProfile: profileData/);
  assert.match(source, /activeIndividualAssignment\?\.status === "past"/);
  assert.match(source, /const taskBlocks = Array\.isArray\(data\.taskBlocks\) \? data\.taskBlocks : \[\];/);
  assert.match(source, /const groupExerciseMetadata = getGroupExerciseMetadata\(taskBlocks\);/);
  assert.match(source, /taskBlockType: "group"/);
});

test("client plan and workout stage visibly identify supersets and trisets", async () => {
  const planSource = await readFile("src/features/client/workouts/WorkoutPlanPage.jsx", "utf8");
  const stageSource = await readFile("src/features/client/workouts/WorkoutRunStageView.jsx", "utf8");

  assert.match(planSource, /function getWorkoutGroupSummary\(workout = \{\}\)/);
  assert.match(planSource, /groupMode === "triset"/);
  assert.match(planSource, /styles\.groupSummary/);
  assert.match(stageSource, /const groupBlock = exercise\?\.taskBlockType === "group"/);
  assert.match(stageSource, /groupExercisePosition/);
  assert.match(stageSource, /groupProgressLabel/);
});

test("trainer assignment confirmation explains that the current queue is preserved", async () => {
  const source = await readFile("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");

  assert.match(source, /buildProgramAssignmentConfirmText/);
  assert.match(source, /Предыдущие тренировки и расписание сохранятся/);
  assert.match(source, /appendClientAssignedWorkouts/);
  assert.doesNotMatch(source, /batch\.delete\(workoutDoc\.ref\)/);
});

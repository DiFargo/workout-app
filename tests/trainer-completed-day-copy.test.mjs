import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { copyTrainerWorkoutDay } from "../src/utils/trainerWorkoutCopy.js";
import { createProgramDraft, programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";

const cleanup = installRuntimeImports({
  "firebase/firestore": { doc: (_db, ...path) => path.join("/"), runTransaction() { assert.fail("Use the test transaction"); } },
  "/src/utils/firebaseStorage.js": { uploadStorageFile() { assert.fail("No uploads while copying"); } },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout() { assert.fail("No API while copying"); } }
});
after(cleanup);
const { createTrainerPlanEditorHandlers } = await import("../src/features/trainer/trainerPlanEditorHandlers.js");
const { saveTrainerProgramDraft } = await import("../src/features/client/workouts/trainerProgramDraftPersistence.js");

function completedDay(id = "done-1", order = 33) {
  return {
    id, order, sortOrder: order, scheduleOrder: order - 32, name: "Тренировка 1", status: "completed",
    completed: true, completedAt: "2026-10-20T10:00:00Z", completedDate: "2026-10-20",
    scheduledDate: "2026-10-20", plannedDate: "2026-10-19", movedToDate: "2026-10-20",
    statusUpdatedAt: "old", startedAt: "old", finishedAt: "old", durationSeconds: 2400,
    readiness: { energy: 5 }, postWorkoutFeedback: { difficulty: 3 }, clientComment: "old", plannedSnapshot: { old: true },
    assignedProgramId: "p", assignedProgramName: "План", assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment",
    _editorSnapshot: "old",
    taskBlocks: [{ id: "group", type: "group", groupMode: "superset", rounds: 3, exerciseIds: ["e1", "e2"] },
      { id: "interval", type: "interval", rounds: 5, workTime: "30 сек", restTime: "15 сек", exerciseIds: [] }],
    exercises: ["e1", "e2"].map((exerciseId, index) => ({
      id: exerciseId, name: "Жим ногами", rest: "90 сек", completed: true, clientNote: "old",
      exerciseCardId: "card", exerciseCardOwnerUid: "trainer", exerciseCardSnapshot: { video: "clip.mp4", technique: "Техника" },
      librarySource: { type: "card", ownerUid: "trainer" }, video: "clip.mp4", videoPosterTime: 4,
      videoCrop: { x: 0.5, y: 0.5, zoom: 1.2 }, alternatives: [{ exerciseCardId: "alternative" }],
      taskBlockId: "group", taskBlockType: "group",
      taskBlockConfig: { id: "group", type: "group", groupMode: "superset", rounds: 3, exerciseIds: ["e1", "e2"] },
      sets: [{ id: `s${index}`, reps: 12, weight: 50, durationSeconds: 30, completed: true, completedRounds: 3,
        enteredReps: "10", enteredWeight: "55", targetReps: 12, targetWeight: 50, targetDurationSeconds: 30,
        aiOriginalWeight: 45, aiSuggestedWeight: 50, aiReadinessId: "old", actualWeight: 55, actualReps: 10,
        completedAt: "old", _editorSet: true }]
    }))
  };
}

test("completed-day copy resets execution and dates while preserving prescription and independent library/media metadata", () => {
  const source = completedDay(), before = structuredClone(source);
  const copy = copyTrainerWorkoutDay(source, { suffix: "copy-a", order: 35 });
  assert.deepEqual(source, before);
  assert.equal(copy.status, "planned"); assert.equal(copy.completed, false);
  for (const key of ["completedAt", "completedDate", "scheduledDate", "plannedDate", "movedToDate", "startedAt", "finishedAt", "durationSeconds", "readiness", "postWorkoutFeedback", "clientComment", "plannedSnapshot", "_editorSnapshot"]) assert.equal(key in copy, false, key);
  assert.equal(copy.assignedProgramAddedAt, "assignment");
  const exercise = copy.exercises[0], set = exercise.sets[0];
  assert.notEqual(copy.id, source.id); assert.notEqual(exercise.id, source.exercises[0].id); assert.notEqual(set.id, source.exercises[0].sets[0].id);
  assert.equal(exercise.completed, false); assert.equal("clientNote" in exercise, false);
  for (const key of ["exerciseCardId", "exerciseCardOwnerUid", "exerciseCardSnapshot", "librarySource", "video", "videoPosterTime", "videoCrop", "alternatives"]) assert.deepEqual(exercise[key], source.exercises[0][key], key);
  assert.deepEqual([set.reps, set.weight, set.durationSeconds], [12, 50, 30]);
  assert.deepEqual([set.completed, set.completedRounds, set.enteredReps, set.enteredWeight], [false, 0, "", ""]);
  for (const key of ["targetReps", "targetWeight", "targetDurationSeconds", "aiOriginalWeight", "aiSuggestedWeight", "aiReadinessId", "actualWeight", "actualReps", "completedAt", "_editorSet"]) assert.equal(key in set, false, key);
  assert.deepEqual(copy.taskBlocks[0].exerciseIds, copy.exercises.map(item => item.id));
  assert.equal(copy.taskBlocks[0].id, exercise.taskBlockId);
  assert.deepEqual(exercise.taskBlockConfig.exerciseIds, copy.taskBlocks[0].exerciseIds);
  assert.equal(exercise.taskBlockConfig.id, copy.taskBlocks[0].id);
  assert.equal(copy.taskBlocks[1].rounds, 5); assert.equal(copy.taskBlocks[1].workTime, "30 сек");
  exercise.videoCrop.zoom = 2; exercise.exerciseCardSnapshot.technique = "new"; set.weight = 60;
  assert.deepEqual(source, before);
  const other = copyTrainerWorkoutDay(source, { suffix: "copy-b", order: 36 });
  assert.notEqual(other.id, copy.id); assert.notEqual(other.exercises[0].sets[0].id, set.id);
});

test("actual draft copy appends after locked days and transaction writes only the new planned day and profile", async () => {
  const source = [completedDay(), completedDay("done-2", 34)];
  const profile = { assignedProgramId: "p", assignedProgramName: "План", assignedProgramUpdatedAt: "v1",
    assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active",
    workoutCalendar: { planRevision: 7, scheduledDates: ["2026-10-20", "2026-10-22"],
      plannedWorkouts: source.map((workout, index) => ({ workoutId: workout.id, order: index + 1, index,
        date: `2026-10-${20 + index * 2}`, status: "completed", completedDate: `2026-10-${20 + index * 2}`, assignedProgramAddedAt: "assignment" })) } };
  const history = { workoutId: "done-1", date: "2026-10-20", exercises: source[0].exercises };
  const docs = new Map([["users/client", structuredClone(profile)], ["users/client/history/old", structuredClone(history)],
    ...source.map(workout => [`users/client/workouts/${workout.id}`, structuredClone(workout)])]);
  const originalDocuments = structuredClone(docs), writes = [];
  const draft = createProgramDraft(source.map(workout => ({ ...workout, _editorSnapshot: programDraftSnapshot(workout) })), profile);
  draft.completedWorkoutIds = source.map(workout => workout.id);
  const baseline = structuredClone(draft.baseline);
  const newId = createTrainerPlanEditorHandlers({ plan: draft.plan, draftOnly: true, completedWorkoutIds: draft.completedWorkoutIds,
    setPlan: plan => { draft.plan = plan; }, saveWorkoutsToFirebase: async () => true
  }).duplicateTrainerNextWorkoutDay("done-1");
  assert.deepEqual(draft.plan.workouts.slice(0, 2), baseline.workouts);
  assert.deepEqual(draft.baseline, baseline); assert.equal(draft.plan.workouts[2].id, newId);
  assert.deepEqual(docs, originalDocuments, "copy remains draft-only");
  const result = await saveTrainerProgramDraft({ db: {}, userId: "client", authorId: "trainer", draft,
    run: async (_db, execute) => {
      const pending = [];
      const result = await execute({
        get: async path => ({ exists: () => docs.has(path), data: () => structuredClone(docs.get(path)) }),
        set: (path, value, options) => pending.push({ path, value, options }),
        delete: () => assert.fail("Copy must not delete any document")
      });
      for (const write of pending) { writes.push(write); docs.set(write.path, write.options?.merge ? { ...docs.get(write.path), ...structuredClone(write.value) } : structuredClone(write.value)); }
      return result;
    }
  });
  assert.deepEqual(writes.map(write => write.path), [`users/client/workouts/${newId}`, "users/client"]);
  for (const workout of source) assert.deepEqual(docs.get(`users/client/workouts/${workout.id}`), originalDocuments.get(`users/client/workouts/${workout.id}`));
  assert.deepEqual(docs.get("users/client/history/old"), history);
  const saved = docs.get(`users/client/workouts/${newId}`);
  assert.equal(saved.status, "planned"); assert.equal(saved.completed, false); assert.equal(saved.order, 35);
  assert.equal(saved.exercises[0].sets[0].completed, false); assert.equal("completedAt" in saved, false);
  const slot = result.workoutCalendar.plannedWorkouts.find(item => item.workoutId === newId);
  assert.equal(slot.status, "planned"); assert.equal(slot.date, ""); assert.ok(!slot.completedDate);
  assert.equal(result.workoutCalendar.planRevision, 8);
  const reloaded = createProgramDraft(result.plan.workouts, { ...profile, ...result.clientPatch });
  assert.equal(reloaded.plan.workouts.at(-1).status, "planned"); assert.equal(reloaded.plan.workouts.at(-1).completed, false);
});

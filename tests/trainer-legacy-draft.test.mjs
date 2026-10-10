import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { createProgramDraft, isProgramDraftDirty, programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";

const cleanup = installRuntimeImports({
  "firebase/firestore": { doc: (_db, ...path) => path.join("/"), runTransaction() { assert.fail("Explicit local transaction expected"); } },
  "/src/utils/firebaseStorage.js": { uploadStorageFile() { assert.fail("Editing weights must not upload a file"); } },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout() { assert.fail("Editing weights must not call an API"); } }
});
after(cleanup);
const { createTrainerPlanEditorHandlers } = await import("../src/features/trainer/trainerPlanEditorHandlers.js");
const { saveTrainerProgramDraft } = await import("../src/features/client/workouts/trainerProgramDraftPersistence.js");

function fixture() {
  const profile = { assignedProgramId: "current", assignedProgramUpdatedAt: "v1", workoutCalendar: { planRevision: 0 } };
  const source = [
    { id: "done", status: "completed", exercises: [{ name: "Жим", sets: [{ reps: 12, weight: 90 }] }] },
    { id: "next", status: "planned", exercises: [
      { id: "legacy_next_1", name: "Тяга", sets: [{ reps: 10, weight: 30 }] },
      { name: "Жим", sets: [{ reps: 12, weight: 70 }, { reps: 12, weight: 70 }] },
      { name: "Жим", sets: [{ reps: 12, weight: 40 }] }
    ] }
  ];
  const documents = new Map([["users/client", profile], ...source.map(workout => [`users/client/workouts/${workout.id}`, structuredClone(workout)])]);
  const draft = createProgramDraft(source.map(workout => ({ ...workout, _editorSnapshot: programDraftSnapshot(workout) })), profile);
  draft.completedWorkoutIds = ["done"];
  const writes = [];
  const run = async (_db, callback) => callback({
    get: async ref => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
    set: (...args) => writes.push(["set", ...args]), delete: (...args) => writes.push(["delete", ...args])
  });
  const handlers = createTrainerPlanEditorHandlers({
    plan: draft.plan, setPlan: next => { draft.plan = next; }, saveWorkoutsToFirebase: async () => true,
    selectedUserId: "client", auth: {}, draftOnly: true, setAdminClientStatus() {}
  });
  return { source, documents, draft, writes, handlers, save: () => saveTrainerProgramDraft({ db: {}, userId: "client", authorId: "trainer", draft, run }) };
}

test("legacy draft identities are stable and collision-safe without mutating source or dirty state", () => {
  const f = fixture();
  const exercises = f.draft.plan.workouts[1].exercises;
  assert.equal(exercises[0].id, "legacy_next_1");
  assert.equal(new Set(exercises.map(exercise => exercise.id)).size, 3);
  assert.ok(exercises.every(exercise => exercise.id));
  assert.equal(f.source[1].exercises[1].id, undefined);
  assert.equal(isProgramDraftDirty(f.draft), false);
  assert.deepEqual(createProgramDraft(f.source).plan.workouts[1].exercises.map(exercise => exercise.id), exercises.map(exercise => exercise.id));
});

test("actual editor handler saves one legacy set and preserves other sets, rows and completed workouts", async () => {
  const f = fixture();
  f.handlers.updateTrainerNextExerciseSet("next", f.draft.plan.workouts[1].exercises[1].id, 0, { weight: "65" });
  assert.equal(isProgramDraftDirty(f.draft), true);
  const result = await f.save();
  assert.deepEqual(f.writes.map(write => write[1]), ["users/client/workouts/next", "users/client"]);
  const saved = f.writes[0][2];
  assert.equal(saved.exercises[1].sets[0].weight, "65");
  assert.equal(saved.exercises[1].sets[1].weight, 70);
  assert.equal(saved.exercises[2].sets[0].weight, 40);
  assert.deepEqual(f.documents.get("users/client/workouts/done"), f.source[0]);
  assert.equal(f.source[1].exercises[1].sets[0].weight, 70);
  assert.equal(result.plan.workouts[1].exercises[1].id, saved.exercises[1].id);
});

test("normalizing legacy ids keeps raw optimistic-concurrency and completed-workout guards", async () => {
  for (const change of ["concurrent", "completed"]) {
    const f = fixture();
    const target = change === "completed" ? 0 : 1;
    f.handlers.updateTrainerNextExerciseSet(f.draft.plan.workouts[target].id, f.draft.plan.workouts[target].exercises[target].id, 0, { weight: "65" });
    if (change === "concurrent") f.documents.get("users/client/workouts/next").exercises[1].sets[0].weight = 80;
    await assert.rejects(f.save, { code: "program/conflict" });
    assert.deepEqual(f.writes, []);
  }
});

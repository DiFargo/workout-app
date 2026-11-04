import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { normalizeTrainerMonthProgram } from "../src/utils/trainerMonthProgramNormalization.js";
import { buildExecutableWorkout } from "../src/utils/universalWorkoutBlocks.js";
import { createTrainerMonthProgramStructureHandlers } from "../src/features/trainer/trainerMonthProgramStructureHandlers.js";

const noop = () => {};
let upload;
let writes;
let commitError;
const cleanup = installRuntimeImports({
  "firebase/firestore": {
    doc: (_db, ...path) => path.join("/"),
    getDoc: async () => ({ exists: () => false }),
    setDoc: async (...args) => writes.push(args),
    writeBatch: () => {
      const pending = [];
      return {
        set: (...args) => pending.push(args),
        commit: async () => {
          if (commitError) throw commitError;
          writes.push(...pending);
        }
      };
    }
  },
  "/src/utils/firebaseStorage.js": { uploadStorageFile: (...args) => upload(...args) },
  "/src/utils/trainerExerciseCards.js": { refreshTemplateExerciseCards: async (value) => value },
  "/src/features/trainer/trainerAiProgramImport.js": { requestTrainerAiProgramImport: noop },
  "/src/features/trainer/trainerMonthProgramImportHelpers.js": { createTrainerMonthProgramImportHelpers: () => ({}) }
});
after(cleanup);
const { createTrainerMonthProgramPersistenceHandlers } = await import("../src/features/trainer/trainerMonthProgramPersistenceHandlers.js");
const { createTrainerNutritionPlanHandlers } = await import("../src/features/trainer/trainerNutritionPlanHandlers.js");
const { createTrainerMonthExerciseHandlers } = await import("../src/features/trainer/trainerMonthExerciseHandlers.js");
const { createTrainerMonthSelectedExerciseHandlers } = await import("../src/features/trainer/trainerMonthSelectedExerciseHandlers.js");

beforeEach(() => {
  writes = [];
  commitError = null;
  upload = async () => ({ url: "https://example.test/new.mp4" });
});

function programFixture() {
  return {
    id: "program", name: "Original", ownerUid: "trainer", months: [{ id: "month", name: "Month" }],
    blocks: [{ id: "cycle", monthId: "month", name: "Cycle", weeks: [{ id: "week", name: "Week", workouts: [{
      id: "day", name: "Grouped day",
      exercises: ["a", "b", "c"].map((id) => ({ id, name: id, video: "old.mp4", sets: [{ id: `set-${id}`, reps: 8, weight: 20 }] })),
      taskBlocks: [
        { id: "group", type: "group", groupMode: "triset", rounds: 4, restAfterRound: "60 сек", exerciseIds: ["a", "b", "c"] },
        { id: "interval", type: "interval", rounds: 8, workTime: "30 сек", restTime: "10 сек", exerciseIds: [] }
      ]
    }] }] }]
  };
}

test("month editor factories resolve snapshot refs only during events and keep the legacy ref API", async () => {
  let currentRef = { current: { isNew: true } };
  let eventPhase = false;
  let refReads = 0;
  const getAdminExerciseEditSnapshotRef = () => {
    assert.equal(eventPhase, true, "factory construction must not read snapshot refs during render");
    refReads += 1;
    return currentRef;
  };
  const exercise = { id: "a", name: "Press", sets: [{ reps: 8 }] };
  const updates = [];
  const exerciseHandlers = createTrainerMonthExerciseHandlers({
    getAdminExerciseEditSnapshotRef, monthWorkouts: [{ id: "day", exercises: [exercise] }],
    updateMonthWorkout: (...args) => updates.push(args), setAdminSelectedExerciseId: noop,
    setAdminExerciseSearch: noop, saveMonthProgramToLibrary: async () => true
  });
  const selectedHandlers = createTrainerMonthSelectedExerciseHandlers({
    getAdminExerciseEditSnapshotRef, adminSelectedExerciseId: "a",
    openMonthWorkoutContext: { block: { id: "cycle" }, week: { id: "week" }, workout: { id: "day", exercises: [exercise] } },
    showAppConfirm: async () => true, removeMonthExercise: noop, setAdminSelectedExerciseId: noop
  });
  const persistenceHandlers = createTrainerMonthProgramPersistenceHandlers({
    getAdminExerciseEditSnapshotRef, adminExerciseLibrary: [], adminTrainingTemplates: [programFixture()],
    normalizeMonthProgram: normalizeTrainerMonthProgram, canManageTrainingTemplate: () => true,
    setAdminProgramEditorMode: noop, setAdminSelectedTemplateId: noop, setAdminActiveProgramId: noop,
    setAdminOpenWorkoutId: noop, setAdminSelectedExerciseId: noop, setAdminExerciseSearch: noop,
    setAdminOpenProgramBlocks: noop, setAdminOpenProgramWeeks: noop, setAdminProgramGroups: noop, setPlan: noop
  });
  assert.equal(refReads, 0);
  eventPhase = true;
  exerciseHandlers.openMonthExerciseEditor("cycle", "week", "day", exercise);
  assert.equal(currentRef.current.exerciseId, "a");
  currentRef = { current: { isNew: false, blockId: "cycle", weekId: "week", workoutId: "day", exerciseId: "a", exercise } };
  exerciseHandlers.cancelMonthExerciseEdit();
  assert.equal(updates.length, 1);
  assert.equal(currentRef.current, null);
  currentRef.current = { isNew: true };
  await selectedHandlers.deleteSelectedMonthExercise();
  assert.equal(currentRef.current, null);
  currentRef.current = { isNew: true };
  persistenceHandlers.editExistingMonthProgram("program");
  assert.equal(currentRef.current, null);
  const legacyRef = { current: null };
  const legacy = createTrainerMonthExerciseHandlers({ adminExerciseEditSnapshotRef: legacyRef, setAdminSelectedExerciseId: noop });
  legacy.openMonthExerciseEditor("cycle", "week", "day", exercise);
  assert.equal(legacyRef.current.exerciseId, "a");
});

for (const mode of ["workout", "microcycle"]) test(`${mode} copy remaps grouped exercise links and preserves executable prescription`, () => {
  let program = programFixture();
  const original = structuredClone(program);
  const handlers = createTrainerMonthProgramStructureHandlers({
    monthWorkouts: program.blocks[0].weeks[0].workouts,
    setMonthProgram: (update) => { program = update(program); },
    setAdminOpenWorkoutId: noop, setAdminSelectedExerciseId: noop, setAdminProgramCopyTarget: noop
  });
  if (mode === "workout") handlers.duplicateMonthWorkout("cycle", "week", "day");
  else handlers.copyMonthProgramBlock("cycle", "month", "cycle");
  const normalized = normalizeTrainerMonthProgram(program);
  const copied = mode === "workout" ? normalized.blocks[0].weeks[0].workouts[1] : normalized.blocks[1].weeks[0].workouts[0];
  const group = copied.taskBlocks.find((block) => block.type === "group");
  assert.deepEqual(group.exerciseIds, copied.exercises.map((exercise) => exercise.id));
  assert.ok(group.exerciseIds.every((id) => !["a", "b", "c"].includes(id)));
  assert.notEqual(group.id, "group");
  const executable = buildExecutableWorkout(copied);
  assert.deepEqual(executable.exercises.slice(0, 3).map((exercise) => exercise.taskBlockType), ["group", "group", "group"]);
  assert.ok(executable.exercises.slice(0, 3).every((exercise) => exercise.taskBlockConfig.rounds === 4 && exercise.taskBlockConfig.restAfterRound === "60 сек"));
  assert.equal(executable.exercises[3].taskBlockType, "interval");
  assert.equal(executable.exercises[3].taskBlockConfig.rounds, 8);
  assert.deepEqual(program.blocks[0].weeks[0].workouts[0], original.blocks[0].weeks[0].workouts[0]);
});

function videoEditor() {
  let program = programFixture();
  const handlers = createTrainerMonthProgramPersistenceHandlers({
    db: {}, monthProgram: program, adminTrainingTemplates: [structuredClone(program)], adminExerciseLibrary: [],
    getCurrentProgramOwner: () => ({ uid: "trainer" }), canManageTrainingTemplate: () => true,
    canUseAdminFeatures: () => false, normalizeMonthProgram: normalizeTrainerMonthProgram,
    setMonthProgram: (update) => { program = typeof update === "function" ? update(program) : update; },
    setAdminExerciseVideoUploadingId: noop, showAppError: noop,
    setAdminTemplateName: noop, setAdminSelectedTemplateId: noop, loadAdminTrainingTemplates: noop, user: {}
  });
  return { handlers, get program() { return program; }, set program(value) { program = value; } };
}

test("upload only changes the latest draft and never saves unrelated edits", async () => {
  let finishUpload;
  upload = () => new Promise((resolve) => { finishUpload = resolve; });
  const editor = videoEditor();
  const pending = editor.handlers.uploadMonthExerciseVideo("cycle", "week", "day", "a", { name: "new.mp4" });
  editor.program = structuredClone(editor.program);
  editor.program.name = "Unsaved concurrent name";
  editor.program.blocks[0].weeks[0].workouts[0].exercises[1].sets[0].weight = 55;
  finishUpload({ url: "https://example.test/new.mp4" });
  await pending;
  assert.equal(writes.length, 0);
  assert.equal(editor.program.name, "Unsaved concurrent name");
  assert.equal(editor.program.blocks[0].weeks[0].workouts[0].exercises[1].sets[0].weight, 55);
  assert.equal(editor.program.blocks[0].weeks[0].workouts[0].exercises[0].video, "https://example.test/new.mp4");
});

test("late upload cannot modify another program or resurrect a removed exercise", async () => {
  for (const change of ["switch", "delete"]) {
    let finishUpload;
    upload = () => new Promise((resolve) => { finishUpload = resolve; });
    const editor = videoEditor();
    const pending = editor.handlers.uploadMonthExerciseVideo("cycle", "week", "day", "a", { name: "new.mp4" });
    editor.program = structuredClone(editor.program);
    if (change === "switch") editor.program.id = "another-program";
    else editor.program.blocks[0].weeks[0].workouts[0].exercises.shift();
    finishUpload({ url: "https://example.test/new.mp4" });
    await pending;
    assert.equal(writes.length, 0);
    assert.ok(editor.program.blocks[0].weeks[0].workouts[0].exercises.every((exercise) => exercise.video === "old.mp4"));
    if (change === "delete") assert.equal(editor.program.blocks[0].weeks[0].workouts[0].exercises.length, 2);
  }
});

test("upload from a discarded editor cannot apply to a reopened session of the same program", async () => {
  let finishUpload;
  let currentSession = true;
  upload = () => new Promise((resolve) => { finishUpload = resolve; });
  const editor = videoEditor();
  const pending = editor.handlers.uploadMonthExerciseVideo("cycle", "week", "day", "a", { name: "new.mp4" }, { isCurrent: () => currentSession });
  currentSession = false;
  editor.program = programFixture();
  const reopened = structuredClone(editor.program);
  finishUpload({ url: "https://example.test/new.mp4" });
  assert.equal(await pending, false);
  assert.deepEqual(editor.program, reopened);
  assert.equal(writes.length, 0);
});

test("AI nutrition profile and state save atomically with matching plan payloads", async (t) => {
  t.mock.method(console, "error", noop);
  const updates = [];
  const handlers = createTrainerNutritionPlanHandlers({
    db: {}, auth: { currentUser: { uid: "trainer" } }, adminSelectedClient: { id: "client" }, usersList: [],
    adminClientNutrition: {}, setAdminClientStatus: noop, setAdminSelectedClient: (value) => updates.push(value),
    setUsersList: noop, setAdminClientNutrition: noop, setNutrition: noop, mirrorClientForTrainer: async () => {}, recordTrainerEvent: async () => {}
  });
  const draft = { calories: 2200, protein: 160, fat: 70, carbs: 230, aiNutritionPlan: { id: "ai", weeks: [{ calories: 2200 }] } };
  commitError = new Error("permission-denied");
  assert.equal(await handlers.saveTrainerClientNutritionPlan(draft), false);
  assert.equal(writes.length, 0);
  assert.equal(updates.length, 0);
  commitError = null;
  assert.equal(await handlers.saveTrainerClientNutritionPlan(draft), true);
  assert.deepEqual(writes.map(([path]) => path), ["users/client", "users/client/nutrition/state"]);
  assert.deepEqual(writes[0][1].aiNutritionPlan, draft.aiNutritionPlan);
  assert.deepEqual(writes[1][1].aiNutritionPlan, draft.aiNutritionPlan);
  assert.deepEqual(writes[0][1].nutritionGoals, writes[1][1].goals);
});

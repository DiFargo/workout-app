import test from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import {
  compactStoredWorkoutPlans,
  createPersistableWorkoutPlan
} from "../src/utils/workoutPlanStorage.js";
import { programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";

function makeStorage(entries = [], quotaBytes = Infinity) {
  const values = new Map(entries);
  const writes = [];
  const removals = [];
  const usedBytes = () => [...values].reduce((total, [key, value]) => total + 2 * (key.length + value.length), 0);
  return {
    values,
    writes,
    removals,
    get usedBytes() { return usedBytes(); },
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      const previousBytes = values.has(key) ? 2 * (key.length + values.get(key).length) : 0;
      if (usedBytes() - previousBytes + 2 * (key.length + value.length) > quotaBytes) {
        throw Object.assign(new Error("Quota exceeded"), { name: "QuotaExceededError" });
      }
      writes.push([key, value]);
      values.set(key, value);
    },
    removeItem(key) { removals.push(key); values.delete(key); }
  };
}

function makePlan() {
  return {
    name: "Тестовая программа",
    assignedProgramUpdatedAt: "assignment-1",
    customUserField: "keep",
    workouts: [{
      id: "day-1",
      name: "День 1",
      taskBlocks: [{ id: "group-1", type: "superset", exerciseIds: ["exercise-1"] }],
      exercises: [{
        id: "exercise-1",
        exerciseCardId: "card-1",
        exerciseCardOwnerUid: "trainer-test",
        name: "Тестовое упражнение",
        video: "protected-video-id",
        videoPoster: "protected-poster-id",
        videoCrop: { x: 0.4, y: 0.5, scale: 1.2 },
        note: "Сохранить заметку",
        readModel: { userDefinedNestedValue: "keep" },
        sets: [{ completed: true, enteredWeight: "35", enteredReps: "12", weight: 30, reps: 12 }]
      }]
    }],
    readModel: { completionHistory: [{ id: "history-1", repeatedData: "x".repeat(2000) }] }
  };
}

function withoutReadModel(plan) {
  const result = { ...plan };
  delete result.readModel;
  return result;
}

function withoutSecondaryMetadata(plan) {
  return {
    ...withoutReadModel(plan),
    workouts: plan.workouts.map(workout => {
      const saved = { ...workout };
      delete saved._editorSnapshot;
      return saved;
    })
  };
}

function makeLegacySnapshotPlan() {
  const plan = withoutReadModel(makePlan());
  const base = plan.workouts[0];
  plan.workouts = Array.from({ length: 16 }, (_, day) => {
    const exercises = Array.from({ length: 6 }, (_, index) => ({
      ...structuredClone(base.exercises[0]),
      id: `day-${day}-exercise-${index}`,
      name: `Упражнение ${index + 1}`,
      clientNote: "Контролировать амплитуду, сохранить рабочий вес и технику",
      sets: Array.from({ length: 4 }, (_, set) => ({
        id: `set-${set}`, weight: 30 + index * 5, reps: 12 - set,
        completed: set === 0, enteredWeight: set === 0 ? "35" : "", enteredReps: set === 0 ? "12" : ""
      }))
    }));
    const workout = {
      ...base, id: `day-${day}`, name: `Тренировка ${day + 1}`,
      scheduledDate: `2026-11-${String(day + 1).padStart(2, "0")}`,
      exercises,
      taskBlocks: [{ id: `group-${day}`, type: "superset", exerciseIds: exercises.slice(0, 2).map(exercise => exercise.id) }]
    };
    return { ...workout, _editorSnapshot: programDraftSnapshot(workout) };
  });
  return plan;
}

test("persisted plans omit only the reproducible top-level read model without mutating live data", () => {
  const plan = makePlan();
  const before = structuredClone(plan);
  const persisted = createPersistableWorkoutPlan(plan);
  assert.deepEqual(persisted, withoutReadModel(plan));
  assert.deepEqual(plan, before);
  assert.equal(persisted.workouts, plan.workouts);
  assert.equal(persisted.workouts[0].exercises[0].readModel.userDefinedNestedValue, "keep");
  assert.equal(createPersistableWorkoutPlan(persisted), persisted);
});

test("secondary snapshots omit workout editor copies even without a read model and retain unchanged references", () => {
  const plan = withoutReadModel(makePlan());
  const workout = plan.workouts[0];
  workout._editorSnapshot = programDraftSnapshot(workout);
  workout._editorExpanded = true;
  workout.exercises[0]._editorSnapshot = "nested value is not a workout snapshot";
  const unchangedWorkout = { id: "day-2", exercises: [] };
  plan.workouts.push(unchangedWorkout);
  const before = structuredClone(plan);

  const persisted = createPersistableWorkoutPlan(plan);

  assert.deepEqual(persisted, withoutSecondaryMetadata(plan));
  assert.deepEqual(plan, before);
  assert.notEqual(persisted.workouts, plan.workouts);
  assert.notEqual(persisted.workouts[0], workout);
  assert.equal(persisted.workouts[0].exercises, workout.exercises);
  assert.equal(persisted.workouts[0].taskBlocks, workout.taskBlocks);
  assert.equal(persisted.workouts[1], unchangedWorkout);
  assert.equal(createPersistableWorkoutPlan(persisted), persisted);
});

test("a circular read model cannot prevent serializing the actual workout draft data", () => {
  const plan = makePlan();
  plan.readModel.self = plan.readModel;
  const serialized = JSON.stringify(createPersistableWorkoutPlan(plan));
  const stored = JSON.parse(serialized);
  assert.equal(stored.workouts[0].exercises[0].sets[0].enteredWeight, "35");
  assert.equal(Object.hasOwn(stored, "readModel"), false);
  assert.equal(plan.readModel.self, plan.readModel);
});

test("compaction preserves the offline primary plan and every own backup, draft field, set, group, note and media reference", () => {
  const uid = "client-test";
  const plan = makePlan();
  const backups = Array.from({ length: 14 }, (_, index) => ({
    id: `backup-${index}`,
    savedAt: `2026-10-${String(index + 1).padStart(2, "0")}`,
    custom: index,
    plan: structuredClone(plan)
  }));
  const draft = {
    version: 2, uid, workoutId: "day-1", currentExerciseIndex: 3,
    workoutStartedAt: 1000, workoutFinishedAt: null,
    assignmentVersion: "assignment-1", selectedReadiness: "ready",
    warmupCompletedSteps: [0, 1], warmupTimerDuration: 300, warmupTimerSeconds: 120,
    restTimerDuration: 90, restTimerSeconds: 42,
    workoutClientComment: "Сохранить комментарий", plan
  };
  const offlinePrimaryRaw = JSON.stringify(plan, null, 2);
  const storage = makeStorage([
    [`workout_tracker_v1:${uid}`, offlinePrimaryRaw],
    [`workout_plan_backup_v1:${uid}`, JSON.stringify(backups)],
    [`workout_active_draft_v1:${uid}:day-1`, JSON.stringify(draft)]
  ]);
  const previousSizes = new Map([...storage.values].map(([key, value]) => [key, value.length]));

  compactStoredWorkoutPlans(uid, { storage });

  assert.equal(storage.getItem(`workout_tracker_v1:${uid}`), offlinePrimaryRaw);
  assert.equal(storage.writes.some(([key]) => key === `workout_tracker_v1:${uid}`), false);
  assert.deepEqual(JSON.parse(storage.getItem(`workout_plan_backup_v1:${uid}`)), backups.map(row => ({
    ...row, plan: withoutReadModel(row.plan)
  })));
  assert.deepEqual(JSON.parse(storage.getItem(`workout_active_draft_v1:${uid}:day-1`)), {
    ...draft, plan: withoutReadModel(plan)
  });
  assert.equal(storage.values.size, 3);
  assert.deepEqual(storage.removals, []);
  assert.ok(storage.writes.length > 0);
  for (const [key, value] of storage.writes) assert.ok(value.length < previousSizes.get(key));

  const firstWrites = storage.writes.length;
  compactStoredWorkoutPlans(uid, { storage });
  assert.equal(storage.writes.length, firstWrites);
});

for (const source of ["backups", "legacy drafts"]) {
  test(`aggregate storage quota is recovered from ${source} without losing any saved entry`, () => {
    const uid = "quota-client";
    const plan = makeLegacySnapshotPlan();
    const compactPlan = withoutSecondaryMetadata(plan);
    const backups = Array.from({ length: 14 }, (_, index) => ({
      id: `backup-${index}`, savedAt: `2026-10-${String(index + 1).padStart(2, "0")}`,
      custom: { keep: index }, plan: source === "backups" ? plan : compactPlan
    }));
    const drafts = [0, 1].map(day => ({
      version: 2, uid, workoutId: `day-${day}`, assignmentVersion: "assignment-1",
      currentExerciseIndex: 2, workoutStartedAt: 1000 + day, restTimerSeconds: 42,
      workoutClientComment: `Сохранить незавершённую тренировку ${day}`,
      plan: source === "legacy drafts" ? plan : compactPlan
    }));
    const backupKey = `workout_plan_backup_v1:${uid}`;
    const protectedEntries = [
      [`workout_tracker_v1:${uid}`, JSON.stringify(plan, null, 2)],
      [`workout_pending_sync_v1:${uid}`, JSON.stringify([{ id: "pending-1", plan }])],
      [`workout_failed_sync_v1:${uid}`, JSON.stringify([{ id: "failed-1", plan }])],
      ["workout_plan_backup_v1:other-client", JSON.stringify([{ id: "other-backup", plan }])],
      [`nutrition_tracker_v1:${uid}`, JSON.stringify({ days: [{ date: "2026-10-30", foods: [{ name: "Овсянка", grams: 70 }] }] })]
    ];
    const entries = [
      [backupKey, JSON.stringify(backups)],
      ...drafts.map(draft => [`workout_active_draft_v1:${uid}:${draft.workoutId}`, JSON.stringify(draft)]),
      ...protectedEntries
    ];
    const initialBytes = makeStorage(entries).usedBytes;
    const quotaBytes = initialBytes + 256;
    const storage = makeStorage(entries, quotaBytes);
    const nextKey = `workout_active_draft_v1:${uid}:day-2`;
    const nextDraft = {
      ...drafts[0], workoutId: "day-2", workoutClientComment: "Новая тренировка с введёнными подходами",
      plan: { ...compactPlan, workouts: [compactPlan.workouts[2]] }
    };
    const nextRaw = JSON.stringify(nextDraft);
    // Each value fits individually; only the aggregate origin usage is full.
    assert.ok(entries.every(([key, value]) => 2 * (key.length + value.length) < quotaBytes));
    assert.ok(2 * (nextKey.length + nextRaw.length) < quotaBytes);
    assert.throws(() => storage.setItem(nextKey, nextRaw), { name: "QuotaExceededError" });
    assert.deepEqual([...storage.values], entries);

    compactStoredWorkoutPlans(uid, { storage });

    assert.ok(initialBytes - storage.usedBytes > 2 * (nextKey.length + nextRaw.length));
    assert.doesNotThrow(() => storage.setItem(nextKey, nextRaw));
    assert.deepEqual(JSON.parse(storage.getItem(nextKey)), nextDraft);
    assert.deepEqual(JSON.parse(storage.getItem(backupKey)), backups.map(backup => ({ ...backup, plan: compactPlan })));
    for (const draft of drafts) {
      assert.deepEqual(JSON.parse(storage.getItem(`workout_active_draft_v1:${uid}:${draft.workoutId}`)), {
        ...draft, plan: compactPlan
      });
    }
    for (const [key, value] of protectedEntries) assert.equal(storage.getItem(key), value);
    assert.equal(storage.values.size, entries.length + 1);
    assert.deepEqual(storage.removals, []);
  });
}

test("compaction cannot touch other accounts, unowned drafts, pending queues or unknown keys", () => {
  const plan = makePlan();
  const protectedEntries = [
    ["workout_tracker_v1:other", JSON.stringify(plan)],
    ["workout_plan_backup_v1:other", JSON.stringify([{ id: "other-backup", plan }])],
    ["workout_active_draft_v1:other:day-1", JSON.stringify({ uid: "other", plan })],
    ["workout_active_draft_v1:client-test:other:day-1", JSON.stringify({ uid: "client-test:other", plan })],
    ["workout_active_draft_v1:client-test:unowned", JSON.stringify({ plan })],
    ["workout_active_draft_v1:client-test:mismatch", JSON.stringify({ uid: "other", plan })],
    ["workout_pending_sync_v1:client-test", JSON.stringify([{ uid: "client-test", plan }])],
    ["workout_failed_sync_v1:client-test", JSON.stringify([{ uid: "client-test", plan }])],
    ["unknown:client-test", JSON.stringify(plan)]
  ];
  const storage = makeStorage(protectedEntries);
  compactStoredWorkoutPlans("client-test", { storage });
  assert.deepEqual([...storage.values], protectedEntries);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(storage.removals, []);
});

test("custom backup keys are compacted while primary plans, malformed and unrelated snapshots survive", () => {
  const plan = makePlan();
  const backups = [{ id: "valid", plan }, null, { id: "metadata-only", note: "keep" }];
  const storage = makeStorage([
    ["custom_plan:client-test", JSON.stringify(plan)],
    ["custom_backup:client-test", JSON.stringify(backups)],
    ["workout_active_draft_v1:client-test:bad-json", "{not-json"],
    ["workout_active_draft_v1:client-test:array", "[]"],
    ["workout_tracker_v1:client-test", "not-json"]
  ]);
  compactStoredWorkoutPlans("client-test", {
    storage, workoutPlanBackupStorageKey: "custom_backup"
  });
  assert.equal(storage.getItem("custom_plan:client-test"), JSON.stringify(plan));
  assert.deepEqual(JSON.parse(storage.getItem("custom_backup:client-test")), [
    { id: "valid", plan: withoutReadModel(plan) }, null, { id: "metadata-only", note: "keep" }
  ]);
  assert.equal(storage.getItem("workout_active_draft_v1:client-test:bad-json"), "{not-json");
  assert.equal(storage.getItem("workout_active_draft_v1:client-test:array"), "[]");
  assert.equal(storage.getItem("workout_tracker_v1:client-test"), "not-json");
  compactStoredWorkoutPlans("client-test", { storage });
  assert.equal(storage.getItem("workout_tracker_v1:client-test"), "not-json");
  assert.deepEqual(storage.removals, []);
});

test("already compact plans and backup arrays are not rewritten or shortened", () => {
  const plan = withoutReadModel(makePlan());
  const entries = [
    ["workout_tracker_v1:client-test", JSON.stringify(plan, null, 2)],
    ["workout_plan_backup_v1:client-test", JSON.stringify([{ id: "keep", plan }], null, 2)],
    ["workout_active_draft_v1:client-test:day-1", JSON.stringify({ uid: "client-test", plan }, null, 2)]
  ];
  const storage = makeStorage(entries);
  compactStoredWorkoutPlans("client-test", { storage });
  assert.deepEqual([...storage.values], entries);
  assert.deepEqual(storage.writes, []);
});

test("a denied storage read or enumeration does not throw or delete saved user data", () => {
  const error = Object.assign(new Error("Storage denied"), { name: "SecurityError" });
  const storage = makeStorage([["workout_tracker_v1:client-test", JSON.stringify(makePlan())]]);
  const before = [...storage.values];
  storage.getItem = () => { throw error; };
  Object.defineProperty(storage, "length", { get() { throw error; } });
  assert.doesNotThrow(() => compactStoredWorkoutPlans("client-test", { storage }));
  assert.deepEqual([...storage.values], before);
  assert.deepEqual(storage.removals, []);
});

test("quota failure during compaction retains the last good values instead of clearing backups", () => {
  const plan = makePlan();
  const entries = [
    ["workout_tracker_v1:client-test", JSON.stringify(plan)],
    ["workout_plan_backup_v1:client-test", JSON.stringify([{ id: "safe-backup", plan }])],
    ["workout_active_draft_v1:client-test:day-1", JSON.stringify({ uid: "client-test", plan })]
  ];
  const storage = makeStorage(entries);
  storage.setItem = () => { throw Object.assign(new Error("Quota exceeded"), { name: "QuotaExceededError" }); };
  assert.doesNotThrow(() => compactStoredWorkoutPlans("client-test", { storage }));
  assert.deepEqual([...storage.values], entries);
  assert.deepEqual(storage.removals, []);
});

test("no account identity means no compaction of global or user keys", () => {
  const entries = [["workout_tracker_v1", JSON.stringify(makePlan())]];
  const storage = makeStorage(entries);
  compactStoredWorkoutPlans("", { storage });
  assert.deepEqual([...storage.values], entries);
  assert.deepEqual(storage.writes, []);
});

test("the actual app persistence effect keeps the complete offline primary but compacts backups and own drafts", async () => {
  const effects = [];
  const uid = "integration-client";
  const plan = makePlan();
  plan.workouts[0]._editorSnapshot = programDraftSnapshot(plan.workouts[0]);
  const before = structuredClone(plan);
  const oldPlan = { ...makePlan(), name: "Предыдущий план" };
  oldPlan.workouts[0]._editorSnapshot = programDraftSnapshot(oldPlan.workouts[0]);
  const ownDraft = { uid, workoutId: "day-1", restTimerSeconds: 27, plan: oldPlan };
  const protectedEntries = [
    ["workout_tracker_v1:other-client", JSON.stringify(oldPlan, null, 2)],
    ["workout_plan_backup_v1:other-client", JSON.stringify([{ id: "other-backup", plan: oldPlan }])],
    ["workout_active_draft_v1:other-client:day-1", JSON.stringify({ uid: "other-client", plan: oldPlan })]
  ];
  const storage = makeStorage([
    [`workout_tracker_v1:${uid}`, JSON.stringify(oldPlan)],
    [`workout_plan_backup_v1:${uid}`, JSON.stringify([
      { id: "old-1", savedAt: "2026-10-01", plan: oldPlan },
      { id: "old-2", savedAt: "2026-10-02", plan: oldPlan }
    ])],
    [`workout_active_draft_v1:${uid}:day-1`, JSON.stringify(ownDraft)],
    ...protectedEntries
  ]);
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const cleanup = installRuntimeImports({
    react: {
      useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),
      useEffectEvent: callback => callback
    },
    "/firebase.js": { auth: { currentUser: null }, db: {} },
    "firebase/firestore": {
      doc: () => assert.fail("unrelated Firebase effect must not run"),
      setDoc: () => assert.fail("unrelated Firebase effect must not run"),
      onSnapshot: () => assert.fail("unrelated Firebase effect must not run")
    }
  });
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const { useAppRuntimeEffects } = await import("../src/app/useAppRuntimeEffects.js");
    useAppRuntimeEffects({
      APP_PAGES: { ADMIN: "admin" },
      auth: { currentUser: { uid } }, user: { uid }, plan,
      workoutStorageKey: "workout_tracker_v1",
      workoutPlanBackupStorageKey: "workout_plan_backup_v1"
    });
    const persistence = effects.filter(({ dependencies }) => dependencies.includes(plan));
    assert.equal(persistence.length, 1);
    persistence[0].effect();

    const primary = JSON.parse(storage.getItem(`workout_tracker_v1:${uid}`));
    assert.deepEqual(primary, plan);
    assert.deepEqual(primary.readModel, plan.readModel);
    const backups = JSON.parse(storage.getItem(`workout_plan_backup_v1:${uid}`));
    assert.equal(backups.length, 3);
    for (const backup of backups) {
      assert.equal(Object.hasOwn(backup.plan, "readModel"), false);
      assert.equal(Object.hasOwn(backup.plan.workouts[0], "_editorSnapshot"), false);
    }
    assert.deepEqual(backups[0].plan, withoutSecondaryMetadata(plan));
    assert.deepEqual(backups.slice(1), [
      { id: "old-1", savedAt: "2026-10-01", plan: withoutSecondaryMetadata(oldPlan) },
      { id: "old-2", savedAt: "2026-10-02", plan: withoutSecondaryMetadata(oldPlan) }
    ]);
    assert.deepEqual(JSON.parse(storage.getItem(`workout_active_draft_v1:${uid}:day-1`)), {
      ...ownDraft, plan: withoutSecondaryMetadata(oldPlan)
    });
    for (const [key, value] of protectedEntries) assert.equal(storage.getItem(key), value);
    assert.deepEqual(plan, before);
    assert.deepEqual(storage.removals, []);
  } finally {
    cleanup();
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  }
});

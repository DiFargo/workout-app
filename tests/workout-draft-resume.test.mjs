import test, { after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { applyExerciseCard, exerciseCardMetadata } from "../functions/exerciseCards.js";

const auth = { currentUser: { uid: "draft-user" } };
const cleanup = installRuntimeImports({
  "firebase/firestore": { doc: () => ({}), writeBatch: () => ({}) },
  "/src/firebase.js": { auth }
});
after(cleanup);
const { createWorkoutOpenHandlers } = await import("../src/features/client/workouts/workoutOpenHandlers.js");
const { createWorkoutDraftPlan, restoreWorkoutDraftPlan } = await import("../src/utils/workoutDraftState.js");

const workout = { id: "day-2", assignedProgramUpdatedAt: "assignment-1", exercises: [{
  id: "exercise-1", clientNote: "Проверить технику", sets: [
    { reps: 12, weight: 30, enteredWeight: "35", enteredReps: "12", completed: true },
    { reps: 12, weight: 30, completed: false }
  ]
}] };
const startedAt = Date.parse("2026-10-24T08:00:00.000Z");
const draft = {
  workoutId: workout.id, assignmentVersion: "assignment-1",
  plan: createWorkoutDraftPlan({ workouts: [workout] }, workout.id),
  currentExerciseIndex: 1, workoutStartedAt: startedAt,
  selectedReadiness: { id: "good" }, warmupCompletedSteps: [0, 1],
  restTimerDuration: 90, restTimerSeconds: 36, workoutClientComment: "Комментарий"
};

function setup(plan, workoutDraftRestorePrompt = null) {
  const state = {};
  const setters = Object.fromEntries([
    "Plan", "SelectedWorkoutId", "OpenVideoId", "FullscreenVideo", "CurrentExerciseIndex",
    "WorkoutStarted", "WorkoutStartedAt", "WorkoutFinishedAt", "WorkoutReadiness",
    "WorkoutReadinessPending", "WarmupCompletedSteps", "WarmupTimerDuration", "WarmupTimerSeconds",
    "WarmupTimerRunning", "RestTimerDuration", "RestTimerSeconds", "RestTimerRunning",
    "ExerciseHistoryOpenId", "WorkoutHistorySyncState", "WorkoutExitPromptOpen",
    "PostWorkoutFeedback", "PostWorkoutFeedbackOpen", "WorkoutReadinessOpen", "IsWorkoutSaved",
    "WorkoutClientComment", "ShowWorkoutSavedCard", "WorkoutDraftRestorePrompt", "Page"
  ].map(name => [`set${name}`, value => { state[name] = value; }]));
  return { state, handlers: createWorkoutOpenHandlers({
    ...setters, auth, plan, history: [], workoutDraftRestorePrompt,
    APP_PAGES: { HISTORY: "history" }, loadHistory() {}
  }) };
}

test("a new app session opens Continue and restores entries, exercise, note and elapsed start", async () => {
  const storage = new Map([[`workout_active_draft_v1:draft-user:${workout.id}`, JSON.stringify(draft)]]);
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key) };
  try {
    const other = { id: "other", name: "Актуальная следующая тренировка", exercises: [] };
    const freshPlan = { workouts: [{ ...workout, exercises: [{ id: "exercise-1", sets: [{ reps: 12, weight: 30 }] }] }, other] };
    const coldSession = setup(freshPlan);
    await coldSession.handlers.openWorkout(workout.id);
    assert.equal(coldSession.state.WorkoutReadinessOpen, undefined);
    const prompt = coldSession.state.WorkoutDraftRestorePrompt;
    assert.equal(prompt.workoutId, workout.id);
    const resumed = setup(freshPlan, prompt);
    await resumed.handlers.handleWorkoutDraftChoice(true);
    assert.equal(resumed.state.WorkoutStarted, true);
    assert.equal(resumed.state.CurrentExerciseIndex, 1);
    assert.equal(resumed.state.WorkoutStartedAt, startedAt);
    assert.equal(resumed.state.WorkoutReadinessOpen, false);
    assert.equal(resumed.state.RestTimerSeconds, 36);
    assert.equal(resumed.state.Plan.workouts[0].exercises[0].sets[0].enteredWeight, "35");
    assert.equal(resumed.state.Plan.workouts[0].exercises[0].sets[0].completed, true);
    assert.equal(resumed.state.Plan.workouts[0].exercises[0].clientNote, "Проверить технику");
    assert.equal(resumed.state.Plan.workouts[1], other);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("confirming an old prompt cannot restore entries into a reassigned program", async () => {
  const nextWorkout = { ...workout, assignedProgramUpdatedAt: "assignment-2", exercises: [] };
  const { state, handlers } = setup({ workouts: [nextWorkout] }, { workoutId: workout.id, savedDraft: draft });
  await handlers.handleWorkoutDraftChoice(true);
  assert.equal(state.WorkoutDraftRestorePrompt, null);
  assert.equal(state.Plan, undefined);
  assert.equal(state.WorkoutStarted, undefined);
});

test("resuming a legacy draft fills a missing frame from the same canonical clip without changing completed entries or notes", () => {
  const source = "gs://synthetic.test/exercise-videos/demo.mp4";
  const savedExercise = { ...workout.exercises[0], video: source, exerciseCardId: "card", exerciseCardOwnerUid: "trainer" };
  const oldDraft = { ...draft, plan: { workouts: [{ ...workout, exercises: [savedExercise] }] } };
  const freshExercise = { ...savedExercise, video: "https://firebasestorage.googleapis.com/v0/b/synthetic.test/o/exercise-videos%2Fdemo.mp4?alt=media&token=synthetic",
    videoPosterTime: 2.1, sets: [{ reps: 8, weight: 10 }], clientNote: "Не заменять заметку" };
  const resumed = restoreWorkoutDraftPlan({ workouts: [{ ...workout, exercises: [freshExercise] }] }, oldDraft).workouts[0].exercises[0];
  assert.equal(resumed.videoPosterTime, 2.1);
  assert.equal(resumed.video, source);
  assert.equal(resumed.sets, savedExercise.sets);
  assert.equal(resumed.sets[0].completed, true);
  assert.equal(resumed.sets[0].enteredWeight, "35");
  assert.equal(resumed.clientNote, "Проверить технику");
});

test("resuming preserves a draft's selected frame and does not borrow frames from another source or card", () => {
  const source = "gs://synthetic.test/exercise-videos/demo.mp4";
  const baseExercise = { ...workout.exercises[0], video: source, exerciseCardId: "card", exerciseCardOwnerUid: "trainer" };
  const fresh = { ...baseExercise, videoPosterTime: 8 };
  for (const patch of [{ videoPosterTime: 0 }, { videoPosterTime: 3.4 }, { video: "local.mp4" }, { id: "different" },
    { exerciseCardId: "different" }, { exerciseCardOverrides: { video: true } }]) {
    const saved = { ...baseExercise, ...patch };
    const oldDraft = { ...draft, plan: { workouts: [{ ...workout, exercises: [saved] }] } };
    const restored = restoreWorkoutDraftPlan({ workouts: [{ ...workout, exercises: [fresh] }] }, oldDraft).workouts[0].exercises[0];
    assert.equal(restored, saved);
  }
});

test("an inherited draft preview keeps its same-card baseline aligned for a later trainer frame update", () => {
  const source = "gs://synthetic.test/exercise-videos/demo.mp4";
  const card = { id: "card", ownerUid: "trainer", name: "Тяга", video: source, videoPosterTime: 2.1 };
  const saved = { ...workout.exercises[0], name: card.name, video: source, videoPosterTime: null,
    exerciseCardId: card.id, exerciseCardOwnerUid: card.ownerUid, exerciseCardOverrides: {},
    exerciseCardSnapshot: exerciseCardMetadata({ ...card, videoPosterTime: null }) };
  const oldDraft = { ...draft, plan: { workouts: [{ ...workout, exercises: [saved] }] } };
  const fresh = applyExerciseCard(saved, card);
  const restored = restoreWorkoutDraftPlan({ workouts: [{ ...workout, exercises: [fresh] }] }, oldDraft).workouts[0].exercises[0];
  assert.equal(restored.videoPosterTime, 2.1);
  assert.equal(restored.exerciseCardSnapshot.videoPosterTime, 2.1);
  assert.equal(restored.sets, saved.sets);
  assert.equal(saved.exerciseCardSnapshot.videoPosterTime, null);
  const updated = applyExerciseCard(restored, { ...card, videoPosterTime: 4.2 });
  assert.equal(updated.videoPosterTime, 4.2);
  assert.notEqual(updated.exerciseCardOverrides.videoPosterTime, true);
  assert.equal(updated.sets, saved.sets);
  const manual = { ...saved, exerciseCardOverrides: { videoPosterTime: true } };
  const manualDraft = { ...oldDraft, plan: { workouts: [{ ...workout, exercises: [manual] }] } };
  assert.equal(restoreWorkoutDraftPlan({ workouts: [{ ...workout, exercises: [fresh] }] }, manualDraft).workouts[0].exercises[0], manual);
});

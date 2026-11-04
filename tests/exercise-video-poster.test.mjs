import assert from "node:assert/strict";
import test from "node:test";
import { isValidExerciseVideoPosterTime, normalizeExerciseVideoPosterTime } from "../functions/exerciseVideoPoster.js";
import { exerciseCardDatabase } from "./helpers/exercise-card-database.mjs";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";
import { applyExerciseCard, exerciseCardLegacyKey, exerciseCardMetadata, mapTemplateExerciseCards } from "../functions/exerciseCards.js";
import { readClientExerciseMedia, resolveClientExerciseMedia } from "../functions/clientExerciseMedia.js";
import { withClientExerciseMedia } from "../src/utils/clientExerciseMedia.js";
import { buildClientWorkoutsFromTemplate } from "../src/utils/workoutPlanNormalization.js";
import { getTrainerExercisePresentationIdentity } from "../src/features/trainer/trainerWorkoutEditHelpers.js";
import { createTrainerExerciseAlternative, replaceTrainerAssignedExerciseInWorkout } from "../src/utils/trainerExerciseAlternatives.js";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const context = { uid: "trainer", role: "trainer" };
const exercise = { id: "press", name: "Жим ногами", video: "/press.mp4", sets: [{ reps: 12, weight: 110 }], rest: "100 сек" };
const workout = { id: "day", assignedBy: "trainer", status: "planned", exercises: [exercise] };
const template = { id: "template", ownerUid: "trainer", workouts: [workout] };

test("month library selection keeps the chosen frame attached to the selected video source", async () => {
  const release = installRuntimeImports();
  let createTrainerMonthExerciseHandlers;
  try { ({ createTrainerMonthExerciseHandlers } = await import("../src/features/trainer/trainerMonthExerciseHandlers.js")); }
  finally { release(); }
  const library = { id: "library", name: "Библиотечный жим", video: "/library.mp4", videoPosterTime: 8 };
  for (const [original, candidates, expectedVideo, expectedTime] of [
    [{ ...exercise, video: "/private.mp4", videoPosterTime: 4 }, [library], "/library.mp4", 8],
    [{ ...exercise, videoAutoFilledFrom: "Старое имя", videoPosterTime: 4 }, [library], "/library.mp4", 8],
    [{ ...exercise, videoAutoFilledFrom: "Старое имя", videoPosterTime: 4 }, [{ ...library, videoPosterTime: undefined }], "/library.mp4", null]
  ]) {
    let updated;
    const handlers = createTrainerMonthExerciseHandlers({ adminExerciseLibrary: candidates,
      monthWorkouts: [{ id: "day", exercises: [original] }],
      updateMonthWorkout: (_block, _week, _day, patch) => { updated = patch.exercises[0]; } });
    handlers.updateMonthExerciseName("block", "week", "day", original, library.name);
    assert.equal(updated.video, expectedVideo);
    assert.equal(updated.videoPosterTime, expectedTime);
    assert.deepEqual(updated.sets, original.sets);
  }
  const original = { ...exercise, video: "/private.mp4", videoPosterTime: 4 };
  const before = structuredClone(original);
  const handlers = createTrainerMonthExerciseHandlers({ adminExerciseLibrary: [],
    monthWorkouts: [{ id: "day", exercises: [original] }],
    updateMonthWorkout: () => assert.fail("Unmatched text must not replace an exercise or its video") });
  assert.equal(handlers.updateMonthExerciseName("block", "week", "day", original, library.name), false);
  assert.deepEqual(original, before);
});

test("poster time accepts bounded finite numbers, preserves zero and rounds to milliseconds", () => {
  for (const value of [0, 0.001, 12.34567, 86400, null]) assert.equal(isValidExerciseVideoPosterTime(value), true);
  assert.equal(normalizeExerciseVideoPosterTime(0), 0);
  assert.equal(normalizeExerciseVideoPosterTime(12.34567), 12.346);
  for (const value of [undefined, "0", "12", false, {}, [], NaN, Infinity, -Infinity, -0.01, 86400.001]) {
    assert.equal(isValidExerciseVideoPosterTime(value), false);
    assert.equal(normalizeExerciseVideoPosterTime(value), null);
  }
  assert.equal(exerciseCardMetadata({ videoPosterTime: 5 }).videoPosterTime, null);
});

test("poster survives shared card, assignment, client enrichment and alternatives without changing prescriptions or history", async () => {
  const db = exerciseCardDatabase({ "trainingTemplates/template": template, "users/client": { assignedTrainerId: "trainer" },
    "users/client/workouts/day": workout, "users/client/history/old": { ...workout, completed: true } });
  const before = structuredClone([...db.documents]);
  const { card } = await manageTrainerExerciseCards({ db, context, body: { action: "save", templateId: template.id,
    exerciseId: exercise.id, legacyKey: exerciseCardLegacyKey(exercise), patch: { videoPosterTime: 0 } } });
  assert.equal(card.videoPosterTime, 0);
  const assigned = buildClientWorkoutsFromTemplate(mapTemplateExerciseCards(template, [card]))[0].exercises[0];
  assert.equal(assigned.videoPosterTime, 0);
  const payload = await readClientExerciseMedia({ db, context: { uid: "client", role: "client" }, clientId: "client" });
  const resolved = withClientExerciseMedia(workout, payload.media).exercises[0];
  assert.equal(resolved.videoPosterTime, 0);
  assert.deepEqual(resolved.sets, exercise.sets);
  assert.equal(resolved.rest, exercise.rest);
  const updated = applyExerciseCard(JSON.parse(JSON.stringify(resolved)), { ...card, videoPosterTime: 3.5 });
  assert.equal(updated.videoPosterTime, 3.5);
  assert.deepEqual(updated.exerciseCardOverrides, {});
  assert.equal(applyExerciseCard({ ...resolved, video: "/private.mp4" }, card).videoPosterTime, null);
  assert.equal(applyExerciseCard({ ...resolved, video: "/private.mp4", videoPosterTime: 7 }, card).videoPosterTime, 7);
  assert.equal(applyExerciseCard({ ...resolved, video: "", videoPosterTime: 7 }, card).videoPosterTime, null);
  const sharedReplacement = applyExerciseCard({ ...resolved, videoPosterTime: 7 }, { ...card, video: "/new.mp4", videoPosterTime: 2 });
  assert.equal(sharedReplacement.videoPosterTime, 2);
  assert.equal(sharedReplacement.exerciseCardOverrides.videoPosterTime, undefined);
  const identity = getTrainerExercisePresentationIdentity(resolved);
  assert.equal(identity.videoPosterTime, 0);
  const alternative = createTrainerExerciseAlternative({ ...card, ...identity });
  const replacement = replaceTrainerAssignedExerciseInWorkout({ exercises: [{ ...exercise, videoPosterTime: 9,
    trainerAlternatives: [alternative] }] }, exercise.id, alternative).replacement;
  assert.equal(replacement.videoPosterTime, 0);
  assert.deepEqual(replacement.sets, exercise.sets);
  const noPoster = createTrainerExerciseAlternative({ id: "other", name: "Другой жим", video: "/other.mp4" });
  assert.equal(replaceTrainerAssignedExerciseInWorkout({ exercises: [{ ...exercise, videoPosterTime: 9,
    trainerAlternatives: [noPoster] }] }, exercise.id, noPoster).replacement.videoPosterTime, null);
  assert.deepEqual([...db.documents].filter(([path]) => !path.startsWith("trainerExerciseCards/")), before);
  for (const invalid of ["0", false, {}, -1, 86401, NaN, Infinity]) {
    await assert.rejects(manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id,
      revision: card.revision, patch: { videoPosterTime: invalid } } }), { status: 400 });
  }
  await assert.rejects(manageTrainerExerciseCards({ db, context: { uid: "other", role: "trainer" },
    body: { action: "save", cardId: card.id, revision: card.revision, patch: { videoPosterTime: 1 } } }), { status: 403 });
});

test("replacement and removed video clear stale poster; an explicit new moment is accepted", async () => {
  const db = exerciseCardDatabase();
  let { card } = await manageTrainerExerciseCards({ db, context, body: { action: "create",
    patch: { name: exercise.name, video: exercise.video, videoPosterTime: 12.34567 } } });
  assert.equal(card.videoPosterTime, 12.346);
  ({ card } = await manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id,
    revision: card.revision, patch: { video: "/next.mp4" } } }));
  assert.equal(card.videoPosterTime, null);
  ({ card } = await manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id,
    revision: card.revision, patch: { video: "/final.mp4", videoPosterTime: 0 } } }));
  assert.equal(card.videoPosterTime, 0);
  ({ card } = await manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id,
    revision: card.revision, patch: { video: "", videoPosterTime: 2 } } }));
  assert.equal(card.videoPosterTime, null);
});

test("legacy media fallback carries only the selected source's poster and leaves protected snapshots alone", () => {
  const missing = { ...workout, exercises: [{ ...exercise, video: "", videoPosterTime: 9 }] };
  const library = { ...template, workouts: [{ ...workout, exercises: [{ ...exercise, videoPosterTime: 0 }] }] };
  let media = resolveClientExerciseMedia([missing], [library], "trainer");
  assert.equal(withClientExerciseMedia(missing, media).exercises[0].videoPosterTime, 0);
  media = resolveClientExerciseMedia([missing], [template], "trainer");
  assert.equal(withClientExerciseMedia(missing, media).exercises[0].videoPosterTime, null);
  const ownVideo = { ...workout, exercises: [{ ...exercise, videoPosterTime: 7 }] };
  assert.equal(withClientExerciseMedia(ownVideo, media).exercises[0].videoPosterTime, 7);
  for (const patch of [{ completed: true }, { source: "basic" }, { assignedProgramLifecycleStatus: "archived" }]) {
    const snapshot = { ...missing, ...patch };
    assert.equal(withClientExerciseMedia(snapshot, media), snapshot);
  }
});

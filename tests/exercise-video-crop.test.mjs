import assert from "node:assert/strict";
import test from "node:test";
import { isValidExerciseVideoCrop, normalizeExerciseVideoCrop } from "../functions/exerciseVideoCrop.js";
import { exerciseVideoCropStyle, panExerciseVideoCrop } from "../src/utils/exerciseVideoCrop.js";
import { exerciseCardDatabase } from "./helpers/exercise-card-database.mjs";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";
import { applyExerciseCard, exerciseCardLegacyKey, mapTemplateExerciseCards } from "../functions/exerciseCards.js";
import { readClientExerciseMedia } from "../functions/clientExerciseMedia.js";
import { withClientExerciseMedia } from "../src/utils/clientExerciseMedia.js";
import { buildClientWorkoutsFromTemplate } from "../src/utils/workoutPlanNormalization.js";
import { getTrainerExercisePresentationIdentity } from "../src/features/trainer/trainerWorkoutEditHelpers.js";
import { createTrainerExerciseAlternative, replaceTrainerAssignedExerciseInWorkout } from "../src/utils/trainerExerciseAlternatives.js";

const crop = { x: 0.2, y: 0.8, zoom: 1.5 };
const context = { uid: "trainer", role: "trainer" };

test("framing accepts only finite bounded numeric metadata, while old exercises keep contain", () => {
  assert.deepEqual(normalizeExerciseVideoCrop(crop), crop);
  assert.equal(exerciseVideoCropStyle(undefined), undefined);
  for (const value of [undefined, {}, [], { ...crop, x: -0.1 }, { ...crop, y: 1.1 }, { ...crop, zoom: 0 }, { ...crop, zoom: 3.1 }, { ...crop, zoom: Infinity }, { ...crop, x: "0.2" }, { ...crop, css: "url(x)" }]) {
    assert.equal(isValidExerciseVideoCrop(value), false);
    assert.equal(normalizeExerciseVideoCrop(value), null);
  }
});

test("panning follows the finger and never exposes an empty edge for portrait or landscape video", () => {
  for (const [videoWidth, videoHeight] of [[1920, 1080], [1080, 1920], [1200, 900]]) {
    const size = { width: 400, height: 300, videoWidth, videoHeight };
    const right = panExerciseVideoCrop(crop, size, 20, 0);
    assert.ok(right.x < crop.x);
    assert.equal(right.y, crop.y);
    assert.equal(panExerciseVideoCrop(crop, size, 10000, 10000).x, 0);
    assert.equal(panExerciseVideoCrop(crop, size, -10000, -10000).y, 1);
    const end = panExerciseVideoCrop(crop, size, -10000, -10000);
    const scale = Math.max(size.width / videoWidth, size.height / videoHeight) * end.zoom;
    const left = (size.width - videoWidth * scale) * end.x;
    const top = (size.height - videoHeight * scale) * end.y;
    assert.ok(left <= 0 && top <= 0);
    assert.ok(left + videoWidth * scale >= size.width && top + videoHeight * scale >= size.height);
  }
});

test("shared crop persists through Firestore copies, assignment and replacement without changing any load or history", async () => {
  const exercise = { id: "press", name: "Жим ногами", video: "/press.mp4", sets: Array.from({ length: 3 }, () => ({ reps: 12, weight: 110 })), rest: "100 сек" };
  const workout = { id: "day", assignedBy: "trainer", status: "planned", exercises: [exercise] };
  const template = { id: "template", ownerUid: "trainer", workouts: [workout] };
  const db = exerciseCardDatabase({ "trainingTemplates/template": template, "users/client": { assignedTrainerId: "trainer" },
    "users/client/workouts/day": workout, "users/client/history/old": { ...workout, completed: true } });
  const before = structuredClone([...db.documents]);
  const { card } = await manageTrainerExerciseCards({ db, context, body: { action: "save", templateId: template.id, exerciseId: exercise.id, legacyKey: exerciseCardLegacyKey(exercise), patch: { videoCrop: crop } } });
  const hydrated = mapTemplateExerciseCards(template, [card]);
  const assigned = buildClientWorkoutsFromTemplate(hydrated)[0].exercises[0];
  assert.deepEqual(assigned.videoCrop, crop);
  const payload = await readClientExerciseMedia({ db, context: { uid: "client", role: "client" }, clientId: "client" });
  const resolved = withClientExerciseMedia(workout, payload.media).exercises[0];
  assert.deepEqual(resolved.videoCrop, crop);
  assert.deepEqual(resolved.sets, exercise.sets);
  assert.equal(resolved.rest, exercise.rest);
  // Serialized snapshots have distinct object identities; they aren't local overrides.
  const next = { ...card, videoCrop: { ...crop, x: 0.7 } };
  const updated = applyExerciseCard(JSON.parse(JSON.stringify(resolved)), next);
  assert.deepEqual(updated.videoCrop, next.videoCrop);
  assert.deepEqual(updated.exerciseCardOverrides, {});
  const privateVideo = applyExerciseCard({ ...resolved, video: "/private.mp4" }, next);
  assert.equal(privateVideo.videoCrop, null);
  const item = { ...card, ...getTrainerExercisePresentationIdentity(resolved) };
  const alternative = createTrainerExerciseAlternative(item);
  const replacement = replaceTrainerAssignedExerciseInWorkout({ exercises: [{ ...exercise, trainerAlternatives: [alternative] }] }, exercise.id, alternative).replacement;
  assert.deepEqual(replacement.videoCrop, crop);
  assert.deepEqual(replacement.sets, exercise.sets);
  for (const forbidden of [{ ...crop, zoom: 4 }, "transform", { ...crop, x: NaN }]) {
    await assert.rejects(manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id, revision: card.revision, patch: { videoCrop: forbidden } } }), { status: 400 });
  }
  await assert.rejects(manageTrainerExerciseCards({ db, context: { uid: "other", role: "trainer" }, body: { action: "save", cardId: card.id, revision: card.revision, patch: { videoCrop: crop } } }), { status: 403 });
  const { card: replaced } = await manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id, revision: card.revision, patch: { video: "/other.mp4" } } });
  assert.equal(replaced.videoCrop, null);
  assert.deepEqual([...db.documents].filter(([path]) => !path.startsWith("trainerExerciseCards/")), before);
});

import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerExerciseSelectionPatch } from "../src/features/trainer/trainerWorkoutEditHelpers.js";
import { resolveClientExerciseMedia } from "../functions/clientExerciseMedia.js";
import { withClientExerciseMedia } from "../src/utils/clientExerciseMedia.js";
import { normalizeExercise, buildClientWorkoutsFromTemplate } from "../src/utils/workoutPlanNormalization.js";

const source = { id: "reused-id", name: "Жим в хаммере", video: "", librarySource: { type: "template", templateId: "b", ownerUid: "trainer" } };
const selected = { id: "assigned", ...getTrainerExerciseSelectionPatch(source), sets: [{ reps: 12, weight: 20, completed: true }], clientNote: "Заметка" };
const workout = { id: "day", status: "planned", assignedBy: "trainer", assignedProgramId: "a", assignedProgramUpdatedAt: "version", exercises: [selected] };
const templates = [
  { id: "a", ownerUid: "trainer", workouts: [{ exercises: [{ id: "reused-id", name: "Жим гантелей", video: "wrong-a.mp4" }] }] },
  { id: "b", ownerUid: "trainer", workouts: [{ exercises: [source] }] }
];

test("a new explicit library selection without a clip rejects an unrelated legacy fallback with a reused ID", () => {
  const original = structuredClone(workout);
  const media = resolveClientExerciseMedia([workout], templates, "trainer");
  assert.equal(media[0].video, "wrong-a.mp4"); // An older server may still offer it.
  const result = withClientExerciseMedia(workout, media);
  assert.equal(result.exercises[0].video, "");
  assert.equal(result.exercises[0], selected);
  assert.deepEqual(workout, original);
});

test("an inherited-card fallback cannot silently replace an unlinked explicit library choice", () => {
  const media = [{ workoutId: "day", exerciseId: "assigned", exerciseName: selected.name, assignmentVersion: "version",
    card: { id: "unrelated", ownerUid: "trainer", name: "Другой жим", video: "wrong-card.mp4" } }];
  assert.equal(withClientExerciseMedia(workout, media).exercises[0], selected);
});

test("actual linked cards keep receiving their own updates without touching performed sets or notes", () => {
  const linked = { ...selected, exerciseCardId: "card-b", exerciseCardOwnerUid: "trainer" };
  const ownWorkout = { ...workout, exercises: [linked] };
  const media = [{ workoutId: "day", exerciseId: "assigned", exerciseName: linked.name, assignmentVersion: "version",
    card: { id: "card-b", ownerUid: "trainer", name: linked.name, video: "current-b.mp4" } }];
  const result = withClientExerciseMedia(ownWorkout, media).exercises[0];
  assert.equal(result.video, "current-b.mp4");
  assert.equal(result.sets, linked.sets);
  assert.equal(result.clientNote, linked.clientNote);
});

test("the explicit-choice marker survives normalisation, client assignment and JSON persistence", () => {
  assert.equal(normalizeExercise(selected).librarySelectionVersion, 1);
  const rows = buildClientWorkoutsFromTemplate({ id: "b", name: "Шаблон", workouts: [{ id: "base", exercises: [selected] }] }, "date", "version");
  assert.equal(JSON.parse(JSON.stringify(rows))[0].exercises[0].librarySelectionVersion, 1);
  assert.equal(selected.name, source.name);
});

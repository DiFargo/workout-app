import assert from "node:assert/strict";
import test from "node:test";
import { canonicalWorkoutVideoSource, fillMissingDraftExercisePreview, mergeLateWorkoutMedia } from "../src/utils/workoutMediaMerge.js";

const source = "gs://synthetic.test/exercise-videos/one.mp4";
const exercise = { id: "e", name: "Тяга", video: source, exerciseCardId: "card", exerciseCardOwnerUid: "trainer",
  exerciseCardSnapshot: { name: "Тяга", video: source, technique: "Исходная техника" }, sets: [{ reps: 12, weight: 20 }], rest: "90 сек" };
const baseline = { assignedProgramId: "p", assignedProgramUpdatedAt: "v1", workouts: [{ id: "day", assignedProgramId: "p",
  assignedProgramAddedAt: "2026-10-01", assignedProgramUpdatedAt: "v1", assignedBy: "trainer", status: "planned", exercises: [exercise] }] };
const resolved = { ...baseline, workouts: [{ ...baseline.workouts[0], exercises: [{ ...exercise, videoPosterTime: 2.1,
  name: "Новое название", technique: "Новая техника", exerciseCardSnapshot: { ...exercise.exerciseCardSnapshot, videoPosterTime: 2.1 } }] }] };
const currentWith = patch => ({ ...baseline, workouts: [{ ...baseline.workouts[0], exercises: [{ ...exercise, ...patch }] }] });

test("late media changes only presentation and keeps the exact runtime set/note/prescription values", () => {
  const current = currentWith({ sets: [{ reps: 12, weight: 20, enteredWeight: "25", enteredReps: "12", completed: true }],
    clientNote: "Заметка", note: "Локальная инструкция", rest: "120 сек" });
  const updated = mergeLateWorkoutMedia(current, baseline, resolved), next = updated.workouts[0].exercises[0];
  assert.equal(next.videoPosterTime, 2.1);
  assert.equal(next.sets, current.workouts[0].exercises[0].sets);
  assert.equal(next.clientNote, "Заметка"); assert.equal(next.note, "Локальная инструкция"); assert.equal(next.rest, "120 сек");
  assert.equal(next.name, "Тяга"); assert.equal(next.technique, undefined);
  assert.deepEqual(next.exerciseCardSnapshot, { ...exercise.exerciseCardSnapshot, videoPosterTime: 2.1 });
  assert.equal(baseline.workouts[0].exercises[0].videoPosterTime, undefined);
  assert.equal(mergeLateWorkoutMedia(updated, baseline, resolved), updated);
});

test("local source, selected frame, crop and exercise identity remain protected", () => {
  for (const patch of [{ video: "gs://synthetic.test/exercise-videos/local.mp4" }, { videoPosterTime: 4 },
    { exerciseCardId: "other-card" }, { name: "Другая тяга" }, { trainerSelectedAlternativeId: "alternative" },
    { exerciseCardOverrides: { video: true } }, { exerciseCardOverrides: { videoPosterTime: true } }]) {
    const current = currentWith(patch);
    assert.equal(mergeLateWorkoutMedia(current, baseline, resolved), current);
  }
  const current = currentWith({ videoCrop: { x: .2, y: .3, scale: 1.3 } });
  const updated = mergeLateWorkoutMedia(current, baseline, resolved);
  assert.equal(updated.workouts[0].exercises[0].videoCrop, current.workouts[0].exercises[0].videoCrop);
  assert.equal(updated.workouts[0].exercises[0].videoPosterTime, 2.1);
});

test("a source replacement cannot carry local framing from another clip", () => {
  const current = currentWith({ videoCrop: { x: .2, y: .3, scale: 1.3 } });
  const replacement = { ...resolved, workouts: [{ ...resolved.workouts[0], exercises: [{ ...resolved.workouts[0].exercises[0], video: "new.mp4" }] }] };
  assert.equal(mergeLateWorkoutMedia(current, baseline, replacement), current);
  const anotherCard = { ...resolved, workouts: [{ ...resolved.workouts[0], exercises: [{ ...resolved.workouts[0].exercises[0], exerciseCardId: "another-card" }] }] };
  assert.equal(mergeLateWorkoutMedia(baseline, baseline, anotherCard), baseline);
});

test("different assignments and completed/archived workouts are not enriched", () => {
  for (const patch of [{ assignedProgramId: "other" }, { assignedProgramUpdatedAt: "v2" },
    { assignedProgramAddedAt: "2026-10-02" }, { assignedBy: "other-trainer" }, { status: "completed" },
    { assignedProgramLifecycleStatus: "archived" }]) {
    const current = { ...baseline, workouts: [{ ...baseline.workouts[0], ...patch }] };
    assert.equal(mergeLateWorkoutMedia(current, baseline, resolved), current);
  }
  const current = { ...baseline, assignedProgramId: "other" };
  assert.equal(mergeLateWorkoutMedia(current, baseline, resolved), current);
});

test("Storage URL forms canonicalise without treating external query-selected videos as identical", () => {
  for (const url of ["https://firebasestorage.googleapis.com/v0/b/synthetic.test/o/exercise-videos%2Fone.mp4?alt=media&token=synthetic",
    "https://storage.googleapis.com/synthetic.test/exercise-videos/one.mp4?X-Goog-Signature=synthetic",
    "https://synthetic.test.storage.googleapis.com/exercise-videos/one.mp4?X-Goog-Signature=synthetic"])
    assert.equal(canonicalWorkoutVideoSource(url), source);
  assert.notEqual(canonicalWorkoutVideoSource("https://example.test/clip?id=1"), canonicalWorkoutVideoSource("https://example.test/clip?id=2"));
});

test("draft frame filling is bounded by source, card identity and existing selection", () => {
  const fresh = { ...exercise, videoPosterTime: 2.1 };
  assert.equal(fillMissingDraftExercisePreview(exercise, fresh).videoPosterTime, 2.1);
  for (const patch of [{ videoPosterTime: 0 }, { videoPosterTime: 4 }, { video: "local.mp4" }, { id: "other" },
    { exerciseCardId: "other" }, { exerciseCardOwnerUid: "other" }, { exerciseCardOverrides: { video: true } },
    { exerciseCardOverrides: { videoPosterTime: true } }]) {
    const current = { ...exercise, ...patch };
    assert.equal(fillMissingDraftExercisePreview(current, fresh), current);
  }
});

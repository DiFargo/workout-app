import assert from "node:assert/strict";
import test, { after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import {
  getTrainerExerciseSelectionPatch,
  resolveTrainerLibraryExercise
} from "../src/features/trainer/trainerWorkoutEditHelpers.js";
import { resolveClientExerciseMedia } from "../functions/clientExerciseMedia.js";

const cleanupImports = installRuntimeImports({
  "firebase/firestore": { runTransaction() { assert.fail("No database transaction belongs to library selection"); } },
  "/src/utils/firebaseStorage.js": { uploadStorageFile() { assert.fail("Programme selection must not upload a new clip"); } },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout() { assert.fail("Programme selection must not create a library card"); } }
});
after(cleanupImports);
const { createTrainerPlanEditorHandlers } = await import("../src/features/trainer/trainerPlanEditorHandlers.js");
const { createTrainerMonthExerciseHandlers } = await import("../src/features/trainer/trainerMonthExerciseHandlers.js");
const { createTrainerWorkspaceHandlers } = await import("../src/features/trainer/trainerWorkspaceHandlers.js");

const libraryCard = {
  id: "card-library-a", exerciseCardId: "card-library-a", exerciseCardOwnerUid: "trainer-a",
  name: "Жим в тренажёре", video: "https://example.test/current.mp4", videoCrop: { x: 0.5, y: 0.5, zoom: 1 },
  videoPosterTime: 2, image: "https://example.test/current.webp", technique: "Текущая техника",
  librarySource: { type: "card", ownerUid: "trainer-a" }, requiresWeight: true
};
const noVideoSource = {
  id: "legacy-library-b", name: "Разгибание ног", video: "", technique: "",
  librarySource: { type: "template", templateId: "template-a", ownerUid: "trainer-a" }
};
const oldExercise = {
  id: "plan-exercise", name: "Старое локальное движение", video: "https://example.test/old.mp4",
  videoUrl: "https://example.test/alias.mp4", videoURL: "https://example.test/alias2.mp4",
  videoCrop: { x: 0.2, y: 0.2, zoom: 2 }, videoPosterTime: 8, videoPoster: "old-poster.webp",
  videoThumbnail: "old-thumb.webp", image: "old-image.webp", thumbnail: "old-image-thumb.webp",
  imageUrl: "old-url.webp", exerciseCardId: "old-card", exerciseCardOwnerUid: "trainer-a",
  exerciseCardSnapshot: { name: "Old baseline" }, exerciseCardOverrides: { video: true },
  sourceExerciseId: "old-source", originalExerciseId: "old-original", previousNames: ["Old name"],
  rest: "120 сек", clientNote: "Наблюдение клиента", sets: [{ weight: 20, reps: 12, enteredWeight: "22", completed: true }]
};

function clientEditor(library = [libraryCard, noVideoSource]) {
  const plan = { assignedProgramUpdatedAt: "assignment-a", workouts: [{ id: "day-a", exercises: [structuredClone(oldExercise)] }] };
  let current = plan;
  const saves = [];
  const statuses = [];
  const factory = createTrainerPlanEditorHandlers({
    plan, trainerExerciseLibraryItems: library, selectedUserId: "synthetic-client-a", auth: {}, draftOnly: true,
    setPlan(value) { current = typeof value === "function" ? value(current) : value; },
    saveWorkoutsToFirebase: async value => { saves.push(value); return true; },
    setAdminClientStatus: value => statuses.push(value)
  });
  return { factory, handlers: createTrainerWorkspaceHandlers({ ...factory, setAdminClientStatus: value => statuses.push(value) }),
    plan, saves, statuses, get current() { return current; } };
}

function monthEditor(library = [libraryCard, noVideoSource]) {
  const workout = { id: "day-a", exercises: [structuredClone(oldExercise)] };
  const updates = [];
  const handlers = createTrainerMonthExerciseHandlers({
    adminExerciseLibrary: library, monthWorkouts: [workout], adminExerciseEditSnapshotRef: { current: null },
    updateMonthWorkout: (...args) => updates.push(args), setAdminExerciseSearch() {}, setAdminSelectedExerciseId() {}
  });
  return { workout, updates, handlers };
}

test("only an explicit, unique active library identity resolves; names and stale metadata are never authority", () => {
  const library = [libraryCard, noVideoSource];
  assert.equal(resolveTrainerLibraryExercise(null, library), null);
  assert.equal(resolveTrainerLibraryExercise({ name: libraryCard.name }, library), null);
  assert.equal(resolveTrainerLibraryExercise({ id: "unknown", name: libraryCard.name }, library), null);
  assert.equal(resolveTrainerLibraryExercise({ ...libraryCard, name: "Старое имя", video: "old.mp4" }, library), libraryCard);
  assert.equal(resolveTrainerLibraryExercise({ ...libraryCard, exerciseCardOwnerUid: "other" }, library), null);
  assert.equal(resolveTrainerLibraryExercise(libraryCard, [libraryCard, { ...libraryCard, video: "another.mp4" }]), null);
  assert.equal(resolveTrainerLibraryExercise(libraryCard, [{ ...libraryCard, libraryDeletedAt: "2026-10-29" }]), null);
  assert.equal(resolveTrainerLibraryExercise(libraryCard, [{ ...libraryCard, deletedAt: "2026-10-29" }]), null);
  assert.equal(resolveTrainerLibraryExercise(libraryCard, [{ ...libraryCard, librarySource: { ...libraryCard.librarySource, isNew: true } }]), null);
});

test("owner and template identity disambiguate library rows without a name-based guess", () => {
  const foreign = { ...libraryCard, exerciseCardOwnerUid: "trainer-b", librarySource: { type: "card", ownerUid: "trainer-b" } };
  assert.equal(resolveTrainerLibraryExercise(libraryCard, [libraryCard, foreign]), libraryCard);
  assert.equal(resolveTrainerLibraryExercise({ id: libraryCard.id }, [libraryCard, foreign]), null);
  const anotherTemplate = { ...noVideoSource, librarySource: { ...noVideoSource.librarySource, templateId: "template-b" } };
  assert.equal(resolveTrainerLibraryExercise(noVideoSource, [noVideoSource, anotherTemplate]), noVideoSource);
  assert.equal(resolveTrainerLibraryExercise({ ...noVideoSource, librarySource: { ...noVideoSource.librarySource, templateId: "missing" } }, [noVideoSource]), null);
});

test("an explicit replacement with no video clears all old media and movement identity but keeps the prescription", () => {
  const before = structuredClone(oldExercise);
  const patch = getTrainerExerciseSelectionPatch(noVideoSource);
  assert.equal(patch.librarySelectionVersion, 1, "Only a new explicit selection opts out of legacy media guesses");
  const result = { ...oldExercise, ...patch };
  assert.equal(result.name, noVideoSource.name);
  for (const field of ["video", "videoUrl", "videoURL", "videoAutoFilledFrom", "videoPoster", "videoThumbnail", "image", "thumbnail", "imageUrl", "exerciseCardId", "exerciseCardOwnerUid", "sourceExerciseId", "originalExerciseId"]) {
    assert.equal(result[field], "", field);
  }
  assert.equal(result.videoPosterTime, null);
  assert.equal(result.videoCrop, null);
  assert.equal(result.exerciseCardSnapshot, null);
  assert.deepEqual(result.exerciseCardOverrides, {});
  assert.deepEqual(result.previousNames, []);
  assert.equal(result.libraryExerciseId, noVideoSource.id);
  assert.equal(result.id, before.id);
  assert.equal(result.sets, oldExercise.sets);
  assert.equal(result.rest, before.rest);
  assert.equal(result.clientNote, before.clientNote);
  assert.deepEqual(oldExercise, before);
});

test("shared card replacement keeps the canonical owner, metadata baseline and preview", () => {
  const patch = getTrainerExerciseSelectionPatch(libraryCard);
  assert.equal(patch.librarySelectionVersion, 1);
  assert.equal(patch.exerciseCardId, libraryCard.id);
  assert.equal(patch.exerciseCardOwnerUid, "trainer-a");
  assert.equal(patch.exerciseCardSnapshot.video, libraryCard.video);
  assert.equal(patch.video, libraryCard.video);
  assert.equal(patch.videoPosterTime, 2);
  assert.deepEqual(patch.videoCrop, libraryCard.videoCrop);
  assert.equal(patch.image, libraryCard.image);
  assert.equal(patch.technique, libraryCard.technique);
  assert.equal("id" in patch, false);
  assert.equal("sets" in patch, false);
  assert.equal("rest" in patch, false);
});

test("only selecting a different movement clears alternatives from the previous movement", () => {
  const current = { ...oldExercise, trainerAlternatives: [{ id: "old-alternative", video: "wrong-for-new-movement.mp4" }] };
  const selected = { ...current, ...getTrainerExerciseSelectionPatch(libraryCard, current) };
  assert.deepEqual(selected.trainerAlternatives, []);
  assert.equal(current.trainerAlternatives.length, 1);
  const sameCard = { ...libraryCard, id: "programme-slot", trainerAlternatives: current.trainerAlternatives };
  const sameCardPatch = getTrainerExerciseSelectionPatch({ ...libraryCard, name: "Обновлённое имя", video: "new-canonical.mp4" }, sameCard);
  assert.equal("trainerAlternatives" in sameCardPatch, false);
  assert.equal(({ ...sameCard, ...sameCardPatch }).trainerAlternatives, current.trainerAlternatives);
  const differentOwner = { ...libraryCard, exerciseCardOwnerUid: "trainer-b", librarySource: { type: "card", ownerUid: "trainer-b" } };
  assert.deepEqual(getTrainerExerciseSelectionPatch(differentOwner, sameCard).trainerAlternatives, []);
});

test("reselecting a legacy reference or an exact unlinked legacy variant preserves alternatives", () => {
  const alternatives = [{ id: "reviewed-alternative" }];
  const current = { ...noVideoSource, id: "programme-slot", libraryExerciseId: noVideoSource.id, trainerAlternatives: alternatives };
  assert.equal("trainerAlternatives" in getTrainerExerciseSelectionPatch({ ...noVideoSource, video: "new-canonical.mp4" }, current), false);
  const exactLegacy = { ...noVideoSource, id: "old-unlinked-slot", trainerAlternatives: alternatives };
  assert.equal("trainerAlternatives" in getTrainerExerciseSelectionPatch(noVideoSource, exactLegacy), false);
  assert.deepEqual(getTrainerExerciseSelectionPatch({ ...noVideoSource, video: "different-unlinked.mp4" }, exactLegacy).trainerAlternatives, []);
  assert.equal("trainerAlternatives" in getTrainerExerciseSelectionPatch(libraryCard), false, "New insertions have no previous movement to clear");
});

test("an explicitly selected legacy clip cannot be replaced by a reused exercise id from another template", () => {
  const selectedSource = {
    id: "reused-legacy-id", name: "Жим в хаммере", video: "https://example.test/selected.mp4",
    librarySource: { type: "template", templateId: "template-b", ownerUid: "trainer-a" }
  };
  const templates = [
    { id: "template-a", ownerUid: "trainer-a", workouts: [{ exercises: [{
      id: selectedSource.id, name: "Жим гантелей", video: "https://example.test/wrong.mp4"
    }] }] },
    { id: "template-b", ownerUid: "trainer-a", workouts: [{ exercises: [selectedSource] }] }
  ];
  const makeWorkout = exercise => ({ id: "client-day", assignedBy: "trainer-a", assignedProgramId: "template-a", exercises: [exercise] });
  const oldSelection = { id: "client-slot", libraryExerciseId: selectedSource.id,
    name: selectedSource.name, video: selectedSource.video, videoAutoFilledFrom: selectedSource.name };
  assert.equal(resolveClientExerciseMedia([makeWorkout(oldSelection)], templates, "trainer-a", [])[0].video,
    "https://example.test/wrong.mp4", "The unchanged backend fallback demonstrates the old collision");
  const explicitSelection = { id: "client-slot", ...getTrainerExerciseSelectionPatch(selectedSource) };
  assert.equal(explicitSelection.video, selectedSource.video);
  assert.equal(explicitSelection.videoAutoFilledFrom, "");
  assert.deepEqual(resolveClientExerciseMedia([makeWorkout(explicitSelection)], templates, "trainer-a", []), []);
  assert.equal(oldSelection.videoAutoFilledFrom, selectedSource.name, "Existing records are not migrated by this selection helper");

  const linkedSource = { ...selectedSource, id: "shared-card-b", exerciseCardId: "shared-card-b", exerciseCardOwnerUid: "trainer-a" };
  const linked = { id: "client-slot", ...getTrainerExerciseSelectionPatch(linkedSource) };
  const freshCard = { id: "shared-card-b", ownerUid: "trainer-a", name: selectedSource.name, video: "https://example.test/fresh-card.mp4" };
  const linkedMedia = resolveClientExerciseMedia([makeWorkout(linked)], templates, "trainer-a", [freshCard]);
  assert.equal(linkedMedia[0].card.video, freshCard.video);
});

test("actual client draft handler rejects free-form or removed sources without any plan write", () => {
  const editor = clientEditor();
  const baseline = structuredClone(editor.plan);
  for (const source of [undefined, { name: libraryCard.name }, { id: "missing", name: libraryCard.name }]) {
    assert.equal(editor.handlers.onAddExercise("day-a", source), false);
  }
  assert.equal(editor.saves.length, 0);
  assert.equal(editor.current, editor.plan);
  assert.deepEqual(editor.plan, baseline);
  assert.ok(editor.statuses.every(message => message.includes("библиотеки")));
  const deleted = clientEditor([{ ...libraryCard, deletedAt: "2026-10-29" }]);
  assert.equal(deleted.handlers.onAddExercise("day-a", libraryCard), false);
  assert.equal(deleted.saves.length, 0);
});

test("client draft selected source uses current canonical metadata and preserves old legacy rows", () => {
  const editor = clientEditor();
  const baseline = structuredClone(editor.plan);
  const result = editor.handlers.onAddExercise("day-a", { ...libraryCard, name: "Устаревшее имя", video: "old.mp4" });
  assert.ok(result);
  assert.equal(result.name, libraryCard.name);
  assert.equal(result.video, libraryCard.video);
  assert.equal(result.exerciseCardId, libraryCard.exerciseCardId);
  assert.equal(result.exerciseCardOwnerUid, libraryCard.exerciseCardOwnerUid);
  assert.equal(result.sets.length, 1);
  assert.deepEqual(editor.current.workouts[0].exercises[0], baseline.workouts[0].exercises[0]);
  assert.deepEqual(editor.plan, baseline);
  assert.equal(editor.saves.length, 1);
  assert.equal(editor.current.workouts[0].exercises.at(-1), result);
});

test("month constructor requires an explicit source and ignores stale selected metadata", () => {
  const editor = monthEditor();
  assert.equal(editor.handlers.addMonthExercise("block", "week", "day-a", null, false), false);
  assert.equal(editor.handlers.addMonthExercise("block", "week", "day-a", { id: "fake", name: libraryCard.name }, false), false);
  assert.equal(editor.updates.length, 0);
  const result = editor.handlers.addMonthExercise("block", "week", "day-a", { ...libraryCard, video: "old.mp4" }, false);
  assert.equal(result.video, libraryCard.video);
  assert.equal(result.name, libraryCard.name);
  assert.equal(result.exerciseCardOwnerUid, "trainer-a");
  assert.equal(editor.updates.length, 1);
  assert.deepEqual(editor.updates[0][3].exercises[0], oldExercise);
});

test("month free text cannot create another movement or retain a mismatched old video", () => {
  const editor = monthEditor();
  assert.equal(editor.handlers.updateMonthExerciseName("block", "week", "day-a", oldExercise, "Новый произвольный жим"), false);
  assert.equal(editor.updates.length, 0);
  assert.equal(editor.handlers.updateMonthExerciseName("block", "week", "day-a", oldExercise, noVideoSource.name), true);
  const replacement = editor.updates[0][3].exercises[0];
  assert.equal(replacement.name, noVideoSource.name);
  assert.equal(replacement.video, "");
  assert.equal(replacement.videoURL, "");
  assert.equal(replacement.exerciseCardId, "");
  assert.deepEqual(replacement.sets, oldExercise.sets);
});

test("duplicating an exercise retains its movement name and independently copies its sets", () => {
  const client = clientEditor();
  client.factory.duplicateTrainerNextExercise("day-a", oldExercise.id);
  const duplicate = client.current.workouts[0].exercises[1];
  assert.equal(duplicate.name, oldExercise.name);
  assert.equal(duplicate.video, oldExercise.video);
  assert.equal(duplicate.exerciseCardId, oldExercise.exerciseCardId);
  assert.notEqual(duplicate.id, oldExercise.id);
  assert.notEqual(duplicate.sets[0], client.current.workouts[0].exercises[0].sets[0]);
  const month = monthEditor();
  month.handlers.duplicateMonthExercise("block", "week", "day-a", oldExercise.id);
  assert.equal(month.updates[0][3].exercises[1].name, oldExercise.name);
  assert.notEqual(month.updates[0][3].exercises[1].sets[0], month.workout.exercises[0].sets[0]);
});

test("editing old legacy prescriptions never silently rewrites their name, clip or historical reference", () => {
  const editor = clientEditor();
  editor.factory.updateTrainerNextExercise("day-a", oldExercise.id, { rest: "60 сек" });
  assert.deepEqual(editor.current.workouts[0].exercises[0], { ...oldExercise, rest: "60 сек" });
  assert.deepEqual(editor.plan.workouts[0].exercises[0], oldExercise);
});

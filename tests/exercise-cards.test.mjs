import assert from "node:assert/strict";
import test from "node:test";
import { exerciseCardDatabase } from "./helpers/exercise-card-database.mjs";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";
import { exerciseCardLegacyKey, exerciseCardMetadata, applyExerciseCard, findExerciseCard, mapTemplateExerciseCards, exerciseCardReference } from "../functions/exerciseCards.js";
import { resolveClientExerciseMedia, readClientExerciseMedia } from "../functions/clientExerciseMedia.js";
import { withClientExerciseMedia } from "../src/utils/clientExerciseMedia.js";
import { buildTrainerExerciseLibraryItems } from "../src/utils/trainerExerciseLibrary.js";
import { buildClientWorkoutsFromTemplate } from "../src/utils/workoutPlanNormalization.js";
import { getBasicWorkoutExerciseTechniqueHint } from "../src/utils/basicWorkoutExercisePresentation.js";
import { getTrainerExercisePresentationIdentity } from "../src/features/trainer/trainerWorkoutEditHelpers.js";
import { createTrainerExerciseAlternative, replaceTrainerAssignedExerciseInWorkout } from "../src/utils/trainerExerciseAlternatives.js";
import { getExerciseActualProgress } from "../src/utils/exerciseProgress.js";

const context = { uid: "trainer", role: "trainer" };
const movement = { id: "press", name: "Жим ногами", video: "https://example.test/old.mp4", technique: "Исходная техника", rest: "100 сек", requiresWeight: true, sets: Array.from({ length: 3 }, () => ({ reps: 12, weight: 110 })) };

test("exercise video metadata accepts only app-bucket allowlisted gs objects, never gs poster/image fields", async () => {
  const db = exerciseCardDatabase({});
  const source = "gs://tren-85720.firebasestorage.app/exercise-videos/trainer/program/Жим.mp4";
  const result = await manageTrainerExerciseCards({ db, context, body: { action: "create", patch: { name: "Жим", video: source } } });
  assert.equal(result.card.video, source);
  for (const patch of [
    { video: "gs://other-project.firebasestorage.app/exercise-videos/one.mp4" },
    { video: "gs://tren-85720.firebasestorage.app/users/client/private.mp4" },
    { video: "gs://tren-85720.firebasestorage.app/exercise-videos/../workout-videos/one.mp4" },
    { videoPoster: source }, { videoThumbnail: source }
  ]) {
    await assert.rejects(manageTrainerExerciseCards({ db, context, body: { action: "create", patch: { name: "Invalid", ...patch } } }), { status: 400 });
  }
});
function fixture() {
  const template = { id: "template", ownerUid: "trainer", workouts: [{ id: "day", exercises: [structuredClone(movement)] }] };
  const second = { ...structuredClone(template), id: "second" };
  second.workouts[0].exercises[0].sets = [{ reps: 8, weight: 40 }];
  second.workouts[0].exercises[0].rest = "60 сек";
  const workout = { ...structuredClone(template.workouts[0]), assignedBy: "trainer", assignedProgramId: "template", assignedProgramUpdatedAt: "v1", status: "planned" };
  const db = exerciseCardDatabase({ "trainingTemplates/template": template, "trainingTemplates/second": second,
    "users/client": { role: "client", assignedTrainerId: "trainer" }, "users/client/workouts/day": workout });
  const save = (patch = { video: "https://example.test/new.mp4", name: "Жим ногами в тренажёре", technique: "Новая техника" }) => manageTrainerExerciseCards({ db, context,
    body: { action: "save", templateId: "template", exerciseId: "press", legacyKey: exerciseCardLegacyKey(movement), patch } });
  return { template, second, workout, db, save };
}

test("one metadata save updates both programmes and assigned client without writing prescriptions or history", async () => {
  const { template, second, workout, db, save } = fixture();
  const before = structuredClone([...db.documents]);
  const { card } = await save();
  assert.deepEqual(db.writes, [`trainerExerciseCards/${card.id}`]);
  assert.equal("sets" in card, false); assert.equal("rest" in card, false);
  for (const source of [template, second]) {
    const hydrated = mapTemplateExerciseCards(source, [card]);
    const exercise = hydrated.workouts[0].exercises[0];
    assert.equal(exercise.name, card.name); assert.equal(exercise.video, card.video); assert.equal(exercise.technique, card.technique);
    assert.deepEqual(exercise.sets, source.workouts[0].exercises[0].sets);
    assert.equal(exercise.rest, source.workouts[0].exercises[0].rest);
    const assigned = buildClientWorkoutsFromTemplate(hydrated)[0].exercises[0];
    assert.equal(assigned.exerciseCardId, card.id);
    assert.deepEqual(assigned.sets.map(set => String(set.weight)), exercise.sets.map(set => String(set.weight)));
  }
  const payload = await readClientExerciseMedia({ db, context: { uid: "client", role: "client" }, clientId: "client" });
  const client = withClientExerciseMedia(workout, payload.media).exercises[0];
  assert.equal(client.video, card.video); assert.equal(client.name, card.name);
  assert.equal(getBasicWorkoutExerciseTechniqueHint(client), card.technique);
  assert.deepEqual(client.sets, movement.sets); assert.equal(client.rest, movement.rest);
  assert.deepEqual([...db.documents].filter(([path]) => !path.startsWith("trainerExerciseCards/")), before);
});

test("stable card identity survives repeated edits, new assignments, local saves and renamed media", async () => {
  const { db, save, template } = fixture();
  const { card } = await save();
  const copy = mapTemplateExerciseCards(template, [card]).workouts[0].exercises[0];
  const { card: updated } = await manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id, revision: card.revision, patch: { name: "Новое название", video: "https://example.test/third.mp4", technique: "Третья версия" } } });
  const resolved = applyExerciseCard(copy, findExerciseCard(copy, [updated], "trainer"));
  assert.equal(resolved.video, updated.video); assert.equal(resolved.name, updated.name);
  assert.equal(exerciseCardReference(resolved).exerciseCardId, card.id);
  assert.deepEqual(resolved.exerciseCardOverrides, {});
  const library = buildTrainerExerciseLibraryItems({}, [template], { cards: [updated] });
  assert.equal(library.length, 1); assert.equal(library[0].name, updated.name);
  assert.equal("sets" in library[0], false);
});

test("local metadata overrides remain local, including explicit video removal; load never changes prescription", async () => {
  const { save } = fixture(); const { card } = await save();
  const linked = applyExerciseCard(movement, card);
  const edited = { ...linked, video: "https://example.test/private.mp4", technique: "Моя инструкция", sets: [{ reps: 7, weight: 99 }] };
  const next = { ...card, name: "Общее имя", video: "https://example.test/next.mp4", technique: "Общая инструкция" };
  const resolved = applyExerciseCard(edited, next);
  assert.equal(resolved.video, edited.video); assert.equal(resolved.technique, edited.technique); assert.equal(resolved.name, next.name);
  assert.deepEqual(resolved.sets, edited.sets);
  const cleared = applyExerciseCard({ ...linked, video: "", videoUrl: "", videoURL: "" }, next);
  assert.equal(cleared.video, "");
  const removedShared = applyExerciseCard(linked, { ...card, video: "", technique: "" });
  assert.equal(removedShared.video, ""); assert.equal(removedShared.videoUrl, "");
  assert.equal(getBasicWorkoutExerciseTechniqueHint(removedShared, "fallback"), "fallback");
});

test("different demonstrations, technique and trainer owners never merge; unmatched private copies keep their media", async () => {
  const { save, workout } = fixture(); const { card } = await save();
  assert.equal(findExerciseCard({ ...movement, video: "https://example.test/private.mp4" }, [card], "trainer"), null);
  assert.equal(findExerciseCard({ ...movement, technique: "Особая техника" }, [card], "trainer"), null);
  assert.equal(findExerciseCard(movement, [card], "other"), null);
  assert.equal(findExerciseCard({ ...movement, exerciseCardId: card.id, exerciseCardOwnerUid: "other" }, [card], "trainer"), null);
  assert.equal(findExerciseCard(movement, [card, { ...card, id: "ambiguous" }], "trainer"), null);
  for (const patch of [{ completed: true }, { status: "completed" }, { completedAt: "today" }, { assignedProgramLifecycleStatus: "archived" }, { source: "basic" }]) {
    const history = { ...workout, ...patch };
    assert.deepEqual(resolveClientExerciseMedia([history], [], "trainer", [card]), []);
    assert.deepEqual(withClientExerciseMedia(history, [{ workoutId: history.id, exerciseId: movement.id, exerciseName: movement.name, assignmentVersion: "v1", card }]), history);
  }
});

test("card creation and deletion never mutate programmes; deleted card stays available to linked assignments", async () => {
  const { db, save, workout } = fixture();
  const { card } = await save();
  const { card: deleted } = await manageTrainerExerciseCards({ db, context, body: { action: "delete", cardId: card.id, revision: card.revision } });
  assert.equal(buildTrainerExerciseLibraryItems({}, [], { cards: [deleted] }).length, 0);
  assert.equal(resolveClientExerciseMedia([workout], [], "trainer", [deleted]).length, 1);
  const { card: restored } = await manageTrainerExerciseCards({ db, context, body: { action: "restore", cardId: card.id, revision: deleted.revision } });
  assert.equal(restored.deletedAt, "");
  const { card: created } = await manageTrainerExerciseCards({ db, context, body: { action: "create", creationId: "new", patch: { name: "Новое упражнение", video: "", technique: "" } } });
  assert.equal(created.id, "new"); assert.equal("sets" in created, false);
  assert.ok(db.writes.every(path => path.startsWith("trainerExerciseCards/")));
});

test("a unique active same-name card replaces a deleted link without changing its prescription", () => {
  const deleted = {
    id: "deleted-card", ownerUid: "trainer", ...exerciseCardMetadata(movement),
    deletedAt: "2026-09-25T10:00:00.000Z", revision: 1, updatedAt: "2026-09-25T10:00:00.000Z"
  };
  const replacement = {
    ...deleted, id: "replacement-card", video: "https://example.test/replacement.mp4",
    deletedAt: "", revision: 1, updatedAt: "2026-09-26T10:00:00.000Z", previousNames: []
  };
  const linked = applyExerciseCard(movement, deleted);
  const workout = { id: "day", assignedBy: "trainer", assignedProgramUpdatedAt: "v1", exercises: [linked] };
  const mapped = mapTemplateExerciseCards({ ownerUid: "trainer", workouts: [{ exercises: [linked] }] }, [deleted, replacement]);
  assert.equal(mapped.workouts[0].exercises[0].exerciseCardId, replacement.id);
  assert.deepEqual(mapped.workouts[0].exercises[0].sets, movement.sets);
  const media = resolveClientExerciseMedia([workout], [], "trainer", [deleted, replacement]);
  assert.equal(media[0].card.id, replacement.id);
  const current = withClientExerciseMedia(workout, media).exercises[0];
  assert.equal(current.exerciseCardId, replacement.id);
  assert.equal(current.video, replacement.video);
  assert.deepEqual(current.sets, movement.sets);
  assert.equal(current.rest, movement.rest);
});

test("replacement by name does not guess between equally dated duplicate cards", () => {
  const deleted = {
    id: "deleted-card", ownerUid: "trainer", ...exerciseCardMetadata(movement),
    deletedAt: "2026-09-25T10:00:00.000Z", revision: 1, updatedAt: "2026-09-25T10:00:00.000Z"
  };
  const linked = applyExerciseCard(movement, deleted);
  const workout = { id: "day", assignedBy: "trainer", assignedProgramUpdatedAt: "v1", exercises: [linked] };
  const replacement = { ...deleted, id: "replacement-card", deletedAt: "", video: "https://example.test/new.mp4" };
  const duplicate = { ...replacement, id: "duplicate-card", video: "https://example.test/other.mp4" };
  const media = resolveClientExerciseMedia([workout], [], "trainer", [deleted, replacement, duplicate]);
  assert.equal(media[0].card.id, deleted.id);
  assert.equal(media[0].card.video, deleted.video);
});

test("server rejects prescription fields, invalid media, cross-owner access and stale revisions", async () => {
  const { db, save } = fixture(); const { card } = await save();
  for (const patch of [{ sets: [] }, { rest: "1" }, { weight: 220 }, { name: "" }, { video: "javascript:alert(1)" }]) {
    await assert.rejects(manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id, revision: 1, patch } }), { status: 400 });
  }
  for (const forbidden of [{ uid: "client", role: "client" }, { uid: "other", role: "trainer" }, { uid: "fake", role: "admin" }]) {
    await assert.rejects(manageTrainerExerciseCards({ db, context: forbidden, body: { action: "save", cardId: card.id, revision: 1, patch: { name: "Forbidden" } } }), { status: 403 });
  }
  await assert.rejects(save(), { status: 409 });
  await assert.rejects(manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id, revision: 0, patch: { name: "Stale" } } }), { status: 409 });
  assert.equal(db.writes.length, 1);
  const own = await manageTrainerExerciseCards({ db, context, body: { action: "list" } }); assert.equal(own.cards.length, 1);
  const other = await manageTrainerExerciseCards({ db, context: { uid: "other", role: "trainer" }, body: { action: "list" } }); assert.equal(other.cards.length, 0);
  assert.deepEqual(exerciseCardMetadata(own.cards[0]), exerciseCardMetadata(card));
});

test("adding and replacing an exercise retain its own card reference and never import another prescription", async () => {
  const { save } = fixture(); const { card } = await save();
  const item = buildTrainerExerciseLibraryItems({}, [], { cards: [card] })[0];
  const identity = getTrainerExercisePresentationIdentity(item);
  assert.equal(identity.exerciseCardId, card.id); assert.equal(identity.technique, card.technique);
  const alternative = createTrainerExerciseAlternative({ ...item, ...identity });
  const previous = { ...movement, exerciseCardId: "previous-card", exerciseCardOwnerUid: "trainer", trainerAlternatives: [alternative] };
  const replacement = replaceTrainerAssignedExerciseInWorkout({ exercises: [previous] }, previous.id, alternative).replacement;
  assert.equal(replacement.exerciseCardId, card.id); assert.deepEqual(replacement.sets, previous.sets); assert.equal(replacement.rest, previous.rest);
  const next = applyExerciseCard(replacement, { ...card, video: "https://example.test/next.mp4" });
  assert.equal(next.video, "https://example.test/next.mp4");
});

test("a renamed card still finds old exercise history without changing that history", async () => {
  const { save } = fixture(); const { card } = await save();
  const history = [{ id: "completed", date: "2026-09-01", exercises: [{ ...movement, id: "old-history-id", sets: [{ reps: 12, weight: 110, completed: true }] }] }];
  const before = structuredClone(history);
  const linked = applyExerciseCard({ ...movement, id: "new-slot-id" }, card);
  const result = getExerciseActualProgress(history, linked);
  assert.ok(result.sessions.length > 0);
  assert.deepEqual(history, before);
});

test("linked trainer alternatives receive current metadata before replacement and admin-assigned owned templates work", async () => {
  const { save, template, workout } = fixture(); const { card } = await save();
  const original = { ...workout, assignedBy: "admin", exercises: [{ id: "different", name: "Другое упражнение", video: "private.mp4", sets: [{ reps: 8, weight: 40 }], trainerAlternatives: [{ ...movement, libraryExerciseId: "press" }] }] };
  const result = withClientExerciseMedia(original, resolveClientExerciseMedia([original], [template], "trainer", [card]));
  assert.equal(result.exercises[0].video, "private.mp4");
  assert.equal(result.exercises[0].trainerAlternatives[0].video, card.video);
  assert.deepEqual(result.exercises[0].sets, original.exercises[0].sets);
});

test("legacy empty or inherited video uses the current card, not the stale media in its source template", async () => {
  const { save, template, workout } = fixture(); const { card } = await save();
  for (const patch of [{ video: "" }, { video: "https://example.test/older.mp4", videoAutoFilledFrom: movement.name }, { id: "old-without-id-match", video: "" }]) {
    const legacy = { ...workout, exercises: [{ ...movement, ...patch }] };
    const resolved = withClientExerciseMedia(legacy, resolveClientExerciseMedia([legacy], [template], "trainer", [card])).exercises[0];
    assert.equal(resolved.video, card.video);
    assert.equal(resolved.exerciseCardId, card.id);
    assert.deepEqual(resolved.sets, movement.sets);
  }
});

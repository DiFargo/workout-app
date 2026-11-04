import { exerciseLibraryNameKey } from "./exerciseLibraryIdentity.js";
import { normalizeExerciseVideoCrop } from "./exerciseVideoCrop.js";
import { normalizeExerciseVideoPosterTime } from "./exerciseVideoPoster.js";
import { exerciseVideoPriorityTime } from "./exerciseVideoPriority.js";

const text = (value) => typeof value === "string" ? value.trim() : "";
export const exerciseVideo = (exercise = {}) => text(exercise.video || exercise.videoUrl || exercise.videoURL);
export const exerciseTechnique = (exercise = {}) => text(exercise.exerciseCardId && Object.hasOwn(exercise, "technique")
  ? exercise.technique : exercise.technique || exercise.description || exercise.note);

// A legacy identity deliberately excludes prescription. Different demonstrations
// or instructions are never merged just because their movement names match.
export function exerciseCardLegacyKey(exercise = {}) {
  return JSON.stringify([exerciseLibraryNameKey(exercise.name), exerciseVideo(exercise), exerciseTechnique(exercise)]);
}

export function exerciseCardMetadata(exercise = {}) {
  return { name: text(exercise.name), video: exerciseVideo(exercise), technique: exerciseTechnique(exercise),
    muscleGroup: text(exercise.muscleGroup), videoPoster: text(exercise.videoPoster), videoThumbnail: text(exercise.videoThumbnail),
    videoCrop: exerciseVideo(exercise) ? normalizeExerciseVideoCrop(exercise.videoCrop) : null,
    videoPosterTime: exerciseVideo(exercise) ? normalizeExerciseVideoPosterTime(exercise.videoPosterTime) : null };
}

// Preserve existing catalogue/illustration identity when a legacy item becomes
// a card. None of these fields prescribes sets, weight, repetitions or rest.
export function exerciseCardPresentationIdentity(source = {}) {
  const fields = ["basicExerciseId", "basicExerciseLibraryId", "basicExerciseGroupId", "basicExerciseGroupTitle",
    "basicExerciseImageUrl", "imageUrl", "image", "thumbnail", "equipment", "sourceId"];
  return { ...Object.fromEntries(fields.filter((field) => text(source[field])).map((field) => [field, text(source[field])])),
    ...(source.libraryExerciseId || source.id ? { libraryExerciseId: text(source.libraryExerciseId || source.id) } : {}) };
}

export function publicExerciseCard(card) {
  return { id: card.id, ownerUid: card.ownerUid, ...exerciseCardMetadata(card), previousNames: card.previousNames || [] };
}

export function findExerciseCard(exercise, cards = [], ownerUid = "") {
  const owned = cards.filter((card) => card.ownerUid === ownerUid);
  if (exercise.exerciseCardId) {
    if (exercise.exerciseCardOwnerUid && exercise.exerciseCardOwnerUid !== ownerUid) return null;
    return owned.find((card) => card.id === exercise.exerciseCardId) || null;
  }
  const key = exerciseCardLegacyKey(exercise);
  const matches = owned.filter((card) => (card.legacyKeys || []).includes(key));
  return matches.length === 1 ? matches[0] : null;
}

// A soft-deleted card remains linked to existing programmes for continuity.
// If the trainer creates a replacement with the same reviewed name, use that
// active card instead. Never guess between equally plausible duplicates.
export function findCurrentExerciseCard(exercise, cards = [], ownerUid = "") {
  const linked = findExerciseCard(exercise, cards, ownerUid);
  if (!linked?.deletedAt) return linked;

  const names = new Set([
    exercise?.name,
    linked.name,
    ...(Array.isArray(exercise?.exerciseCardNames) ? exercise.exerciseCardNames : []),
    ...(Array.isArray(linked.previousNames) ? linked.previousNames : [])
  ].map(exerciseLibraryNameKey).filter(Boolean));
  if (!names.size) return linked;

  const replacements = cards.filter((card) => {
    if (card.ownerUid !== ownerUid || card.deletedAt) return false;
    const cardNames = [card.name, ...(Array.isArray(card.previousNames) ? card.previousNames : [])]
      .map(exerciseLibraryNameKey).filter(Boolean);
    return cardNames.some((name) => names.has(name));
  });
  const uniqueReplacements = [...new Map(replacements.map((card) => [card.id, card])).values()];
  if (uniqueReplacements.length === 1) return uniqueReplacements[0];
  if (uniqueReplacements.length < 2) return linked;

  const dated = uniqueReplacements.map((card) => ({ card, time: exerciseVideoPriorityTime({
    ...card, exerciseCardId: card.id
  }) }));
  const latestTime = Math.max(0, ...dated.map((item) => item.time));
  const latest = dated.filter((item) => item.time === latestTime);
  return latestTime > 0 && latest.length === 1 ? latest[0].card : linked;
}

export function applyExerciseCard(exercise, card) {
  if (!card || (exercise.exerciseCardOwnerUid && exercise.exerciseCardOwnerUid !== card.ownerUid)) return exercise;
  const metadata = exerciseCardMetadata(card);
  const original = exerciseCardMetadata(exercise);
  const baseline = exercise.exerciseCardSnapshot;
  const overrides = { ...(exercise.exerciseCardOverrides || {}) };
  // A local edit after linking is an intentional per-program exception. Retain
  // it even when the shared card later changes; never inspect/replace sets.
  for (const field of Object.keys(metadata)) {
    if (baseline && Object.hasOwn(baseline, field) && JSON.stringify(original[field]) !== JSON.stringify(baseline[field])) overrides[field] = true;
  }
  const resolved = Object.fromEntries(Object.entries(metadata).filter(([field]) => !overrides[field]));
  // A different, local video must never inherit framing for the shared source.
  if (overrides.video && !overrides.videoCrop) resolved.videoCrop = null;
  if (overrides.video && !overrides.videoPosterTime) resolved.videoPosterTime = null;
  // A local timestamp belongs to its old source, not to a replacement shared
  // clip. A cleared video cannot retain any selected frame either.
  if (Object.hasOwn(resolved, "video") && resolved.video !== original.video) {
    resolved.videoPosterTime = metadata.videoPosterTime;
    delete overrides.videoPosterTime;
  }
  if (!exerciseVideo({ ...exercise, ...resolved })) resolved.videoPosterTime = null;
  if (Object.hasOwn(resolved, "video")) Object.assign(resolved, { videoUrl: "", videoURL: "" });
  return { ...exercise, ...resolved, exerciseCardId: card.id, exerciseCardOwnerUid: card.ownerUid,
    exerciseCardNames: card.previousNames || [],
    exerciseCardSnapshot: metadata, exerciseCardOverrides: overrides };
}

export function mapTemplateExerciseCards(value, cards = [], ownerUid = value?.ownerUid || "") {
  if (Array.isArray(value)) return value.map((item) => mapTemplateExerciseCards(item, cards, ownerUid));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    key === "exercises" && Array.isArray(child)
      ? child.map((exercise) => {
        const resolved = applyExerciseCard(exercise, findCurrentExerciseCard(exercise, cards, ownerUid));
        return Array.isArray(resolved.trainerAlternatives) ? { ...resolved,
          trainerAlternatives: resolved.trainerAlternatives.map((alternative) => applyExerciseCard(alternative, findCurrentExerciseCard(alternative, cards, ownerUid))) } : resolved;
      })
      : mapTemplateExerciseCards(child, cards, ownerUid)
  ]));
}

export function exerciseCardReference(exercise = {}) {
  return exercise.exerciseCardId ? { exerciseCardId: exercise.exerciseCardId,
    exerciseCardOwnerUid: exercise.exerciseCardOwnerUid || "",
    exerciseCardSnapshot: exercise.exerciseCardSnapshot || exerciseCardMetadata(exercise),
    exerciseCardNames: exercise.exerciseCardNames || exercise.previousNames || [],
    exerciseCardOverrides: exercise.exerciseCardOverrides || {} } : {};
}

export function isExerciseCardWorkoutMutable(workout = {}) {
  return workout.source !== "basic" && !String(workout.assignedProgramUpdatedAt || "").startsWith("basic:") &&
    !["archived", "past"].includes(workout.assignedProgramLifecycleStatus) && !workout.completed && !workout.completedAt &&
    !["completed", "completed_off_date"].includes(workout.status);
}

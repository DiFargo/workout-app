import { exerciseLibraryNameKey, exerciseLibraryVariantKey } from "../../functions/exerciseLibraryIdentity.js";
import { findExerciseCard, exerciseCardMetadata, exerciseTechnique, exerciseCardPresentationIdentity } from "../../functions/exerciseCards.js";
import { exerciseCardLibraryItem } from "./trainerExerciseCards.js";
import { exerciseVideoPriorityTime, selectLatestExerciseVideo } from "../../functions/exerciseVideoPriority.js";

function getExerciseVideo(exercise = {}) {
  return String(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "").trim();
}

export function mergeTrainerExerciseLibraryItems(exercises = [], { includeDeleted = false } = {}) {
  const hasSource = (exercise) => Boolean(exercise.librarySource || exercise.sourceWorkoutId);
  const preferSource = (candidate, current) => {
    if (!current) return true;
    if (getExerciseVideo(candidate) && getExerciseVideo(current)) {
      const mediaTimeDifference = exerciseVideoPriorityTime(candidate) - exerciseVideoPriorityTime(current);
      if (mediaTimeDifference) return mediaTimeDifference > 0;
    }
    const candidateCard = Boolean(candidate.exerciseCardId);
    const currentCard = Boolean(current.exerciseCardId);
    if (candidateCard !== currentCard) return candidateCard;
    if (candidateCard) {
      // Keep one real editable record, including its revision and tombstone.
      // A deleted current card must not reveal an older duplicate underneath.
      const candidateTime = String(candidate.updatedAt || candidate.createdAt || "");
      const currentTime = String(current.updatedAt || current.createdAt || "");
      if (candidateTime !== currentTime) return candidateTime > currentTime;
      return String(candidate.exerciseCardId) < String(current.exerciseCardId);
    }
    return !hasSource(current) && hasSource(candidate);
  };
  const groups = new Map();
  for (const exercise of exercises) {
    const name = exerciseLibraryNameKey(exercise?.name);
    if (!name) continue;
    const owner = exercise.exerciseCardOwnerUid || exercise.librarySource?.ownerUid || exercise.ownerUid || "";
    // A shared-card ID and a legacy template ID can describe the same library
    // item. Ownership, movement and technique define the display group, not ID.
    const key = JSON.stringify([owner, name, exerciseTechnique(exercise)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(exercise);
  }
  return [...groups.values()].flatMap((candidates) => {
    const videos = new Map();
    for (const exercise of candidates) {
      const video = getExerciseVideo(exercise);
      if (video && preferSource(exercise, videos.get(video))) videos.set(video, exercise);
    }
    // Prefer the latest saved video for this owner's exact movement/technique.
    // Keep undated/ambiguous demonstrations separate instead of guessing age.
    const latestVideo = selectLatestExerciseVideo([...videos.values()]);
    const selected = latestVideo ? [latestVideo, ...[...videos.values()].filter(item => item.libraryDeletedAt)] : videos.size ? [...videos.values()]
      : [candidates.reduce((current, candidate) => preferSource(candidate, current) ? candidate : current, null)];
    return selected.map((exercise) => {
      const item = { ...exercise };
      for (const field of ["muscleGroup", "groupId", "basicExerciseGroupId", "basicExerciseGroupTitle"]) {
        if (item[field]) continue;
        const values = [...new Set(candidates.map((entry) => entry[field]).filter(Boolean))];
        if (values.length === 1) item[field] = values[0];
      }
      return item;
    });
  }).filter((exercise) => includeDeleted || !exercise.libraryDeletedAt);
}

function getTemplateWorkouts(template = {}) {
  const templateBlocks = Array.isArray(template.blocks)
    ? template.blocks
    : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);

  return [
    ...(template.workouts || []),
    ...templateBlocks.flatMap((block) =>
      (block.weeks || []).flatMap((week) => week.workouts || [])
    )
  ];
}

export function buildTrainerExerciseLibraryItems(plan = {}, templates = [], options = {}) {
  if (Array.isArray(options.cards)) {
    const cards = options.cards;
    const representedEmptyCopies = new Set();
    const cardVersions = new Map();
    const rememberVersion = (key, card) => {
      if (!cardVersions.has(key)) cardVersions.set(key, []);
      cardVersions.get(key).push(card);
    };
    for (const card of cards) {
      rememberVersion(JSON.stringify([card.ownerUid, exerciseLibraryNameKey(card.name), exerciseTechnique(card)]), card);
      for (const legacyKey of card.legacyKeys || []) {
        try {
          const identity = JSON.parse(legacyKey);
          if (Array.isArray(identity) && identity.length === 3 && identity.every(value => typeof value === "string")) {
            const key = JSON.stringify([card.ownerUid, exerciseLibraryNameKey(identity[0]), identity[2]]);
            representedEmptyCopies.add(key);
            rememberVersion(key, card);
          }
        } catch { /* Ignore malformed old identities; never hide based on a guess. */ }
      }
    }
    const isUnrepresented = (exercise, owner) => {
      if (findExerciseCard(exercise, cards, owner)) return false;
      const key = JSON.stringify([owner, exerciseLibraryNameKey(exercise.name), exerciseTechnique(exercise)]);
      if (!getExerciseVideo(exercise)) return !representedEmptyCopies.has(key);
      // A saved replacement stays authoritative after its card is renamed or
      // the technique is edited; stale filmed template copies must not return.
      const versions = cardVersions.get(key) || [];
      const latest = selectLatestExerciseVideo([...versions, exercise]);
      return !latest || !versions.includes(latest);
    };
    const legacy = templates.flatMap((template) => getTemplateWorkouts(template).flatMap((workout) =>
      (workout.exercises || []).filter((exercise) => isUnrepresented(exercise, template.ownerUid))
        .map((exercise) => ({
        id: exercise.id, ...exerciseCardPresentationIdentity(exercise), ...exerciseCardMetadata(exercise), libraryDeletedAt: exercise.libraryDeletedAt || "",
        ...(exercise.videoUpdatedAt ? { videoUpdatedAt: exercise.videoUpdatedAt } : {}),
        librarySource: { type: "template", templateId: template.id, ownerUid: template.ownerUid }
      }))
    ));
    return mergeTrainerExerciseLibraryItems([...cards.map(exerciseCardLibraryItem), ...legacy], options);
  }
  const sources = [
    ...(plan.workouts || []).flatMap((workout) => (workout.exercises || []).map((exercise) => ({
      exercise,
      librarySource: { type: "plan", workoutId: workout.id || "" }
    }))),
    ...(Array.isArray(templates) ? templates : []).flatMap((template) => getTemplateWorkouts(template).flatMap((workout) =>
      (workout.exercises || []).map((exercise) => ({
        exercise,
        librarySource: { type: "template", templateId: template.id || "", ...(template.ownerUid ? { ownerUid: template.ownerUid } : {}) }
      }))
    ))
  ];
  return mergeTrainerExerciseLibraryItems(sources.map(({ exercise, librarySource }) => ({ ...exercise, librarySource })), options);
}

// Library visibility is separate from the exercise's place in a programme.
// Match the exact video variant across repeated days and copied templates.
export function setTrainerLibraryVariantDeleted(value, exercise, deletedAt) {
  if (Array.isArray(value)) return value.map((item) => setTrainerLibraryVariantDeleted(item, exercise, deletedAt));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    key === "exercises" && Array.isArray(item)
      ? item.map((entry) => exerciseLibraryVariantKey(entry) === exerciseLibraryVariantKey(exercise)
        ? { ...entry, libraryDeletedAt: deletedAt } : entry)
      : setTrainerLibraryVariantDeleted(item, exercise, deletedAt)
  ]));
}

export function patchExerciseInTrainerTemplate(value, exerciseId, patch) {
  if (Array.isArray(value)) {
    return value.map((item) => patchExerciseInTrainerTemplate(item, exerciseId, patch));
  }
  if (!value || typeof value !== "object") return value;

  const isExercise = value.id === exerciseId && (
    Array.isArray(value.sets)
    || "requiresWeight" in value
    || "usesWeight" in value
  );
  const current = isExercise ? { ...value, ...patch } : value;

  return Object.fromEntries(
    Object.entries(current).map(([key, item]) => [key, patchExerciseInTrainerTemplate(item, exerciseId, patch)])
  );
}

export function removeExerciseFromTrainerTemplate(value, exerciseId) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(item && typeof item === "object" && item.id === exerciseId && (
        Array.isArray(item.sets)
        || "requiresWeight" in item
        || "usesWeight" in item
      )))
      .map((item) => removeExerciseFromTrainerTemplate(item, exerciseId));
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, removeExerciseFromTrainerTemplate(item, exerciseId)])
  );
}

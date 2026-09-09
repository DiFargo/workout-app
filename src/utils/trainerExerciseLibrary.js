import { exerciseLibraryNameKey, exerciseLibraryVariantKey } from "../../functions/exerciseLibraryIdentity.js";

function getExerciseVideo(exercise = {}) {
  return String(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "").trim();
}

export function mergeTrainerExerciseLibraryItems(exercises = [], { includeDeleted = false } = {}) {
  const hasSource = (exercise) => Boolean(exercise.librarySource || exercise.sourceWorkoutId);
  const groups = new Map();
  for (const exercise of exercises) {
    const key = exerciseLibraryNameKey(exercise?.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(exercise);
  }
  return [...groups.values()].flatMap((candidates) => {
    const videos = new Map();
    for (const exercise of candidates) {
      const video = getExerciseVideo(exercise);
      if (video && (!videos.has(video) || (!hasSource(videos.get(video)) && hasSource(exercise)))) videos.set(video, exercise);
    }
    // Keep every distinct video. Empty copies never replace a filmed version.
    // Keep the winning source/id together so editing opens that exact record.
    return [...(videos.size ? videos.values() : [candidates.find(hasSource) || candidates[0]])].map((exercise) => {
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
  const sources = [
    ...(plan.workouts || []).flatMap((workout) => (workout.exercises || []).map((exercise) => ({
      exercise,
      librarySource: { type: "plan", workoutId: workout.id || "" }
    }))),
    ...(Array.isArray(templates) ? templates : []).flatMap((template) => getTemplateWorkouts(template).flatMap((workout) =>
      (workout.exercises || []).map((exercise) => ({
        exercise,
        librarySource: { type: "template", templateId: template.id || "" }
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

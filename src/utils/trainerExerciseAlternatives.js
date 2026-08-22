const ALTERNATIVE_FIELDS = Object.freeze([
  "id",
  "name",
  "video",
  "videoUrl",
  "videoURL",
  "image",
  "thumbnail",
  "imageUrl",
  "muscleGroup",
  "requiresWeight",
  "usesWeight",
  "equipment",
  "note",
  "description",
  "technique",
  "sourceId",
  "basicExerciseId",
  "basicExerciseLibraryId",
  "basicExerciseGroupId",
  "basicExerciseGroupTitle",
  "basicExerciseImageUrl"
]);

// One planned exercise can have two trainer-approved substitutions.
export const MAX_TRAINER_EXERCISE_ALTERNATIVES = 2;

function normalizedName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е");
}

function safeAlternative(item = {}) {
  if (!item || typeof item !== "object" || !String(item.name || "").trim()) return null;

  const alternative = ALTERNATIVE_FIELDS.reduce((result, field) => {
    if (item[field] !== undefined && item[field] !== null && item[field] !== "") {
      result[field] = item[field];
    }
    return result;
  }, {});
  const id = String(item.libraryExerciseId || item.id || item.sourceId || item.name).trim();

  return {
    ...alternative,
    id,
    libraryExerciseId: id,
    name: String(item.name).trim(),
    assignedByTrainer: true
  };
}

/**
 * A compact snapshot is stored in a trainer's programme, so an assignment does
 * not depend on later changes to the common exercise library.
 */
export function createTrainerExerciseAlternative(libraryExercise = {}) {
  return safeAlternative(libraryExercise);
}

export function getTrainerExerciseAlternatives(exercise = {}) {
  const alternatives = Array.isArray(exercise?.trainerAlternatives)
    ? exercise.trainerAlternatives
    : [];
  const seen = new Set();

  return alternatives.reduce((result, item) => {
    if (result.length >= MAX_TRAINER_EXERCISE_ALTERNATIVES) return result;
    const alternative = safeAlternative(item);
    if (!alternative) return result;
    const key = `${alternative.libraryExerciseId}:${normalizedName(alternative.name)}`;
    if (seen.has(key)) return result;
    seen.add(key);
    result.push(alternative);
    return result;
  }, []);
}

export function replaceTrainerAssignedExerciseInWorkout(workout = {}, exerciseId = "", selectedAlternative = {}) {
  let replacement = null;
  const exercises = (Array.isArray(workout?.exercises) ? workout.exercises : []).map((exercise) => {
    if (exercise?.id !== exerciseId) return exercise;

    const alternative = getTrainerExerciseAlternatives(exercise).find((item) => (
      String(item.libraryExerciseId || item.id) === String(selectedAlternative?.libraryExerciseId || selectedAlternative?.id)
        && normalizedName(item.name) === normalizedName(selectedAlternative?.name)
    ));
    if (!alternative) return exercise;

    replacement = {
      ...exercise,
      name: alternative.name,
      video: alternative.video || alternative.videoUrl || alternative.videoURL || "",
      image: alternative.image || alternative.thumbnail || "",
      thumbnail: alternative.thumbnail || alternative.image || "",
      muscleGroup: alternative.muscleGroup || exercise.muscleGroup || "",
      requiresWeight: alternative.requiresWeight ?? alternative.usesWeight ?? exercise.requiresWeight,
      usesWeight: alternative.requiresWeight ?? alternative.usesWeight ?? exercise.usesWeight,
      equipment: alternative.equipment || exercise.equipment || "",
      note: alternative.note || alternative.description || exercise.note || "",
      description: alternative.description || alternative.note || exercise.description || "",
      technique: alternative.technique || alternative.note || exercise.technique || "",
      sourceId: alternative.sourceId || exercise.sourceId || "",
      basicExerciseId: alternative.basicExerciseId || exercise.basicExerciseId || "",
      basicExerciseLibraryId: alternative.basicExerciseLibraryId || exercise.basicExerciseLibraryId || "",
      basicExerciseGroupId: alternative.basicExerciseGroupId || exercise.basicExerciseGroupId || "",
      basicExerciseGroupTitle: alternative.basicExerciseGroupTitle || exercise.basicExerciseGroupTitle || "",
      basicExerciseImageUrl: alternative.basicExerciseImageUrl || exercise.basicExerciseImageUrl || "",
      imageUrl: alternative.imageUrl || exercise.imageUrl || "",
      libraryExerciseId: alternative.libraryExerciseId || exercise.libraryExerciseId || "",
      trainerReplacementOf: exercise.trainerReplacementOf || exercise.name || "",
      trainerSelectedAlternativeId: alternative.libraryExerciseId || alternative.id,
      trainerReplacementChangedAt: new Date().toISOString()
    };

    return replacement;
  });

  return {
    workout: { ...workout, exercises },
    replacement
  };
}

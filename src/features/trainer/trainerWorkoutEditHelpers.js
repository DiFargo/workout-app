import {
  exerciseUsesExternalWeight,
  findExerciseLibraryMatch
} from "../../utils/auditSafety.js";

const DEFAULT_EXERCISE_NAME = "\u041d\u043e\u0432\u043e\u0435 \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u0435";
const ABS_EXERCISE_MARKER = "\u041f\u0440\u0435\u0441\u0441";
const DEFAULT_REST_LABEL = "90 \u0441\u0435\u043a";

function getExerciseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// A trainer's custom library can carry a visual identity independently from
// its displayed title.  Persist this compact snapshot in every new plan item
// so a client assignment can keep resolving the correct muscle illustration.
export function getTrainerExercisePresentationIdentity(sourceExercise = {}) {
  const source = sourceExercise && typeof sourceExercise === "object" ? sourceExercise : {};
  const libraryExerciseId = getExerciseText(source.libraryExerciseId) || getExerciseText(source.id);
  const basicExerciseLibraryId = getExerciseText(source.basicExerciseLibraryId)
    || getExerciseText(source.basicExerciseId);
  const basicExerciseGroupId = getExerciseText(source.basicExerciseGroupId)
    || getExerciseText(source.groupId);
  const fields = {
    libraryExerciseId,
    sourceId: getExerciseText(source.sourceId),
    basicExerciseId: getExerciseText(source.basicExerciseId),
    basicExerciseLibraryId,
    basicExerciseGroupId,
    basicExerciseGroupTitle: getExerciseText(source.basicExerciseGroupTitle),
    basicExerciseImageUrl: getExerciseText(source.basicExerciseImageUrl),
    imageUrl: getExerciseText(source.imageUrl),
    image: getExerciseText(source.image),
    thumbnail: getExerciseText(source.thumbnail),
    muscleGroup: getExerciseText(source.muscleGroup),
    equipment: getExerciseText(source.equipment)
  };

  return Object.entries(fields).reduce((identity, [field, value]) => {
    if (value) identity[field] = value;
    return identity;
  }, {});
}

export function normalizeTrainerNextExerciseDefaults(
  exerciseName = DEFAULT_EXERCISE_NAME,
  trainerExerciseLibraryItems = []
) {
  const sourceExercise = findExerciseLibraryMatch(trainerExerciseLibraryItems, exerciseName);
  const exercise = sourceExercise || { name: exerciseName };
  const exerciseUsesWeight = exerciseUsesExternalWeight(exercise);
  const defaultReps = exerciseName.includes(ABS_EXERCISE_MARKER) ? 15 : 8;
  const sourceVideo = exercise.video || exercise.videoUrl || exercise.videoURL || "";

  return {
    id: `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...getTrainerExercisePresentationIdentity(sourceExercise),
    name: String(exerciseName).trim() || DEFAULT_EXERCISE_NAME,
    requiresWeight: exerciseUsesWeight,
    usesWeight: exerciseUsesWeight,
    rest: DEFAULT_REST_LABEL,
    video: sourceVideo,
    videoAutoFilledFrom: sourceVideo ? exercise.name : "",
    sets: [{ reps: defaultReps, weight: "", enteredReps: "", enteredWeight: "" }]
  };
}

export function mapTrainerNextWorkoutSetExercise(workouts, workoutId, _exerciseId, patcher) {
  return (workouts || []).map((workoutItem) => {
    if (workoutItem.id !== workoutId) return workoutItem;
    return {
      ...workoutItem,
      exercises: patcher(Array.isArray(workoutItem.exercises) ? workoutItem.exercises : [])
    };
  });
}

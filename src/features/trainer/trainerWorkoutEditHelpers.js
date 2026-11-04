import {
  exerciseUsesExternalWeight,
  findExerciseLibraryMatch
} from "../../utils/auditSafety.js";
import { exerciseCardLegacyKey, exerciseCardMetadata, exerciseCardReference, exerciseTechnique } from "../../../functions/exerciseCards.js";
import { normalizeExerciseVideoPosterTime } from "../../../functions/exerciseVideoPoster.js";

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
    ...exerciseCardReference(source),
    videoCrop: source.videoCrop || null,
    videoPosterTime: normalizeExerciseVideoPosterTime(source.videoPosterTime),
    technique: exerciseTechnique(source),
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
    if (value || (field === "videoPosterTime" && Object.hasOwn(source, field))) identity[field] = value;
    return identity;
  }, {});
}

// Selection is an explicit identity choice, never a best-effort name match.
// Read metadata from the current library so a stale picker row cannot restore
// an old video or pass arbitrary free-form data into a programme.
export function resolveTrainerLibraryExercise(sourceExercise, library = []) {
  if (!sourceExercise || typeof sourceExercise !== "object" || Array.isArray(sourceExercise)) return null;
  const id = getExerciseText(sourceExercise.id) || getExerciseText(sourceExercise.libraryExerciseId);
  const cardId = getExerciseText(sourceExercise.exerciseCardId)
    || (sourceExercise.librarySource?.type === "card" ? id : "");
  const owner = getExerciseText(sourceExercise.exerciseCardOwnerUid)
    || getExerciseText(sourceExercise.librarySource?.ownerUid) || getExerciseText(sourceExercise.ownerUid);
  const templateId = getExerciseText(sourceExercise.librarySource?.templateId);
  if (!id && !cardId) return null;
  const matches = (Array.isArray(library) ? library : []).filter((item) => {
    if (!item || !getExerciseText(item.name) || item.libraryDeletedAt || item.deletedAt || item.librarySource?.isNew) return false;
    const itemId = getExerciseText(item.id) || getExerciseText(item.libraryExerciseId);
    const itemCardId = getExerciseText(item.exerciseCardId)
      || (item.librarySource?.type === "card" ? itemId : "");
    const itemOwner = getExerciseText(item.exerciseCardOwnerUid)
      || getExerciseText(item.librarySource?.ownerUid) || getExerciseText(item.ownerUid);
    if (owner && owner !== itemOwner) return false;
    if (cardId) return cardId === itemCardId;
    if (templateId && templateId !== getExerciseText(item.librarySource?.templateId)) return false;
    return id === itemId;
  });
  return matches.length === 1 ? matches[0] : null;
}

// A replacement must clear the previous movement's complete identity/media,
// including empty values. Prescription and performed sets are not part of it.
export function getTrainerExerciseSelectionPatch(sourceExercise = {}, currentExercise = null) {
  const source = sourceExercise && typeof sourceExercise === "object" ? sourceExercise : {};
  const metadata = exerciseCardMetadata(source);
  const usesWeight = exerciseUsesExternalWeight(source);
  const cardId = (exercise) => getExerciseText(exercise?.exerciseCardId)
    || (exercise?.librarySource?.type === "card" ? getExerciseText(exercise.id) : "");
  const owner = (exercise) => getExerciseText(exercise?.exerciseCardOwnerUid)
    || getExerciseText(exercise?.librarySource?.ownerUid) || getExerciseText(exercise?.ownerUid);
  const currentCardId = cardId(currentExercise);
  const sourceCardId = cardId(source);
  const ownersMatch = !owner(currentExercise) || !owner(source) || owner(currentExercise) === owner(source);
  const currentLibraryId = getExerciseText(currentExercise?.libraryExerciseId);
  const sourceLibraryId = getExerciseText(source.libraryExerciseId) || getExerciseText(source.id);
  const sameMovement = currentExercise && ownersMatch && (currentCardId || sourceCardId
    ? currentCardId && currentCardId === sourceCardId
    : currentLibraryId && sourceLibraryId
      ? currentLibraryId === sourceLibraryId
      : getExerciseText(currentExercise.name) && getExerciseText(source.name)
        && exerciseCardLegacyKey(currentExercise) === exerciseCardLegacyKey(source));
  return {
    librarySelectionVersion: 1,
    exerciseCardId: "", exerciseCardOwnerUid: "", exerciseCardSnapshot: null,
    exerciseCardNames: [], exerciseCardOverrides: {}, libraryExerciseId: "", sourceId: "",
    basicExerciseId: "", basicExerciseLibraryId: "", basicExerciseGroupId: "",
    basicExerciseGroupTitle: "", basicExerciseImageUrl: "", imageUrl: "", image: "", thumbnail: "", equipment: "",
    originalExerciseId: "", sourceExerciseId: "", exerciseId: "", catalogueId: "", previousNames: [],
    ...getTrainerExercisePresentationIdentity(source),
    ...metadata,
    videoUrl: "", videoURL: "",
    // A legacy clip chosen explicitly is a snapshot, not permission to guess
    // another template's media by a reused old exercise id. Shared-card
    // references still resolve their current metadata before that fallback.
    videoAutoFilledFrom: source.exerciseCardId && metadata.video ? metadata.name : "",
    requiresWeight: usesWeight,
    usesWeight,
    // Alternatives belong to a movement, not its slot in the programme. Only
    // an explicit replacement clears them; load, weight edits and reselection
    // of the same library identity do not touch a trainer's chosen variants.
    ...(currentExercise && !sameMovement ? { trainerAlternatives: [] } : {})
  };
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

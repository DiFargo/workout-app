import { isExerciseCardWorkoutMutable } from "../../functions/exerciseCards.js";
import { normalizeExerciseVideoPosterTime } from "../../functions/exerciseVideoPoster.js";

const MEDIA_FIELDS = ["video", "videoUrl", "videoURL", "videoCrop", "videoPosterTime", "videoPoster", "videoThumbnail", "videoAutoFilledFrom"];
const SNAPSHOT_MEDIA_FIELDS = ["video", "videoCrop", "videoPosterTime", "videoPoster", "videoThumbnail"];
const ASSIGNMENT_FIELDS = ["source", "assignedProgramId", "assignedProgramAddedAt", "assignedProgramUpdatedAt", "assignedBy", "assignedAt", "programAssignmentId"];
const EXERCISE_IDENTITY_FIELDS = ["id", "name", "exerciseCardId", "exerciseCardOwnerUid", "libraryExerciseId", "sourceId", "trainerSelectedAlternativeId", "trainerReplacementChangedAt"];
const text = value => String(value ?? "").trim();
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sameFields = (left, right, fields) => fields.every(field => text(left?.[field]) === text(right?.[field]));
const videoOf = exercise => text(exercise?.video || exercise?.videoUrl || exercise?.videoURL);
const uniqueById = (items, id) => {
  const matches = (items || []).filter(item => item?.id === id);
  return matches.length === 1 ? matches[0] : null;
};

// Recognise only known Storage URL spellings. Arbitrary external query strings
// can select a different clip and must not be discarded when comparing sources.
export function canonicalWorkoutVideoSource(source) {
  const value = text(source);
  if (!value) return "";
  if (value.startsWith("gs://")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return value;
    const firebase = url.hostname === "firebasestorage.googleapis.com" && /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (firebase) return `gs://${decodeURIComponent(firebase[1])}/${decodeURIComponent(firebase[2])}`;
    const storage = url.hostname === "storage.googleapis.com" && /^\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (storage) return `gs://${decodeURIComponent(storage[1])}/${decodeURIComponent(storage[2])}`;
    const virtualBucket = /^(.*)\.storage\.googleapis\.com$/.exec(url.hostname);
    if (virtualBucket && url.pathname.length > 1) return `gs://${virtualBucket[1]}/${decodeURIComponent(url.pathname.slice(1))}`;
  } catch { /* Keep unrecognised/local references exact. */ }
  return value;
}

function locallyOverriddenVideo(exercise) {
  if (exercise?.exerciseCardOverrides?.video) return true;
  const baselineVideo = videoOf(exercise?.exerciseCardSnapshot);
  return Boolean(baselineVideo && canonicalWorkoutVideoSource(baselineVideo) !== canonicalWorkoutVideoSource(videoOf(exercise)));
}

function mergeExerciseMedia(current, baseline, resolved) {
  if (!sameFields(current, baseline, EXERCISE_IDENTITY_FIELDS) || locallyOverriddenVideo(current) ||
    canonicalWorkoutVideoSource(videoOf(current)) !== canonicalWorkoutVideoSource(videoOf(baseline))) return current;
  if (current.exerciseCardId && resolved.exerciseCardId && current.exerciseCardId !== resolved.exerciseCardId) return current;
  if (current.exerciseCardOwnerUid && resolved.exerciseCardOwnerUid && current.exerciseCardOwnerUid !== resolved.exerciseCardOwnerUid) return current;
  const localMediaChanges = MEDIA_FIELDS.some(field => !equal(current[field], baseline[field]) || current.exerciseCardOverrides?.[field]);
  if (canonicalWorkoutVideoSource(videoOf(resolved)) !== canonicalWorkoutVideoSource(videoOf(baseline)) && localMediaChanges) return current;
  const patch = Object.fromEntries(MEDIA_FIELDS.filter(field => Object.hasOwn(resolved, field) &&
    !current.exerciseCardOverrides?.[field] && equal(current[field], baseline[field]) && !equal(current[field], resolved[field]))
    .map(field => [field, resolved[field]]));
  if (!Object.keys(patch).length) return current;
  if (current.exerciseCardSnapshot && current.exerciseCardId === resolved.exerciseCardId) {
    const snapshotPatch = Object.fromEntries(SNAPSHOT_MEDIA_FIELDS.filter(field => Object.hasOwn(patch, field)).map(field => [field, patch[field]]));
    if (Object.keys(snapshotPatch).length) patch.exerciseCardSnapshot = { ...current.exerciseCardSnapshot, ...snapshotPatch };
  }
  return { ...current, ...patch };
}

// Optional metadata can arrive during a set. Merge only its presentation fields
// into the current plan; never replace runtime sets, notes or the prescription.
export function mergeLateWorkoutMedia(currentPlan, publishedPlan, resolvedPlan) {
  if (!currentPlan || !sameFields(currentPlan, publishedPlan, ASSIGNMENT_FIELDS) ||
    !Array.isArray(currentPlan.workouts)) return currentPlan;
  const workouts = currentPlan.workouts.map(current => {
    const baseline = uniqueById(publishedPlan?.workouts, current.id);
    const resolved = uniqueById(resolvedPlan?.workouts, current.id);
    if (!baseline || !resolved || !isExerciseCardWorkoutMutable(current) ||
      !sameFields(current, baseline, ASSIGNMENT_FIELDS)) return current;
    const exercises = (current.exercises || []).map(exercise => {
      const original = uniqueById(baseline.exercises, exercise.id);
      const candidate = uniqueById(resolved.exercises, exercise.id);
      return original && candidate ? mergeExerciseMedia(exercise, original, candidate) : exercise;
    });
    return exercises.every((exercise, index) => exercise === current.exercises[index]) ? current : { ...current, exercises };
  });
  return workouts.every((workout, index) => workout === currentPlan.workouts[index]) ? currentPlan : { ...currentPlan, workouts };
}

// A legacy draft may predate preview selection. Its performed sets win, but an
// absent frame can be filled from the fresh, same-source exercise on resume.
export function fillMissingDraftExercisePreview(draftExercise, freshExercise) {
  if (!freshExercise || draftExercise?.id !== freshExercise.id || locallyOverriddenVideo(draftExercise) ||
    draftExercise?.exerciseCardOverrides?.videoPosterTime ||
    normalizeExerciseVideoPosterTime(draftExercise?.videoPosterTime) !== null ||
    normalizeExerciseVideoPosterTime(freshExercise.videoPosterTime) === null) return draftExercise;
  for (const field of ["exerciseCardId", "exerciseCardOwnerUid"]) {
    if (text(draftExercise[field]) && text(freshExercise[field]) && text(draftExercise[field]) !== text(freshExercise[field])) return draftExercise;
  }
  const source = canonicalWorkoutVideoSource(videoOf(draftExercise));
  if (!source || source !== canonicalWorkoutVideoSource(videoOf(freshExercise))) return draftExercise;
  const videoPosterTime = normalizeExerciseVideoPosterTime(freshExercise.videoPosterTime);
  const snapshot = draftExercise.exerciseCardSnapshot;
  const canFillSnapshot = draftExercise.exerciseCardId && draftExercise.exerciseCardId === freshExercise.exerciseCardId &&
    snapshot && typeof snapshot === "object" && canonicalWorkoutVideoSource(videoOf(snapshot)) === source;
  // This is inherited metadata, not a local frame edit. Keep its existing
  // same-card baseline aligned so the next card update does not infer an override.
  return { ...draftExercise, videoPosterTime,
    ...(canFillSnapshot ? { exerciseCardSnapshot: { ...snapshot, videoPosterTime } } : {}) };
}

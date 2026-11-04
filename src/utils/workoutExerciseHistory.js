import { collection, documentId, getDocs, limit, orderBy, query, startAfter } from "firebase/firestore";
import { captureAuthSession } from "./authSession.js";
import { runSessionResource } from "./sessionResource.js";
import { getWorkoutHistoryRevision } from "./workoutHistoryRevision.js";
import { canonicalWorkoutVideoSource } from "./workoutMediaMerge.js";

export const RECENT_EXERCISE_HISTORY_LIMIT = 20;
const CACHE_MS = 60000;
const DEFAULT_TIMEOUT_MS = 10000;
const databaseKeys = new WeakMap();
const resourceGuards = new WeakMap();
const cursorRecords = new WeakMap();
const nextCursors = new WeakMap();
const generationBuckets = new WeakMap();
let databaseSequence = 0;
let cursorSequence = 0;

const failure = (code, message) => Object.assign(new Error(message), { code });
const text = value => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
const normalizeName = value => text(value).toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/\s+/g, " ");
const exerciseName = exercise => exercise?.name || exercise?.title || exercise?.exerciseName || "";
const videoOf = exercise => canonicalWorkoutVideoSource(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "");
const namesOf = exercise => new Set([exerciseName(exercise),
  ...(Array.isArray(exercise?.exerciseCardNames) ? exercise.exerciseCardNames : []),
  ...(Array.isArray(exercise?.previousNames) ? exercise.previousNames : [])].map(normalizeName).filter(Boolean));

function identities(exercise = {}) {
  const card = text(exercise.exerciseCardId);
  return {
    card,
    owner: text(exercise.exerciseCardOwnerUid),
    ids: new Set([
      ...[exercise.id, exercise.exerciseId, exercise.sourceExerciseId, exercise.originalExerciseId]
        .map(value => text(value) ? `id:${text(value)}` : ""),
      ...[exercise.basicExerciseId, exercise.basicExerciseLibraryId, exercise.libraryExerciseId, exercise.catalogueId]
        .map(value => text(value) ? `library:${text(value)}` : "")
    ].filter(Boolean))
  };
}

function matchesExercise(target, candidate) {
  const a = identities(target), b = identities(candidate);
  // Explicitly different cards/libraries win over any local-ID or name/video
  // fallback. Local IDs may be regenerated (or reused) in another assignment.
  if (a.card && b.card) {
    if (a.card !== b.card || a.owner && b.owner && a.owner !== b.owner) return false;
    if (a.owner && a.owner === b.owner) return true;
  }
  const aLibrary = [...a.ids].filter(id => id.startsWith("library:"));
  const bLibrary = [...b.ids].filter(id => id.startsWith("library:"));
  if (aLibrary.length && bLibrary.length) return aLibrary.some(id => b.ids.has(id));
  const targetName = normalizeName(exerciseName(target)), candidateName = normalizeName(exerciseName(candidate));
  const sameDirectName = Boolean(targetName && targetName === candidateName);
  const sameName = namesOf(target).has(candidateName);
  const targetVideo = videoOf(target), candidateVideo = videoOf(candidate);
  const sameVideo = Boolean(targetVideo && targetVideo === candidateVideo);
  const conflictingVideo = targetVideo && candidateVideo && !sameVideo;
  if ([...a.ids].some(id => b.ids.has(id))) {
    return !conflictingVideo && (!targetName || !candidateName || sameDirectName || sameVideo);
  }
  if (sameName && sameVideo) return true;
  // Preserve name-only legacy records only when neither side has an identity
  // or media cue. Never use a name alone to bridge different assignment IDs.
  return !a.card && !b.card && !a.ids.size && !b.ids.size && !targetVideo && !candidateVideo && sameDirectName;
}

function numeric(value) {
  const source = text(value).replace(",", ".");
  if (!source || !/^\d+(?:\.\d+)?$/.test(source)) return null;
  const result = Number(source);
  return Number.isFinite(result) ? result : null;
}

function actualSets(exercise = {}) {
  const sources = [exercise.actualSets, exercise.completedSets, exercise.sets].filter(Array.isArray);
  return sources.map(source => source.flatMap((set, index) => {
    if (!set || typeof set !== "object" || set.completed === false) return [];
    const reps = numeric(set.enteredReps ?? set.actualReps ?? set.completedReps ?? set.reps);
    const weight = numeric(set.enteredWeight ?? set.actualWeight ?? set.completedWeight ?? set.weight);
    const durationSeconds = numeric(set.enteredDurationSeconds ?? set.actualDurationSeconds ?? set.durationSeconds);
    // These arrays are actual HISTORY results, never plannedSnapshot. Older
    // persisted records used plain reps/weight without a completed flag.
    const hasRecordedValues = [set.enteredReps, set.actualReps, set.completedReps,
      set.enteredDurationSeconds, set.actualDurationSeconds].some(value => numeric(value) > 0);
    if (set.completed !== true && !hasRecordedValues && !(reps > 0 || weight > 0 || durationSeconds > 0)) return [];
    const setType = text(set.setType || set.type) || "work";
    return [{ set: numeric(set.set) || index + 1, reps, weight, durationSeconds,
      setType, type: text(set.type || set.setType) || "work", completed: true }];
  })).sort((a, b) => b.length - a.length)[0] || [];
}

const numberLabel = value => String(value).replace(".", ",");
function setLabel(set) {
  const work = set.durationSeconds > 0 ? `${numberLabel(set.durationSeconds)} с`
    : set.reps > 0 ? `${numberLabel(set.reps)} повт.` : "повторы не записаны";
  return set.weight === null ? work
    : set.weight > 0 ? `${numberLabel(set.weight)} кг × ${work}` : work;
}

function summary(sets) {
  const labels = sets.map(setLabel);
  if (labels.every(label => label === labels[0])) return `${sets.length} × ${labels[0]}`;
  return labels.map((label, index) => `${index + 1}: ${label}`).join("; ");
}

function dateValue(value) {
  if (value === null || value === undefined || value === "") return "";
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : "";
  } catch { return ""; }
}

/** Select one page of actual history; assignments are combined unless explicitly scoped. */
export function selectRecentWorkoutExerciseHistory(rows = [], exercise = {}, { assignmentVersion = "", scope = "all" } = {}) {
  const source = Array.isArray(rows) ? rows : [];
  const recent = source.slice(0, RECENT_EXERCISE_HISTORY_LIMIT);
  const version = text(assignmentVersion);
  const entries = [];
  for (const [rowIndex, row] of recent.entries()) {
    const workout = row?.data && typeof row.data === "object" ? row.data : row;
    if (!workout || typeof workout !== "object") continue;
    if (scope === "assignment" && version && text(workout.assignedProgramUpdatedAt || workout.assignmentVersion) !== version) continue;
    const date = dateValue(workout.date);
    if (!date) continue;
    const explicitActual = [workout.actualExercises, workout.completedExercises,
      workout.exerciseResults, workout.results].flatMap(value => Array.isArray(value) ? value : []);
    // Transitional records may contain the same exercise in two actual-result
    // fields. Keep the most complete matching recording instead of duplicating it.
    const pick = candidates => candidates.filter(candidate => candidate && typeof candidate === "object" && matchesExercise(exercise, candidate))
      .map(actualSets).sort((a, b) => b.length - a.length)[0];
    const actual = pick(explicitActual);
    const matching = actual?.length ? actual : pick(Array.isArray(workout.exercises) ? workout.exercises : []);
    if (!matching?.length) continue;
    entries.push({ id: text(row?.id || workout.id) || `recent-${rowIndex}`, date, summary: summary(matching), sets: matching });
  }
  return {
    entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
    searchedWorkouts: recent.length,
    hasMore: source.length > RECENT_EXERCISE_HISTORY_LIMIT
  };
}

function withDeadline(read, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(failure("exercise-history/timeout", "История загружается слишком долго. Повторите попытку.")), timeoutMs);
    // The SDK read itself is not cancellable. After timeout its result cannot
    // populate the session cache or be published by this request.
    Promise.resolve().then(read).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

function scopeKey(exercise, scope, assignmentVersion) {
  const identity = identities(exercise);
  return JSON.stringify([scope, scope === "assignment" ? text(assignmentVersion) : "",
    identity.card, identity.owner, [...identity.ids].sort(), [...namesOf(exercise)].sort(), videoOf(exercise)]);
}

function rejectedRequest(error, isCurrent) {
  const rejected = Promise.reject(error);
  rejected.isCurrent = isCurrent;
  return rejected;
}

function generationStoreFor(auth, db, revision) {
  let bucket = generationBuckets.get(auth);
  if (!bucket?.session.isUnchanged()) {
    bucket = { session: captureAuthSession(auth), databases: new WeakMap() };
    generationBuckets.set(auth, bucket);
  }
  let store = bucket.databases.get(db);
  if (!store || store.revision !== revision) {
    store?.pages.forEach(generation => { generation.active = false; });
    store = { revision, pages: new Map() };
    bucket.databases.set(db, store);
  }
  return store;
}

function invalidatePageGeneration(store, key, firstPage) {
  if (firstPage) {
    store.pages.forEach(generation => { generation.active = false; });
    store.pages.clear();
  } else {
    const previous = store.pages.get(key);
    if (previous) previous.active = false;
  }
}

function beginPageGeneration(store, key, parent) {
  invalidatePageGeneration(store, key, !parent);
  const generation = { active: true, isCurrent: () => generation.active && (!parent || parent.isCurrent()) };
  store.pages.set(key, generation);
  return generation;
}

function nextCursorFor(read, context) {
  if (!read.hasMore || !read.boundary) return null;
  let byScope = nextCursors.get(read);
  if (!byScope) { byScope = new Map(); nextCursors.set(read, byScope); }
  if (byScope.has(context.selectionKey)) return byScope.get(context.selectionKey);
  const cursor = Object.freeze({});
  const generation = read.generation;
  // Cursor authority is separate from the bounded payload cache. Evicting an
  // old page must free its documents, not impose an accidental 80-page limit.
  cursorRecords.set(cursor, { ...context, boundary: read.boundary, key: ++cursorSequence,
    isCurrent: () => context.session.isCurrent() && getWorkoutHistoryRevision(context.auth) === context.revision
      && generation.isCurrent() });
  byScope.set(context.selectionKey, cursor);
  return cursor;
}

/** Load one page, only on demand. Cursors are private in-memory capabilities, not document paths. */
export function loadRecentWorkoutExerciseHistory({ auth, db, exercise = {}, assignmentVersion = "", scope = "all" } = {}, { cursor = null, force = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const session = captureAuthSession(auth);
  if (!session.isCurrent() || typeof session.uid !== "string" || session.uid.length > 128 || session.uid.includes("/")) {
    return rejectedRequest(failure("exercise-history/auth-required", "Войдите в аккаунт, чтобы посмотреть историю."), () => false);
  }
  if (!db || typeof db !== "object") {
    return rejectedRequest(failure("exercise-history/unavailable", "История сейчас недоступна. Повторите попытку."), session.isCurrent);
  }
  if (!["all", "assignment"].includes(scope)) {
    return rejectedRequest(failure("exercise-history/scope-invalid", "Неизвестная область истории."), session.isCurrent);
  }
  if (!databaseKeys.has(db)) databaseKeys.set(db, ++databaseSequence);
  const revision = getWorkoutHistoryRevision(auth);
  const selectionKey = scopeKey(exercise, scope, assignmentVersion);
  const parent = cursor && typeof cursor === "object" ? cursorRecords.get(cursor) : null;
  if (cursor !== null && (!parent || parent.auth !== auth || parent.db !== db || parent.uid !== session.uid
    || parent.revision !== revision || parent.selectionKey !== selectionKey || !parent.isCurrent())) {
    return rejectedRequest(failure("exercise-history/cursor-invalid", "История обновилась. Начните просмотр заново."), session.isCurrent);
  }
  const key = `recent-exercise-history:${databaseKeys.get(db)}:${revision}:${parent ? `cursor-${parent.key}` : "first"}`;
  const generations = generationStoreFor(auth, db, revision);
  if (force) invalidatePageGeneration(generations, key, !parent);
  const deadline = Math.max(1, Math.min(15000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  let request;
  const isCurrent = () => session.isCurrent() && getWorkoutHistoryRevision(auth) === revision
    && (!parent || parent.isCurrent()) && (resourceGuards.get(request)?.() ?? true);
  request = runSessionResource(auth, key, async resource => {
    resourceGuards.set(request, resource.isCurrent);
    if (parent && !parent.isCurrent()) return null;
    const generation = beginPageGeneration(generations, key, parent);
    const constraints = [orderBy("date", "desc"), orderBy(documentId(), "desc")];
    if (parent) constraints.push(startAfter(parent.boundary.date, parent.boundary.id));
    constraints.push(limit(RECENT_EXERCISE_HISTORY_LIMIT + 1));
    const snapshot = await withDeadline(() => getDocs(query(collection(db, "users", session.uid, "history"), ...constraints)), deadline);
    if (!resource.isCurrent() || !generation.isCurrent()) return null;
    if (!Array.isArray(snapshot?.docs) || snapshot.metadata?.fromCache === true || snapshot.metadata?.hasPendingWrites === true) {
      throw failure("exercise-history/unverified", "Не удалось получить свежую историю. Подключитесь к интернету и повторите.");
    }
    const rows = snapshot.docs.slice(0, RECENT_EXERCISE_HISTORY_LIMIT).map(document => ({ ...document.data(), id: document.id }));
    const last = rows.at(-1);
    return { rows, hasMore: snapshot.docs.length > RECENT_EXERCISE_HISTORY_LIMIT,
      // The peek document (21st) is NOT consumed. Starting after the 20th keeps
      // that record as the first candidate on the following page, including ties.
      boundary: last ? { date: last.date, id: last.id } : null,
      generation, isCurrent: resource.isCurrent };
  }, { force, maxAgeMs: CACHE_MS });
  const result = request.then(read => {
    if (read?.isCurrent) resourceGuards.set(request, read.isCurrent);
    if (!read || !isCurrent()) return { entries: [], searchedWorkouts: 0, hasMore: false, nextCursor: null, isCurrent: () => false };
    const nextCursor = nextCursorFor(read, { auth, db, uid: session.uid, session, revision, parent, selectionKey });
    return { ...selectRecentWorkoutExerciseHistory(read.rows, exercise, { assignmentVersion, scope }),
      hasMore: read.hasMore, nextCursor, isCurrent };
  });
  result.isCurrent = isCurrent;
  return result;
}

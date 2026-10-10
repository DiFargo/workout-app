import { normalizeWorkoutRegistration, normalizeWorkoutTrainingHistory } from "../../functions/basicWorkoutPersonalization.js";

const numeric = (value) => Number(String(value ?? "").replace(",", "."));
const timestamp = (value) => typeof value?.toMillis === "function" ? value.toMillis()
  : value?.seconds ? value.seconds * 1000 : new Date(value || "").getTime();

export function buildBasicWorkoutClientContext({ profile = {}, measurements = [], history = [] } = {}, now = Date.now()) {
  const latestWeight = (Array.isArray(measurements) ? measurements : [])
    .map((item) => ({ value: numeric(item?.values?.weight ?? item?.weight), at: timestamp(item?.date || item?.createdAt || item?.savedAt) }))
    .filter((item) => item.value >= 25 && item.value <= 350 && item.at > 0 && item.at <= now)
    .sort((a, b) => b.at - a.at)[0];
  const registration = normalizeWorkoutRegistration({ ...profile,
    ...(latestWeight ? { weight: latestWeight.value, weightMeasuredAt: new Date(latestWeight.at).toISOString().slice(0, 10) } : {}) });
  const seen = new Set();
  const sessions = (Array.isArray(history) ? history : [])
    .map((workout) => ({ workout, at: timestamp(workout?.finishedAt || workout?.date || workout?.completedAt) }))
    .filter(({ workout, at }) => at > 0 && at <= now && now - at <= 90 * 86400000
      && !["draft", "planned", "skipped"].includes(workout.status) && workout.completed !== false)
    .sort((a, b) => b.at - a.at).filter(({ workout, at }) => {
      const key = workout.clientSaveId || workout.id || `${at}:${workout.name}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 20).map(({ workout, at }) => ({
      daysAgo: Math.floor((now - at) / 86400000), feedback: workout.postWorkoutFeedback?.id,
      exercises: (Array.isArray(workout.exercises) ? workout.exercises : []).map((exercise) => {
        const completed = (Array.isArray(exercise.sets) ? exercise.sets : []).filter((set) => set.completed !== false
          && (numeric(set.enteredReps || set.reps) > 0 || numeric(set.durationSeconds) > 0));
        const last = completed.at(-1) || {};
        return { catalogueId: exercise.basicExerciseId || exercise.basicExerciseLibraryId || exercise.catalogueId,
          name: exercise.name, completedSets: completed.length, reps: last.enteredReps || last.reps,
          weight: last.enteredWeight || last.weight, durationSeconds: last.durationSeconds };
      })
    }));
  return { registration, trainingHistory: normalizeWorkoutTrainingHistory(sessions) };
}

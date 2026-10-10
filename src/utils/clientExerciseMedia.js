import { fetchAuthorizedWithTimeout } from "./apiClient.js";
import { applyExerciseCard, isExerciseCardWorkoutMutable } from "../../functions/exerciseCards.js";

export async function loadClientExerciseMedia(clientId, request = fetchAuthorizedWithTimeout) {
  try {
    const response = await request("/api/client-exercise-media", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId })
    }, 6000);
    if (!response.ok) throw new Error(`Exercise media: ${response.status}`);
    const result = await response.json();
    return Array.isArray(result.media) ? result.media : [];
  } catch (error) {
    // An optional video lookup must never make the training plan unavailable.
    console.warn("Exercise library video lookup failed:", error?.message);
    return [];
  }
}

export function withClientExerciseMedia(workout, media = []) {
  if (!isExerciseCardWorkoutMutable(workout)) return workout;
  return { ...workout, exercises: (workout.exercises || []).map((exercise) => {
    const match = media.find((item) => item.workoutId === workout.id && item.exerciseId === exercise.id &&
      item.exerciseName === exercise.name && String(item.assignmentVersion || "") === String(workout.assignedProgramUpdatedAt || ""));
    const updated = match?.alternativeCards?.length && Array.isArray(exercise.trainerAlternatives) ? { ...exercise,
      trainerAlternatives: exercise.trainerAlternatives.map((alternative) => applyExerciseCard(alternative,
        match.alternativeCards.find((item) => item.id === (alternative.libraryExerciseId || alternative.id))?.card)) } : exercise;
    if (match?.card) return applyExerciseCard(updated, match.card);
    const ownVideo = exercise.video || exercise.videoUrl || exercise.videoURL;
    if (ownVideo && !exercise.videoAutoFilledFrom) return updated;
    if (!match?.video) return updated;
    return { ...updated, video: match.video, videoAutoFilledFrom: match.sourceName || exercise.name };
  }) };
}

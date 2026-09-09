import { fetchAuthorizedWithTimeout } from "./apiClient.js";

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
  return { ...workout, exercises: (workout.exercises || []).map((exercise) => {
    const ownVideo = exercise.video || exercise.videoUrl || exercise.videoURL;
    if (ownVideo && !exercise.videoAutoFilledFrom) return exercise;
    const match = media.find((item) => item.workoutId === workout.id && item.exerciseId === exercise.id &&
      item.exerciseName === exercise.name && String(item.assignmentVersion || "") === String(workout.assignedProgramUpdatedAt || ""));
    if (!match?.video) return exercise;
    return { ...exercise, video: match.video, videoAutoFilledFrom: match.sourceName || exercise.name };
  }) };
}

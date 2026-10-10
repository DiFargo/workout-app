// Only a saved media timestamp or a shared card's revision date establishes
// priority. A whole template's edit time says nothing about its exercise videos.
export function exerciseVideoPriorityTime(exercise = {}) {
  const sharedCard = exercise.exerciseCardId || exercise.librarySource?.type === "card"
    || (exercise.ownerUid && Number.isFinite(exercise.revision));
  const value = exercise.videoUpdatedAt || (sharedCard ? exercise.updatedAt || exercise.createdAt : "");
  const time = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(time) && time > 0 ? time : 0;
}

export function selectLatestExerciseVideo(exercises = []) {
  const video = exercise => String(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "").trim();
  const filmed = exercises.filter(exercise => video(exercise) && !exercise.deletedAt && !exercise.libraryDeletedAt);
  const latestTime = Math.max(0, ...filmed.map(exerciseVideoPriorityTime));
  if (!latestTime) return null;
  const latest = filmed.filter(exercise => exerciseVideoPriorityTime(exercise) === latestTime);
  // Equal timestamps with different media do not prove which video is newer.
  return new Set(latest.map(video)).size === 1 ? latest[0] : null;
}

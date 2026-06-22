export function createWorkoutHistoryNavigation({
  APP_PAGES,
  loadHistory,
  setPage,
  setSelectedWorkoutId,
  setOpenVideoId,
  setFullscreenVideo,
  setCurrentExerciseIndex,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setWorkoutFinishedAt,
  setOpenHistoryKey,
  setProfileWorkoutHistoryProgramScope,
  setProfileWorkoutHistoryModalOpen
}) {
  function openHistory() {
    setPage(APP_PAGES.HISTORY);
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setOpenHistoryKey(null);
    loadHistory();
  }

  function openCabinetWorkoutHistory(workoutId = "", programScope = null) {
    const nextWorkoutId = workoutId ? String(workoutId) : "";
    setProfileWorkoutHistoryProgramScope(
      programScope && typeof programScope === "object" ? programScope : null
    );
    setOpenHistoryKey(nextWorkoutId || null);
    setProfileWorkoutHistoryModalOpen(true);
    loadHistory();
  }

  function toggleCabinetWorkoutHistory(itemId) {
    const targetId = String(itemId || "").trim();
    if (!targetId) return;
    setProfileWorkoutHistoryModalOpen(true);
    setOpenHistoryKey((prev) => (prev === targetId ? null : targetId));
  }

  return {
    openHistory,
    openCabinetWorkoutHistory,
    toggleCabinetWorkoutHistory
  };
}

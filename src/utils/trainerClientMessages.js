// Only text explicitly entered by the client belongs in the replyable feed.
// A workout rating and its system advice remain separate history metadata.
export function getWorkoutNoteItems(history = []) {
  return (Array.isArray(history) ? history : [])
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const workoutTitle = item.workoutName || item.workout || "Тренировка";
      const date = item.finishedAt || item.date || item.createdAt;
      const notes = [];
      const clientComment = String(item.clientComment || "").trim();

      if (clientComment) {
        const sourceCommentId = `${item.id || item.clientSaveId || date}-comment`;
        notes.push({
          id: sourceCommentId,
          title: workoutTitle,
          source: "Комментарий",
          text: clientComment,
          date,
          workoutId: item.workoutId || item.id || "",
          workoutName: workoutTitle,
          historyId: item.id || item.clientSaveId || "",
          sourceCommentId
        });
      }

      (item.exercises || []).forEach((exercise, exerciseIndex) => {
        const exerciseNote = String(exercise?.clientNote || "").trim();
        if (!exerciseNote) return;

        const sourceCommentId = `${item.id || item.clientSaveId || date}-exercise-${exercise.id || exerciseIndex}`;
        notes.push({
          id: sourceCommentId,
          title: exercise.name || workoutTitle,
          source: "Упражнение",
          text: exerciseNote,
          date,
          workoutId: item.workoutId || item.id || "",
          workoutName: workoutTitle,
          historyId: item.id || item.clientSaveId || "",
          exerciseId: exercise.id || "",
          exerciseName: exercise.name || "",
          sourceCommentId
        });
      });

      return notes;
    })
    .sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime());
}

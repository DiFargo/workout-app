export default function WorkoutExerciseSupport({
  exercise,
  exerciseAiWeightAdjustments,
  exerciseHistoryOpenId,
  lastExerciseText,
  onOpenNote,
  onToggleHistory,
  readinessVolumeText
}) {
  return (
    <div className="workoutExerciseSupport">
      <button
        type="button"
        className="previousInfo subtle"
        onClick={onToggleHistory}
      >
        {lastExerciseText}
        {exerciseHistoryOpenId === exercise.id && (
          <small>План сейчас: {exercise.sets.length} подхода · нажми ещё раз, чтобы свернуть</small>
        )}
      </button>

      <button
        type="button"
        className="workoutExerciseNoteButton"
        onClick={onOpenNote}
        aria-label="Открыть заметку к упражнению"
      >
        <span>Заметка</span>
        <span aria-hidden="true">✎</span>
      </button>

      {exerciseAiWeightAdjustments.length > 0 && (
        <div className="workoutAiAdjustHint">
          Коррекция готовности · {readinessVolumeText}
        </div>
      )}
    </div>
  );
}

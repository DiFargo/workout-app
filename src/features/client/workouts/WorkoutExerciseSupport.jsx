import styles from "./WorkoutExerciseSupport.module.css";

export default function WorkoutExerciseSupport({
  exercise,
  exerciseAiWeightAdjustments,
  exerciseHistoryOpenId,
  lastExerciseText,
  onOpenNote,
  onToggleHistory,
  readinessVolumeText,
  showNoteButton = true
}) {
  return (
    <div
      className={styles.root}
      data-testid="workout-exercise-support"
      data-css-module-scope="workout-exercise-support"
    >
      <button
        type="button"
        className={styles.previousInfo}
        data-css-module-control="workout-exercise-support"
        onClick={onToggleHistory}
      >
        {lastExerciseText}
        {exerciseHistoryOpenId === exercise.id && (
          <small>План сейчас: {exercise.sets.length} подхода · нажми ещё раз, чтобы свернуть</small>
        )}
      </button>

      {showNoteButton && (
        <button
          type="button"
          className={styles.noteButton}
          data-css-module-control="workout-exercise-support"
          onClick={onOpenNote}
          aria-label="Открыть заметку к упражнению"
        >
          <span>Заметка</span>
          <span aria-hidden="true">✎</span>
        </button>
      )}

      {exerciseAiWeightAdjustments.length > 0 && (
        <div className={styles.aiAdjustHint}>
          Коррекция готовности · {readinessVolumeText}
        </div>
      )}
    </div>
  );
}

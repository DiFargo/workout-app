import styles from "./WorkoutExerciseSupport.module.css";

export default function WorkoutExerciseSupport({
  exercise,
  exerciseAiWeightAdjustments,
  exerciseHistoryOpenId,
  lastExerciseText,
  onOpenNote,
  onStartingWeightFeedback,
  onToggleHistory,
  readinessVolumeText,
  startingWeightCheck = null,
  showNoteButton = true
}) {
  const needsStartingWeightFeedback = Boolean(startingWeightCheck?.awaitingFeedback);
  const showsStartingWeightHint = Boolean(startingWeightCheck && !needsStartingWeightFeedback);

  return (
    <div
      className={styles.root}
      data-testid="workout-exercise-support"
      data-css-module-scope="workout-exercise-support"
    >
      {needsStartingWeightFeedback ? (
        <div className={styles.startingWeightCheck} data-testid="basic-workout-starting-weight-check">
          <span>Первый подход?</span>
          <button type="button" onClick={() => onStartingWeightFeedback?.("too_easy")}>Легко</button>
          <button type="button" onClick={() => onStartingWeightFeedback?.("just_right")}>Норма</button>
          <button type="button" onClick={() => onStartingWeightFeedback?.("too_hard")}>Тяжело</button>
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.previousInfo} ${showsStartingWeightHint ? styles.startingWeightHint : ""}`}
          data-css-module-control="workout-exercise-support"
          onClick={showsStartingWeightHint ? undefined : onToggleHistory}
        >
          {showsStartingWeightHint
            ? "Стартовый вес по анкете — скорректируй после первого подхода"
            : lastExerciseText}
          {!showsStartingWeightHint && exerciseHistoryOpenId === exercise.id && (
            <small>План сейчас: {exercise.sets.length} подхода · нажми ещё раз, чтобы свернуть</small>
          )}
        </button>
      )}

      {!needsStartingWeightFeedback && showNoteButton && (
        <button
          type="button"
          className={styles.noteButton}
          data-css-module-control="workout-exercise-support"
          onClick={onOpenNote}
          aria-label="Открыть заметку тренеру к упражнению"
        >
          <span>Заметка тренеру</span>
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

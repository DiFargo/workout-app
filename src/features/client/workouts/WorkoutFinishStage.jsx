import styles from "./WorkoutFinishStage.module.css";

export default function WorkoutFinishStage({
  completedExercisesCount,
  exerciseCount,
  finishAdviceText,
  finishPresentation,
  finishProgressText,
  finishStats,
  finishSyncText,
  goToPreviousExercise,
  incompleteExerciseNames,
  isBasicWorkout = false,
  isSaving,
  isWorkoutSaved,
  onClientCommentChange,
  onFinishWorkout,
  postWorkoutFeedback,
  showWorkoutSavedCard,
  swipeDirection,
  swipeOffset,
  workoutClientComment,
  workoutHistorySyncState
}) {
  return (
    <>
      {showWorkoutSavedCard && (
        <div className={styles.savedCard} data-css-module-scope="workout-finish-stage">
          <div className={styles.savedCheck}>✓</div>
          <strong>Тренировка сохранена</strong>
          <span>{postWorkoutFeedback?.advice || "Отличная работа"}</span>
        </div>
      )}

      <div
        key="finish-slide"
        className={`${styles.screen} ${
          swipeDirection === "up"
            ? styles.slideFromBottom
            : swipeDirection === "down"
            ? styles.slideFromTop
            : ""
        }`}
        data-testid="workout-finish-screen"
        data-css-module-scope="workout-finish-stage"
        style={{
          transform: swipeOffset
            ? `translateY(${swipeOffset}px)`
            : undefined
        }}
      >
        <div className={styles.card} data-testid="workout-finish-card">
          <div className={styles.top}>
            <span>{isWorkoutSaved ? "Выполнена" : "Готова к сохранению"}</span>
            <span>{finishPresentation.day}</span>
          </div>

          <div className={styles.result}>
            <span className={styles.trophy} aria-hidden="true">🏆</span>
            <div>
              <p>{isWorkoutSaved ? "Отличная работа" : "Проверь результат"}</p>
            </div>
          </div>

          {finishStats.length > 0 && (
            <div className={styles.stats}>
              {finishStats.map((stat) => (
                <div key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          )}

          <div className={styles.progress}>
            <span>Прогресс</span>
            <strong>
              Выполнено {completedExercisesCount} из {exerciseCount} упражнений
            </strong>
            <p>{finishProgressText}</p>
          </div>

          {!isWorkoutSaved && incompleteExerciseNames.length > 0 && (
            <div className={styles.incomplete}>
              <strong>Остались без данных</strong>
              <span>{incompleteExerciseNames.slice(0, 3).join(" · ")}</span>
            </div>
          )}

          {!isWorkoutSaved && (
            <label className={styles.comment}>
              <span>{isBasicWorkout ? "Заметка о тренировке" : "Комментарий тренеру"}</span>
              <textarea
                className={styles.commentInput}
                data-css-module-control="workout-finish-stage"
                value={workoutClientComment}
                onChange={onClientCommentChange}
                placeholder="Например: последний подход дался тяжело"
                maxLength={300}
              />
            </label>
          )}

          <div className={styles.tip}>
            <span aria-hidden="true">💡</span>
            <p>{finishAdviceText}</p>
          </div>

          {finishSyncText && workoutHistorySyncState !== "synced" && (
            <div className={`${styles.syncStatus} ${styles[workoutHistorySyncState] || ""}`}>
              <span aria-hidden="true">
                {workoutHistorySyncState === "local" ? "◷" : workoutHistorySyncState === "synced" ? "✓" : "•"}
              </span>
              {finishSyncText}
            </div>
          )}
        </div>
      </div>

      <div className={styles.actionPanel} data-css-module-scope="workout-finish-stage">
        <div className={styles.navigationRow}>
          <button
            type="button"
            className={styles.backButton}
            data-css-module-control="workout-finish-stage"
            onClick={goToPreviousExercise}
            disabled={isSaving}
            aria-label="Вернуться к последнему упражнению"
          >
            <span>Назад</span>
          </button>
          <button
            type="button"
            className={styles.finishButton}
            data-css-module-control="workout-finish-stage"
            onClick={onFinishWorkout}
            disabled={isSaving}
          >
            {isSaving
              ? "Сохраняю..."
              : isWorkoutSaved
              ? "Вернуться в меню"
              : "Сохранить и завершить"}
          </button>
        </div>
      </div>
    </>
  );
}

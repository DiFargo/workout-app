import { Check, CircleAlert, Clock3, Lightbulb, LoaderCircle, Trophy } from "lucide-react";
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
  const showSaveStatusFirst = workoutHistorySyncState === "saving" || workoutHistorySyncState === "error";
  const saveStatus = finishSyncText && (isWorkoutSaved || showSaveStatusFirst) ? (
    <div className={`${styles.syncStatus} ${styles[workoutHistorySyncState] || ""}`} role={workoutHistorySyncState === "error" ? "alert" : "status"} aria-atomic="true" data-testid="workout-finish-save-status" data-save-state={workoutHistorySyncState}>
      <span aria-hidden="true">
        {workoutHistorySyncState === "local" ? <Clock3 /> : workoutHistorySyncState === "synced" ? <Check /> : workoutHistorySyncState === "error" ? <CircleAlert /> : <LoaderCircle />}
      </span>
      {finishSyncText}
    </div>
  ) : null;

  return (
    <>
      {showWorkoutSavedCard && isWorkoutSaved && (
        <div className={styles.savedCard} role="status" aria-atomic="true" data-save-state={workoutHistorySyncState} data-css-module-scope="workout-finish-stage">
          <div className={styles.savedCheck}>{workoutHistorySyncState === "local" ? <Clock3 aria-hidden="true" /> : <Check aria-hidden="true" />}</div>
          <strong>{workoutHistorySyncState === "local" ? "Сохранено на устройстве" : workoutHistorySyncState === "synced" ? "Сохранено в облаке" : "Тренировка сохранена"}</strong>
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
            <span>{isWorkoutSaved ? "Выполнена" : workoutHistorySyncState === "error" ? "Не сохранена" : "Готова к сохранению"}</span>
            <span>{finishPresentation.day}</span>
          </div>

          {showSaveStatusFirst ? saveStatus : null}

          <div className={styles.result}>
            <span className={styles.trophy} aria-hidden="true"><Trophy /></span>
            <div>
              <p>{isWorkoutSaved ? "Отличная работа" : "Проверь результат"}</p>
            </div>
          </div>

          {finishStats.length > 0 && (
            <div className={styles.stats} role="group" aria-label="Показатели тренировки" data-testid="workout-finish-stats">
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
              <span className={styles.commentLabel}>
                <span>{isBasicWorkout ? "Заметка о тренировке" : "Комментарий тренеру"}</span>
                <small aria-hidden="true">Необязательно</small>
              </span>
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
            <span aria-hidden="true"><Lightbulb /></span>
            <p>{finishAdviceText}</p>
          </div>

          {!showSaveStatusFirst ? saveStatus : null}
        </div>
      </div>

      <div
        className={`${styles.actionPanel} ${isWorkoutSaved ? styles.savedActionPanel : ""}`}
        data-css-module-scope="workout-finish-stage"
        data-testid="workout-finish-actions"
      >
        <div className={`${styles.navigationRow} ${isWorkoutSaved ? styles.savedNavigationRow : ""}`}>
          {!isWorkoutSaved && (
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
          )}
          <button
            type="button"
            className={styles.finishButton}
            data-css-module-control="workout-finish-stage"
            onClick={onFinishWorkout}
            disabled={isSaving}
          >
            {isSaving
              ? "Сохраняем…"
              : isWorkoutSaved
              ? "Вернуться в меню"
              : workoutHistorySyncState === "error"
              ? "Повторить сохранение"
              : "Сохранить и завершить"}
          </button>
        </div>
      </div>
    </>
  );
}

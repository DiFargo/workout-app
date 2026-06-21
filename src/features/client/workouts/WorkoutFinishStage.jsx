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
        <div className="workoutSavedFloatingCard">
          <div className="workoutSavedCheck">✓</div>
          <strong>Тренировка сохранена</strong>
          <span>{postWorkoutFeedback?.advice || "Отличная работа"}</span>
        </div>
      )}

      <div
        key="finish-slide"
        className={`finishSlideWrap workoutFinishScreen ${
          swipeDirection === "up"
            ? "slideFromBottom"
            : swipeDirection === "down"
            ? "slideFromTop"
            : ""
        }`}
        style={{
          transform: swipeOffset
            ? `translateY(${swipeOffset}px)`
            : undefined
        }}
      >
        <div className="exercise exerciseSlideCard finishSummaryCard workoutFinishCard workoutStageCard">
          <div className="workoutFinishTop">
            <span>{isWorkoutSaved ? "Выполнена" : "Готова к сохранению"}</span>
            <span>{finishPresentation.day}</span>
          </div>

          <div className="workoutFinishResult">
            <span className="workoutFinishTrophy" aria-hidden="true">🏆</span>
            <div>
              <p>{isWorkoutSaved ? "Отличная работа" : "Проверь результат"}</p>
            </div>
          </div>

          {finishStats.length > 0 && (
            <div className="workoutFinishStats">
              {finishStats.map((stat) => (
                <div key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="workoutFinishProgress">
            <span>Прогресс</span>
            <strong>
              Выполнено {completedExercisesCount} из {exerciseCount} упражнений
            </strong>
            <p>{finishProgressText}</p>
          </div>

          {!isWorkoutSaved && incompleteExerciseNames.length > 0 && (
            <div className="workoutFinishIncomplete">
              <strong>Остались без данных</strong>
              <span>{incompleteExerciseNames.slice(0, 3).join(" · ")}</span>
            </div>
          )}

          {!isWorkoutSaved && (
            <label className="workoutFinishComment">
              <span>Комментарий тренеру</span>
              <textarea
                value={workoutClientComment}
                onChange={onClientCommentChange}
                placeholder="Например: последний подход дался тяжело"
                maxLength={300}
              />
            </label>
          )}

          <div className="workoutFinishTip">
            <span aria-hidden="true">💡</span>
            <p>{finishAdviceText}</p>
          </div>

          {finishSyncText && (
            <div className={`workoutFinishSyncStatus ${workoutHistorySyncState}`}>
              <span aria-hidden="true">
                {workoutHistorySyncState === "local" ? "◷" : workoutHistorySyncState === "synced" ? "✓" : "•"}
              </span>
              {finishSyncText}
            </div>
          )}
        </div>
      </div>

      <div className="workoutFinishActionPanel workoutStageActionPanel">
        <div className="finishNavigationRow">
          <button
            type="button"
            className="finishBackButton"
            onClick={goToPreviousExercise}
            disabled={isSaving}
            aria-label="Вернуться к последнему упражнению"
          >
            <span>Назад</span>
          </button>
          <button
            type="button"
            className="finishWorkoutButton"
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

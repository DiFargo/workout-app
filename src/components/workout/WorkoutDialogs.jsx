import { WORKOUT_READINESS_OPTIONS } from "../../domain/workoutPresentation";

export function WorkoutExitDialog({ open, onStay, onLeave }) {
  if (!open) return null;

  return (
    <div className="workoutExitOverlay">
      <div className="workoutExitCard" role="dialog" aria-modal="true">
        <span className="workoutExitIcon" aria-hidden="true">↩</span>
        <h2>Выйти из тренировки?</h2>
        <p>Введённые данные сохранены в черновике. Ты сможешь продолжить позже.</p>
        <div className="workoutExitActions">
          <button type="button" onClick={onStay}>Остаться</button>
          <button type="button" onClick={onLeave}>Выйти</button>
        </div>
      </div>
    </div>
  );
}

export function WorkoutIncompleteDialog({ open, completion, onContinue, onSave }) {
  if (!open) return null;

  return (
    <div className="workoutExitOverlay">
      <div className="workoutExitCard" role="dialog" aria-modal="true" aria-labelledby="workout-incomplete-title">
        <span className="workoutExitIcon" aria-hidden="true">!</span>
        <h2 id="workout-incomplete-title">Сохранить неполную тренировку?</h2>
        <p>
          Выполнено подходов: {completion.completedSets} из {completion.totalSets}.
          Остальные подходы будут отмечены как невыполненные.
        </p>
        <div className="workoutExitActions">
          <button type="button" onClick={onContinue}>Продолжить тренировку</button>
          <button type="button" onClick={onSave}>Сохранить неполную</button>
        </div>
      </div>
    </div>
  );
}

export function PostWorkoutFeedbackDialog({
  open,
  options,
  isSaving,
  onSelect
}) {
  if (!open) return null;

  return (
    <div className="postWorkoutOverlay">
      <div
        className="postWorkoutCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-workout-feedback-title"
      >
        <span className="postWorkoutBadge">AI feedback</span>
        <h2 id="post-workout-feedback-title">Как прошла тренировка?</h2>
        <p>AI учтёт это для восстановления и следующих рекомендаций.</p>

        <div className="postWorkoutGrid">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              disabled={isSaving}
              onClick={() => onSelect(option)}
            >
              <span>{option.emoji}</span>
              <strong>{option.title}</strong>
              <small>{option.subtitle}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkoutReadinessDialog({
  open,
  selectedWorkoutId,
  workoutStarted,
  pendingOption,
  onSelectOption,
  onBack,
  onApply
}) {
  if (!open || !selectedWorkoutId || workoutStarted) return null;

  return (
    <div className="workoutReadinessOverlay">
      <div className="workoutReadinessStage">
        <header className="workoutReadinessHeader">
          <span>Готовность к тренировке</span>
          <small>Выбери состояние перед разминкой</small>
        </header>

        <div className="workoutReadinessCard">
          <div className="workoutReadinessIntro">
            <span aria-hidden="true">◷</span>
            <div>
              <strong>Как ты себя чувствуешь?</strong>
              <p>Выбор влияет только на рабочий вес этой тренировки.</p>
            </div>
          </div>

          <div className="workoutReadinessGrid">
            {WORKOUT_READINESS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={pendingOption?.id === option.id ? "active" : ""}
                onClick={() => onSelectOption(option)}
              >
                <span>{option.emoji}</span>
                <span>
                  <strong>{option.title}</strong>
                  <small>
                    {option.id === "excellent"
                      ? "Немного увеличить рабочий вес"
                      : option.id === "good"
                        ? "Оставить план тренера без изменений"
                        : "Немного снизить нагрузку"}
                  </small>
                </span>
              </button>
            ))}
          </div>

          <p className={`workoutReadinessConfirmation ${pendingOption ? "" : "empty"}`}>
            {pendingOption
              ? pendingOption.id === "good"
                ? "Плановые веса тренера останутся без изменений."
                : `Будет применена корректировка: ${pendingOption.volumeText}.`
              : "Выберите вариант самочувствия."}
          </p>
        </div>

        <div className="workoutReadinessActions">
          <button type="button" onClick={onBack}>
            Назад
          </button>
          <button
            type="button"
            disabled={!pendingOption}
            onClick={() => onApply(pendingOption)}
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkoutDraftRestoreDialog({
  open,
  blocked,
  onRestart,
  onRestore
}) {
  if (!open || blocked) return null;

  return (
    <div className="workoutDraftRestoreOverlay">
      <div
        className="workoutDraftRestoreCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workoutDraftRestoreTitle"
        aria-describedby="workoutDraftRestoreDescription"
      >
        <span className="workoutDraftRestoreIcon" aria-hidden="true">↩</span>
        <h2 id="workoutDraftRestoreTitle">Продолжить тренировку?</h2>
        <p id="workoutDraftRestoreDescription">
          Найден незавершённый черновик. Можно восстановить прогресс или начать заново.
        </p>

        <div className="workoutDraftRestoreActions">
          <button
            type="button"
            className="workoutDraftRestartButton"
            onClick={onRestart}
          >
            Начать заново
          </button>
          <button
            type="button"
            className="workoutDraftRestoreButton"
            onClick={onRestore}
          >
            Восстановить
          </button>
        </div>
      </div>
    </div>
  );
}

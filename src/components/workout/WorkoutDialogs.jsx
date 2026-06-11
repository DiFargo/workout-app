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

export function PostWorkoutFeedbackDialog({ open, options, isSaving, onSelect }) {
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

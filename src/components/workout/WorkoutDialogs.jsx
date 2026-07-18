import { WORKOUT_READINESS_OPTIONS } from "../../domain/workoutPresentation";
import styles from "./WorkoutDialogs.module.css";

export function WorkoutExitDialog({ open, onStay, onLeave }) {
  if (!open) return null;

  return (
    <div
      className={styles.exitOverlay}
      data-testid="workout-exit-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div className={styles.exitCard} role="dialog" aria-modal="true" data-modal-surface="true" aria-label="Выход из тренировки">
        <span className={styles.exitIcon} aria-hidden="true">↩</span>
        <h2>Выйти из тренировки?</h2>
        <p>Введённые данные сохранены в черновике. Ты сможешь продолжить позже.</p>
        <div className={styles.exitActions}>
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
    <div
      className={styles.exitOverlay}
      data-testid="workout-incomplete-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div className={styles.exitCard} role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="workout-incomplete-title">
        <span className={styles.exitIcon} aria-hidden="true">!</span>
        <h2 id="workout-incomplete-title">Сохранить неполную тренировку?</h2>
        <p>
          Выполнено подходов: {completion.completedSets} из {completion.totalSets}.
          Остальные подходы будут отмечены как невыполненные.
        </p>
        <div className={styles.exitActions}>
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
    <div
      className={styles.postOverlay}
      data-testid="post-workout-feedback-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div
        className={styles.postCard}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="post-workout-feedback-title"
      >
        <span className={styles.postBadge}>AI feedback</span>
        <h2 id="post-workout-feedback-title">Как прошла тренировка?</h2>
        <p>AI учтёт это для восстановления и следующих рекомендаций.</p>

        <div className={styles.postGrid}>
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              className={styles.postOption}
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
    <div
      className={styles.readinessOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-readiness-title"
      data-testid="workout-readiness-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div className={styles.readinessStage}>
        <header className={styles.readinessHeader}>
          <span id="workout-readiness-title">Готовность к тренировке</span>
          <small>Выбери состояние перед разминкой</small>
        </header>

        <div className={styles.readinessCard}>
          <div className={styles.readinessIntro}>
            <span aria-hidden="true">◷</span>
            <div>
              <strong>Как ты себя чувствуешь?</strong>
              <p>Выбор влияет только на рабочий вес этой тренировки.</p>
            </div>
          </div>

          <div className={styles.readinessGrid}>
            {WORKOUT_READINESS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`${styles.readinessOption} ${
                  pendingOption?.id === option.id ? styles.active : ""
                }`}
                data-workout-readiness-option={option.id}
                aria-pressed={pendingOption?.id === option.id}
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

          <p className={`${styles.readinessConfirmation} ${pendingOption ? "" : styles.empty}`}>
            {pendingOption
              ? pendingOption.id === "good"
                ? "Плановые веса тренера останутся без изменений."
                : `Будет применена корректировка: ${pendingOption.volumeText}.`
              : "Выберите вариант самочувствия."}
          </p>
        </div>

        <div className={styles.readinessActions}>
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
    <div
      className={styles.draftOverlay}
      data-testid="workout-draft-restore-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div
        className={styles.draftCard}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="workoutDraftRestoreTitle"
        aria-describedby="workoutDraftRestoreDescription"
      >
        <span className={styles.draftIcon} aria-hidden="true">↩</span>
        <h2 id="workoutDraftRestoreTitle">Продолжить тренировку?</h2>
        <p id="workoutDraftRestoreDescription">
          Найден незавершённый черновик. Можно восстановить прогресс или начать заново.
        </p>

        <div className={styles.draftActions}>
          <button
            type="button"
            className={styles.restartButton}
            onClick={onRestart}
          >
            Начать заново
          </button>
          <button
            type="button"
            className={styles.restoreButton}
            onClick={onRestore}
          >
            Восстановить
          </button>
        </div>
      </div>
    </div>
  );
}

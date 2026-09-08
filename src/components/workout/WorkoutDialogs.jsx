import { getWorkoutReadinessOption, WORKOUT_READINESS_OPTIONS } from "../../domain/workoutPresentation";
import {
  AlertCircle,
  Clock3,
  LogOut,
  RotateCcw,
  X
} from "lucide-react";
import styles from "./WorkoutDialogs.module.css";

export function WorkoutExitDialog({ open, onStay, onLeave }) {
  if (!open) return null;

  return (
    <div
      className={styles.exitOverlay} data-modal-backdrop="true"
      data-testid="workout-exit-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div className={`${styles.exitCard} ${styles.exitCardExit}`} role="dialog" aria-modal="true" data-modal-surface="true" aria-label="Выход из тренировки">
        <div className={styles.exitHeader}>
          <span className={styles.exitIcon} aria-hidden="true"><LogOut size={21} strokeWidth={2.25} /></span>
          <button type="button" className={styles.exitCloseButton} onClick={onStay} aria-label="Остаться в тренировке">
            <X size={21} strokeWidth={2.5} />
          </button>
        </div>
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
      className={styles.exitOverlay} data-modal-backdrop="true"
      data-testid="workout-incomplete-dialog"
      data-css-module-scope="workout-dialogs"
    >
      <div className={`${styles.exitCard} ${styles.exitCardIncomplete}`} role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="workout-incomplete-title">
        <div className={styles.exitHeader}>
          <span className={styles.exitIcon} aria-hidden="true"><AlertCircle size={22} strokeWidth={2.2} /></span>
          <button type="button" className={styles.exitCloseButton} onClick={onContinue} aria-label="Продолжить тренировку">
            <X size={21} strokeWidth={2.5} />
          </button>
        </div>
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
  onSelect,
  onClose
}) {
  if (!open) return null;

  return (
    <div
      className={styles.postOverlay} data-modal-backdrop="true"
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
        <div className={styles.postHeader}>
          <span className={styles.postBadge}>Самочувствие</span>
          <button
            type="button"
            className={styles.postCloseButton}
            onClick={onClose}
            aria-label="Закрыть оценку тренировки"
          >
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <h2 id="post-workout-feedback-title">Как прошла тренировка?</h2>
        <p>Ответ поможет точнее подобрать восстановление и следующую нагрузку.</p>

        <div className={styles.postGrid}>
          {options.map((option) => (
              <button
                type="button"
                key={option.id}
                className={styles.postOption}
                disabled={isSaving}
                onClick={() => onSelect(option)}
              >
                <span className={styles.postOptionIcon} aria-hidden="true">
                  {option.emoji}
                </span>
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
  const selectedOption = pendingOption || getWorkoutReadinessOption("good");

  return (
    <div
      className={styles.readinessOverlay} data-modal-backdrop="true"
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
            <span aria-hidden="true"><Clock3 /></span>
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
                    selectedOption?.id === option.id ? styles.active : ""
                  }`}
                  data-workout-readiness-option={option.id}
                  aria-pressed={selectedOption?.id === option.id}
                  onClick={() => onSelectOption(option)}
                >
                  <span className={styles.readinessOptionIcon} aria-hidden="true">
                    {option.emoji}
                  </span>
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

          <p className={styles.readinessConfirmation}>
            {selectedOption.id === "good"
                ? "Плановые веса тренера останутся без изменений."
                : `Будет применена корректировка: ${selectedOption.volumeText}.`}
          </p>
        </div>

        <div className={styles.readinessActions}>
          <button type="button" onClick={onBack}>
            Назад
          </button>
          <button
            type="button"
            onClick={() => onApply(selectedOption)}
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
      className={styles.draftOverlay} data-modal-backdrop="true"
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
        <span className={styles.draftIcon} aria-hidden="true"><RotateCcw /></span>
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

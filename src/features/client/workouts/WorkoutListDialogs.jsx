import { formatIndividualWorkoutHistoryDate } from "../../../utils/workoutHistoryPresentation";
import styles from "./WorkoutListDialogs.module.css";

export function WorkoutModePickerDialog({
  open,
  workoutModePreference,
  rememberChoice,
  onClose,
  onOpenBasic,
  onOpenIndividual,
  onRememberChoiceChange
}) {
  if (!open) return null;
  const rememberChecked = Boolean(rememberChoice ?? workoutModePreference?.remember);

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="workout-list-dialogs"
      data-testid="workout-mode-dialog-overlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={styles.dialog}
        data-testid="workout-mode-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="workoutModeModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header} data-testid="workout-mode-dialog-header">
          <div>
            <small className={styles.eyebrow}>ТРЕНИРОВКИ</small>
            <h2 className={styles.title} id="workoutModeModalTitle">Режим запуска</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            data-testid="workout-mode-dialog-close"
            aria-label="Закрыть выбор режима"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.options} data-testid="workout-mode-dialog-options">
          <button
            type="button"
            className={`${styles.option} ${workoutModePreference.mode === "basic" ? styles.optionActive : ""}`}
            data-testid="workout-mode-option"
            aria-pressed={workoutModePreference.mode === "basic"}
            onClick={onOpenBasic}
          >
            <span className={styles.optionIcon}>Б</span>
            <div className={styles.optionContent}>
              <strong className={styles.optionTitle}>Базовые тренировки</strong>
              <small className={styles.optionDescription}>Подбор готовой программы по цели и опыту</small>
            </div>
            <i className={styles.optionIndicator}>›</i>
          </button>

          <button
            type="button"
            className={`${styles.option} ${workoutModePreference.mode === "individual" ? styles.optionActive : ""}`}
            data-testid="workout-mode-option"
            aria-pressed={workoutModePreference.mode === "individual"}
            onClick={onOpenIndividual}
          >
            <span className={styles.optionIcon}>И</span>
            <div className={styles.optionContent}>
              <strong className={styles.optionTitle}>Индивидуальный план</strong>
              <small className={styles.optionDescription}>Программа, назначенная вашим тренером</small>
            </div>
            <i className={styles.optionIndicator}>✓</i>
          </button>
        </div>

        <label className={styles.remember} data-testid="workout-mode-dialog-remember">
          <input
            type="checkbox"
            className={styles.rememberInput}
            checked={rememberChecked}
            onChange={(event) => onRememberChoiceChange?.(event.target.checked)}
          />
          <span>Запомнить выбор</span>
        </label>
      </section>
    </div>
  );
}

export function IndividualWorkoutHistoryDialog({
  open,
  historyLoading,
  historyItems,
  onClose,
  onOpenAll
}) {
  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      data-testid="workout-history-dialog-overlay"
      data-css-module-scope="workout-list-dialogs"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={`${styles.dialog} ${styles.historyDialog}`}
        data-testid="workout-history-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="workoutHistoryModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header} data-testid="workout-history-dialog-header">
          <div>
            <small className={styles.eyebrow}>ИНДИВИДУАЛЬНЫЙ ПЛАН</small>
            <h2 className={styles.title} id="workoutHistoryModalTitle">История тренировок</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            data-testid="workout-history-dialog-close"
            aria-label="Закрыть историю тренировок"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.historyList} data-testid="workout-history-dialog-list">
          {historyLoading && <p className={styles.historyMessage}>Загрузка истории...</p>}

          {!historyLoading && historyItems.map((item) => (
            <div
              className={styles.historyItem}
              data-testid="workout-history-dialog-item"
              key={item.id || `${item.date}_${item.workout}`}
            >
              <span className={styles.historyIcon} aria-hidden="true">{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
              <div className={styles.historyContent}>
                <strong className={styles.historyTitle}>{item.workout || "Тренировка"}</strong>
                <small className={styles.historyMeta}>
                  {formatIndividualWorkoutHistoryDate(item.date)}
                  {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                </small>
              </div>
            </div>
          ))}

          {!historyLoading && historyItems.length === 0 && (
            <p className={styles.historyMessage}>В этой программе завершённых тренировок пока нет.</p>
          )}
        </div>

        {historyItems.length > 0 && (
          <button
            type="button"
            className={styles.historyAllButton}
            data-testid="workout-history-dialog-all"
            onClick={onOpenAll}
          >
            Открыть историю тренировок
          </button>
        )}
      </section>
    </div>
  );
}

import { formatIndividualWorkoutHistoryDate } from "../../../utils/workoutHistoryPresentation";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
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
        <ClientPageHeader
          compact
          embedded
          className={styles.header}
          title="Режим запуска"
          titleId="workoutModeModalTitle"
          testId="workout-mode-dialog-header"
          scope="workout-mode-dialog-header"
          onBack={onClose}
          backTestId="workout-mode-dialog-close"
          backAriaLabel="Закрыть выбор режима"
        />

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
        <ClientPageHeader
          compact
          embedded
          className={styles.header}
          title="История тренировок"
          titleId="workoutHistoryModalTitle"
          testId="workout-history-dialog-header"
          scope="workout-history-dialog-header"
          onBack={onClose}
          backTestId="workout-history-dialog-close"
          backAriaLabel="Закрыть историю тренировок"
        />

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

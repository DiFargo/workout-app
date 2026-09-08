import { useEffect, useState } from "react";
import { formatIndividualWorkoutHistoryDate } from "../../../utils/workoutHistoryPresentation";
import { Check, ChevronRight, ClipboardList, Dumbbell, Trophy, X } from "lucide-react";
import { ChevronDown as ChevronDownData, ChevronRight as ChevronRightData } from "lucide";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import MorphingIcon from "../../../shared/ui/MorphingIcon";
import styles from "./WorkoutListDialogs.module.css";

function useDismissDialog(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
}

function formatPlanDate(dateKey) {
  if (!dateKey) return "Дата уточняется";
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Дата уточняется";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function getHistorySummary(historyItems = []) {
  return historyItems.reduce((summary, item) => {
    const exercises = Array.isArray(item?.exercises)
      ? item.exercises
      : Array.isArray(item?.workout?.exercises)
        ? item.workout.exercises
        : [];
    exercises.forEach((exercise) => {
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      summary.sets += sets.length;
      sets.forEach((set) => {
        const weight = Number(String(set?.weight ?? set?.actualWeight ?? "").replace(",", "."));
        if (Number.isFinite(weight) && weight > summary.maxWeight) summary.maxWeight = weight;
      });
    });
    summary.minutes += Number(item?.durationSeconds) > 0
      ? Math.max(1, Math.round(Number(item.durationSeconds) / 60))
      : 0;
    return summary;
  }, { minutes: 0, sets: 0, maxWeight: 0 });
}

function DialogCloseButton({ testId, label, onClose }) {
  return (
    <button
      type="button"
      className={styles.modeCloseButton}
      data-testid={testId}
      aria-label={label}
      onClick={onClose}
    >
      <X aria-hidden="true" size={22} strokeWidth={2.25} />
    </button>
  );
}

export function WorkoutModePickerDialog({
  open,
  workoutModePreference,
  rememberChoice,
  onClose,
  onOpenBasic,
  onOpenIndividual,
  onRememberChoiceChange
}) {
  useDismissDialog(open, onClose);
  if (!open) return null;
  const rememberChecked = Boolean(rememberChoice ?? workoutModePreference?.remember);

  return (
    <div
      className={`${styles.overlay} ${styles.modeOverlay}`} data-modal-backdrop="true"
      data-css-module-scope="workout-list-dialogs"
      data-testid="workout-mode-dialog-overlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={`${styles.dialog} ${styles.modeDialog}`}
        data-testid="workout-mode-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-cabinet-sheet="true"
        aria-labelledby="workoutModeModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          className={styles.header}
          title="Режим тренировок"
          titleId="workoutModeModalTitle"
          testId="workout-mode-dialog-header"
          scope="workout-mode-dialog-header"
          actions={(
            <button
              type="button"
              className={styles.modeCloseButton}
              data-testid="workout-mode-dialog-dismiss"
              aria-label="Закрыть выбор режима"
              onClick={onClose}
            >
              <X aria-hidden="true" size={22} strokeWidth={2.25} />
            </button>
          )}
        />

        <div className={styles.options} data-testid="workout-mode-dialog-options">
          <button
            type="button"
            className={`${styles.option} ${workoutModePreference.mode === "basic" ? styles.optionActive : ""}`}
            data-testid="workout-mode-option"
            aria-pressed={workoutModePreference.mode === "basic"}
            onClick={onOpenBasic}
          >
            <span className={styles.optionIcon} aria-hidden="true"><Dumbbell /></span>
            <div className={styles.optionContent}>
              <strong className={styles.optionTitle}>Базовые тренировки</strong>
              <small className={styles.optionDescription}>Подбор готовой программы по цели и опыту</small>
            </div>
            <i className={styles.optionIndicator} aria-hidden="true">{workoutModePreference.mode === "basic" ? <Check /> : <ChevronRight />}</i>
          </button>

          <button
            type="button"
            className={`${styles.option} ${workoutModePreference.mode === "individual" ? styles.optionActive : ""}`}
            data-testid="workout-mode-option"
            aria-pressed={workoutModePreference.mode === "individual"}
            onClick={onOpenIndividual}
          >
            <span className={styles.optionIcon} aria-hidden="true"><ClipboardList /></span>
            <div className={styles.optionContent}>
              <strong className={styles.optionTitle}>Индивидуальный план</strong>
              <small className={styles.optionDescription}>Программа, назначенная вашим тренером</small>
            </div>
            <i className={styles.optionIndicator} aria-hidden="true">{workoutModePreference.mode === "individual" ? <Check /> : <ChevronRight />}</i>
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

export function WorkoutPlanDialog({
  open,
  programName,
  completedCount,
  workouts = [],
  onClose,
  onSelectWorkout
}) {
  useDismissDialog(open, onClose);
  if (!open) return null;

  const upcomingCount = workouts.filter((workout) => !workout.completed).length;

  return (
    <div className={styles.overlay} data-modal-backdrop="true" data-testid="workout-plan-dialog-overlay" role="presentation" onClick={onClose}>
      <section
        className={`${styles.dialog} ${styles.planDialog}`}
        data-testid="workout-plan-dialog"
        data-modal-surface="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workoutPlanModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          className={styles.header}
          title="План тренировок"
          titleId="workoutPlanModalTitle"
          testId="workout-plan-dialog-header"
          actions={<DialogCloseButton testId="workout-plan-dialog-close" label="Закрыть выбор тренировки" onClose={onClose} />}
        />

        <div className={styles.planSummary}>
          <span className={styles.planSummaryIcon}><Dumbbell aria-hidden="true" /></span>
          <span><strong>{programName || "Программа тренировок"}</strong><small>{completedCount} выполнено · {upcomingCount} впереди</small></span>
        </div>

        <div className={styles.planList} data-testid="workout-plan-dialog-list">
          {workouts.map((workout) => (
            <button
              type="button"
              className={`${styles.planItem} ${workout.active ? styles.planItemActive : ""} ${workout.completed ? styles.planItemCompleted : ""}`}
              data-testid="workout-plan-dialog-item"
              key={workout.id}
              disabled={workout.completed}
              aria-current={workout.active ? "true" : undefined}
              onClick={() => onSelectWorkout?.(workout.index)}
            >
              <span className={styles.planOrder}>{workout.completed ? <Check aria-hidden="true" /> : String(workout.index + 1).padStart(2, "0")}</span>
              <span className={styles.planCopy}>
                <strong>{workout.name}</strong>
                <small>{workout.exerciseCount} упражнений · {formatPlanDate(workout.date)}</small>
              </span>
              {workout.completed
                ? <em className={styles.planStatus}>Выполнена</em>
                : workout.active
                  ? <em className={styles.planStatus}>Выбрана</em>
                  : <ChevronRight aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function WorkoutProgramDialog({
  open,
  programName,
  completedCount,
  workouts = [],
  onClose
}) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  useDismissDialog(open, onClose);

  if (!open) return null;
  const visibleExpandedIndex = expandedIndex ?? workouts.find((workout) => workout.active)?.index ?? workouts[0]?.index ?? -1;

  return (
    <div className={styles.overlay} data-modal-backdrop="true" data-testid="workout-program-dialog-overlay" role="presentation" onClick={onClose}>
      <section
        className={`${styles.dialog} ${styles.programDialog}`}
        data-testid="workout-program-dialog"
        data-modal-surface="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workoutProgramModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          className={styles.header}
          title="Программа тренировок"
          titleId="workoutProgramModalTitle"
          testId="workout-program-dialog-header"
          actions={<DialogCloseButton testId="workout-program-dialog-close" label="Закрыть программу тренировок" onClose={onClose} />}
        />

        <div className={styles.planSummary}>
          <span className={styles.planSummaryIcon}><Dumbbell aria-hidden="true" /></span>
          <span><strong>{programName || "Программа тренировок"}</strong><small>{workouts.length} тренировок · {completedCount} выполнено</small></span>
        </div>

        <div className={styles.programList} data-testid="workout-program-dialog-list">
          {workouts.map((workout) => {
            const expanded = workout.index === visibleExpandedIndex;
            return (
              <section className={`${styles.programWorkout} ${expanded ? styles.programWorkoutExpanded : ""}`} key={workout.id}>
                <button
                  type="button"
                  className={styles.programWorkoutHeader}
                  data-testid="workout-program-dialog-item"
                  aria-expanded={expanded}
                  onClick={() => setExpandedIndex(expanded ? -1 : workout.index)}
                >
                  <span className={styles.planOrder}>{workout.completed ? <Check aria-hidden="true" /> : String(workout.index + 1).padStart(2, "0")}</span>
                  <span className={styles.planCopy}><strong>{workout.name}</strong><small>{formatPlanDate(workout.date)} · {workout.exerciseCount} упражнений</small></span>
                  <MorphingIcon
                    icon={expanded ? ChevronDownData : ChevronRightData}
                    data-icon-state={expanded ? "expanded" : "collapsed"}
                  />
                </button>
                {expanded && (
                  <ol className={styles.exerciseList} data-testid="workout-program-exercise-list">
                    {workout.exercises.length ? workout.exercises.map((exercise, exerciseIndex) => (
                      <li key={`${workout.id}-${exerciseIndex}`}>
                        <span>{exerciseIndex + 1}</span>
                        <div><strong>{exercise.name}</strong><small>{exercise.detail}</small></div>
                      </li>
                    )) : <li className={styles.exerciseEmpty}>Упражнения пока не добавлены.</li>}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function IndividualWorkoutHistoryDialog({
  open,
  historyLoading,
  historyItems = [],
  onClose
}) {
  useDismissDialog(open, onClose);
  if (!open) return null;
  const summary = getHistorySummary(historyItems);

  return (
    <div
      className={styles.overlay} data-modal-backdrop="true"
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
          title="История и рекорды"
          titleId="workoutHistoryModalTitle"
          testId="workout-history-dialog-header"
          scope="workout-history-dialog-header"
          actions={<DialogCloseButton testId="workout-history-dialog-close" label="Закрыть историю тренировок" onClose={onClose} />}
        />

        <div className={styles.historyStats} data-testid="workout-history-dialog-stats">
          <span><strong>{historyItems.length}</strong><small>тренировки</small></span>
          <span><strong>{summary.minutes || "—"}</strong><small>минут</small></span>
          <span><strong>{summary.maxWeight ? `${summary.maxWeight} кг` : "—"}</strong><small>макс. вес</small></span>
        </div>

        <div className={styles.historyList} data-testid="workout-history-dialog-list">
          {historyLoading && <p className={styles.historyMessage}>Загрузка истории...</p>}

          {!historyLoading && historyItems.map((item) => (
            <div
              className={styles.historyItem}
              data-testid="workout-history-dialog-item"
              key={item.id || `${item.date}_${item.workout}`}
            >
              <span className={styles.historyIcon} aria-hidden="true"><Trophy /></span>
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

      </section>
    </div>
  );
}

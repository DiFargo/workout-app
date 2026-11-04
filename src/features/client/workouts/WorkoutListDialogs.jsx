import { useEffect, useMemo, useRef, useState } from "react";
import { formatIndividualWorkoutHistoryDate } from "../../../utils/workoutHistoryPresentation";
import { CalendarDays, Check, ChevronRight, ClipboardList, Clock3, Dumbbell, Trophy, X } from "lucide-react";
import { ChevronDown as ChevronDownData, ChevronRight as ChevronRightData } from "lucide";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import MorphingIcon from "../../../shared/ui/MorphingIcon";
import styles from "./WorkoutListDialogs.module.css";
import { formatRussianCount } from "../../../utils/russianCount.js";
import { buildWorkoutHistoryAchievements } from "./workoutHistoryAchievements.js";

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

function formatHistoryMinutes(minutes) {
  if (minutes > 0 && minutes < 1) return "<1 мин";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60), rest = total % 60;
  return hours ? `${hours} ч${rest ? ` ${rest} мин` : ""}` : `${total} мин`;
}

function historyRecordDuration(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return "";
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? formatHistoryMinutes(seconds / 60) : "";
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
                <small>{formatRussianCount(workout.exerciseCount, ["упражнение", "упражнения", "упражнений"])} · {formatPlanDate(workout.date)}</small>
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
                  <span className={styles.planOrder}>{workout.completed ? <Check aria-hidden="true" /> : String(workout.programOrder ?? workout.index + 1).padStart(2, "0")}</span>
                  <span className={styles.planCopy}><strong>{workout.name}</strong><small>{formatPlanDate(workout.date)} · {formatRussianCount(workout.exerciseCount, ["упражнение", "упражнения", "упражнений"])}</small></span>
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
  historyLoader,
  historyOwnerKey = "",
  onClose
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [attempt, setAttempt] = useState(0);
  const [historyState, setHistoryState] = useState({ status: "idle", ownerKey: historyOwnerKey, items: [], isCurrent: null });
  const loaderRef = useRef(historyLoader);
  useEffect(() => { loaderRef.current = historyLoader; }, [historyLoader]);
  useEffect(() => {
    let active = true;
    const reset = { ownerKey: historyOwnerKey, items: [], isCurrent: null };
    // This state is a request lifecycle, not a second copy of derived history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(12);
    if (!open) {
      setHistoryState({ ...reset, status: "idle" });
      return undefined;
    }
    const load = loaderRef.current;
    if (typeof load !== "function") {
      setHistoryState({ ...reset, status: "unavailable" });
      return undefined;
    }
    setHistoryState({ ...reset, status: "loading" });
    Promise.resolve().then(() => active ? load() : undefined).then(result => {
      if (!active) return;
      if (typeof result?.isCurrent !== "function" || result.isCurrent() !== true) {
        setHistoryState({ ...reset, status: "stale" });
        return;
      }
      if (!Array.isArray(result.items)) throw new Error("Incomplete workout history result");
      setHistoryState({ ownerKey: historyOwnerKey, status: "ready", items: result.items, isCurrent: result.isCurrent });
    }).catch(() => {
      if (active) setHistoryState({ ...reset, status: "error" });
    });
    return () => { active = false; };
  }, [open, attempt, historyOwnerKey]);
  useDismissDialog(open, onClose);

  const ownerMatches = historyState.ownerKey === historyOwnerKey;
  const allTimeReady = ownerMatches && historyState.status === "ready" && historyState.isCurrent?.() === true;
  const stale = ownerMatches && (historyState.status === "stale" || historyState.status === "ready" && !allTimeReady);
  const loading = typeof historyLoader === "function" && (!ownerMatches || ["idle", "loading"].includes(historyState.status));
  const summary = useMemo(() => buildWorkoutHistoryAchievements(historyState.items), [historyState.items]);
  const programSummary = useMemo(() => buildWorkoutHistoryAchievements(historyItems), [historyItems]);
  const items = stale || !ownerMatches ? [] : allTimeReady ? summary.confirmedItems : historyLoading ? [] : programSummary.confirmedItems;
  const retry = () => {
    setHistoryState({ status: "loading", ownerKey: historyOwnerKey, items: [], isCurrent: null });
    setAttempt(value => value + 1);
  };
  if (!open) return null;

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

        <div className={styles.historyBody} aria-busy={loading}>
          {loading && <div className={styles.historyLoadNotice} role="status"><strong>Загружаем историю за всё время…</strong><span>Собираем подтверждённые тренировки из всех программ.</span></div>}
          {!allTimeReady && !loading && <div className={styles.historyLoadNotice} role={stale || historyState.status === "error" ? "alert" : "status"}>
            <strong>{stale ? "История недоступна для текущей сессии" : historyState.status === "error" ? "Не удалось загрузить полную историю" : "Полная история пока недоступна"}</strong>
            <span>{stale ? "Обновите историю. Данные предыдущей сессии не показаны." : "Ниже — только текущая программа. Итоги за всё время пока не рассчитаны."}</span>
            {typeof historyLoader === "function" && <button type="button" className={styles.historyRetry} onClick={retry}>Повторить загрузку</button>}
          </div>}

          {allTimeReady && <>
            <section className={styles.historyHero} data-testid="workout-history-all-time" aria-label="Итоги за всё время">
              <span className={styles.historyEyebrow}><Trophy size={16} aria-hidden="true" /> ЗА ВСЁ ВРЕМЯ</span>
              <h2>Всего {formatRussianCount(summary.completedCount, ["тренировка", "тренировки", "тренировок"])}</h2>
              <p>Все ваши программы{summary.firstDate ? ` · ${summary.undatedCount ? "первая известная дата — " : "с "}${formatIndividualWorkoutHistoryDate(summary.firstDate)}` : ""}</p>
            </section>
            <div className={styles.historyStats} data-testid="workout-history-dialog-stats">
              <span><Clock3 size={17} aria-hidden="true" /><strong>{summary.durationRecordCount ? formatHistoryMinutes(summary.durationMinutesKnown) : "—"}</strong><small>время по записям</small></span>
              <span><CalendarDays size={17} aria-hidden="true" /><strong>{summary.activeWeeks}</strong><small>активные недели</small></span>
            </div>
            {summary.completedCount > 0 && summary.durationRecordCount < summary.completedCount && <p className={styles.historyDataNote}>{summary.durationRecordCount ? `Время указано у ${summary.durationRecordCount} из ${summary.completedCount} тренировок — итог неполный.` : "Время тренировок в истории не указано. По плану его не оцениваем."}</p>}
            {summary.undatedCount > 0 && <p className={styles.historyDataNote}>У {summary.undatedCount} тренировок нет точной даты: они включены в общее число, но не в статистику недель и последних 30 дней.</p>}
            <div className={styles.historyHighlights}>
              <section><small>Достигнутый рубеж</small><strong>{summary.milestone ? formatRussianCount(summary.milestone, ["тренировка", "тренировки", "тренировок"]) : "Первая тренировка впереди"}</strong></section>
              <section><small>За последние 30 дней</small><strong>{formatRussianCount(summary.recent30Count, ["тренировка", "тренировки", "тренировок"])}</strong></section>
            </div>
            {summary.bestWeek && <p className={styles.historyBestWeek}>Лучшая неделя — {formatRussianCount(summary.bestWeek.count, ["тренировка", "тренировки", "тренировок"])}<span>с {formatIndividualWorkoutHistoryDate(summary.bestWeek.start)}</span></p>}
            {summary.pendingCount > 0 && <p className={styles.historyDataNote}>Записи на устройстве ({summary.pendingCount}) не входят в общие итоги до синхронизации.</p>}
          </>}

          {!stale && ownerMatches && !loading && <>
            <p className={styles.historyProgramNote} data-testid="workout-history-program-count">{historyLoading ? "История текущей программы загружается…" : `В текущей программе: ${formatRussianCount(programSummary.completedCount, ["тренировка", "тренировки", "тренировок"])}.`}</p>
            <h3 className={styles.historyListTitle}>{allTimeReady ? "Последние тренировки" : "Текущая программа"}</h3>
            <div className={styles.historyList} data-testid="workout-history-dialog-list">
              {!allTimeReady && historyLoading && <p className={styles.historyMessage}>Загрузка истории текущей программы…</p>}
              {items.slice(0, visibleCount).map((item) => {
                const duration = historyRecordDuration(item.durationSeconds);
                return <div className={styles.historyItem} data-testid="workout-history-dialog-item" key={item.id || item.clientSaveId || `${item.date}_${item.workout}`}>
                  <span className={styles.historyIcon} aria-hidden="true"><Dumbbell /></span>
                  <div className={styles.historyContent}>
                    <strong className={styles.historyTitle}>{item.workoutName || (typeof item.workout === "string" ? item.workout : item.workout?.name) || "Тренировка"}</strong>
                    <small className={styles.historyMeta}>{formatIndividualWorkoutHistoryDate(item.completedAt || item.finishedAt || item.date)}{duration ? ` · ${duration}` : ""}</small>
                  </div>
                </div>;
              })}
              {items.length > visibleCount && <button type="button" className={styles.historyMore} onClick={() => setVisibleCount(count => count + 12)}>Показать ещё · осталось {items.length - visibleCount}</button>}
              {items.length === 0 && (allTimeReady || !historyLoading) && <p className={styles.historyMessage}>{allTimeReady ? "Здесь появятся ваши завершённые тренировки. Каждая сохранённая тренировка будет учтена." : "В этой программе завершённых тренировок пока нет."}</p>}
            </div>
          </>}
        </div>

      </section>
    </div>
  );
}

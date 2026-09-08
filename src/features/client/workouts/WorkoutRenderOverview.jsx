import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, ChevronRight, Dumbbell, Info, MoonStar, RotateCcw, Trophy, X } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import { ClientMainBottomBar } from "../../../shared/ui/BottomBar";
import weeklyCalendarStyles from "../../../shared/ui/WeeklyCalendar.module.css";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";
import styles from "./WorkoutRenderOverview.module.css";
import responsiveFixStyles from "./WorkoutRenderOverviewResponsiveFix.module.css";

function formatWorkoutDateLabel(dateKey, fallback = "Дата не назначена") {
  if (!dateKey) return fallback;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

function getWeekDays(centerDateKey, scheduledDates = [], todayDateKey = "") {
  const center = centerDateKey ? new Date(`${centerDateKey}T12:00:00`) : new Date();
  const safeCenter = Number.isNaN(center.getTime()) ? new Date() : center;
  const mondayOffset = (safeCenter.getDay() + 6) % 7;
  const monday = new Date(safeCenter);
  monday.setDate(safeCenter.getDate() - mondayOffset);
  const planned = new Set(scheduledDates);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      weekday: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][index],
      day: date.getDate(),
      planned: planned.has(key),
      active: key === todayDateKey
    };
  });
}

const STATE_COPY = {
  draft: { eyebrow: "Тренировка в процессе", title: "Продолжите с того же места", description: "Результаты уже сохранены в черновике.", primary: "Продолжить тренировку", icon: Dumbbell },
  completed: { eyebrow: "Тренировка завершена", title: "Отличная работа сегодня", description: "Результаты сохранены в истории тренировок.", primary: "Посмотреть результат", icon: Trophy },
  today: { eyebrow: "Тренировка сегодня", title: "Всё готово к тренировке", description: "Начните по плану, когда будете готовы.", primary: "Начать тренировку", icon: Dumbbell },
  shifted: { eyebrow: "Программа продолжается", title: "Начните со следующей тренировки", description: "Пропущенные дни не меняют порядок: план продолжится от сегодняшней тренировки.", primary: "Начать тренировку", icon: RotateCcw },
  missed: { eyebrow: "Тренировка пропущена", title: "Вернитесь к плану сегодня", description: "Можно выполнить тренировку сейчас или выбрать новую дату.", primary: "Начать сейчас", secondary: "Перенести", icon: RotateCcw },
  recovery: { eyebrow: "Отдых и восстановление", title: "Сегодня тренировки нет", description: "Отдохните, соблюдайте питание и добавьте лёгкую активность.", primary: "Начать раньше", icon: MoonStar },
  unscheduled: { eyebrow: "Без расписания", title: "На сегодня тренировка не назначена", description: "Выберите следующую незавершённую тренировку из плана.", primary: "Выбрать тренировку", icon: CalendarDays },
  "program-complete": { eyebrow: "Программа завершена", title: "Все тренировки выполнены", description: "Ваши результаты и рекорды сохранены в истории.", primary: "Посмотреть результаты", icon: Trophy }
};

function ActionDialog({ mode, workout, workoutDate, onClose, onConfirm, onReschedule }) {
  const [dateKey, setDateKey] = useState("");
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  useEffect(() => {
    if (!mode) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, onClose]);
  if (!mode) return null;

  const reschedule = mode === "reschedule";
  const handleSave = async () => {
    if (!dateKey || saving) return;
    setSaving(true);
    const saved = await onReschedule?.(dateKey);
    setSaving(false);
    if (saved !== false) onClose();
  };

  return (
    <div className={`${styles.modalOverlay} ${responsiveFixStyles.modalOverlay}`} data-modal-backdrop="true" role="presentation" onClick={onClose} data-testid="workout-today-action-overlay">
      <section className={`${styles.modal} ${responsiveFixStyles.modal}`} data-modal-surface="true" role="dialog" aria-modal="true" aria-labelledby="workoutTodayDialogTitle" onClick={(event) => event.stopPropagation()}>
        <button className={styles.modalClose} type="button" aria-label="Закрыть" onClick={onClose}><X aria-hidden="true" /></button>
        <span className={styles.modalIcon}>{reschedule ? <CalendarDays aria-hidden="true" /> : <Dumbbell aria-hidden="true" />}</span>
        <h2 id="workoutTodayDialogTitle">{reschedule ? "Перенести тренировку" : "Начать тренировку раньше?"}</h2>
        <p>{reschedule
          ? `${workout?.name || "Тренировка"} была назначена на ${formatWorkoutDateLabel(workoutDate).toLowerCase()}. Выберите новую дату: если этот день занят, следующие тренировки автоматически сдвинутся, сохранив порядок программы.`
          : `${workout?.name || "Тренировка"} запланирована на ${formatWorkoutDateLabel(workoutDate).toLowerCase()}. Плановая дата сохранится, а фактическое выполнение будет отмечено сегодняшним числом.`}</p>
        {reschedule ? <label className={`${styles.dateField} ${responsiveFixStyles.dateField}`}><span>Новая дата</span><input className={responsiveFixStyles.dateInput} type="date" min={todayKey} value={dateKey} onChange={(event) => setDateKey(event.target.value)} /></label> : null}
        <button className={styles.modalPrimary} type="button" disabled={reschedule && (!dateKey || saving)} onClick={reschedule ? handleSave : onConfirm}>
          {saving ? "Сохраняем…" : reschedule ? "Сохранить дату" : "Начать сегодня"}
        </button>
      </section>
    </div>
  );
}

export default function WorkoutRenderOverview({
  workout, workoutDate, scheduledDates = [], programName, index = 0, total = 0, completedCount = 0,
  programType = "individual", todayState = "today", missedCount = 0, isTrainerMode, renderBottomBar, onOpen, onViewResult,
  onReschedule, onHistory, onPlan, onProgram, onCreateBasicWorkout, navigation
}) {
  const [dialogMode, setDialogMode] = useState("");
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const weekDays = getWeekDays(workoutDate || todayKey, scheduledDates, todayKey);
  const exerciseCount = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
  const setCount = (workout?.exercises || []).reduce((sum, exercise) => sum + (Array.isArray(exercise?.sets) ? exercise.sets.length : Number(exercise?.sets || exercise?.approaches) || 0), 0);
  const state = STATE_COPY[todayState] || STATE_COPY.today;
  const StateIcon = state.icon;
  const upcoming = ["recovery", "unscheduled"].includes(todayState);
  const completed = ["completed", "program-complete"].includes(todayState);
  const handlePrimary = () => {
    if (todayState === "unscheduled") return onPlan?.();
    if (completed) return (onViewResult || onHistory)?.();
    if (todayState === "recovery") return setDialogMode("early");
    return onOpen?.();
  };

  return (
    <div className={`${styles.page} ${adaptiveShellStyles.shell}`} data-client-adaptive-shell="true" data-testid="workout-render-overview">
      <ClientPageHeader
        className={styles.header}
        title="Тренировки"
        titleAlign="start"
        titleTestId="workout-list-title"
        testId="workout-list-header"
        scope="workout-render-header"
        primary
      />
      <main className={styles.content}>
        <section className={`${styles.week} ${weeklyCalendarStyles.root}`} data-week-calendar="workouts" data-testid="workout-week-calendar" aria-label="Неделя ближайшей тренировки">
          {weekDays.map((day) => <span className={day.active ? styles.activeDay : ""} key={day.key} data-week-calendar-day data-active={day.active ? "true" : "false"} data-date={day.key} data-planned={day.planned ? "true" : "false"} aria-current={day.active ? "date" : undefined}><small data-week-calendar-label>{day.weekday}</small><strong data-week-calendar-number>{day.day}</strong>{day.planned && !day.active ? <i data-week-calendar-dot aria-label={`${day.weekday} ${day.day}: запланирована тренировка`} /> : null}</span>)}
        </section>

        <div className={styles.sectionHead}><h2>{upcoming ? "Следующая тренировка" : "Сегодня"}</h2><button type="button" data-testid="workout-plan-button" onClick={onPlan}>Расписание</button></div>
        <section className={`${styles.workoutCard} ${styles[`state_${todayState}`] || ""}`} data-testid="workout-today-card" data-state={todayState}>
          <div data-testid="workout-list-card">
          <div className={styles.workoutLabel}><span>{programType === "basic" ? "Базовая программа" : "Индивидуальная программа"}</span><small>{todayState === "draft" ? "В процессе" : todayState === "missed" ? "Перенос" : formatWorkoutDateLabel(workoutDate, "Без даты")}</small></div>
          {!completed ? <div className={styles.workoutSummary}><span className={styles.order}>{String(index + 1).padStart(2, "0")}</span><span className={styles.workoutCopy}><strong>{workout?.name || `Тренировка ${index + 1}`}</strong><small>Тренировка {index + 1}</small></span></div> : <h2 className={styles.completedTitle}>{state.title}</h2>}
          {!completed ? <div className={styles.exerciseMeta}><p>{exerciseCount} упражнений{setCount ? ` · ${setCount} подходов` : ""}{["today", "draft"].includes(todayState) ? null : <><br />{state.description}</>}</p><StateIcon aria-hidden="true" /></div> : <p className={styles.advice}>{state.description}</p>}
          {todayState === "missed" && missedCount > 1 ? <p className={styles.advice}>Пропущено: {missedCount}. Порядок программы сохраняется.</p> : null}
          {todayState === "draft" ? <div className={styles.progress} data-testid="workout-list-progress" style={{ "--exercise-count": Math.max(exerciseCount, 1) }} aria-label={`${exerciseCount} упражнений`}>{Array.from({ length: Math.max(exerciseCount, 1) }, (_, itemIndex) => <span key={itemIndex} />)}</div> : null}
          <div className={styles.actions}><button className={styles.start} type="button" data-testid="workout-start-button" onClick={handlePrimary}>{state.primary}<ArrowRight aria-hidden="true" /></button>{state.secondary ? <button className={styles.secondary} type="button" onClick={() => setDialogMode("reschedule")}>{state.secondary}</button> : null}</div>
          </div>
        </section>

        <div className={styles.sectionHead}><h2>Ваша программа</h2></div>
        <section className={styles.program}>
          <div className={styles.programHead}><span className={styles.programIcon}><Dumbbell aria-hidden="true" /></span><span><strong>{programName || "Программа тренировок"}</strong><small>{programType === "basic" ? "Базовые тренировки" : "Программа от тренера"}</small></span></div>
          <div className={styles.programProgress}><span>{completedCount} из {total} тренировок</span><span>{Math.max(total - completedCount, 0)} осталось</span></div>
          <div className={styles.programTrack} role="progressbar" aria-label="Прогресс программы" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={Math.max(total, completedCount, 1)}><span style={{width: `${total ? Math.min(100, completedCount / total * 100) : 0}%`}} /></div>
          <div className={styles.programBottom} data-testid={programType === "basic" ? "basic-workout-management" : undefined}><button type="button" data-testid="workout-program-button" onClick={onProgram}>Открыть программу<ChevronRight aria-hidden="true" /></button>{programType === "basic" ? <button type="button" data-testid="basic-manage-plan" onClick={onCreateBasicWorkout}><CalendarDays aria-hidden="true" />Изменить</button> : null}</div>
        </section>
        <button type="button" className={styles.historyRow} data-testid="workout-records-button" onClick={onHistory}><span className={styles.historyIcon}><ChartNoAxesColumnIncreasing aria-hidden="true" /></span><span><strong>История и рекорды</strong><small>Выполнено тренировок: {completedCount}</small></span><ChevronRight aria-hidden="true" /></button>
        <p className={styles.managementHint}><Info aria-hidden="true" />Вы выбираете дни. Порядок тренировок в программе сохраняется.</p>
      </main>
      {renderBottomBar ? renderBottomBar("workouts") : <ClientMainBottomBar active="workouts" isTrainerMode={isTrainerMode} {...navigation} />}
      <ActionDialog mode={dialogMode} workout={workout} workoutDate={workoutDate} onClose={() => setDialogMode("")} onConfirm={() => { setDialogMode(""); onOpen?.(); }} onReschedule={onReschedule} />
    </div>
  );
}

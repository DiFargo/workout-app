import { ChevronRight, Dumbbell } from "lucide-react";
import styles from "./ProfileWorkoutCalendarModal.module.css";
import { getWorkoutCalendarDayStatuses, WORKOUT_CALENDAR_STATUSES } from "./workoutCalendarPresentation.js";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function ProfileWorkoutCalendarContent({
  monthDate,
  monthKey,
  calendarDays = [],
  selectedDate,
  selectedItems = [],
  scheduledDates = [],
  draftDates = [],
  canEditSchedule = true,
  isTrainerManaged = false,
  scheduleRequiredCount = 0,
  editing,
  saving,
  status,
  getTimestampValue,
  onShiftMonth,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDayClick,
  onOpenHistory
}) {
  const currentDates = editing ? draftDates : scheduledDates;
  const scheduledThisMonth = scheduledDates.filter((dateKey) => dateKey.startsWith(monthKey)).length;
  const selectedDayScheduled = currentDates.includes(selectedDate);
  const selectedDay = calendarDays.find((day) => day.key === selectedDate);
  const selectedStatuses = getWorkoutCalendarDayStatuses(selectedDay, editing);
  const scheduleCountLabel = scheduleRequiredCount === 1
    ? "1 дату"
    : `${scheduleRequiredCount} дат`;

  return (
    <div
      className={styles.calendar}
      data-testid="profile-workout-calendar"
      data-css-module-scope="profile-workout-calendar"
    >
      <div className={styles.navigation}>
        <button className={styles.navigationButton} data-testid="profile-workout-calendar-shift" type="button" onClick={() => onShiftMonth(-1)} aria-label="Предыдущий месяц">
          ‹
        </button>
        <strong className={styles.navigationTitle}>
          {monthDate.toLocaleDateString("ru-RU", {
            month: "long",
            year: "numeric"
          })}
        </strong>
        <button className={styles.navigationButton} data-testid="profile-workout-calendar-shift" type="button" onClick={() => onShiftMonth(1)} aria-label="Следующий месяц">
          ›
        </button>
      </div>

      <div className={styles.planner}>
        <div className={styles.plannerContent}>
          <strong className={styles.plannerTitle}>{editing ? "Выберите дни тренировок" : "План на месяц"}</strong>
          <small className={styles.plannerDescription}>
            {editing
              ? scheduleRequiredCount
                ? `Выберите ${scheduleCountLabel}; программа останется без изменений.`
                : "Нажимай на даты текущего месяца"
              : isTrainerManaged
                ? "Вы выбираете дни, а тренер видит изменения."
                : `${scheduledThisMonth} дней запланировано`}
          </small>
        </div>
        {canEditSchedule && (
          editing ? (
            <div className={styles.editActions} data-testid="profile-workout-calendar-edit-actions">
              <button className={`${styles.actionButton} ${styles.secondaryAction}`} type="button" disabled={saving} onClick={onCancelEdit}>
                Отмена
              </button>
              <button className={styles.actionButton} type="button" disabled={saving} onClick={onSave}>
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          ) : (
            <button className={styles.plannerButton} data-testid="profile-workout-calendar-edit" type="button" onClick={onStartEdit}>
              Изменить расписание
            </button>
          )
        )}
      </div>

      {editing && isTrainerManaged && (
        <p className={styles.coordinationNote}>
          Упражнения, их порядок и объём остаются под управлением тренера.
        </p>
      )}

      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span className={styles.weekday} key={day}>{day}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {calendarDays.map((day) => {
          const dayStatuses = getWorkoutCalendarDayStatuses(day, editing);
          const hasHistoryWorkouts = !editing && day.workouts.length > 0;
          const visualStatus = WORKOUT_CALENDAR_STATUSES[dayStatuses[0]]?.className || "";
          const entryLabel = day.scheduleEntries.map((entry) => `№${entry.order}`).join(", ");
          const historyLabel = day.workouts.length > 1 ? `${day.workouts.length}×` : "";

          return (
            <button
              type="button"
              data-testid="profile-workout-calendar-day"
              data-date={day.key}
              data-status={dayStatuses.join(" ")}
              key={day.key}
              className={[
                styles.dayButton,
                day.isCurrentMonth ? "" : styles.outside,
                day.isToday ? styles.today : "",
                day.scheduleEntries.length ? styles.hasWorkout : "",
                editing && day.isScheduled ? styles.scheduled : "",
                visualStatus ? styles[visualStatus] : "",
                editing ? styles.editing : "",
                editing && day.isScheduleLocked ? styles.locked : "",
                day.key === selectedDate ? styles.selected : ""
              ].filter(Boolean).join(" ")}
              disabled={editing && !day.isCurrentMonth}
              onClick={() => onDayClick(day)}
              aria-pressed={day.key === selectedDate}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={[
                day.date.toLocaleDateString("ru-RU"),
                entryLabel ? `тренировка ${entryLabel}` : "",
                ...dayStatuses.map((status) => WORKOUT_CALENDAR_STATUSES[status].description),
                day.workouts.length ? `тренировок выполнено: ${day.workouts.length}` : "",
                day.isScheduleLocked ? "дата выполненной тренировки недоступна для изменения" : ""
              ].filter(Boolean).join(", ")}
            >
              <span>{day.date.getDate()}</span>
              {(dayStatuses.length > 0 || entryLabel || hasHistoryWorkouts) && (
                <span className={styles.dayStatusMarks}>
                  {dayStatuses.map((status) => (
                    <i key={status} className={`${styles.statusMark} ${styles[WORKOUT_CALENDAR_STATUSES[status].className]}`} aria-hidden="true">
                      {WORKOUT_CALENDAR_STATUSES[status].symbol}
                    </i>
                  ))}
                  {(entryLabel || historyLabel) && <i className={styles.dayBadge}>{entryLabel || historyLabel}</i>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.legend} aria-label="Легенда статусов тренировок">
        {Object.entries(WORKOUT_CALENDAR_STATUSES).map(([status, definition]) => (
          <span key={status} className={styles.legendItem} title={definition.description} data-calendar-legend={status}>
            <i className={`${styles.statusMark} ${styles[definition.className]}`} aria-hidden="true">{definition.symbol}</i>
            {definition.label}
          </span>
        ))}
      </div>

      {status && (
        <p className={`${styles.status} ${(status.includes("сохранены") || status.includes("сохранено")) ? styles.success : ""}`} role="status" aria-live="polite">
          {status}
        </p>
      )}

      <div className={styles.dayDetails}>
        <div>
          <span className={styles.dayDetailsLabel}>Выбранный день</span>
          <strong className={styles.dayDetailsTitle}>
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric"
            })}
          </strong>
          {selectedStatuses.map((status) => (
            <em key={status} className={styles.scheduledBadge} data-testid="profile-workout-calendar-selected-status">
              <i className={`${styles.statusMark} ${styles[WORKOUT_CALENDAR_STATUSES[status].className]}`} aria-hidden="true">{WORKOUT_CALENDAR_STATUSES[status].symbol}</i>
              {WORKOUT_CALENDAR_STATUSES[status].description}
            </em>
          ))}
        </div>

        {selectedItems.length ? (
          selectedItems.map((item) => (
            <button
              type="button"
              className={styles.historyItem}
              data-testid="profile-workout-calendar-history-item"
              key={item.id || `${item.date}_${item.workout}`}
              onClick={() => onOpenHistory(item.id)}
            >
              <span className={styles.historyIcon} aria-hidden="true"><Dumbbell /></span>
              <div className={styles.historyContent}>
                <strong className={styles.historyTitle}>{item.workout || "Тренировка"}</strong>
                <small className={styles.historyMeta}>
                  {new Date(getTimestampValue(item.date)).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                  {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                </small>
              </div>
              <i className={styles.historyIndicator} aria-hidden="true"><ChevronRight /></i>
            </button>
          ))
        ) : (
          <p className={styles.emptyDay}>
            {selectedStatuses.includes("missed")
              ? "Записи о выполнении нет. Если тренировка была, проверь её в истории."
              : selectedStatuses.includes("completed") || selectedStatuses.includes("completed_off_date")
                ? "Выполнение отмечено в расписании. Подробной записи в истории нет."
                : selectedStatuses.includes("shifted")
                  ? "Чтобы выбрать новую дату, нажми «Изменить расписание»."
                  : selectedStatuses.includes("planned") || (editing && selectedDayScheduled)
                    ? "Номер тренировки указан в календаре."
                    : "В этот день нет записей о тренировках."}
          </p>
        )}
      </div>
    </div>
  );
}

import styles from "./ProfileWorkoutCalendarModal.module.css";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const STATUS_ORDER = ["missed", "completed_off_date", "completed", "shifted", "planned"];

export function ProfileWorkoutCalendarContent({
  monthDate,
  monthKey,
  calendarDays = [],
  selectedDate,
  selectedItems = [],
  scheduledDates = [],
  draftDates = [],
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
          <strong className={styles.plannerTitle}>{editing ? "Выбери дни тренировок" : "План на месяц"}</strong>
          <small className={styles.plannerDescription}>
            {editing
              ? "Нажимай на даты текущего месяца"
              : `${scheduledThisMonth} дней запланировано`}
          </small>
        </div>
        {!editing && (
          <button className={styles.plannerButton} data-testid="profile-workout-calendar-edit" type="button" onClick={onStartEdit}>
            Изменить
          </button>
        )}
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span className={styles.weekday} key={day}>{day}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {calendarDays.map((day) => {
          const statusClass = STATUS_ORDER
            .find((candidate) => day.scheduleEntries.some((entry) => entry.status === candidate));
          const hasHistoryWorkouts = !editing && day.workouts.length > 0;
          const visualStatus = statusClass === "completed_off_date"
            ? "completedOffDate"
            : statusClass || (hasHistoryWorkouts ? "historyCompleted" : "");
          const entryLabel = day.scheduleEntries.map((entry) => `№${entry.order}`).join(", ");
          const historyLabel = day.workouts.length > 1 ? `${day.workouts.length}×` : "✓";

          return (
            <button
              type="button"
              data-testid="profile-workout-calendar-day"
              key={day.key}
              className={[
                styles.dayButton,
                day.isCurrentMonth ? "" : styles.outside,
                day.isToday ? styles.today : "",
                day.scheduleEntries.length ? styles.hasWorkout : "",
                day.isScheduled ? styles.scheduled : "",
                visualStatus ? styles[visualStatus] : "",
                editing ? styles.editing : "",
                day.key === selectedDate ? styles.selected : ""
              ].filter(Boolean).join(" ")}
              disabled={editing && !day.isCurrentMonth}
              onClick={() => onDayClick(day)}
              aria-pressed={day.key === selectedDate}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={[
                day.date.toLocaleDateString("ru-RU"),
                entryLabel ? `тренировка ${entryLabel}` : "",
                day.workouts.length ? `тренировок выполнено: ${day.workouts.length}` : ""
              ].filter(Boolean).join(", ")}
            >
              <span>{day.date.getDate()}</span>
              {day.scheduleEntries.length > 0 && <i className={styles.dayBadge}>{entryLabel}</i>}
              {!day.scheduleEntries.length && hasHistoryWorkouts && <i className={styles.dayBadge}>{historyLabel}</i>}
            </button>
          );
        })}
      </div>

      <div className={styles.legend} aria-label="Легенда статусов тренировок">
        <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.planned}`} />План</span>
        <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.completed}`} />В срок</span>
        <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.historyCompleted}`} />Прошлые</span>
        <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.completedOffDate}`} />Другой день</span>
        <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.missed}`} />Пропущена</span>
        <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.shifted}`} />Смещена</span>
      </div>

      {editing && (
        <div className={styles.editActions} data-testid="profile-workout-calendar-edit-actions">
          <button className={`${styles.actionButton} ${styles.secondaryAction}`} type="button" disabled={saving} onClick={onCancelEdit}>
            Отмена
          </button>
          <button className={styles.actionButton} type="button" disabled={saving} onClick={onSave}>
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      )}

      {status && (
        <p className={`${styles.status} ${status.includes("сохранены") ? styles.success : ""}`}>
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
          {currentDates.includes(selectedDate) && (
            <em className={styles.scheduledBadge}>Тренировка запланирована</em>
          )}
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
              <span className={styles.historyIcon} aria-hidden="true">🏋️</span>
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
              <i className={styles.historyIndicator}>›</i>
            </button>
          ))
        ) : (
          <p className={styles.emptyDay}>
            {selectedDayScheduled ? "Тренировка запланирована. Её номер указан в календаре." : "В этот день тренировок нет."}
          </p>
        )}
      </div>
    </div>
  );
}

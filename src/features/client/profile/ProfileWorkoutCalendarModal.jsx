const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const STATUS_ORDER = ["missed", "completed_off_date", "completed", "shifted", "planned"];

export default function ProfileWorkoutCalendarModal({
  open,
  modalBodyRef,
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
  onClose,
  onShiftMonth,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDayClick,
  onOpenHistory
}) {
  if (!open) {
    return null;
  }

  const currentDates = editing ? draftDates : scheduledDates;
  const scheduledThisMonth = scheduledDates.filter((dateKey) => dateKey.startsWith(monthKey)).length;

  return (
    <div className="cabinetUtilityModalOverlay" role="presentation" onClick={onClose}>
      <section
        className="cabinetUtilityModal cabinetProgressModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetProgressModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cabinetUtilityModalHead">
          <div>
            <span>ТРЕНИРОВКИ</span>
            <h2 id="cabinetProgressModalTitle">Календарь</h2>
          </div>
          <button type="button" aria-label="Закрыть календарь тренировок" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="cabinetUtilityModalBody" ref={modalBodyRef}>
          <div className="cabinetWorkoutCalendar">
            <div className="cabinetWorkoutCalendarNav">
              <button type="button" onClick={() => onShiftMonth(-1)} aria-label="Предыдущий месяц">
                ‹
              </button>
              <strong>
                {monthDate.toLocaleDateString("ru-RU", {
                  month: "long",
                  year: "numeric"
                })}
              </strong>
              <button type="button" onClick={() => onShiftMonth(1)} aria-label="Следующий месяц">
                ›
              </button>
            </div>

            <div className="cabinetWorkoutCalendarPlanner">
              <div>
                <strong>{editing ? "Выбери дни тренировок" : "План на месяц"}</strong>
                <small>
                  {editing
                    ? "Нажимай на даты текущего месяца"
                    : `${scheduledThisMonth} дней запланировано`}
                </small>
              </div>
              {!editing && (
                <button type="button" onClick={onStartEdit}>
                  Изменить
                </button>
              )}
            </div>

            <div className="cabinetWorkoutCalendarWeekdays" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="cabinetWorkoutCalendarGrid">
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
                    key={day.key}
                    className={[
                      day.isCurrentMonth ? "" : "outside",
                      day.isToday ? "today" : "",
                      day.scheduleEntries.length ? "hasWorkout" : "",
                      day.isScheduled ? "scheduled" : "",
                      hasHistoryWorkouts ? "hasHistoryWorkout" : "",
                      visualStatus || "",
                      editing ? "editing" : "",
                      day.key === selectedDate ? "selected" : ""
                    ].filter(Boolean).join(" ")}
                    disabled={editing && !day.isCurrentMonth}
                    onClick={() => onDayClick(day)}
                    aria-label={[
                      day.date.toLocaleDateString("ru-RU"),
                      entryLabel ? `тренировка ${entryLabel}` : "",
                      day.workouts.length ? `тренировок выполнено: ${day.workouts.length}` : ""
                    ].filter(Boolean).join(", ")}
                  >
                    <span>{day.date.getDate()}</span>
                    {day.scheduleEntries.length > 0 && <i>{entryLabel}</i>}
                    {!day.scheduleEntries.length && hasHistoryWorkouts && <i>{historyLabel}</i>}
                  </button>
                );
              })}
            </div>

            <div className="cabinetWorkoutCalendarLegend" aria-label="Легенда статусов тренировок">
              <span><i className="planned" />План</span>
              <span><i className="completed" />В срок</span>
              <span><i className="historyCompleted" />Прошлые</span>
              <span><i className="completedOffDate" />Другой день</span>
              <span><i className="missed" />Пропущена</span>
              <span><i className="shifted" />Смещена</span>
            </div>

            {editing && (
              <div className="cabinetWorkoutCalendarEditActions">
                <button type="button" className="secondary" disabled={saving} onClick={onCancelEdit}>
                  Отмена
                </button>
                <button type="button" disabled={saving} onClick={onSave}>
                  {saving ? "Сохраняю..." : "Сохранить"}
                </button>
              </div>
            )}

            {status && (
              <p className={status.includes("сохранены") ? "cabinetWorkoutCalendarStatus success" : "cabinetWorkoutCalendarStatus"}>
                {status}
              </p>
            )}

            <div className="cabinetWorkoutCalendarDay">
              <div>
                <span>Выбранный день</span>
                <strong>
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                </strong>
                {currentDates.includes(selectedDate) && (
                  <em>Тренировка запланирована</em>
                )}
              </div>

              {selectedItems.length ? (
                selectedItems.map((item) => (
                  <button
                    type="button"
                    key={item.id || `${item.date}_${item.workout}`}
                    onClick={() => onOpenHistory(item.id)}
                  >
                    <span aria-hidden="true">🏋️</span>
                    <div>
                      <strong>{item.workout || "Тренировка"}</strong>
                      <small>
                        {new Date(getTimestampValue(item.date)).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                        {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                      </small>
                    </div>
                    <i>›</i>
                  </button>
                ))
              ) : (
                <p>В этот день тренировок нет.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

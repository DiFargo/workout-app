export default function NutritionCalendarModal({
  monthLabel,
  days,
  onClose,
  onShiftMonth,
  onSelectDate,
  onSelectToday
}) {
  return (
    <div className="nutritionCalendarOverlay" role="dialog" aria-modal="true" aria-label="Календарь">
      <button
        type="button"
        className="nutritionCalendarBackdrop"
        onClick={onClose}
        aria-label="Закрыть календарь по фону"
      />

      <div className="nutritionCalendarSheet">
        <div className="nutritionCalendarGrabber" aria-hidden="true" />
        <button
          type="button"
          className="nutritionCalendarClose"
          onClick={onClose}
          aria-label="Закрыть календарь"
        >
          ×
        </button>

        <div className="nutritionCalendarHeader">
          <button type="button" onClick={() => onShiftMonth(-1)} aria-label="Предыдущий месяц">‹</button>
          <div>
            <span>Календарь питания</span>
            <strong>{monthLabel}</strong>
          </div>
          <button type="button" onClick={() => onShiftMonth(1)} aria-label="Следующий месяц">›</button>
        </div>

        <div className="nutritionCalendarWeekdays" aria-hidden="true">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="nutritionCalendarGrid">
          {days.map((day) => (
            <button
              type="button"
              key={day.key}
              className={[
                "nutritionCalendarDay",
                day.isCurrentMonth ? "" : "muted",
                day.isToday ? "today" : "",
                day.isSelected ? "selected" : "",
                day.hasFood ? "hasFood" : "",
                day.isOverGoal ? "overGoal" : ""
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectDate(day.key)}
              aria-pressed={day.isSelected}
              aria-current={day.isToday ? "date" : undefined}
            >
              <strong>{day.dayNumber}</strong>
              {day.hasFood && (
                <small>{day.calories} ккал</small>
              )}
            </button>
          ))}
        </div>

        <div className="nutritionCalendarFooter">
          <button type="button" onClick={onSelectToday}>Сегодня</button>
          <button type="button" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
}

import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./NutritionCalendarModal.module.css";

export default function NutritionCalendarModal({
  monthLabel,
  days,
  onClose,
  onShiftMonth,
  onSelectDate,
  onSelectToday
}) {
  return (
    <div
      className={styles.overlay}
      data-testid="nutrition-calendar-modal"
      data-css-module-scope="nutrition-calendar-modal"
    >
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Закрыть календарь по фону"
        data-nutrition-calendar-action="backdrop"
      />

      <div
        className={styles.sheet}
        data-testid="nutrition-calendar-sheet"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-label="Календарь"
      >
        <div className={styles.grabber} aria-hidden="true" data-nutrition-calendar-grabber />
        <ClientPageHeader
          compact
          embedded
          className={styles.pageHeader}
          title="Календарь питания"
          testId="nutrition-calendar-page-header"
          scope="nutrition-calendar-page-header"
          onBack={onClose}
          backTestId="nutrition-calendar-close"
          backAriaLabel="Закрыть календарь"
          backProps={{ "data-nutrition-calendar-action": "close" }}
        />

        <div className={styles.header} data-testid="nutrition-calendar-header">
          <button
            type="button"
            className={styles.monthAction}
            onClick={() => onShiftMonth(-1)}
            aria-label="Предыдущий месяц"
            data-nutrition-calendar-action="previous-month"
          >
            ‹
          </button>
          <div className={styles.monthBlock}>
            <span className={styles.eyebrow}>Календарь питания</span>
            <strong className={styles.month}>{monthLabel}</strong>
          </div>
          <button
            type="button"
            className={styles.monthAction}
            onClick={() => onShiftMonth(1)}
            aria-label="Следующий месяц"
            data-nutrition-calendar-action="next-month"
          >
            ›
          </button>
        </div>

        <div className={styles.weekdays} aria-hidden="true" data-testid="nutrition-calendar-weekdays">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <span className={styles.weekday} key={day}>{day}</span>
          ))}
        </div>

        <div className={styles.grid} data-testid="nutrition-calendar-grid">
          {days.map((day) => (
            <button
              type="button"
              key={day.key}
              className={[
                styles.day,
                day.isCurrentMonth ? "" : styles.muted,
                day.isToday ? styles.today : "",
                day.isSelected ? styles.selected : "",
                day.hasFood ? styles.hasFood : "",
                day.isOverGoal ? styles.overGoal : ""
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectDate(day.key)}
              aria-pressed={day.isSelected}
              aria-current={day.isToday ? "date" : undefined}
              data-nutrition-calendar-day={day.key}
              data-current-month={day.isCurrentMonth ? "true" : "false"}
              data-has-food={day.hasFood ? "true" : "false"}
              data-over-goal={day.isOverGoal ? "true" : "false"}
            >
              <strong className={styles.dayNumber}>{day.dayNumber}</strong>
              {day.hasFood && (
                <small className={styles.calories}>{day.calories} ккал</small>
              )}
            </button>
          ))}
        </div>

        <div className={styles.footer} data-testid="nutrition-calendar-footer">
          <button
            type="button"
            className={styles.footerAction}
            onClick={onSelectToday}
            data-nutrition-calendar-action="today"
          >
            Сегодня
          </button>
          <button
            type="button"
            className={`${styles.footerAction} ${styles.primaryAction}`}
            onClick={onClose}
            data-nutrition-calendar-action="done"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

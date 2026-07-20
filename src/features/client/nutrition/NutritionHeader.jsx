import { CalendarDays, Search } from "lucide-react";
import { todayNutritionKey } from "../../../domain/nutritionPresentation";
import styles from "./NutritionHeader.module.css";

export default function NutritionHeader({
  weekDates,
  nutrition,
  nutritionDateKey,
  onOpenSearch,
  onOpenCalendar,
  onSelectDate
}) {
  return (
    <section
      className={styles.root}
      data-testid="nutrition-header"
      data-css-module-scope="nutrition-header"
    >
      <div className={styles.titleRow} data-nutrition-header-part="title-row">
        <h1 className={styles.title} data-nutrition-header-part="title">Питание</h1>
        <div className={styles.actions} data-nutrition-header-part="actions">
          <button
            className={styles.action}
            type="button"
            onClick={onOpenSearch}
            aria-label="Поиск еды"
            title="Поиск еды"
            data-testid="nutrition-header-search"
            data-nutrition-header-action="search"
          >
            <Search className={styles.icon} aria-hidden="true" data-nutrition-header-icon />
          </button>
          <button
            className={styles.action}
            type="button"
            onClick={onOpenCalendar}
            aria-label="Календарь"
            title="Календарь"
            data-testid="nutrition-header-calendar"
            data-nutrition-header-action="calendar"
          >
            <CalendarDays
              className={`${styles.icon} ${styles.calendarIcon}`}
              aria-hidden="true"
              data-nutrition-header-icon
            />
          </button>
        </div>
      </div>

      <div className={styles.week} data-nutrition-header-part="week">
        {weekDates.map((day) => {
          const dayHasFood = Boolean(nutrition.days?.[day.key]?.foods?.length);
          const isSelectedDay = day.key === nutritionDateKey;
          const isTodayDay = day.key === todayNutritionKey();
          const dayAriaLabel = day.date.toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long"
          });

          return (
            <button
              type="button"
              className={`${styles.day} ${isSelectedDay ? styles.selected : ""} ${dayHasFood ? styles.hasFood : ""} ${isTodayDay ? styles.today : ""}`}
              key={day.key}
              onClick={() => onSelectDate(day.key)}
              aria-label={`Выбрать ${dayAriaLabel}`}
              aria-pressed={isSelectedDay}
              aria-current={isTodayDay ? "date" : undefined}
              data-nutrition-header-day={day.key}
              data-selected={isSelectedDay}
              data-has-food={dayHasFood}
              data-today={isTodayDay}
            >
              <span className={styles.dot} aria-hidden="true" data-nutrition-header-part="day-dot" />
              <small className={styles.dayLabel} data-nutrition-header-part="day-label">
                {day.label}
              </small>
              <span className={styles.dateNumber}>{day.date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

import { todayNutritionKey } from "../../../domain/nutritionPresentation";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import weeklyCalendarStyles from "../../../shared/ui/WeeklyCalendar.module.css";
import styles from "./NutritionHeader.module.css";

function formatWeekdayLabel(label) {
  const value = String(label || "").toLocaleLowerCase("ru-RU");
  return value ? `${value[0].toLocaleUpperCase("ru-RU")}${value.slice(1)}` : "";
}

export default function NutritionHeader({
  weekDates,
  nutrition,
  nutritionDateKey,
  onSelectDate
}) {
  return (
    <>
      <ClientPageHeader
        title="Питание"
        titleAlign="start"
        primary
        titlePart="title"
        titleTestId="nutrition-header-title"
        className={styles.root}
        testId="nutrition-header"
        scope="nutrition-header"
        barPart="title-row"
      />

      <div className={`${styles.week} ${weeklyCalendarStyles.root}`} data-week-calendar="nutrition" data-nutrition-header-part="week">
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
              data-week-calendar-day
            >
              <span className={styles.dot} aria-hidden="true" data-nutrition-header-part="day-dot" />
              <small className={styles.dayLabel} data-week-calendar-label data-nutrition-header-part="day-label">
                {formatWeekdayLabel(day.label)}
              </small>
              <span className={styles.dateNumber} data-week-calendar-number>{day.date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

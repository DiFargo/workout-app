import { CalendarDays, Search } from "lucide-react";
import { todayNutritionKey } from "../../../domain/nutritionPresentation";

export default function NutritionHeader({
  nutritionDateTitle,
  weekDates,
  nutrition,
  nutritionDateKey,
  nutritionStreakText,
  onOpenSearch,
  onOpenCalendar,
  onSelectDate
}) {
  return (
    <section className="nutritionHeroV4">
      <div className="nutritionHeroTitleV4">
        <h1 className="clientCorePageTitle">{nutritionDateTitle}</h1>
        <div className="nutritionHeaderIconActions">
          <button
            className="nutritionQuickActionExact nutritionHeaderIconButton"
            type="button"
            onClick={onOpenSearch}
            aria-label="Поиск еды"
            title="Поиск еды"
          >
            <Search className="nutritionHeaderLucideIcon" aria-hidden="true" />
          </button>
          <button
            className="nutritionQuickActionExact nutritionHeaderIconButton"
            type="button"
            onClick={onOpenCalendar}
            aria-label="Календарь"
            title="Календарь"
          >
            <CalendarDays className="nutritionQuickCalendarIcon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="nutritionWeekV4">
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
              className={`nutritionDayV4 ${isSelectedDay ? "selected" : ""} ${dayHasFood ? "hasFood" : ""} ${isTodayDay ? "today" : ""}`}
              key={day.key}
              onClick={() => onSelectDate(day.key)}
              aria-label={`Выбрать ${dayAriaLabel}`}
              aria-pressed={isSelectedDay}
            >
              <span aria-hidden="true" />
              <small>{day.label}</small>
            </button>
          );
        })}
      </div>

      <div className="nutritionStreakV4">
        <span>{nutritionStreakText}</span>
      </div>
    </section>
  );
}

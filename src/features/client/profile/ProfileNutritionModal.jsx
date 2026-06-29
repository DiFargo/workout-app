import { todayNutritionKey } from "../../../domain/nutritionPresentation";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import {
  getAiNutritionDayMacros,
  getAiNutritionWeekForDate
} from "../../../utils/aiNutritionSchedule";

const PROFILE_NUTRITION_GOALS = [
  { id: "maintain", title: "Поддержка" },
  { id: "recomp", title: "Рекомпозиция" },
  { id: "cut", title: "Похудение" },
  { id: "dry", title: "Сушка" },
  { id: "mass", title: "Набор" }
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getGoalHint(goal) {
  if (goal === "maintain") {
    return "Поддержка: калории около нормы, цель — стабильный вес и энергия.";
  }

  if (goal === "recomp") {
    return "Рекомпозиция: небольшой дефицит и повышенный белок для снижения жира с сохранением мышц.";
  }

  return "КБЖУ будут пересчитаны под выбранную цель.";
}

function getProfileNutritionDayLabel(day, plannedMacros, showPlan) {
  const date = day.date instanceof Date ? day.date : new Date(day.date || "");
  const dateLabel = Number.isNaN(date.getTime())
    ? `День ${day.dayNumber}`
    : date.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long"
      });
  const status = day.hasFood
    ? `записано ${Math.round(day.calories)} ккал и ${Math.round(day.protein)} г белка`
    : showPlan
      ? `план ${Math.round(plannedMacros.calories)} ккал`
      : "нет записей";
  const flags = [
    day.isSelected ? "выбранный день" : "",
    day.isToday ? "сегодня" : ""
  ].filter(Boolean).join(", ");

  return [dateLabel, status, flags].filter(Boolean).join(", ");
}

export default function ProfileNutritionModal({
  open,
  profileDraft,
  activeProfile,
  draftMacros,
  nutritionGoals,
  saveStatus,
  weekLabel,
  weekDays = [],
  aiPlan,
  aiWeek,
  aiActiveProfile,
  selectedTotals,
  onClose,
  onGoalChange,
  onSave,
  onShiftWeek
}) {
  if (!open) {
    return null;
  }

  const currentGoal = profileDraft.goal || activeProfile?.goal || "recomp";

  return (
    <div className="cabinetNutritionModalOverlay" role="presentation" onClick={onClose}>
      <div
        className="cabinetNutritionModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetNutritionModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cabinetNutritionModalHead">
          <div>
            <span>ПЛАН ПИТАНИЯ</span>
            <h2 id="cabinetNutritionModalTitle">План КБЖУ</h2>
          </div>
          <button type="button" aria-label="Закрыть план КБЖУ" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="profileDashboardGrid profileNutritionSection hasPlan cabinetNutritionCombined">
          <div className="profileDashboardCard profileNutritionGoalCard">
            <div className="profileNutritionInlinePlan">
              <div className="profileNutritionInlinePlanHead">
                <span>ВЫБРАТЬ ПЛАН</span>
                <strong>{getAiNutritionGoalLabel(currentGoal)}</strong>
              </div>

              <div className="profileGoalPicker">
                {PROFILE_NUTRITION_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    className={profileDraft.goal === goal.id ? "active" : ""}
                    aria-label={`Выбрать цель питания: ${goal.title}`}
                    aria-pressed={profileDraft.goal === goal.id}
                    onClick={() => onGoalChange(goal.id)}
                  >
                    {goal.title}
                  </button>
                ))}
              </div>

              <div className="profileGoalModeHint">
                {getGoalHint(profileDraft.goal)}
              </div>

              <div className="profileMacroGrid">
                <div><span>Ккал</span><strong>{Math.round(draftMacros.calories || nutritionGoals.calories)}</strong></div>
                <div><span>Белки</span><strong>{Math.round(draftMacros.protein || nutritionGoals.protein)} г</strong></div>
                <div><span>Жиры</span><strong>{Math.round(draftMacros.fat || nutritionGoals.fat)} г</strong></div>
                <div><span>Угл.</span><strong>{Math.round(draftMacros.carbs || nutritionGoals.carbs)} г</strong></div>
              </div>

              <button
                type="button"
                className="profileDashboardButton"
                data-save-state={saveStatus || "idle"}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                onClick={onSave}
              >
                {saveStatus === "saved"
                  ? "План сохранён ✓"
                  : saveStatus === "saving"
                    ? "Сохраняю…"
                    : saveStatus === "error"
                      ? "Повторить сохранение"
                      : "Сохранить план питания"}
              </button>
            </div>
          </div>

          <div className="profileDashboardCard profileAiNutritionPlanCard">
            <div className="profileNutritionOverview">
              <div className="profileNutritionCalendarHead">
                <div>
                  <h2>План питания</h2>
                </div>
              </div>

              <div className="profileNutritionCalendarMonthTitle">
                <button type="button" onClick={() => onShiftWeek(-1)} aria-label="Предыдущая неделя">
                  ‹
                </button>
                <strong>{weekLabel}</strong>
                <button type="button" onClick={() => onShiftWeek(1)} aria-label="Следующая неделя">
                  ›
                </button>
              </div>

              <div className="profileNutritionMonthGrid">
                {WEEKDAYS.map((dayLabel) => (
                  <span key={dayLabel} className="profileNutritionWeekday">{dayLabel}</span>
                ))}

                {weekDays.map((day) => {
                  const plannedWeek = getAiNutritionWeekForDate(aiPlan, day.date);
                  const plannedMacros = getAiNutritionDayMacros(
                    plannedWeek || aiWeek || nutritionGoals,
                    aiActiveProfile,
                    day.date
                  );
                  const calorieGoal = Number(plannedMacros?.calories || nutritionGoals.calories) || 1;
                  const proteinGoal = Number(plannedMacros?.protein || nutritionGoals.protein) || 1;
                  const caloriePercent = Math.min(100, Math.round((day.calories / calorieGoal) * 100));
                  const proteinPercent = Math.min(100, Math.round((day.protein / proteinGoal) * 100));
                  const showPlan = !day.hasFood && day.key >= todayNutritionKey();

                  return (
                    <div
                      key={day.key}
                      className={[
                        "profileNutritionMonthDay",
                        day.hasFood ? "filled" : "",
                        showPlan ? "planned" : "",
                        day.isOverGoal ? "highCalories" : "",
                        day.isToday ? "today" : "",
                        day.isSelected ? "active" : ""
                      ].filter(Boolean).join(" ")}
                      aria-label={getProfileNutritionDayLabel(day, plannedMacros, showPlan)}
                      aria-current={day.isToday ? "date" : undefined}
                    >
                      <i
                        className="profileNutritionCalorieFill"
                        style={{ height: `${day.hasFood ? Math.max(8, caloriePercent) : 0}%` }}
                      />
                      <i
                        className="profileNutritionProteinFill"
                        style={{ height: `${day.hasFood ? Math.max(5, proteinPercent) : 0}%` }}
                      />
                      <span>{day.dayNumber}</span>
                      {day.hasFood ? (
                        <>
                          <strong>{day.calories}</strong>
                          <small>{day.protein}г</small>
                        </>
                      ) : showPlan ? (
                        <>
                          <strong>{plannedMacros.calories}</strong>
                          <small>план</small>
                        </>
                      ) : (
                        <em>—</em>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="profileNutritionCalendarLegend">
                <span><i className="calorieOk" /> Факт</span>
                <span><i className="proteinFill" /> Белок</span>
                <span><i className="caloriePlan" /> План</span>
              </div>

              {selectedTotals.calories > 0 && (
                <p className="profileNutritionCalendarLogged">
                  Записано за день: {Math.round(selectedTotals.calories)} ккал
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

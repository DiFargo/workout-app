import { todayNutritionKey } from "../../../domain/nutritionPresentation";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import {
  getAiNutritionDayMacros,
  getAiNutritionWeekForDate
} from "../../../utils/aiNutritionSchedule";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileNutritionModal.module.css";

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
    <div
      className={styles.overlay}
      data-css-module-scope="profile-nutrition-modal"
      data-testid="profile-nutrition-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.dialog}
        data-testid="profile-nutrition-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="cabinetNutritionModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title="План питания"
          titleId="cabinetNutritionModalTitle"
          eyebrow="КБЖУ и недельный план"
          actions={(
            <ProfileModalCloseButton
              testId="profile-nutrition-close"
              ariaLabel="Закрыть план питания"
              onClick={onClose}
            />
          )}
          testId="profile-nutrition-header"
          scope="profile-nutrition-header"
        />

        <section className={styles.content} data-testid="profile-nutrition-content">
          <div className={`${styles.card} ${styles.goalCard}`} data-testid="profile-nutrition-goal-card">
            <div className={styles.inlinePlan}>
              <div className={styles.planHeader}>
                <span>ВЫБРАТЬ ПЛАН</span>
                <strong>{getAiNutritionGoalLabel(currentGoal)}</strong>
              </div>

              <div className={styles.goalPicker} data-testid="profile-nutrition-goal-picker">
                {PROFILE_NUTRITION_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    className={profileDraft.goal === goal.id ? styles.activeGoal : undefined}
                    aria-label={`Выбрать цель питания: ${goal.title}`}
                    aria-pressed={profileDraft.goal === goal.id}
                    onClick={() => onGoalChange(goal.id)}
                  >
                    {goal.title}
                  </button>
                ))}
              </div>

              <div className={styles.goalHint}>
                {getGoalHint(profileDraft.goal)}
              </div>

              <div className={styles.macroGrid}>
                <div><span>Ккал</span><strong>{Math.round(draftMacros.calories || nutritionGoals.calories)}</strong></div>
                <div><span>Белки</span><strong>{Math.round(draftMacros.protein || nutritionGoals.protein)} г</strong></div>
                <div><span>Жиры</span><strong>{Math.round(draftMacros.fat || nutritionGoals.fat)} г</strong></div>
                <div><span>Угл.</span><strong>{Math.round(draftMacros.carbs || nutritionGoals.carbs)} г</strong></div>
              </div>

              <button
                type="button"
                className={styles.saveButton}
                data-testid="profile-nutrition-save"
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

          <div className={`${styles.card} ${styles.calendarCard}`} data-testid="profile-nutrition-calendar-card">
            <div className={styles.calendarOverview}>
              <div className={styles.calendarTitle}>
                <button
                  data-testid="profile-nutrition-previous-week"
                  type="button"
                  onClick={() => onShiftWeek(-1)}
                  aria-label="Предыдущая неделя"
                >
                  ‹
                </button>
                <strong>{weekLabel}</strong>
                <button
                  data-testid="profile-nutrition-next-week"
                  type="button"
                  onClick={() => onShiftWeek(1)}
                  aria-label="Следующая неделя"
                >
                  ›
                </button>
              </div>

              <div className={styles.monthGrid}>
                {WEEKDAYS.map((dayLabel) => (
                  <span key={dayLabel} className={styles.weekday}>{dayLabel}</span>
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
                        styles.day,
                        showPlan ? styles.planned : "",
                        day.isOverGoal ? styles.highCalories : "",
                        day.isToday ? styles.today : "",
                        day.isSelected ? styles.activeDay : ""
                      ].filter(Boolean).join(" ")}
                      data-testid="profile-nutrition-day"
                      data-has-food={day.hasFood ? "true" : "false"}
                      data-planned={showPlan ? "true" : "false"}
                      data-over-goal={day.isOverGoal ? "true" : "false"}
                      data-selected={day.isSelected ? "true" : "false"}
                      aria-label={getProfileNutritionDayLabel(day, plannedMacros, showPlan)}
                      aria-current={day.isToday ? "date" : undefined}
                    >
                      <i
                        className={styles.calorieFill}
                        style={{ height: `${day.hasFood ? Math.max(8, caloriePercent) : 0}%` }}
                      />
                      <i
                        className={styles.proteinFill}
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

              <div className={styles.legend}>
                <span><i className={styles.factLegend} /> Факт</span>
                <span><i className={styles.proteinLegend} /> Белок</span>
                <span><i className={styles.planLegend} /> План</span>
              </div>

              {selectedTotals.calories > 0 && (
                <p className={styles.logged}>
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

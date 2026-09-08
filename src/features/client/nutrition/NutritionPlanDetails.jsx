import { CalendarDays, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import NutritionMacroScoreRing from "./NutritionMacroScoreRing";
import styles from "./NutritionPlanDetails.module.css";

const BADGE_CLASS_BY_TYPE = {
  good: styles.good,
  warning: styles.warning,
  warn: styles.warning,
  info: styles.info
};

const BADGE_ICON_BY_TYPE = {
  good: CircleCheck,
  warning: TriangleAlert,
  warn: TriangleAlert,
  info: Info
};

function BadgeStatusIcon({ type }) {
  const Icon = BADGE_ICON_BY_TYPE[type] || Info;
  return <Icon className={styles.badgeIcon} data-nutrition-plan-part="badge-icon" aria-hidden="true" />;
}

export default function NutritionPlanDetails({
  isExpanded,
  isCaloriesOverGoal,
  goalText,
  isTrainingDay,
  todayPlanMacros,
  caloriePercent,
  caloriesLeft,
  caloriesConsumed,
  effectiveGoals,
  scoreSegments,
  nutritionDay,
  proteinPercent,
  fatPercent,
  carbsPercent,
  nutritionTotals,
  roundMacro,
  currentWeek,
  onClose
}) {
  if (!isExpanded) {
    return null;
  }

  return (
    <div
      className={styles.dialog}
      role="presentation"
      data-nutrition-plan-part="dialog"
    >
      <section
        className={`${styles.root} ${styles.modern} ${isCaloriesOverGoal ? styles.overLimit : ""}`}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-label="План питания"
        data-testid="nutrition-plan-details"
        data-css-module-scope="nutrition-plan-details"
        data-state={isCaloriesOverGoal ? "over-limit" : "within-limit"}
      >
        <div className={styles.header} data-nutrition-plan-part="header">
          <div className={styles.titleBox} data-nutrition-plan-part="title">
            <span className={styles.titleEyebrow} data-nutrition-plan-text="eyebrow">План питания</span>
            <h2 className={styles.title} data-nutrition-plan-text="title">{goalText}</h2>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Закрыть план питания"
            onClick={onClose}
            data-testid="nutrition-plan-close"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div
          className={`${styles.dayPill} ${isTrainingDay ? styles.dayPillActive : ""}`}
          data-nutrition-plan-part="day-pill"
          data-state={isTrainingDay ? "training" : "regular"}
        >
          <span className={styles.dayTitle} data-nutrition-plan-text="day-title">
            {isTrainingDay ? "Тренировочный день" : "Обычный день"}
          </span>
          <small className={styles.dayDescription} data-nutrition-plan-text="day-description">
            {isTrainingDay ? `Сегодня: ${todayPlanMacros.calories} ккал · У ${todayPlanMacros.carbs} г` : "КБЖУ без тренировочной надбавки"}
          </small>
        </div>

        <div className={styles.body} data-nutrition-plan-part="body">
          <div className={styles.calorieProgress} data-nutrition-plan-part="calorie-progress">
            <div className={styles.calorieTopline}>
              <span>Калории</span>
              <strong>{caloriePercent}%</strong>
            </div>
            <progress
              className={styles.calorieTrack}
              max="100"
              value={Math.min(100, Math.max(0, caloriePercent))}
              aria-label={`Калории: ${caloriesConsumed} из ${effectiveGoals.calories} ккал`}
              data-over-limit={isCaloriesOverGoal ? "true" : "false"}
            />
            <div className={styles.calorieSummary}>
              <span><strong>{caloriesConsumed}</strong> из {effectiveGoals.calories} ккал</span>
              <span>Осталось <strong>{caloriesLeft}</strong></span>
            </div>
          </div>

          <div className={styles.scoreBlock} data-nutrition-plan-part="score-block">
            <span className={styles.scoreLabel} data-nutrition-plan-text="score-label">Баланс дня</span>
            <NutritionMacroScoreRing score={nutritionDay.score} segments={scoreSegments} />
            <span className={styles.scoreCaption}>по КБЖУ</span>
          </div>
        </div>

        <div className={styles.macros} data-nutrition-plan-part="macros">
          <div className={styles.macro} data-nutrition-plan-part="macro">
            <span className={styles.macroLabel} data-nutrition-plan-text="macro-label">Белки</span>
            <strong className={styles.macroValue} data-nutrition-plan-text="macro-value">{roundMacro(nutritionTotals.protein)} г</strong>
            <small className={styles.macroGoal} data-nutrition-plan-text="macro-goal">/ {effectiveGoals.protein} г</small>
            <progress className={styles.macroTrack} max="100" value={Math.min(100, proteinPercent)} aria-label={`Белки: ${proteinPercent}%`} />
            <span className={styles.macroPercentText}>{proteinPercent}%</span>
          </div>
          <div className={styles.macro} data-nutrition-plan-part="macro">
            <span className={styles.macroLabel} data-nutrition-plan-text="macro-label">Жиры</span>
            <strong className={styles.macroValue} data-nutrition-plan-text="macro-value">{roundMacro(nutritionTotals.fat)} г</strong>
            <small className={styles.macroGoal} data-nutrition-plan-text="macro-goal">/ {effectiveGoals.fat} г</small>
            <progress className={styles.macroTrack} max="100" value={Math.min(100, fatPercent)} aria-label={`Жиры: ${fatPercent}%`} />
            <span className={styles.macroPercentText}>{fatPercent}%</span>
          </div>
          <div className={styles.macro} data-nutrition-plan-part="macro">
            <span className={styles.macroLabel} data-nutrition-plan-text="macro-label">Углеводы</span>
            <strong className={styles.macroValue} data-nutrition-plan-text="macro-value">{roundMacro(nutritionTotals.carbs)} г</strong>
            <small className={styles.macroGoal} data-nutrition-plan-text="macro-goal">/ {effectiveGoals.carbs} г</small>
            <progress className={styles.macroTrack} max="100" value={Math.min(100, carbsPercent)} aria-label={`Углеводы: ${carbsPercent}%`} />
            <span className={styles.macroPercentText}>{carbsPercent}%</span>
          </div>
        </div>

        <div className={styles.conclusion} data-nutrition-plan-part="conclusion">
          <span className={styles.conclusionLabel} data-nutrition-plan-text="conclusion-label">Короткий вывод</span>
          <p className={styles.conclusionText} data-nutrition-plan-text="conclusion">{nutritionDay.summary} {nutritionDay.adaptiveAdvice}</p>
        </div>

        <div className={styles.badges} data-nutrition-plan-part="badges">
          {nutritionDay.badges.map((badge) => (
            <span
              className={`${styles.badge} ${BADGE_CLASS_BY_TYPE[badge.type] || ""}`}
              key={badge.text}
              data-nutrition-plan-part="badge"
              data-badge-type={badge.type}
            >
              <BadgeStatusIcon type={badge.type} />{badge.text}
            </span>
          ))}
          <span className={`${styles.badge} ${styles.info}`} data-nutrition-plan-part="badge" data-badge-type="info">
            <CalendarDays className={styles.badgeIcon} data-nutrition-plan-part="badge-icon" aria-hidden="true" />Неделя {currentWeek}/4
          </span>
        </div>
      </section>

      <button
        type="button"
        className={styles.backdrop} data-modal-backdrop="true"
        onClick={onClose}
        aria-label="Закрыть план питания по фону"
        data-testid="nutrition-plan-backdrop"
        data-nutrition-plan-part="backdrop"
      />
    </div>
  );
}

import NutritionMacroScoreRing from "./NutritionMacroScoreRing";
import styles from "./NutritionPlanDetails.module.css";

const CALORIE_PIXELS = Array.from({ length: 25 }, (_, index) => index);
const BADGE_CLASS_BY_TYPE = {
  good: styles.good,
  warning: styles.warning,
  warn: styles.warning,
  info: styles.info
};

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
      role="dialog"
      aria-modal="true"
      data-modal-surface="true"
      aria-label="План питания"
      data-nutrition-plan-part="dialog"
    >
      <section
        className={`${styles.root} ${isCaloriesOverGoal ? styles.overLimit : ""}`}
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
            ×
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
            <div className={styles.pixelGrid} aria-hidden="true" data-nutrition-plan-part="pixel-grid">
                  {CALORIE_PIXELS.map((index) => (
                    <span
                      key={index}
                      className={`${styles.pixel} ${index < Math.round((caloriePercent / 100) * 25) ? styles.pixelActive : ""}`}
                      data-nutrition-plan-pixel={index < Math.round((caloriePercent / 100) * 25) ? "active" : "inactive"}
                    />
                  ))}
            </div>

            <div className={styles.calorieCopy} data-nutrition-plan-part="calorie-copy">
              <div className={styles.calorieStats} data-nutrition-plan-part="calorie-stats">
                <div className={styles.calorieStat} data-nutrition-plan-part="calorie-stat">
                  <span className={styles.calorieLabel} data-nutrition-plan-text="calorie-label">Осталось</span>
                  <strong className={styles.calorieValue} data-nutrition-plan-text="calorie-value">{caloriesLeft}</strong>
                </div>
                <i className={styles.calorieDivider} aria-hidden="true" data-nutrition-plan-part="calorie-divider" />
                <div className={styles.calorieStat} data-nutrition-plan-part="calorie-stat">
                  <span className={styles.calorieLabel} data-nutrition-plan-text="calorie-label">Получено</span>
                  <strong className={styles.calorieValue} data-nutrition-plan-text="calorie-value">{caloriesConsumed}</strong>
                </div>
              </div>

              <div className={styles.calorieFoot} data-nutrition-plan-part="calorie-foot">
                <span>{caloriePercent}% от РСК</span>
                <strong>{effectiveGoals.calories} ккал</strong>
              </div>
            </div>
          </div>

          <div className={styles.scoreBlock} data-nutrition-plan-part="score-block">
            <span className={styles.scoreLabel} data-nutrition-plan-text="score-label">Score питания</span>
            <NutritionMacroScoreRing score={nutritionDay.score} segments={scoreSegments} />
          </div>
        </div>

        <div className={styles.macroPercent} data-nutrition-plan-part="macro-percent">
          <span className={styles.macroPercentItem} data-nutrition-plan-part="macro-percent-item"><i className={styles.macroDot} data-nutrition-plan-part="macro-dot" />Б {proteinPercent}%</span>
          <span className={styles.macroPercentItem} data-nutrition-plan-part="macro-percent-item"><i className={styles.macroDot} data-nutrition-plan-part="macro-dot" />Ж {fatPercent}%</span>
          <span className={styles.macroPercentItem} data-nutrition-plan-part="macro-percent-item"><i className={styles.macroDot} data-nutrition-plan-part="macro-dot" />У {carbsPercent}%</span>
        </div>

        <div className={styles.macros} data-nutrition-plan-part="macros">
          <div className={styles.macro} data-nutrition-plan-part="macro">
            <span className={styles.macroLabel} data-nutrition-plan-text="macro-label">Белки</span>
            <strong className={styles.macroValue} data-nutrition-plan-text="macro-value">{roundMacro(nutritionTotals.protein)} г</strong>
            <small className={styles.macroGoal} data-nutrition-plan-text="macro-goal">/ {effectiveGoals.protein} г</small>
          </div>
          <div className={styles.macro} data-nutrition-plan-part="macro">
            <span className={styles.macroLabel} data-nutrition-plan-text="macro-label">Жиры</span>
            <strong className={styles.macroValue} data-nutrition-plan-text="macro-value">{roundMacro(nutritionTotals.fat)} г</strong>
            <small className={styles.macroGoal} data-nutrition-plan-text="macro-goal">/ {effectiveGoals.fat} г</small>
          </div>
          <div className={styles.macro} data-nutrition-plan-part="macro">
            <span className={styles.macroLabel} data-nutrition-plan-text="macro-label">Углеводы</span>
            <strong className={styles.macroValue} data-nutrition-plan-text="macro-value">{roundMacro(nutritionTotals.carbs)} г</strong>
            <small className={styles.macroGoal} data-nutrition-plan-text="macro-goal">/ {effectiveGoals.carbs} г</small>
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
              <i className={styles.badgeIcon} data-nutrition-plan-part="badge-icon">{badge.icon}</i>{badge.text}
            </span>
          ))}
          <span className={`${styles.badge} ${styles.info}`} data-nutrition-plan-part="badge" data-badge-type="info">
            <i className={styles.badgeIcon} data-nutrition-plan-part="badge-icon">📅</i>Неделя {currentWeek}/4
          </span>
        </div>
      </section>

      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Закрыть план питания по фону"
        data-testid="nutrition-plan-backdrop"
        data-nutrition-plan-part="backdrop"
      />
    </div>
  );
}

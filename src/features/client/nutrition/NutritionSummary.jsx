import styles from "./NutritionSummary.module.css";

export default function NutritionSummary({
  isCaloriesOverGoal,
  summaryText,
  onExpand
}) {
  return (
    <section
      className={`${styles.root} ${isCaloriesOverGoal ? styles.overLimit : ""}`}
      data-testid="nutrition-summary"
      data-css-module-scope="nutrition-summary"
      data-state={isCaloriesOverGoal ? "over-limit" : "within-limit"}
    >
      <button
        type="button"
        className={styles.card}
        onClick={onExpand}
        aria-label="Развернуть анализ питания"
        data-nutrition-summary-part="card"
      >
        <span className={styles.icon} aria-hidden="true" data-nutrition-summary-part="icon">📊</span>
        <span className={styles.title} data-nutrition-summary-part="title">
          <strong className={styles.titleStrong}>Анализ</strong>
          <small className={styles.description}>{summaryText}</small>
        </span>
        <span className={styles.arrow} aria-hidden="true" data-nutrition-summary-part="arrow">›</span>
      </button>
    </section>
  );
}

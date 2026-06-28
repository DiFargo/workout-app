export default function NutritionSummary({
  isCaloriesOverGoal,
  summaryText,
  onExpand
}) {
  return (
    <section className={`nutritionAiPlanDashboard collapsed nutritionAiPlanTopInline ${isCaloriesOverGoal ? "overLimit" : ""}`}>
      <button
        type="button"
        className="nutritionAiPlanTopCard"
        onClick={onExpand}
        aria-label="Развернуть анализ питания"
      >
        <span className="nutritionAiPlanCollapsedIcon" aria-hidden="true">📊</span>
        <span className="nutritionAiPlanTopTitle">
          <strong>Анализ</strong>
          <small>{summaryText}</small>
        </span>
        <span className="nutritionAiPlanCollapsedArrow" aria-hidden="true">›</span>
      </button>
    </section>
  );
}

export default function NutritionPlanDetails({
  isExpanded,
  isCaloriesOverGoal,
  goalText,
  isTrainingDay,
  todayPlanMacros,
  summaryText,
  caloriePercent,
  caloriesLeft,
  caloriesConsumed,
  effectiveGoals,
  scoreStyle,
  nutritionDay,
  proteinPercent,
  fatPercent,
  carbsPercent,
  nutritionTotals,
  roundMacro,
  currentWeek,
  onExpand,
  onClose
}) {
  return (
    <>
      {isExpanded && (
        <button
          type="button"
          className="nutritionAiPlanModalBackdrop"
          onClick={onClose}
          aria-label="Закрыть план питания"
        />
      )}

      <section
        className={`nutritionAiPlanDashboard ${isExpanded ? "expanded nutritionAiPlanModal" : "collapsed nutritionAiPlanInlineHidden"} ${isCaloriesOverGoal ? "overLimit" : ""}`}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? "true" : undefined}
        aria-label={isExpanded ? "План питания" : undefined}
      >
        {isExpanded && (
          <div className="nutritionAiPlanHeader">
            <div className="nutritionAiPlanTitleBox">
              <span>План питания</span>
              <h2>{goalText}</h2>
            </div>
            <button
              type="button"
              className="nutritionAiPlanToggleBtn"
              aria-label="Закрыть план питания"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        )}

        {isExpanded && (
          <div className={`nutritionAiTrainingDayPill ${isTrainingDay ? "active" : ""}`}>
            <span>{isTrainingDay ? "Тренировочный день" : "Обычный день"}</span>
            <small>{isTrainingDay ? `Сегодня: ${todayPlanMacros.calories} ккал · У ${todayPlanMacros.carbs} г` : "КБЖУ без тренировочной надбавки"}</small>
          </div>
        )}

        {!isExpanded ? (
          <button
            type="button"
            className="nutritionAiPlanCollapsedCard"
            onClick={onExpand}
            aria-label="Развернуть сводку питания"
          >
            <div className="nutritionAiPlanCollapsedHeading">
              <strong>Анализ</strong>
            </div>

            <div className="nutritionAiPlanCollapsedContent">
              <span className="nutritionAiPlanCollapsedIcon" aria-hidden="true">📊</span>
              <span className="nutritionAiPlanCollapsedInsight">{summaryText}</span>
              <span className="nutritionAiPlanCollapsedArrow" aria-hidden="true">›</span>
            </div>
          </button>
        ) : (
          <>
            <div className="nutritionAiPlanBody">
              <div className="nutritionAiPlanRsk">
                <div className="nutritionAiPlanGrid" aria-hidden="true">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <span
                      key={index}
                      className={index < Math.round((caloriePercent / 100) * 25) ? "active" : ""}
                    />
                  ))}
                </div>

                <div className="nutritionAiPlanRskRight">
                  <div className="nutritionAiPlanRskInfo">
                    <div>
                      <span>Осталось</span>
                      <strong>{caloriesLeft}</strong>
                    </div>
                    <i aria-hidden="true" />
                    <div>
                      <span>Получено</span>
                      <strong>{caloriesConsumed}</strong>
                    </div>
                  </div>

                  <div className="nutritionAiPlanRskFoot">
                    <span>{caloriePercent}% от РСК</span>
                    <strong>{effectiveGoals.calories} ккал</strong>
                  </div>
                </div>
              </div>

              <div className="nutritionAiPlanScoreBlock">
                <span>Score питания</span>
                <div className="nutritionAiPlanScore" style={scoreStyle}>
                  <div>
                    <strong>{nutritionDay.score}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="nutritionAiPlanMacroPercent">
              <span><i className="protein" />Б {proteinPercent}%</span>
              <span><i className="fat" />Ж {fatPercent}%</span>
              <span><i className="carbs" />У {carbsPercent}%</span>
            </div>

            <div className="nutritionAiPlanMacros">
              <div>
                <span>Белки</span>
                <strong>{roundMacro(nutritionTotals.protein)} г</strong>
                <small>/ {effectiveGoals.protein} г</small>
              </div>
              <div>
                <span>Жиры</span>
                <strong>{roundMacro(nutritionTotals.fat)} г</strong>
                <small>/ {effectiveGoals.fat} г</small>
              </div>
              <div>
                <span>Углеводы</span>
                <strong>{roundMacro(nutritionTotals.carbs)} г</strong>
                <small>/ {effectiveGoals.carbs} г</small>
              </div>
            </div>

            <div className="nutritionAiPlanConclusion">
              <span>Короткий вывод</span>
              <p>{nutritionDay.summary} {nutritionDay.adaptiveAdvice}</p>
            </div>

            <div className="nutritionAiPlanBadges">
              {nutritionDay.badges.map((badge) => (
                <span className={badge.type} key={badge.text}>
                  <i>{badge.icon}</i>{badge.text}
                </span>
              ))}
              <span className="info"><i>📅</i>Неделя {currentWeek}/4</span>
            </div>
          </>
        )}
      </section>
    </>
  );
}

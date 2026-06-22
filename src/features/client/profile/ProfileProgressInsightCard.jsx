export default function ProfileProgressInsightCard({
  isMainDashboard,
  progressInsight,
  expanded,
  statuses,
  currentGoalId,
  totalWorkouts,
  onToggle
}) {
  return (
    <div className={`profileAiCoachInsight profileProgressInsightCard ${progressInsight.tone}`}>
      <button
        type="button"
        className="profileAiCoachToggle"
        onClick={isMainDashboard ? undefined : onToggle}
      >
        <div className="profileAiCoachSummary">
          <div
            className="profileProgressGauge"
            style={{
              "--progress-score": progressInsight.score ?? 0,
              "--progress-angle": `${-180 + (progressInsight.score ?? 0) * 1.8}deg`
            }}
            role="img"
            aria-label={progressInsight.score === null
              ? "Недостаточно данных для оценки прогресса"
              : `Общая оценка прогресса ${progressInsight.score} из 100`}
          >
            <div className="profileProgressGaugeDial">
              <i />
              <strong>{progressInsight.score ?? "—"}</strong>
            </div>
            <small>из 100</small>
          </div>

          <div className="profileAiCoachHeadline">
            <span>Оценка прогресса</span>
            <h2>{progressInsight.scoreLabel}</h2>
            <p>{progressInsight.scoreSummary}</p>
          </div>
        </div>

        {!isMainDashboard && <em>{expanded ? "−" : "+"}</em>}
      </button>

      {(isMainDashboard || !expanded) && (
        <div className="profileAiCoachPreview profileProgressInsightBadges">
          {statuses.map((status) => (
            <span key={status.title} className="profileProgressInsightBadge">
              <b>{status.icon} {status.title}</b>
              <small>{status.text}</small>
            </span>
          ))}
        </div>
      )}

      {!isMainDashboard && expanded && (
        <div className="profileAiCoachExpanded">
          <div className="profileAiCoachStatusRow insideProgress">
            {statuses.map((status) => (
              <div key={status.title}>
                <span>{status.icon}</span>
                <strong>{status.title}</strong>
                <small>{status.text}</small>
              </div>
            ))}
          </div>

          <div className="profileAiCoachMetrics">
            <div><span>Жир</span><strong>{currentGoalId === "mass" ? "контроль" : "↓"}</strong></div>
            <div><span>Мышцы</span><strong>{currentGoalId === "cut" || currentGoalId === "dry" ? "сохранить" : "↑"}</strong></div>
            <div><span>Сила</span><strong>{totalWorkouts ? "+" : "—"}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

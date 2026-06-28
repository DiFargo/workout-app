function getProgressGaugeTone(score) {
  if (score === null || score === undefined) {
    return {
      color: "rgba(140, 148, 168, 0.7)",
      glow: "rgba(140, 148, 168, 0.16)"
    };
  }

  const alpha = score >= 75
    ? 1
    : score >= 50
      ? 0.78
      : score >= 25
        ? 0.48
        : 0.22;

  return {
    color: `rgba(123, 111, 232, ${alpha})`,
    glow: `rgba(123, 111, 232, ${Math.max(0.1, alpha * 0.24).toFixed(2)})`
  };
}

export default function ProfileProgressInsightCard({
  isMainDashboard,
  progressInsight,
  expanded,
  statuses,
  currentGoalId,
  totalWorkouts,
  onToggle
}) {
  const gaugeScore = typeof progressInsight.score === "number"
    ? Math.max(0, Math.min(100, progressInsight.score))
    : null;
  const gaugeTone = getProgressGaugeTone(gaugeScore);

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
              "--progress-score": gaugeScore ?? 0,
              "--progress-fill": `${Math.round((gaugeScore ?? 0) * 3.6)}deg`,
              "--progress-color": gaugeTone.color,
              "--progress-glow": gaugeTone.glow
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
            <small style={{
              top: "54px",
              bottom: "auto",
              color: "#778196",
              WebkitTextFillColor: "#778196",
              fontSize: "8px"
            }}>из 100</small>
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

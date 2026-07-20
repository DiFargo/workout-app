import styles from "./ProfileProgressInsightCard.module.css";

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

export default function ProfileProgressInsightCard({ progressInsight, statuses }) {
  const gaugeScore = typeof progressInsight.score === "number"
    ? Math.max(0, Math.min(100, progressInsight.score))
    : null;
  const gaugeTone = getProgressGaugeTone(gaugeScore);
  const toneClass = styles[progressInsight.tone] || styles.neutral;

  return (
    <section
      className={`${styles.root} ${toneClass}`}
      data-css-module-scope="profile-progress-insight-card"
      data-testid="profile-progress-card"
    >
      <h2 className={styles.sectionTitle}>Прогресс недели</h2>
      <div className={styles.toggle}>
        <div className={styles.summary}>
          <div
            className={styles.gauge}
            data-testid="profile-progress-gauge"
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
            <div className={styles.dial}>
              <strong>{progressInsight.score ?? "—"}</strong>
            </div>
            <small className={styles.gaugeCaption}>из 100</small>
          </div>

          <div className={styles.headline} data-testid="profile-progress-headline">
            <h2 className={styles.title} data-testid="profile-progress-title">{progressInsight.scoreLabel}</h2>
            <p className={styles.copy} data-testid="profile-progress-copy">{progressInsight.scoreSummary}</p>
            <button type="button" className={styles.more} data-testid="profile-progress-more">Подробнее</button>
          </div>
        </div>
      </div>

      <div className={styles.badges} data-testid="profile-progress-badges">
        {statuses.map((status) => (
          <span key={status.title} className={styles.badge} data-testid="profile-progress-badge">
            <b>{status.icon} {status.title}</b>
            <small>{status.text}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

import styles from "./ProfileMainMeasurementSnapshot.module.css";

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSnapshotWeight(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "— кг";
  }
  return `${Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(1)} кг`;
}

export default function ProfileMainMeasurementSnapshot({
  measurementSeries,
  latestWeight,
  weightChange
}) {
  const safeSeries = Array.isArray(measurementSeries) ? measurementSeries.slice(-4) : [];
  const latestWeightLabel = formatSnapshotWeight(latestWeight);
  const chartMin = Math.min(...safeSeries.map((item) => Number(item.weight)).filter(Number.isFinite), Number(latestWeight) || 0);
  const chartMax = Math.max(...safeSeries.map((item) => Number(item.weight)).filter(Number.isFinite), Number(latestWeight) || 0);
  const chartRange = Math.max(1, chartMax - chartMin);
  const chartPoints = safeSeries.map((item, index) => {
    const x = safeSeries.length === 1
      ? 146
      : 28 + (224 * index) / Math.max(1, safeSeries.length - 1);
    const y = 72 - ((Number(item.weight) - chartMin) / chartRange) * 40;
    return {
      ...item,
      x,
      y,
      weightLabel: formatSnapshotWeight(item.weight)
    };
  });
  const chartPolyline = chartPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const lastPoint = chartPoints.at(-1);
  const bubbleWidth = 58;
  const bubbleX = lastPoint ? clampNumber(lastPoint.x - bubbleWidth / 2, 6, 280 - bubbleWidth - 6) : 0;
  const bubbleY = lastPoint ? clampNumber(lastPoint.y - 42, 4, 48) : 0;
  const bubblePointerX = lastPoint ? clampNumber(lastPoint.x - bubbleX, 12, bubbleWidth - 12) : bubbleWidth / 2;

  return (
    <section
      className={styles.root}
      data-state={chartPoints.length >= 2 ? "trend" : chartPoints.length === 1 ? "single" : "empty"}
      data-css-module-scope="profile-main-measurement-snapshot"
      data-testid="profile-measurement-snapshot"
      aria-label="Последние замеры веса"
    >
      <div className={styles.header} data-testid="profile-measurement-snapshot-header">
        <span>Вес</span>
      </div>
      <div className={styles.body} data-testid="profile-measurement-snapshot-body">
        <div className={styles.weight} data-testid="profile-measurement-snapshot-weight">
          <strong>{latestWeightLabel}</strong>
          {weightChange !== 0 && (
            <em>{weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} кг</em>
          )}
          <small>{weightChange ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} кг за неделю` : "0 кг за неделю"}</small>
        </div>
        <div className={styles.chart} data-testid="profile-measurement-snapshot-chart">
          {chartPoints.length >= 2 ? (
            <svg
              className={styles.trend}
              data-testid="profile-measurement-snapshot-trend"
              viewBox="0 0 280 118"
              role="img"
              aria-label="Изменение веса по последним замерам"
            >
              <defs>
                <linearGradient id="mainMeasurementLineGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-profile-measurement-chart-start)" />
                  <stop offset="100%" stopColor="var(--color-profile-measurement-chart-end)" />
                </linearGradient>
              </defs>
              {lastPoint && (
                <line
                  className={styles.currentGuide}
                  x1={lastPoint.x}
                  y1={lastPoint.y + 7}
                  x2={lastPoint.x}
                  y2="96"
                />
              )}
              <polyline className={styles.trendLine} points={chartPolyline} />
              {chartPoints.map((point, index) => (
                index === chartPoints.length - 1 ? null : (
                  <text
                    key={`${point.dateLabel}-weight-${index}`}
                    className={styles.pointLabel}
                    x={point.x}
                    y={point.y - 14}
                  >
                    {point.weightLabel}
                  </text>
                )
              ))}
              {chartPoints.map((point, index) => (
                <circle
                  key={`${point.dateLabel}-point-${index}`}
                  className={`${styles.trendPoint} ${index === chartPoints.length - 1 ? styles.current : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === chartPoints.length - 1 ? "7" : "4.8"}
                />
              ))}
              {lastPoint && (
                <g className={styles.currentBubble}>
                  <rect x={bubbleX} y={bubbleY} width={bubbleWidth} height="25" rx="7" />
                  <path d={`M ${bubbleX + bubblePointerX - 7} ${bubbleY + 24} L ${bubbleX + bubblePointerX + 7} ${bubbleY + 24} L ${lastPoint.x} ${bubbleY + 35} Z`} />
                  <text x={bubbleX + bubbleWidth / 2} y={bubbleY + 17}>{lastPoint.weightLabel}</text>
                </g>
              )}
              {chartPoints.map((point, index) => (
                <text
                  key={`${point.dateLabel}-date-${index}`}
                  className={styles.dateLabel}
                  x={point.x}
                  y="110"
                >
                  {point.dateLabel}
                </text>
              ))}
            </svg>
          ) : chartPoints.length === 1 ? (
            <div className={styles.single} data-testid="profile-measurement-snapshot-single">
              <strong>Первая точка сохранена</strong>
              <span>Добавь ещё один замер, чтобы увидеть динамику.</span>
            </div>
          ) : (
            <div className={styles.empty} data-testid="profile-measurement-snapshot-empty">
              Добавь первый замер, чтобы отслеживать динамику веса
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

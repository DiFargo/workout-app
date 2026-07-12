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
  latestMeasurement,
  latestWeight,
  weightChange
}) {
  const safeSeries = Array.isArray(measurementSeries) ? measurementSeries.slice(-4) : [];
  const isEmpty = safeSeries.length === 0;
  const isSinglePoint = safeSeries.length === 1;
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
      className={`mainMeasurementSnapshot ${isEmpty ? "emptyTrend" : ""} ${isSinglePoint ? "singlePointTrend" : ""}`}
      aria-label="Последние замеры веса"
    >
      <div className="mainMeasurementSnapshotHeader">
        <span>Последние замеры</span>
        <i aria-hidden="true">›</i>
      </div>
      <div className="mainMeasurementSnapshotBody">
        <div className="mainMeasurementWeight">
          <span>Текущий вес</span>
          <strong>{latestWeightLabel}</strong>
          {weightChange !== 0 && (
            <em>{weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} кг</em>
          )}
          <small>{latestMeasurement ? "к прошлому замеру" : "добавь первый замер"}</small>
        </div>
        <div className="mainMeasurementChart">
          {chartPoints.length >= 2 ? (
            <svg
              className="mainMeasurementChartTrend"
              viewBox="0 0 280 118"
              role="img"
              aria-label="Изменение веса по последним замерам"
            >
              <defs>
                <linearGradient id="mainMeasurementLineGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#6354f4" />
                  <stop offset="100%" stopColor="#7a4cff" />
                </linearGradient>
              </defs>
              {lastPoint && (
                <line
                  className="mainMeasurementCurrentGuide"
                  x1={lastPoint.x}
                  y1={lastPoint.y + 7}
                  x2={lastPoint.x}
                  y2="96"
                />
              )}
              <polyline className="mainMeasurementTrendLine" points={chartPolyline} />
              {chartPoints.map((point, index) => (
                index === chartPoints.length - 1 ? null : (
                  <text
                    key={`${point.dateLabel}-weight-${index}`}
                    className="mainMeasurementPointLabel"
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
                  className={`mainMeasurementTrendPoint ${index === chartPoints.length - 1 ? "current" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === chartPoints.length - 1 ? "7" : "4.8"}
                />
              ))}
              {lastPoint && (
                <g className="mainMeasurementCurrentBubble">
                  <rect x={bubbleX} y={bubbleY} width={bubbleWidth} height="25" rx="7" />
                  <path d={`M ${bubbleX + bubblePointerX - 7} ${bubbleY + 24} L ${bubbleX + bubblePointerX + 7} ${bubbleY + 24} L ${lastPoint.x} ${bubbleY + 35} Z`} />
                  <text x={bubbleX + bubbleWidth / 2} y={bubbleY + 17}>{lastPoint.weightLabel}</text>
                </g>
              )}
              {chartPoints.map((point, index) => (
                <text
                  key={`${point.dateLabel}-date-${index}`}
                  className="mainMeasurementDateLabel"
                  x={point.x}
                  y="110"
                >
                  {point.dateLabel}
                </text>
              ))}
            </svg>
          ) : chartPoints.length === 1 ? (
            <div className="mainMeasurementSingle">
              <strong>Первая точка сохранена</strong>
              <span>Добавь ещё один замер, чтобы увидеть динамику.</span>
            </div>
          ) : (
            <div className="mainMeasurementEmpty">
              Добавь первый замер, чтобы отслеживать динамику веса
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

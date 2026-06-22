export default function ProfileMainMeasurementSnapshot({
  measurementSeries,
  measurementPoints,
  latestMeasurement,
  latestWeight,
  weightChange,
  formatMeasurementDate
}) {
  const isEmpty = measurementSeries.length === 0;
  const isSinglePoint = measurementSeries.length === 1;

  return (
    <section
      className={`mainMeasurementSnapshot ${isEmpty ? "emptyTrend" : ""} ${isSinglePoint ? "singlePointTrend" : ""}`}
      aria-label="Последние замеры веса"
    >
      <div className="mainMeasurementSnapshotHeader">
        <div>
          <span>Последние замеры</span>
          <small>{latestMeasurement ? formatMeasurementDate(latestMeasurement) : "Добавь первый замер"}</small>
        </div>
        <strong>
          {latestWeight ? `${latestWeight} кг` : "— кг"}
          {weightChange !== 0 && (
            <em>{weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} кг</em>
          )}
        </strong>
      </div>
      <div className="mainMeasurementChart">
        {measurementSeries.length >= 2 ? (
          <svg viewBox="0 0 260 72" role="img" aria-label="Изменение веса по последним замерам">
            <line x1="10" y1="62" x2="250" y2="62" />
            <polyline points={measurementPoints} />
            {measurementSeries.map((item, index) => {
              const [x, y] = measurementPoints.split(" ")[index].split(",");
              return <circle key={`${item.dateLabel}-${index}`} cx={x} cy={y} r="3.5" />;
            })}
          </svg>
        ) : measurementSeries.length === 1 ? (
          <div className="mainMeasurementSingle">
            <strong>Первая точка сохранена</strong>
            <span>Добавь ещё один замер, чтобы увидеть динамику.</span>
          </div>
        ) : (
          <div className="mainMeasurementEmpty">
            Добавь первый замер, чтобы отслеживать динамику веса
          </div>
        )}
        {measurementSeries.length !== 1 && (
          <div className="mainMeasurementChartDates">
            <span>{measurementSeries[0]?.dateLabel || "Старт"}</span>
            <span>{measurementSeries.at(-1)?.dateLabel || "Сейчас"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

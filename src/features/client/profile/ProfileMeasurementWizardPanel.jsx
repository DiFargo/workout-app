import { Camera, ChevronRight, Ruler, Trophy } from "lucide-react";
import { useState } from "react";
import styles from "./ProfileMeasurementWizardPanel.module.css";
import { measurementTimestamp as getTimestamp, progressPeriodRange, getPeriodMeasurements, buildWeightChart } from "./profileProgressChart.js";
import ProfileAchievementsModal from "./ProfileAchievementsModal.jsx";

function toNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function formatDelta(delta, unit) {
  if (delta === null) return "Нет предыдущего значения";
  if (Math.abs(delta) < 0.05) return "Без изменений";
  return `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} ${unit}`;
}

function buildFieldComparison(measurements, field) {
  const values = measurements
    .map((measurement) => ({ measurement, value: toNumber(measurement?.[field.id]), timestamp: getTimestamp(measurement) }))
    .filter((item) => item.value !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
  const latest = values[0] || null;
  const previous = values[1] || null;
  return {
    value: latest?.value ?? null,
    delta: latest && previous ? Math.round((latest.value - previous.value) * 100) / 100 : null,
    latestMeasurement: latest?.measurement || null,
    previousMeasurement: previous?.measurement || null
  };
}

const PERIOD_OPTIONS = [
  { id: "month", label: "Месяц", days: 30 },
  { id: "halfYear", label: "6 месяцев", days: 183 },
  { id: "year", label: "Год", days: 366 }
];

export default function ProfileMeasurementWizardPanel({
  visible,
  latestMeasurement,
  measurements = [],
  measurementFields,
  formatMeasurementDate,
  totalWorkouts = 0,
  progressPhotos = [],
  onStart,
  onOpenPhotos,
  onAddWeight,
  onLoadAchievements,
  now = new Date()
}) {
  const [period, setPeriod] = useState("month");
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  if (!visible) return null;
  const sortedMeasurements = [...(Array.isArray(measurements) ? measurements : [])].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  const effectiveMeasurements = sortedMeasurements.length ? sortedMeasurements : latestMeasurement ? [latestMeasurement] : [];
  const periodMeasurements = getPeriodMeasurements([...effectiveMeasurements].reverse(), period, now);
  const periodRange = progressPeriodRange(period, now);
  const rangeDate = date => date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  const weightField = measurementFields.find((field) => field.id === "weight") || measurementFields[0];
  const weightComparison = weightField ? buildFieldComparison(effectiveMeasurements, weightField) : { value: null, delta: null };
  const chart = buildWeightChart(periodMeasurements, period === "month" ? 8 : 12);
  const firstPoint = chart.points[0];
  const lastPoint = chart.points.at(-1);
  const photoCount = Array.isArray(progressPhotos) ? progressPhotos.length : 0;
  const measurementNote = latestMeasurement ? `Последний замер: ${formatMeasurementDate(latestMeasurement)}` : "Добавьте первый замер";
  const weightNote = weightComparison.latestMeasurement
    ? `Последний вес: ${formatMeasurementDate(weightComparison.latestMeasurement)}`
    : "Добавьте первый вес";
  const photoNote = photoCount ? `${photoCount === 1 ? "1 фото сохранено" : `${photoCount} фото сохранено`}` : "Добавьте первое фото";

  return <div className={styles.panel} data-testid="profile-measurement-panel">
    <div className={styles.periods} role="tablist" aria-label="Период графика веса" data-testid="profile-progress-periods">
      {PERIOD_OPTIONS.map((option) => <button
        type="button"
        key={option.id}
        role="tab"
        aria-selected={period === option.id}
        className={period === option.id ? styles.activePeriod : ""}
        onClick={() => setPeriod(option.id)}
      >{option.label}</button>)}
    </div>
    <section className={styles.chartCard} data-testid="profile-progress-weight-card">
      <p className={styles.periodRange} data-testid="profile-progress-period-range">{period === "month" ? "Последние 30 дней · " : ""}{rangeDate(periodRange.from)} — {rangeDate(periodRange.to)}</p>
      <div className={styles.chartTop}>
        <div><span>Последний вес</span><strong>{weightComparison.value === null ? "—" : formatNumber(weightComparison.value)} <small>кг</small></strong></div>
        <div className={styles.weightChange} data-testid="profile-progress-weight-delta"><strong>{formatDelta(weightComparison.delta, "кг")}</strong><small>{weightComparison.delta === null ? "Добавьте ещё один замер" : "с прошлого замера"}</small></div>
      </div>
      {chart.points.length ? <>
        <svg className={styles.chart} viewBox="0 0 320 105" role="img" aria-label={`Динамика веса: от ${formatNumber(firstPoint.value)} до ${formatNumber(lastPoint.value)} килограмма`}>
          <defs><linearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--apple-blue)" stopOpacity=".14"/><stop offset="1" stopColor="var(--apple-blue)" stopOpacity=".02"/></linearGradient></defs>
          <path className={styles.grid} d="M0 25h320M0 52h320M0 79h320"/><path className={styles.area} d={chart.area}/><path className={styles.line} d={chart.path}/>
          {chart.points.map((point, index) => {
            const labelY = point.y <= 29 ? point.y + 14 : point.y - 9;
            const labelAnchor = index === 0 ? "start" : index === chart.points.length - 1 ? "end" : "middle";
            return <g key={`${point.timestamp}-${point.value}`}>
              <circle className={styles.point} cx={point.x} cy={point.y} r={point === lastPoint ? 5 : 3}><title>{`${formatNumber(point.value)} кг, ${formatMeasurementDate(point.measurement)}`}</title></circle>
              <text
                data-testid="profile-progress-weight-point-label"
                x={point.x}
                y={labelY}
                textAnchor={labelAnchor}
                fill="var(--apple-secondary)"
                stroke="var(--apple-surface)"
                strokeWidth="2.4"
                paintOrder="stroke"
                strokeLinejoin="round"
                fontSize="9"
                fontWeight="650"
                aria-hidden="true"
              >{formatNumber(point.value)}</text>
            </g>;
          })}
        </svg>
        <div className={styles.chartDates}><span>{formatMeasurementDate(firstPoint.measurement)}</span><span>{formatMeasurementDate(lastPoint.measurement)}</span></div>
        <details className={styles.chartValues}><summary>Даты и значения</summary><ul>{periodMeasurements.filter(item => toNumber(item.weight) !== null).map((item, index) => <li key={`${getTimestamp(item)}-${index}`}>{formatMeasurementDate(item)} · {formatNumber(toNumber(item.weight))} кг</li>)}</ul></details>
      </> : <p className={styles.chartEmpty}>{weightComparison.value === null ? "Добавьте первый вес, чтобы увидеть реальную динамику." : `За выбранный период свежих замеров веса нет. ${weightNote}.`}</p>}
      {onAddWeight ? <div className={styles.chartEntry}><small>{weightNote}</small><button type="button" data-testid="profile-progress-add-weight" onClick={onAddWeight}>Добавить вес</button></div> : null}
    </section>

    <div className={styles.sectionHead}><h3>Достижения</h3></div>
    <button type="button" className={styles.achievement} data-testid="profile-progress-achievement" aria-haspopup="dialog" onClick={() => setAchievementsOpen(true)}>
      <span><Trophy aria-hidden="true" /></span><div><strong>{totalWorkouts > 0 ? `${totalWorkouts} тренировок завершено` : "Первая тренировка впереди"}</strong><small>Каждое занятие — шаг вперёд</small></div>
      <ChevronRight className={styles.achievementChevron} aria-hidden="true" />
    </button>
    {achievementsOpen && <ProfileAchievementsModal historyLoader={onLoadAchievements} now={now} onClose={() => setAchievementsOpen(false)} />}

    <div className={styles.sectionHead}><h3>Контроль тела</h3></div>
    <section className={styles.controlGroup} data-testid="profile-progress-controls">
      <button type="button" className={styles.controlRow} data-testid="profile-progress-photos-open" onClick={onOpenPhotos}>
        <span className={`${styles.controlIcon} ${styles.photoIcon}`}><Camera aria-hidden="true" /></span><span><strong>Фото прогресса</strong><small>{photoNote}</small></span><ChevronRight aria-hidden="true" />
      </button>
      <button type="button" className={styles.controlRow} data-testid="profile-measurement-start" onClick={onStart}>
        <span className={`${styles.controlIcon} ${styles.measurementIcon}`}><Ruler aria-hidden="true" /></span><span><strong>Замеры тела</strong><small>{measurementNote}</small></span><ChevronRight aria-hidden="true" />
      </button>
    </section>
    <p className={styles.note}>Вес и замеры помогают наблюдать динамику. Отдельное значение — только часть картины.</p>
  </div>;
}

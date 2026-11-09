import { X } from "lucide-react";
import { Camera, ChevronRight, Ruler, Trophy, ChartNoAxesColumnIncreasing } from "../../../shared/ui/ClientReferenceIcon.jsx";
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
  { id: "quarter", label: "3 месяца", days: 90 },
  { id: "all", label: "Всё время" }
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
  onOpenExerciseProgress,
  onLoadAchievements,
  now = new Date()
}) {
  const [period, setPeriod] = useState("month");
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [weightDetailsOpen, setWeightDetailsOpen] = useState(false);
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
    <section className={styles.chartCard} data-testid="profile-progress-weight-card" aria-label={period === "all" ? "Все сохранённые замеры веса" : `${period === "month" ? "Последние 30 дней · " : ""}${rangeDate(periodRange.from)} — ${rangeDate(periodRange.to)}`}>
      <div className={styles.chartTop}>
        <div><span>Динамика веса</span><strong>{weightComparison.value === null ? "—" : formatNumber(weightComparison.value)} <small>кг</small></strong></div>
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
        <div className={styles.chartDates}><span>{new Date(firstPoint.timestamp).toLocaleDateString("ru-RU", { day:"numeric", month:"long" })}</span><span>{new Date(lastPoint.timestamp).toLocaleDateString("ru-RU", { day:"numeric", month:"long" })}</span></div>
      </> : <p className={styles.chartEmpty}>{weightComparison.value === null ? "Добавьте первый вес, чтобы увидеть реальную динамику." : `За выбранный период свежих замеров веса нет. ${weightNote}.`}</p>}
      <button type="button" className={styles.chartOpen} aria-label="История веса и добавление записи" aria-haspopup="dialog" onClick={() => setWeightDetailsOpen(true)} />
    </section>
    {weightDetailsOpen && <div className={styles.detailsOverlay} data-modal-backdrop="true" onClick={() => setWeightDetailsOpen(false)}><section className={styles.detailsSheet} role="dialog" aria-modal="true" aria-label="История веса" data-modal-surface="true" onClick={event => event.stopPropagation()}>
      <header><h2>История веса</h2><button type="button" aria-label="Закрыть историю веса" onClick={() => setWeightDetailsOpen(false)}><X aria-hidden="true" /></button></header>
      <p className={styles.periodRange} data-testid="profile-progress-period-range">{period === "all" ? "Все сохранённые замеры" : `${period === "month" ? "Последние 30 дней · " : ""}${rangeDate(periodRange.from)} — ${rangeDate(periodRange.to)}`}</p>
      {periodMeasurements.filter(item => toNumber(item.weight) !== null).length ? <ul>{[...periodMeasurements].reverse().filter(item => toNumber(item.weight) !== null).map((item,index) => <li key={`${getTimestamp(item)}-${index}`}><span>{formatMeasurementDate(item)}</span><strong>{formatNumber(toNumber(item.weight))} кг</strong></li>)}</ul> : <p>{weightNote}</p>}
      {onAddWeight && <button type="button" className={styles.addWeight} data-testid="profile-progress-add-weight" onClick={() => { setWeightDetailsOpen(false); onAddWeight(); }}>Добавить вес</button>}
    </section></div>}

    <div className={styles.sectionHead}><h3>Каждая тренировка важна</h3></div>
    <button type="button" className={styles.achievement} data-testid="profile-progress-achievement" aria-haspopup="dialog" onClick={() => setAchievementsOpen(true)}>
      <span><Trophy aria-hidden="true" /></span><div><strong>{totalWorkouts > 0 ? totalWorkouts : "Первая тренировка впереди"}</strong><small>{totalWorkouts > 0 ? "тренировок завершено за всё время" : "Каждое занятие — шаг вперёд"}</small></div>
      <span className={styles.achievementFooter}>Все достижения<ChevronRight aria-hidden="true" /></span>
    </button>
    {achievementsOpen && <ProfileAchievementsModal historyLoader={onLoadAchievements} now={now} onClose={() => setAchievementsOpen(false)} />}

    <div className={styles.sectionHead}><h3>Контроль тела</h3></div>
    <section className={styles.controlGroup} data-testid="profile-progress-controls">
      <button type="button" className={styles.controlRow} data-testid="profile-measurement-start" onClick={onStart}>
        <span className={`${styles.controlIcon} ${styles.measurementIcon}`}><Ruler aria-hidden="true" /></span><span><strong>Замеры тела</strong><small>{measurementNote}</small></span><ChevronRight aria-hidden="true" />
      </button>
      <button type="button" className={styles.controlRow} data-testid="profile-progress-photos-open" onClick={onOpenPhotos}>
        <span className={`${styles.controlIcon} ${styles.photoIcon}`}><Camera aria-hidden="true" /></span><span><strong>Фото прогресса</strong><small>{photoNote}</small></span><ChevronRight aria-hidden="true" />
      </button>
    </section>
    {onOpenExerciseProgress && <><div className={styles.sectionHead}><h3>Результаты</h3></div><section className={styles.controlGroup}><button type="button" className={styles.controlRow} data-testid="profile-exercise-progress-open" onClick={onOpenExerciseProgress}><span className={styles.controlIcon}><ChartNoAxesColumnIncreasing /></span><span><strong>Прогресс упражнений</strong><small>Вес, повторы и история выполнения</small></span><ChevronRight /></button></section></>}
  </div>;
}

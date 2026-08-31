import { useMemo, useState } from "react";
import { Dumbbell, Ruler, Scale, Utensils } from "lucide-react";
import {
  buildTrainerClientProgressDashboard,
  getTrainerClientAutoProgressPeriod
} from "../../utils/trainerClientProgressDashboard.js";
import styles from "./TrainerClientProgressDashboard.module.css";

const PERIODS = [
  { id: "1w", label: "1 неделя", days: 7 },
  { id: "1m", label: "1 месяц", days: 30 },
  { id: "3m", label: "3 месяца", days: 90 },
  { id: "6m", label: "6 месяцев", days: 180 }
];

function formatNumber(value, precision = 1) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(value);
}

function formatSigned(value, suffix = "%") {
  if (!Number.isFinite(value)) return "Нет сравнения";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
}

function formatChartDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getTrendTone(value, neutral = false) {
  if (neutral || !Number.isFinite(value) || Math.abs(value) < 0.1) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function MiniLineChart({ points, title, baseline = null }) {
  if (!points.length) {
    return <div className={styles.emptyChart}>Недостаточно данных за период</div>;
  }

  const values = points.map((point) => point.value);
  const scaleValues = Number.isFinite(baseline) ? [...values, baseline] : values;
  let min = Math.min(...scaleValues);
  let max = Math.max(...scaleValues);
  const spread = max - min;
  const padding = spread > 0 ? spread * 0.18 : Math.max(Math.abs(max) * 0.08, 1);
  min -= padding;
  max += padding;
  const timestamps = points.map((point) => new Date(point.date).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const getY = (value) => 88 - ((value - min) / Math.max(0.0001, max - min)) * 68;
  const renderChart = (width, inset, className) => {
    const getX = (point, index) => maxTime > minTime
      ? inset + ((timestamps[index] - minTime) / (maxTime - minTime)) * (width - inset * 2)
      : width / 2;
    const polyline = points.map((point, index) => `${getX(point, index)},${getY(point.value)}`).join(" ");

    return (
      <svg className={className} viewBox={`0 0 ${width} 104`} role="img" aria-label={title}>
        {[20, 54, 88].map((y) => <line key={y} x1={inset} x2={width - inset} y1={y} y2={y} className={styles.gridLine} />)}
        {Number.isFinite(baseline) && baseline >= min && baseline <= max ? (
          <line x1={inset} x2={width - inset} y1={getY(baseline)} y2={getY(baseline)} className={styles.baseline} />
        ) : null}
        {points.length > 1 ? <polyline points={polyline} className={styles.line} /> : null}
        {points.map((point, index) => (
          <circle key={`${point.date?.toISOString?.() || point.date}-${index}`} cx={getX(point, index)} cy={getY(point.value)} r="3.5" className={styles.dot} />
        ))}
      </svg>
    );
  };

  return (
    <div className={styles.chartWrap}>
      {renderChart(720, 32, styles.desktopChart)}
      {renderChart(320, 14, styles.mobileChart)}
      <div className={styles.chartDates}>
        <span>{formatChartDate(points[0].date)}</span>
        {points.length > 1 ? <span>{formatChartDate(points.at(-1).date)}</span> : null}
      </div>
    </div>
  );
}

function ProgressSignal({ card, active, onSelect }) {
  const Icon = card.icon;
  return (
    <button
      type="button"
      className={`${styles.signal} ${styles[card.id]} ${active ? styles.signalActive : ""}`}
      aria-pressed={active}
      onClick={() => onSelect(card.id)}
    >
      <span className={styles.signalIcon}><Icon size={18} /></span>
      <div>
        <h3>{card.title}</h3>
        <small>{card.meta}</small>
      </div>
      <strong className={styles[card.tone]}>{card.value}</strong>
    </button>
  );
}

export default function TrainerClientProgressDashboard({
  measurements = [],
  history = [],
  nutritionDays = [],
  nutritionGoals = {}
}) {
  const autoPeriod = useMemo(() => getTrainerClientAutoProgressPeriod({
    measurements,
    history,
    nutritionDays
  }), [history, measurements, nutritionDays]);
  const [manualPeriod, setManualPeriod] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("weight");
  const period = manualPeriod || autoPeriod;
  const selectedPeriod = PERIODS.find((item) => item.id === period) || PERIODS[2];
  const dashboard = useMemo(() => buildTrainerClientProgressDashboard({
    measurements,
    history,
    nutritionDays,
    nutritionGoals,
    days: selectedPeriod.days
  }), [history, measurements, nutritionDays, nutritionGoals, selectedPeriod.days]);

  const bodyTone = getTrendTone(dashboard.body.current);
  const strengthTone = getTrendTone(dashboard.strength.current);
  const nutritionTone = !Number.isFinite(dashboard.nutrition.current)
    ? "neutral"
    : dashboard.nutrition.trackedDays / Math.max(1, dashboard.nutrition.periodDays) < 0.5
      ? "neutral"
      : dashboard.nutrition.current >= 85 ? "positive" : dashboard.nutrition.current < 70 ? "negative" : "warning";
  const nutritionCoverageLow = dashboard.nutrition.trackedDays / Math.max(1, dashboard.nutrition.periodDays) < 0.5;
  const cards = [
    {
      id: "weight",
      title: "Вес",
      icon: Scale,
      value: formatSigned(dashboard.weight.delta, " кг"),
      meta: Number.isFinite(dashboard.weight.current) ? `Сейчас ${formatNumber(dashboard.weight.current)} кг` : "Нет замеров за период",
      tone: "neutral",
      points: dashboard.weight.points,
      chartLabel: "Динамика веса",
      chartTitle: "Изменение веса клиента",
      chartValue: Number.isFinite(dashboard.weight.current) ? `${formatNumber(dashboard.weight.current)} кг` : "Нет данных",
      chartBaseline: null
    },
    {
      id: "body",
      title: "Индекс замеров",
      icon: Ruler,
      value: formatSigned(dashboard.body.current),
      meta: dashboard.body.contributorCount ? `${dashboard.body.contributorCount} показателей` : "Нет сравнения",
      tone: bodyTone,
      points: dashboard.body.points,
      chartLabel: "Динамика замеров",
      chartTitle: "Изменение индекса замеров клиента",
      chartValue: formatSigned(dashboard.body.current),
      chartBaseline: 0
    },
    {
      id: "strength",
      title: "Силовые показатели",
      icon: Dumbbell,
      value: formatSigned(dashboard.strength.current),
      meta: dashboard.strength.exerciseCount ? `${dashboard.strength.exerciseCount} сопоставимых упр.` : "Нет сравнения",
      tone: strengthTone,
      points: dashboard.strength.points,
      chartLabel: "Динамика силы",
      chartTitle: "Изменение силовых показателей клиента",
      chartValue: formatSigned(dashboard.strength.current),
      chartBaseline: 0
    },
    {
      id: "nutrition",
      title: "Питание",
      icon: Utensils,
      value: Number.isFinite(dashboard.nutrition.current) ? `${formatNumber(dashboard.nutrition.current, 0)}%` : "—",
      meta: dashboard.nutrition.trackedDays ? `${dashboard.nutrition.trackedDays} из ${dashboard.nutrition.periodDays} завершённых дней` : "Нет цели или записей",
      tone: nutritionCoverageLow ? "neutral" : nutritionTone,
      points: dashboard.nutrition.points,
      chartLabel: "Соблюдение питания",
      chartTitle: "Соблюдение плана питания клиентом",
      chartValue: Number.isFinite(dashboard.nutrition.current) ? `${formatNumber(dashboard.nutrition.current, 0)}%` : "Нет данных",
      chartBaseline: 85
    }
  ];
  const activeCard = cards.find((card) => card.id === selectedMetric) || cards[0];

  return (
    <section
      className={styles.dashboard}
      aria-labelledby="trainer-client-progress-dashboard-title"
      data-testid="trainer-client-progress-dashboard"
    >
      <header className={styles.dashboardHeader}>
        <div>
          <h2 id="trainer-client-progress-dashboard-title">Результат</h2>
          <p>Вес, замеры, сила и питание — отдельно, на реальных данных клиента.</p>
        </div>
        <div className={styles.periods} aria-label="Период анализа прогресса">
          {PERIODS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === period ? styles.active : ""}
              aria-pressed={item.id === period}
              onClick={() => setManualPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <div className={styles.resultLayout}>
        <article className={`${styles.chartPanel} ${styles[activeCard.id]}`}>
          <div className={styles.chartPanelHead}>
            <div><span>{activeCard.chartLabel}</span><strong>{activeCard.chartValue}</strong></div>
            <small>{selectedPeriod.label}</small>
          </div>
          <MiniLineChart points={activeCard.points} title={activeCard.chartTitle} baseline={activeCard.chartBaseline} />
        </article>
        <div className={styles.signals} aria-label="Показатели для графика">
          {cards.map((card) => (
            <ProgressSignal
              key={card.id}
              card={card}
              active={card.id === activeCard.id}
              onSelect={setSelectedMetric}
            />
          ))}
        </div>
      </div>
      <p className={styles.caption}>Изменение веса само по себе не означает прогресс. Оценка питания не включает сегодняшний незавершённый день. Это контекст, а не причина прогресса.</p>
    </section>
  );
}

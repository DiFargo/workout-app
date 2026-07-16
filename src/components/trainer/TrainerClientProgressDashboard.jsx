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
  const getX = (point, index) => maxTime > minTime
    ? 14 + ((timestamps[index] - minTime) / (maxTime - minTime)) * 292
    : 160;
  const getY = (value) => 88 - ((value - min) / Math.max(0.0001, max - min)) * 68;
  const polyline = points.map((point, index) => `${getX(point, index)},${getY(point.value)}`).join(" ");

  return (
    <div className={styles.chartWrap}>
      <svg viewBox="0 0 320 104" role="img" aria-label={title}>
        {[20, 54, 88].map((y) => <line key={y} x1="14" x2="306" y1={y} y2={y} className={styles.gridLine} />)}
        {Number.isFinite(baseline) && baseline >= min && baseline <= max ? (
          <line x1="14" x2="306" y1={getY(baseline)} y2={getY(baseline)} className={styles.baseline} />
        ) : null}
        {points.length > 1 ? <polyline points={polyline} className={styles.line} /> : null}
        {points.map((point, index) => (
          <circle key={`${point.date?.toISOString?.() || point.date}-${index}`} cx={getX(point, index)} cy={getY(point.value)} r="3.5" className={styles.dot} />
        ))}
      </svg>
      <div className={styles.chartDates}>
        <span>{formatChartDate(points[0].date)}</span>
        {points.length > 1 ? <span>{formatChartDate(points.at(-1).date)}</span> : null}
      </div>
    </div>
  );
}

function ProgressCard({ card }) {
  const Icon = card.icon;
  return (
    <article className={`${styles.card} ${styles[card.id]}`}>
      <header className={styles.cardHeader}>
        <span className={styles.icon}><Icon size={18} /></span>
        <div className={styles.cardTitle}><small>{card.eyebrow}</small><h3>{card.title}</h3></div>
        <span className={`${styles.badge} ${styles[card.badgeTone]}`}>{card.badge}</span>
      </header>
      <div className={styles.metricRow}>
        <strong>{card.metric}</strong>
        <span>{card.meta}</span>
      </div>
      <MiniLineChart points={card.points} title={card.chartLabel} baseline={card.baseline} />
      <p className={styles.explanation}>{card.explanation}</p>
    </article>
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
      eyebrow: "МАССА ТЕЛА",
      title: "Вес",
      icon: Scale,
      metric: Number.isFinite(dashboard.weight.current) ? `${formatNumber(dashboard.weight.current)} кг` : "—",
      meta: formatSigned(dashboard.weight.delta, " кг"),
      badge: "Без оценки",
      badgeTone: "neutral",
      points: dashboard.weight.points,
      chartLabel: "Изменение веса клиента",
      explanation: "Изменение массы показывается без оценки: рост или снижение веса сами по себе не означают прогресс."
    },
    {
      id: "body",
      eyebrow: "СОСТАВ ТЕЛА",
      title: "Индекс замеров",
      icon: Ruler,
      metric: formatSigned(dashboard.body.current),
      meta: dashboard.body.contributorCount ? `${dashboard.body.contributorCount} показателей` : "Нет сравнения",
      badge: bodyTone === "positive" ? "Прогресс" : bodyTone === "negative" ? "Регресс" : "Без динамики",
      badgeTone: bodyTone,
      points: dashboard.body.points,
      baseline: 0,
      chartLabel: "Сводный индекс замеров тела",
      explanation: "Среднее изменение обхватов: рост плеч, груди, рук и ног идёт в плюс, рост талии — в минус. Вес не включён."
    },
    {
      id: "strength",
      eyebrow: "ТРЕНИРОВКИ",
      title: "Силовые показатели",
      icon: Dumbbell,
      metric: formatSigned(dashboard.strength.current),
      meta: dashboard.strength.exerciseCount ? `${dashboard.strength.exerciseCount} сопоставимых упр.` : "Нет сравнения",
      badge: strengthTone === "positive" ? "Рост силы" : strengthTone === "negative" ? "Снижение" : "Без динамики",
      badgeTone: strengthTone,
      points: dashboard.strength.points,
      baseline: 0,
      chartLabel: "Изменение силового индекса клиента",
      explanation: "Среднее изменение оценочного 1ПМ только по упражнениям, которые клиент выполнил минимум дважды за период."
    },
    {
      id: "nutrition",
      eyebrow: "СОБЛЮДЕНИЕ ПЛАНА",
      title: "Питание",
      icon: Utensils,
      metric: Number.isFinite(dashboard.nutrition.current) ? `${formatNumber(dashboard.nutrition.current, 0)}%` : "—",
      meta: dashboard.nutrition.trackedDays ? `${dashboard.nutrition.trackedDays} из ${dashboard.nutrition.periodDays} дней` : "Нет цели или записей",
      badge: nutritionCoverageLow && dashboard.nutrition.trackedDays ? "Мало данных" : nutritionTone === "positive" ? "План соблюдается" : nutritionTone === "negative" ? "Нужно проверить" : nutritionTone === "warning" ? "Есть отклонения" : "Нет данных",
      badgeTone: nutritionTone,
      points: dashboard.nutrition.points,
      baseline: 85,
      chartLabel: "Соблюдение плана питания клиентом",
      explanation: "Оценка на 70% учитывает попадание в калории и на 30% — выполнение цели по белку. Это контекст, а не причина прогресса."
    }
  ];

  return (
    <section
      className={styles.dashboard}
      aria-labelledby="trainer-client-progress-dashboard-title"
      data-testid="trainer-client-progress-dashboard"
    >
      <header className={styles.dashboardHeader}>
        <div>
          <h2 id="trainer-client-progress-dashboard-title">Динамика прогресса</h2>
          <p>Четыре независимые шкалы — значения не смешиваются между собой.</p>
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
      <div className={styles.grid}>{cards.map((card) => <ProgressCard key={card.id} card={card} />)}</div>
    </section>
  );
}

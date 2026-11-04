import { buildWorkoutExerciseProgress } from "../../../utils/workoutExerciseProgress.js";
import styles from "./WorkoutExerciseProgressChart.module.css";

const number = value => Number.isFinite(value)
  ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value) : "—";
const date = value => new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" });

export default function WorkoutExerciseProgressChart({ entries = [], complete = false }) {
  const model = buildWorkoutExerciseProgress(entries, { complete });
  const measured = model.points.filter(point => Number.isFinite(point.value));
  if (!measured.length) return null;
  const minimum = Math.min(...measured.map(point => point.value));
  const maximum = Math.max(...measured.map(point => point.value));
  const firstTime = Date.parse(model.points[0].date), lastTime = Date.parse(model.points.at(-1).date);
  const x = point => lastTime === firstTime ? 176 : 48 + (Date.parse(point.date) - firstTime) / (lastTime - firstTime) * 256;
  const y = point => maximum === minimum ? 64 : 116 - (point.value - minimum) / (maximum - minimum) * 100;
  const path = model.points.map((point, index) => Number.isFinite(point.value)
    ? `${index > 0 && Number.isFinite(model.points[index - 1].value) ? "L" : "M"}${x(point).toFixed(2)},${y(point).toFixed(2)}`
    : "").join(" ");

  return <section className={styles.root} data-testid="workout-exercise-progress-chart" aria-label="Динамика результатов упражнения">
    <div className={styles.heading}><strong>{model.metric.label}</strong><span>{model.scopeLabel}</span></div>
    <div className={styles.stats}>
      <div><span>Последний замер</span><strong>{number(model.latest)} <small>{model.metric.unit}</small></strong></div>
      <div><span>Максимум</span><strong>{number(model.best)} <small>{model.metric.unit}</small></strong></div>
    </div>
    {measured.length >= 4 ? <svg className={styles.chart} viewBox="0 0 320 158" role="img"
      aria-label={`${model.metric.label}, ${model.metric.unit}. От ${date(model.points[0].date)} до ${date(model.points.at(-1).date)}. Значения доступны в списке записей ниже.`}>
      <line className={styles.grid} x1="48" y1={y({ value: maximum })} x2="304" y2={y({ value: maximum })} />
      <text x="40" y={y({ value: maximum }) + 5} textAnchor="end">{number(maximum)}</text>
      {maximum !== minimum ? <>
        <line className={styles.grid} x1="48" y1="116" x2="304" y2="116" />
        <text x="40" y="121" textAnchor="end">{number(minimum)}</text>
      </> : null}
      <path className={styles.line} d={path} />
      {measured.map(point => <circle key={point.id} cx={x(point)} cy={y(point)} r="3.5"><title>{`${date(point.date)}: ${number(point.value)} ${model.metric.unit}`}</title></circle>)}
      <text x="48" y="150">{date(model.points[0].date)}</text>
      <text x="304" y="150" textAnchor="end">{date(model.points.at(-1).date)}</text>
    </svg> : <p>Для линии динамики нужны хотя бы четыре сохранённых замера.</p>}
  </section>;
}

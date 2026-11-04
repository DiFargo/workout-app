import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildTrainerExerciseHistoryChart, TRAINER_EXERCISE_CHART_METRICS } from "../../utils/trainerExerciseHistoryChart.js";
import { formatRussianCount } from "../../utils/russianCount.js";
import styles from "./TrainerExerciseHistoryChart.module.css";

const EMPTY_SESSIONS = [];
const WIDTH = 320, LEFT = 58, RIGHT = 308, TOP = 24, BOTTOM = 140;
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const axisNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1, notation: "compact" });
const fullDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const axisDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "2-digit" });
const dateText = record => record?.time === null || !record ? "Без даты" : fullDate.format(record.time);
const valueText = (record, metric) => record?.value === null || !record ? "Нет данных" : `${number.format(record.value)} ${metric.unit}`;

export default function TrainerExerciseHistoryChart({ sessions = EMPTY_SESSIONS }) {
  const id = useId();
  const [metricKey, setMetricKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const model = useMemo(() => buildTrainerExerciseHistoryChart(sessions, metricKey), [sessions, metricKey]);
  const { records, metric } = model;
  // Text lists show recent records first; the graph and navigation stay chronological.
  const displayRecords = useMemo(() => records.slice().sort((a, b) => {
    if (a.time === null) return b.time === null ? 0 : 1;
    if (b.time === null) return -1;
    return b.time - a.time;
  }), [records]);
  const selected = records.find(record => record.key === selectedKey)
    || records.findLast(record => record.time !== null) || records.at(-1) || null;
  const selectedIndex = selected ? records.indexOf(selected) : -1;
  const x = record => model.firstTime === model.lastTime ? (LEFT + RIGHT) / 2
    : LEFT + (record.time - model.firstTime) / (model.lastTime - model.firstTime) * (RIGHT - LEFT);
  const y = value => model.minimum === model.maximum ? (TOP + BOTTOM) / 2
    : BOTTOM - (value - model.minimum) / (model.maximum - model.minimum) * (BOTTOM - TOP);
  const ticks = model.minimum === model.maximum ? [model.minimum] : [model.minimum, (model.minimum + model.maximum) / 2, model.maximum];
  const selectIndex = index => { if (records[index]) setSelectedKey(records[index].key); };
  const handleGraphKey = event => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? records.length - 1
      : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.max(0, selectedIndex - 1)
        : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.min(records.length - 1, selectedIndex + 1) : null;
    if (next !== null) { event.preventDefault(); selectIndex(next); }
  };
  const handleGraphClick = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const tappedX = (event.clientX - rect.left) / rect.width * WIDTH;
    let nearest = null, distance = Infinity;
    for (const record of records) {
      if (record.time === null) continue;
      const currentDistance = Math.abs(x(record) - tappedX);
      if (currentDistance < distance) { nearest = record; distance = currentDistance; }
    }
    if (nearest) setSelectedKey(nearest.key);
  };

  return <section className={styles.root} aria-labelledby={`${id}-title`} data-testid="trainer-exercise-history-chart">
    <header className={styles.heading}>
      <strong id={`${id}-title`}>Динамика упражнения</strong>
      <span>По загруженной истории · {formatRussianCount(records.length, ["запись", "записи", "записей"])}</span>
    </header>
    {!records.length ? <p className={styles.empty}>В загруженной истории нет записей для графика.</p> : <>
      <div className={styles.metrics} role="group" aria-label="Показатель графика">
        {TRAINER_EXERCISE_CHART_METRICS.map(item => <button key={item.key} type="button" className={styles.metric}
          aria-pressed={metric.key === item.key} onClick={() => setMetricKey(item.key)}>{item.label}</button>)}
      </div>
      <div className={styles.axisHeading}><strong>{metric.label}</strong><span>{metric.unit}</span></div>
      {model.measuredCount ? <svg className={styles.chart} viewBox="0 0 320 184" width="320" height="184" role="slider" tabIndex={0}
        aria-label={`Запись на графике — ${metric.label}`} aria-orientation="horizontal"
        aria-valuemin={1} aria-valuemax={records.length} aria-valuenow={selectedIndex + 1}
        aria-valuetext={`${dateText(selected)}: ${valueText(selected, metric)}`} aria-describedby={`${id}-hint`}
        onKeyDown={handleGraphKey} onClick={handleGraphClick}>
        <g aria-hidden="true">
          {ticks.map((value, index) => <g key={index}><line className={styles.grid} x1={LEFT} x2={RIGHT} y1={y(value)} y2={y(value)} />
            <text className={styles.axisText} x={LEFT - 8} y={y(value) + 5} textAnchor="end">{axisNumber.format(value)}</text></g>)}
          {model.segments.filter(segment => segment.length > 1).map((segment, index) => <path key={index} className={styles.line}
            data-testid="trainer-history-chart-segment" d={segment.map((record, pointIndex) => `${pointIndex ? "L" : "M"}${x(record)},${y(record.value)}`).join(" ")} />)}
          {model.segments.flat().map(record => <circle key={record.key} className={record.key === selected?.key ? styles.selectedPoint : styles.point}
            cx={x(record)} cy={y(record.value)} r={record.key === selected?.key ? 5.5 : 3.5} />)}
          {model.firstTime === model.lastTime ? <text className={styles.axisText} x={(LEFT + RIGHT) / 2} y="173" textAnchor="middle">{axisDate.format(model.firstTime)}</text>
            : <><text className={styles.axisText} x={LEFT} y="173">{axisDate.format(model.firstTime)}</text>
              <text className={styles.axisText} x={RIGHT} y="173" textAnchor="end">{axisDate.format(model.lastTime)}</text></>}
        </g>
      </svg> : <p className={styles.empty}>Для этого показателя нет сохранённых значений с датой.</p>}
      <p className={styles.hint} id={`${id}-hint`}>{model.measuredCount === 1 ? "Одна точка — без вывода о динамике. " : ""}
        {model.measuredCount} из {records.length} записей с показателем и датой. Пропуски и смена учёта веса разрывают линию. На графике доступны стрелки и выбор касанием.</p>
      {metric.key === "e1rm" ? <p className={styles.hint}>Оценка по формуле Эпли, а не измеренный максимум.</p> : null}
      <div className={styles.recordPicker}>
        <button type="button" className={styles.step} aria-label="Предыдущая запись" disabled={selectedIndex <= 0} onClick={() => selectIndex(selectedIndex - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <div className={styles.selectLabel}><label htmlFor={`${id}-record`}>Запись</label>
          <select id={`${id}-record`} value={selected?.key || ""} onChange={event => setSelectedKey(event.target.value)}>
            {displayRecords.map(record => <option key={record.key} value={record.key}>{dateText(record)}</option>)}
          </select>
        </div>
        <button type="button" className={styles.step} aria-label="Следующая запись" disabled={selectedIndex >= records.length - 1} onClick={() => selectIndex(selectedIndex + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className={styles.readout} role="status" aria-live="polite" aria-atomic="true" data-testid="trainer-history-chart-value">
        <span>{dateText(selected)}</span><strong>{valueText(selected, metric)}</strong>
        <small>{selected?.session.bodyweightOnly ? "Собственный вес" : selected?.session.weightConventionLabel || "Способ указания веса не задан"}</small>
      </div>
      <details className={styles.records}><summary>Все записи · {records.length}</summary>
        <table><caption>{metric.label}: точные значения по загруженным записям</caption>
          <thead><tr><th scope="col">Дата</th><th scope="col">{metric.label}, {metric.unit}</th><th scope="col">Учёт веса</th></tr></thead>
          <tbody>{displayRecords.map(record => <tr key={record.key} aria-selected={record.key === selected?.key}>
            <th scope="row"><button type="button" className={styles.dateButton} onClick={() => setSelectedKey(record.key)}>{dateText(record)}</button></th>
            <td>{valueText(record, metric)}</td><td>{record.session.bodyweightOnly ? "Собственный вес" : record.session.weightConventionLabel || "Не задан"}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </>}
  </section>;
}

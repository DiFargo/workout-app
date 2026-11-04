import { useId, useRef, useState } from "react";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation";
import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet";
import styles from "./TrainerMeasurementsModal.module.css";

const VIEWS = [
  { id: "fields", label: "Показатели", title: "Все показатели" },
  { id: "history", label: "История", title: "История замеров" },
  { id: "trend", label: "Динамика", title: "Графики и анализ" }
];
const NUMBER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });
const CHART = { width: 320, height: 180, left: 45, right: 305, top: 18, bottom: 145 };

function dateLabel(date) {
  return date ? DATE.format(date) : "Дата не указана";
}

function measurementValue(record, field, getValue) {
  if (!record || !field || typeof getValue !== "function") return null;
  const value = getValue(record, field);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function valueLabel(value, unit) {
  return value === null ? "Не заполнено" : `${NUMBER.format(value)}${unit ? ` ${unit}` : ""}`;
}

function deltaLabel(value, previous, unit) {
  if (value === null || previous === null) return "Нет сравнения";
  const delta = Math.round((value - previous) * 10) / 10;
  return delta === 0 ? "Без изменений" : `${delta > 0 ? "+" : ""}${NUMBER.format(delta)} ${unit || ""}`.trim();
}

function prepareRecords(measurements, getDate) {
  const occurrences = new Map();
  return (Array.isArray(measurements) ? measurements : []).map((record) => {
    const candidate = typeof getDate === "function" ? getDate(record) : null;
    const date = candidate instanceof Date && Number.isFinite(candidate.getTime()) ? candidate : null;
    const identity = record?.id ? `id:${record.id}` : `date:${date?.getTime() ?? "unknown"}`;
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return { record, date, key: `${identity}:${occurrence}` };
  });
}

function buildChart(records, field, getValue) {
  const points = records.slice(0, 8).map((item) => ({
    ...item,
    value: measurementValue(item.record, field, getValue)
  })).sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  const known = points.filter((item) => item.date && item.value !== null);
  const dates = points.filter((item) => item.date).map((item) => item.date.getTime());
  const firstTime = dates.length ? Math.min(...dates) : null;
  const lastTime = dates.length ? Math.max(...dates) : null;
  const values = known.map((item) => item.value);
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const x = (date) => firstTime === lastTime ? (CHART.left + CHART.right) / 2 :
    CHART.left + (date.getTime() - firstTime) / (lastTime - firstTime) * (CHART.right - CHART.left);
  const y = (value) => min === max ? (CHART.top + CHART.bottom) / 2 :
    CHART.bottom - (value - min) / (max - min) * (CHART.bottom - CHART.top);
  const segments = [];
  let segment = [];
  const finishSegment = () => {
    if (segment.length > 1 && segment.some((item) => item.date.getTime() !== segment[0].date.getTime())) segments.push(segment);
    segment = [];
  };
  points.forEach((item) => {
    if (!item.date || item.value === null) finishSegment();
    else segment.push(item);
  });
  finishSegment();
  return { points, known, firstTime, lastTime, min, max, x, y, segments };
}

export default function TrainerMeasurementsModal({ initialView = "fields", measurements = [], fields = [], getDate, getValue, insight = null, onClose }) {
  useModalBackNavigation({ open: true, onBack: onClose });
  const id = useId();
  const tabsRef = useRef(null);
  const records = prepareRecords(measurements, getDate);
  const safeFields = Array.isArray(fields) ? fields : [];
  const [view, setView] = useState(() => VIEWS.some((item) => item.id === initialView) ? initialView : "fields");
  const [recordKey, setRecordKey] = useState(() => records[0]?.key || "");
  const [fieldId, setFieldId] = useState("weight");
  const [trendKey, setTrendKey] = useState(() => records[0]?.key || "");
  const activeView = VIEWS.find((item) => item.id === view) || VIEWS[0];
  const selectedIndex = Math.max(0, records.findIndex((item) => item.key === recordKey));
  const selected = records[selectedIndex] || null;
  const previous = records[selectedIndex + 1] || null;
  const trendField = safeFields.find((field) => field.id === fieldId) || safeFields[0] || null;
  const chart = buildChart(records, trendField, getValue);
  const foundTrendIndex = chart.points.findIndex((item) => item.key === trendKey);
  const trendIndex = foundTrendIndex >= 0 ? foundTrendIndex : Math.max(0, chart.points.length - 1);
  const trendSelected = chart.points[trendIndex] || null;
  const summaryFields = ["weight", "belly", "chest"].map((fieldId) => safeFields.find((field) => field.id === fieldId)).filter(Boolean);

  function changeTab(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % VIEWS.length;
    else if (event.key === "ArrowLeft") next = (index + VIEWS.length - 1) % VIEWS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = VIEWS.length - 1;
    else return;
    event.preventDefault();
    setView(VIEWS[next].id);
    tabsRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  function showRecord(key) {
    setRecordKey(key);
    setView("fields");
    tabsRef.current?.querySelector('[role="tab"]')?.focus();
  }

  function selectChartPoint(event) {
    if (!chart.known.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const targetX = (event.clientX - rect.left) / rect.width * CHART.width;
    const closest = chart.known.reduce((best, point) => Math.abs(chart.x(point.date) - targetX) < Math.abs(chart.x(best.date) - targetX) ? point : best);
    setTrendKey(closest.key);
  }

  return (
    <TrainerClientUtilitySheet title={activeView.title} eyebrow="Замеры тела" onRequestClose={onClose}>
      <div className={styles.root} data-testid="trainer-measurements-modal">
        <div className={styles.tabs} role="tablist" aria-label="Разделы замеров" ref={tabsRef}>
          {VIEWS.map((item, index) => (
            <button key={item.id} type="button" role="tab" id={`${id}-${item.id}-tab`} aria-controls={`${id}-panel`}
              aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1}
              onKeyDown={(event) => changeTab(event, index)} onClick={() => setView(item.id)}>{item.label}</button>
          ))}
        </div>
        <section id={`${id}-panel`} className={styles.panel} role="tabpanel" aria-labelledby={`${id}-${view}-tab`}>
          {!records.length ? <p className={styles.empty}>Полных замеров пока нет. Отдельные записи веса доступны в сводке, в разделе «Динамика → Вес».</p> : null}

          {view === "fields" && selected ? <>
            <div className={styles.control}>
              <label htmlFor={`${id}-record`}>Дата замера</label>
              <select id={`${id}-record`} value={selected.key} onChange={(event) => setRecordKey(event.target.value)}>
                {records.map((item, index) => <option key={item.key} value={item.key}>{dateLabel(item.date)}{index === 0 ? " · последний" : ""}</option>)}
              </select>
            </div>
            <p className={styles.note}>{previous ? `Изменения с ${dateLabel(previous.date)}.` : "Более ранних замеров для сравнения пока нет."} Дата замера не связана с выбранными фото.</p>
            <dl className={styles.fields}>
              {safeFields.map((field) => {
                const currentValue = measurementValue(selected.record, field, getValue);
                const previousValue = measurementValue(previous?.record, field, getValue);
                return <div className={styles.field} key={field.id} data-testid="trainer-measurement-field">
                  <dt>{field.label}</dt>
                  <dd>{valueLabel(currentValue, field.unit)}</dd>
                  <dd className={styles.delta}>{deltaLabel(currentValue, previousValue, field.unit)}</dd>
                </div>;
              })}
            </dl>
          </> : null}

          {view === "history" && records.length ? <>
            <p className={styles.note}>Полные замеры тела · {records.length}. Выберите запись, чтобы увидеть все показатели.</p>
            <ol className={styles.history}>
              {records.map((item, index) => <li className={styles.historyRow} key={item.key}>
                <div className={styles.historyHeading}><strong>{dateLabel(item.date)}</strong>{index === 0 ? <span>Последний</span> : null}</div>
                <dl className={styles.summary}>
                  {summaryFields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{valueLabel(measurementValue(item.record, field, getValue), field.unit)}</dd></div>)}
                </dl>
                <button className={styles.historyButton} type="button" aria-label={`Показать замер: ${dateLabel(item.date)}`} onClick={() => showRecord(item.key)}>Показать замер</button>
              </li>)}
            </ol>
          </> : null}

          {view === "trend" && records.length ? <>
            <div className={styles.control}>
              <label htmlFor={`${id}-field`}>Показатель динамики</label>
              <select id={`${id}-field`} value={trendField?.id || ""} onChange={(event) => setFieldId(event.target.value)}>
                {safeFields.map((field) => <option key={field.id} value={field.id}>{field.label}, {field.unit}</option>)}
              </select>
            </div>
            <p className={styles.note}>По последним {chart.points.length} полным замерам из загруженной истории. Пропуски не соединяются линией.</p>
            {chart.known.length ? <div className={styles.chartCard}>
              <div className={styles.chartHeading}><strong>{trendField?.label}</strong><span>{trendField?.unit} · даты замеров</span></div>
              <svg className={styles.chart} viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="slider" tabIndex={0}
                aria-label={`Динамика: ${trendField?.label || "показатель"}. Выберите дату стрелками`}
                aria-valuemin={1} aria-valuemax={chart.points.length} aria-valuenow={trendIndex + 1}
                aria-valuetext={`${dateLabel(trendSelected?.date)}: ${valueLabel(trendSelected?.value ?? null, trendField?.unit)}`}
                onClick={selectChartPoint} onKeyDown={(event) => {
                  let next;
                  if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, trendIndex - 1);
                  else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(chart.points.length - 1, trendIndex + 1);
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = chart.points.length - 1;
                  else return;
                  event.preventDefault(); setTrendKey(chart.points[next].key);
                }}>
                <line className={styles.gridLine} x1={CHART.left} x2={CHART.right} y1={CHART.top} y2={CHART.top} />
                <line className={styles.gridLine} x1={CHART.left} x2={CHART.right} y1={CHART.bottom} y2={CHART.bottom} />
                <text className={styles.axis} x={CHART.left - 7} y={chart.min === chart.max ? (CHART.top + CHART.bottom) / 2 + 4 : CHART.bottom + 4} textAnchor="end">{NUMBER.format(chart.min)}</text>
                {chart.min !== chart.max ? <text className={styles.axis} x={CHART.left - 7} y={CHART.top + 4} textAnchor="end">{NUMBER.format(chart.max)}</text> : null}
                {chart.segments.map((segment, index) => <polyline key={index} data-testid="trainer-measurement-trend-segment" className={styles.chartLine}
                  points={segment.map((point) => `${chart.x(point.date)},${chart.y(point.value)}`).join(" ")} />)}
                {chart.known.map((point) => <circle key={point.key} cx={chart.x(point.date)} cy={chart.y(point.value)} r={point.key === trendSelected?.key ? 5.5 : 3.5}
                  className={point.key === trendSelected?.key ? styles.selectedPoint : styles.point} />)}
                <text className={styles.axis} x={CHART.left} y={168}>{SHORT_DATE.format(chart.firstTime)}</text>
                {chart.firstTime !== chart.lastTime ? <text className={styles.axis} x={CHART.right} y={168} textAnchor="end">{SHORT_DATE.format(chart.lastTime)}</text> : null}
              </svg>
              <p className={styles.chartCaption}>{chart.known.length === 1 ? "Одна точка — без вывода о динамике." : `${chart.known.length} значений из ${chart.points.length} замеров. Расстояние между точками соответствует времени.`}</p>
            </div> : <p className={styles.empty}>Нет значений с датой для этого графика. Незаполненные показатели не считаются нулём.</p>}
            <div className={styles.control}>
              <label htmlFor={`${id}-moment`}>Дата на графике</label>
              <select id={`${id}-moment`} value={trendSelected?.key || ""} onChange={(event) => setTrendKey(event.target.value)}>
                {chart.points.map((point) => <option key={point.key} value={point.key}>{dateLabel(point.date)} · {valueLabel(point.value, trendField?.unit)}</option>)}
              </select>
            </div>
            <div className={styles.readout} data-testid="trainer-measurement-trend-value" aria-live="polite" aria-atomic="true">
              <span>{dateLabel(trendSelected?.date)}</span><strong>{valueLabel(trendSelected?.value ?? null, trendField?.unit)}</strong>
            </div>
            {insight?.title || insight?.text ? <section className={styles.insight} aria-label="Анализ замеров">
              {insight.title ? <h3>{insight.title}</h3> : null}
              {insight.text ? <p>{insight.text}</p> : null}
            </section> : null}
          </> : null}
        </section>
      </div>
    </TrainerClientUtilitySheet>
  );
}

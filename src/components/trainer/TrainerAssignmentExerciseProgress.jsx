import { useState } from "react";
import styles from "./TrainerAssignmentExerciseProgress.module.css";

const dateLabel = date => date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const number = value => Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function HistoryChart({ sessions, selected }) {
  const values = sessions.flatMap(session => [session.chartActualWeight, session.chartPlannedWeight]).filter(value => value !== null && Number.isFinite(value));
  const maximum = Math.max(5, Math.ceil(Math.max(...values) / 5) * 5);
  const x = index => 32 + index * 350 / Math.max(1, sessions.length - 1);
  const y = value => 100 - value / maximum * 82;
  function segments(field) {
    const result = [];
    let points = [];
    sessions.forEach((session, index) => {
      const value = session[field];
      if (value === null || !Number.isFinite(value)) {
        if (points.length) result.push(points.join(" "));
        points = [];
      } else points.push(`${x(index)},${y(value)}`);
    });
    if (points.length) result.push(points.join(" "));
    return result;
  }
  const hasPlan = sessions.some(session => session.chartPlannedWeight !== null);
  return (
    <figure className={styles.chart} data-testid="assignment-progress-chart">
      <figcaption>Максимальный рабочий вес, кг</figcaption>
      <svg viewBox="0 0 400 118" aria-hidden="true" focusable="false">
        <path className={styles.gridLine} d="M32 18H382M32 100H382" />
        <text x="0" y="22">{number(maximum)}</text><text x="16" y="104">0</text>
        {segments("chartPlannedWeight").map((points, index) => <polyline key={`plan-${index}`} data-series="planned" className={styles.plannedLine} points={points} strokeDasharray="5 5" />)}
        {segments("chartActualWeight").map((points, index) => <polyline key={`actual-${index}`} data-series="actual" className={styles.actualLine} points={points} />)}
        {sessions.map((session, index) => session.chartActualWeight !== null && Number.isFinite(session.chartActualWeight) && (
          <circle key={index} cx={x(index)} cy={y(session.chartActualWeight)} r={session === selected ? 5 : 3} className={styles.point} />
        ))}
      </svg>
      <div className={styles.legend}><span>— Факт</span>{hasPlan && <span>┄ План той тренировки</span>}</div>
      <p>Точки — тренировки по порядку. График показывает только вес; повторы и подходы — ниже.</p>
    </figure>
  );
}

export default function TrainerAssignmentExerciseProgress({ progress }) {
  const [pickedSession, setPickedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selected = progress.sessions.includes(pickedSession) ? pickedSession : progress.current;
  if (!progress.current) {
    return <p className={styles.empty} data-testid="assignment-progress-summary">Пока нет записанных рабочих подходов. История появится после выполнения упражнения.</p>;
  }
  const showChart = progress.sessions.length >= 4 && progress.sessions.some(session => session.chartActualWeight > 0);
  return (
    <section className={styles.progress} aria-label="История выполнения упражнения">
      <div className={styles.summary} data-testid="assignment-progress-summary">
        <div className={styles.historyHeading}>
          <span className={styles.caption}>Последняя тренировка · {dateLabel(progress.current.date)}</span>
          <b className={styles.badge} data-tone={progress.planStatus.tone}>{progress.planStatus.label}</b>
        </div>
        {progress.returnToPlan && <strong className={styles.returnLabel}>Возврат к плановой нагрузке</strong>}
        <strong className={styles.fact}>{progress.current.factText}</strong>
        <p>{progress.comparisonText || progress.trend.description}</p>
        {["incomparable", "mixed", "repeated_lower"].includes(progress.trend.key) && <p><strong>{progress.trend.label}.</strong> {progress.trend.description}</p>}
        {progress.baselineText && <p>{progress.baselineText}</p>}
        {progress.planStatus.key === "unknown" && <p>{progress.current.planText}</p>}
      </div>
      {showChart && <HistoryChart sessions={progress.sessions} selected={selected} />}
      <div className={styles.historyLabel}>Последние тренировки{progress.sessionCount > 8 ? " · показаны 8" : ""}</div>
      <div className={styles.sessions} role="group" aria-label="Выбрать тренировку для просмотра подходов и плана">
        {progress.sessions.map((session, index) => (
          <button
            key={`${session.date.getTime()}:${index}`}
            type="button"
            data-testid="assignment-history-point"
            aria-pressed={session === selected}
            aria-label={`${dateLabel(session.date)}: ${session.factText}. Показать подходы и план`}
            onClick={() => { setPickedSession(session); setDetailsOpen(true); }}
          >
            <span>{dateLabel(session.date)}</span>
            <strong>{session.chartActualWeight > 0 ? `${number(session.chartActualWeight)} кг` : `${number(session.totalReps)} повт.`}</strong>
          </button>
        ))}
      </div>
      <details className={styles.details} data-testid="assignment-progress-details" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
        <summary>Подходы и план · {dateLabel(selected.date)}</summary>
        <section className={styles.sessionDetail} data-testid="assignment-session-detail" aria-label={`Данные тренировки ${dateLabel(selected.date)}`}>
          <div><span>Факт</span><strong>{selected.factText}</strong></div>
          <div><span>План этой тренировки</span><strong>{selected.planText}</strong></div>
          <p>{selected.planStatus.description}</p>
          <table>
            <caption>Выполненные рабочие подходы</caption>
            <thead><tr><th scope="col">Подход</th><th scope="col">Вес, кг</th><th scope="col">Повторы</th></tr></thead>
            <tbody>{selected.actualSets.map(set => <tr key={set.index}><th scope="row">{set.index + 1}</th><td>{set.weight > 0 ? number(set.weight) : selected.factsComplete === false ? "Не записан" : "Без доп. веса"}</td><td>{number(set.reps)}</td></tr>)}</tbody>
          </table>
          {selected.weightConvention === "per_hand" && <p>Вес указан на одну руку / гантель.</p>}
          {selected.clientComment && <p className={styles.comment}>Комментарий клиента: {selected.clientComment}</p>}
        </section>
      </details>
    </section>
  );
}

import { useEffect, useState } from "react";
import { CalendarDays, Medal, Trophy } from "lucide-react";
import ProfileModalCloseButton from "./ProfileModalCloseButton.jsx";
import { useModalBackNavigation } from "../../../shared/hooks/useModalBackNavigation.js";
import { buildProfileAchievements } from "./profileAchievements.js";
import styles from "./ProfileAchievementsModal.module.css";

function countText(count, one, few, many) {
  const remainder = count % 100;
  return `${count} ${remainder >= 11 && remainder <= 14 ? many : count % 10 === 1 ? one : count % 10 >= 2 && count % 10 <= 4 ? few : many}`;
}

function dateText(key, options = { day: "numeric", month: "long", year: "numeric" }) {
  return new Date(`${key}T12:00:00`).toLocaleDateString("ru-RU", options);
}

function ProgressChart({ model }) {
  const series = model.monthSeries;
  if (!series.length) return <p className={styles.explanation}>График появится после первой тренировки с сохранённой датой.</p>;
  const max = Math.max(1, model.datedCount);
  const points = [{ x: 30, y: 142 }, ...series.map((item, index) => ({
    x: 30 + ((index + 1) / series.length) * 280,
    y: 142 - (item.total / max) * 116
  }))];
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  return <>
    <svg className={styles.chart} viewBox="0 0 332 172" role="img" aria-label={`Завершённые тренировки накопительно: от 0 до ${model.datedCount}. Точные значения по месяцам доступны ниже.`}>
      <path className={styles.grid} d="M30 26H310M30 84H310M30 142H310" />
      <text x="20" y="30" textAnchor="end">{max}</text><text x="20" y="146" textAnchor="end">0</text>
      <path className={styles.area} d={`${path} L310 142 Z`} />
      <path className={styles.line} d={path} />
      <circle className={styles.point} cx={310} cy={points.at(-1).y} r="4" />
      <text x="30" y="166">{dateText(`${series[0].key}-01`, { month: "short", year: "2-digit" })}</text>
      <text x="310" y="166" textAnchor="end">{dateText(`${series.at(-1).key}-01`, { month: "short", year: "2-digit" })}</text>
    </svg>
    <p className={styles.chartNote}>Каждая тренировка добавляется к предыдущим. График показывает ваш вклад в регулярность, а не изменение силы или веса.</p>
    <details className={styles.values}>
      <summary tabIndex={0}>По месяцам — точные числа</summary>
      <table><caption>Завершённые тренировки за весь период</caption><thead><tr><th scope="col">Месяц</th><th scope="col">За месяц</th><th scope="col">Всего</th></tr></thead><tbody>
        {series.map(item => <tr key={item.key}><th scope="row">{dateText(`${item.key}-01`, { month: "long", year: "numeric" })}</th><td>{item.count}</td><td>{item.total}</td></tr>)}
      </tbody></table>
    </details>
  </>;
}

export default function ProfileAchievementsModal({ historyLoader, onClose, now = new Date() }) {
  const [loader] = useState(() => historyLoader);
  const [asOf] = useState(() => now);
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState({ status: "loading", value: null });
  useModalBackNavigation({ open: true, onBack: onClose });

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => loader?.()).then(value => {
      if (cancelled) return;
      if (!value?.isCurrent?.()) throw new Error("Achievements history is no longer current");
      setResource({ status: "ready", value });
    }).catch(() => {
      if (!cancelled) setResource({ status: "error", value: null });
    });
    return () => { cancelled = true; };
  }, [loader, attempt]);

  const current = resource.status === "ready" && resource.value?.isCurrent?.();
  const model = current ? buildProfileAchievements(resource.value.items, { now: asOf }) : null;
  return <div className={styles.overlay} data-modal-backdrop="true" role="presentation" onClick={onClose} data-testid="profile-achievements-overlay">
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="profileAchievementsTitle" data-modal-surface="true" data-cabinet-sheet="true" data-testid="profile-achievements-dialog" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
      <header className={styles.header}>
        <div><p>Весь период</p><h2 id="profileAchievementsTitle">Ваши достижения</h2></div>
        <ProfileModalCloseButton className={styles.close} ariaLabel="Закрыть достижения" onClick={onClose} />
      </header>
      <div className={styles.body} aria-busy={resource.status === "loading"}>
        {resource.status === "loading" ? <div className={styles.state} role="status"><span className={styles.trophy}><Trophy aria-hidden="true" /></span><h3>Собираем ваши достижения</h3><p>Проверяем завершённые тренировки за весь период.</p></div> : !model ? <div className={styles.state} role="alert"><h3>Не удалось загрузить достижения</h3><p>Проверьте соединение и повторите. Ваши тренировки не изменились.</p><button type="button" className={styles.retry} onClick={() => { setResource({ status: "loading", value: null }); setAttempt(value => value + 1); }}>Повторить</button></div> : <>
          <section className={styles.hero} data-testid="profile-achievements-total">
            <span className={styles.trophy}><Trophy aria-hidden="true" /></span>
            <strong>{model.completedCount}</strong>
            <h3>{countText(model.completedCount, "тренировка завершена", "тренировки завершены", "тренировок завершено").replace(/^\d+\s/, "")}</h3>
            <p>{model.completedCount ? "Вы находили время для себя. Каждое занятие — уже результат." : "Первая завершённая тренировка станет началом вашей истории."}</p>
          </section>
          {model.completedCount > 0 && <>
            <div className={styles.facts}>
              <section><CalendarDays aria-hidden="true" /><strong>{model.activeWeeks}</strong><span>{countText(model.activeWeeks, "неделя с тренировками", "недели с тренировками", "недель с тренировками").replace(/^\d+\s/, "")}</span></section>
              <section><Medal aria-hidden="true" /><strong>{model.bestWeek?.count || "—"}</strong><span>{countText(model.bestWeek?.count || 0, "тренировка", "тренировки", "тренировок").replace(/^\d+\s/, "")} в самую активную неделю</span></section>
            </div>
            <section className={styles.chartCard} aria-labelledby="achievementsChartTitle">
              <div className={styles.chartHead}><h3 id="achievementsChartTitle">Ваш путь в тренировках</h3><span>Тренировок накоплено</span></div>
              <ProgressChart model={model} />
            </section>
            <section className={styles.details}>
              {model.milestone > 0 && <p><Medal aria-hidden="true" /><span><strong>Рубеж: {countText(model.milestone, "тренировка", "тренировки", "тренировок")}</strong><small>Вы уже сделали это.</small></span></p>}
              {model.firstDate && <p><CalendarDays aria-hidden="true" /><span><strong>{model.undatedCount ? "Первая тренировка с известной датой" : "Ваша первая сохранённая тренировка"}</strong><small>{dateText(model.firstDate)}</small></span></p>}
            </section>
          </>}
          {model.undatedCount > 0 && <p className={styles.explanation}>{countText(model.undatedCount, "тренировка учтена", "тренировки учтены", "тренировок учтено")} в общем результате, но без точной даты — вне графика и недельной статистики.</p>}
          {model.pendingCount > 0 && <p className={styles.explanation}>Есть результаты, ожидающие синхронизации. Они появятся в достижениях после сохранения на сервере.</p>}
          <p className={styles.footerNote}>Только реальные завершённые тренировки, в том числе из прошлых программ. У каждого свой темп.</p>
        </>}
      </div>
    </section>
  </div>;
}

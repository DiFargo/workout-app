import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardCheck, MessageSquare, Search, X } from "lucide-react";
import {
  buildTrainerWorkoutHistoryRows,
  filterTrainerWorkoutHistoryRows
} from "../../utils/trainerWorkoutHistoryPresentation.js";
import { formatRussianCount } from "../../utils/russianCount.js";
import styles from "./TrainerWorkoutHistoryPanel.module.css";

const PAGE_SIZE = 20;
const recordsLabel = count => formatRussianCount(count, ["запись", "записи", "записей"]);

function WorkoutHistoryDetails({ row, review, onAdjustNextWorkout }) {
  return <div className={styles.details} data-workout-history-detail="true">
    <header className={styles.detailHeader}>
      <h3>{row.title}</h3>
      {review ? <strong className={`${styles.badge} ${review.reviewed ? styles.success : styles.warning}`}>
        {review.reviewed ? "Проверено тренером" : "Можно проверить"}
      </strong> : null}
    </header>
    {row.programLabel ? <p className={styles.note}>{row.programLabel}</p> : null}
    <div className={styles.stats}>
      <div className={styles.stat}><span>Упражнения</span><strong>{row.comparison.length ? row.exercisesCount : "—"}</strong><small>с отметкой выполнения</small></div>
      <div className={styles.stat}><span>Подходы</span><strong>{row.comparison.length ? row.setsCount : "—"}</strong><small>выполнено по записи</small></div>
      <div className={styles.stat}><span>Объём</span><strong>{row.volumeLabel}</strong><small>вес × повторы</small></div>
    </div>
    {row.feedbackTitle || row.clientComment ? <div className={styles.feedback}>
      <MessageSquare size={18} aria-hidden="true" />
      <div>
        <strong>{row.feedbackTitle ? `После тренировки: ${row.feedbackTitle}` : "Комментарий клиента"}</strong>
        {row.clientComment ? <blockquote>{row.clientComment}</blockquote> : null}
      </div>
    </div> : <p className={styles.note}>Клиент не оставил оценку и комментарий после тренировки.</p>}
    {row.readinessTitle ? <p className={styles.note}>Самочувствие до тренировки: {row.readinessTitle}</p> : null}
    <details className={styles.comparison}>
      <summary tabIndex={0}>{row.hasSavedPlan ? "План и выполненные подходы" : "Выполненные подходы"}<ChevronDown size={17} aria-hidden="true" /></summary>
      <p className={styles.note}>{row.hasSavedPlan
        ? "План сохранён на дату этого занятия. Нынешняя программа на сравнение не влияет."
        : "План на дату занятия не сохранён. Показан только факт — без сравнения с нынешней программой."}</p>
      {row.comparison.length ? <ol className={styles.exerciseComparison}>{row.comparison.map(exercise => <li key={exercise.key} className={styles.exercise}>
        <strong>{exercise.name}</strong>
        {row.hasSavedPlan ? <p><span>План</span>{exercise.plannedText || "Не сопоставлен"}</p> : null}
        <p><span>Факт</span>{exercise.actualText}</p>
        {exercise.note ? <blockquote>{exercise.note}</blockquote> : null}
      </li>)}</ol> : <p className={styles.note}>Подходы в этой записи не сохранены.</p>}
      {row.unmatchedPlanNames.length ? <p className={styles.note}>Не сопоставлено с планом: {row.unmatchedPlanNames.join(", ")}. Название или состав могли измениться; это не автоматическая отметка о пропуске.</p> : null}
    </details>
    {review?.needsTrainerReply && !review.reviewed && onAdjustNextWorkout ? <button type="button" className={styles.primaryButton} onClick={onAdjustNextWorkout}>
      <ClipboardCheck size={18} aria-hidden="true" />Скорректировать следующую тренировку
    </button> : null}
  </div>;
}

export default function TrainerWorkoutHistoryPanel({
  history = [], actionableReview, onAdjustNextWorkout,
  hasMore = false, loading = false, error = "", onLoadMore
}) {
  const rows = useMemo(() => buildTrainerWorkoutHistoryRows(history), [history]);
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const panelId = useId();
  const rowButtons = useRef(new Map());
  const filteredRows = useMemo(() => filterTrainerWorkoutHistoryRows(rows, query), [rows, query]);
  const visibleRows = filteredRows.slice(0, visibleCount);
  const actionableRow = rows.find(row => actionableReview?.historyId &&
    [row.entry.id, row.entry.clientSaveId].includes(actionableReview.historyId));

  function updateQuery(value) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function openActionableRow() {
    if (!actionableRow) return;
    setQuery("");
    setVisibleCount(Math.max(PAGE_SIZE, rows.indexOf(actionableRow) + 1));
    setExpandedKey(actionableRow.key);
    requestAnimationFrame(() => rowButtons.current.get(actionableRow.key)?.focus());
  }

  return <section className={styles.root} aria-label="Сохранённые тренировки клиента">
    <div className={styles.toolbar}>
      <div className={styles.search}><label htmlFor={`${panelId}-search`}>Поиск по истории</label><div className={styles.searchField}>
        <Search size={18} aria-hidden="true" />
        <input id={`${panelId}-search`} type="search" value={query} onChange={event => updateQuery(event.target.value)} placeholder="Тренировка, программа или дата" />
        {query ? <button className={styles.clearSearch} type="button" aria-label="Очистить поиск по истории" onClick={() => updateQuery("")}><X size={18} aria-hidden="true" /></button> : null}
      </div></div>
      <p className={styles.count}>{query ? `Найдено: ${filteredRows.length} из ${rows.length}` : `${hasMore ? "Загружено: " : "Всего: "}${recordsLabel(rows.length)}`}<span>Новые занятия сверху{hasMore ? " · доступны более ранние записи" : ""}</span></p>
    </div>
    {actionableRow && actionableReview.needsTrainerReply && !actionableReview.reviewed ? <div className={styles.notice}>
      <div><strong>Последняя тренировка текущей программы</strong><span>{actionableRow.title} · {actionableRow.dateLabel}</span></div>
      <button type="button" className={styles.secondaryButton} onClick={openActionableRow}>Посмотреть</button>
    </div> : null}
    {visibleRows.length ? <div className={styles.list}>{visibleRows.map((row, index) => {
      const expanded = expandedKey === row.key;
      const detailId = `${panelId}-session-${index}`;
      const review = actionableRow?.key === row.key ? actionableReview : null;
      return <article key={row.key} className={styles.item}>
        <button type="button" className={styles.row} aria-expanded={expanded} aria-controls={detailId} data-workout-history-review={review ? "current" : undefined}
          ref={node => { if (node) rowButtons.current.set(row.key, node); else rowButtons.current.delete(row.key); }}
          onClick={() => setExpandedKey(value => value === row.key ? "" : row.key)}>
          <span className={styles.dateTile} aria-hidden="true"><strong>{row.dateDay}</strong><small>{row.dateMonth}</small></span>
          <span className={styles.rowCopy}><strong>{row.title}</strong><small>{row.dateLabel} · {row.summary}</small>
            <span className={styles.rowState}>{row.clientComment ? <><MessageSquare size={13} aria-hidden="true" />Есть комментарий</> : row.feedbackTitle ? `Оценка: ${row.feedbackTitle}` : "Без оценки после тренировки"}{review?.reviewed ? " · Проверено" : ""}</span>
          </span>
          {expanded ? <ChevronUp className={styles.chevron} size={18} aria-hidden="true" /> : <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />}
        </button>
        <div id={detailId} hidden={!expanded}>{expanded ? <WorkoutHistoryDetails row={row} review={review} onAdjustNextWorkout={onAdjustNextWorkout} /> : null}</div>
      </article>;
    })}</div> : <div className={styles.empty}>
      <h3>{query ? "Ничего не найдено" : hasMore ? "Нужно загрузить записи" : "Тренировок пока нет"}</h3>
      <p>{query ? `Поиск идёт по ${recordsLabel(rows.length)}${hasMore ? ", загруженным сейчас" : ""}. Попробуйте другое название или дату.` : hasMore ? "Загрузите сохранённую историю клиента кнопкой ниже." : "Здесь появятся завершённые занятия и результаты клиента."}</p>
      {query ? <button type="button" className={styles.secondaryButton} onClick={() => updateQuery("")}>Сбросить поиск</button> : null}
    </div>}
    <div className={styles.pagination}>
      {filteredRows.length > visibleCount ? <button type="button" className={styles.secondaryButton} onClick={() => setVisibleCount(value => value + PAGE_SIZE)}>Показать ещё {Math.min(PAGE_SIZE, filteredRows.length - visibleCount)} записей</button> : null}
      {hasMore ? <><p className={styles.note}>Более ранние занятия загружаются отдельно.{query ? " Поиск охватывает только загруженные записи." : ""}</p><button type="button" className={styles.secondaryButton} disabled={loading} onClick={onLoadMore}>{loading ? "Загружаю…" : "Загрузить более ранние тренировки"}</button></> : null}
      {error ? <p role="alert" className={styles.note}>{error}</p> : null}
    </div>
  </section>;
}

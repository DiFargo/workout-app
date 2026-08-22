import { useMemo, useState } from "react";
import styles from "./TrainerDailyJournal.module.css";
import {
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  Dumbbell,
  MessageSquare,
  Ruler,
  Sparkles,
  Utensils
} from "lucide-react";
import {
  buildTrainerImmediateActions,
  buildTrainerDailyJournal,
  filterTrainerDailyJournalItems,
  TRAINER_DAILY_JOURNAL_FILTERS
} from "../../utils/trainerDailyJournal.js";

function getReviewedStorageKey(trainerName, dateKey) {
  return `trainer_daily_journal_reviewed:${String(trainerName || "trainer").trim() || "trainer"}:${dateKey}`;
}

function readReviewedIds(trainerName, dateKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getReviewedStorageKey(trainerName, dateKey)) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function JournalIcon({ type }) {
  const Icon = {
    workout: Dumbbell,
    nutrition: Utensils,
    measurement: Ruler,
    feedback: MessageSquare,
    task: ClipboardList,
    program: Sparkles,
    plan: CalendarDays,
    attention: Bell
  }[type] || Bell;
  return <Icon size={16} strokeWidth={1.9} aria-hidden="true" />;
}

function TrainerDailyJournalContent({ immediateActions, journal, onOpenClient, renderAvatar, trainerName }) {
  const [reviewedIds, setReviewedIds] = useState(() => readReviewedIds(trainerName, journal.dateKey));
  const [journalFilter, setJournalFilter] = useState("all");
  const actionsNow = useMemo(() => {
    const seen = new Set();
    const standingActions = immediateActions.map((action) => ({ ...action, isStanding: true }));
    const dailyActions = journal.items.filter((item) => item.requiresAction);

    return [...standingActions, ...dailyActions].filter((action) => {
      if (!action?.id || seen.has(action.id) || reviewedIds.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
  }, [immediateActions, journal.items, reviewedIds]);
  const timelineItems = useMemo(
    () => journal.items.filter((item) => !item.requiresAction || reviewedIds.has(item.id)),
    [journal.items, reviewedIds]
  );
  const filteredItems = useMemo(
    () => filterTrainerDailyJournalItems(timelineItems, journalFilter, reviewedIds),
    [timelineItems, journalFilter, reviewedIds]
  );

  function acknowledge(eventId) {
    setReviewedIds((current) => {
      const next = new Set(current);
      next.add(eventId);
      try {
        window.localStorage.setItem(getReviewedStorageKey(trainerName, journal.dateKey), JSON.stringify([...next]));
      } catch {
        // The journal remains usable during this session when local storage is unavailable.
      }
      return next;
    });
  }

  function openClient(target) {
    onOpenClient?.(target.client, target.target || "overview");
  }

  function openEvent(event) {
    acknowledge(event.id);
    openClient(event);
  }

  function openImmediateAction(action) {
    // A standing task (for example, an unassigned client) stays here until
    // the underlying state actually changes. Daily signals can be marked as
    // reviewed when the trainer opens the related client card.
    if (!action.isStanding) acknowledge(action.id);
    openClient(action);
  }

  return (
    <>
      {actionsNow.length ? (
        <section className={styles.immediateActionsSection} aria-label="Действия, которые нужно выполнить сейчас">
          <header className={styles.immediateActionsHead}>
            <div>
              <span>СЕЙЧАС</span>
              <h2>Требуют действия</h2>
              <p>Незакрытые задачи собраны отдельно, чтобы их можно было быстро обработать.</p>
            </div>
            <strong>{actionsNow.length}</strong>
          </header>
          <div className={styles.immediateActionsList}>
            {actionsNow.map((action) => (
              <article key={action.id}>
                {renderAvatar(action.client, "small")}
                <div className={styles.immediateActionsContent}>
                  <span><JournalIcon type={action.icon} />{action.clientName}</span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </div>
                <button type="button" onClick={() => openImmediateAction(action)}>{action.actionLabel || "Открыть"}</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.dailyJournalSection} aria-label="Журнал дня">
        <header className={styles.dailyJournalHead}>
          <div>
            <span>ЖУРНАЛ ДНЯ</span>
            <h2>Хронология событий</h2>
            <p>События дня и уже проверенные сигналы по данным клиентов.</p>
          </div>
          <strong className={actionsNow.length ? styles.attention : styles.calm}>
            {actionsNow.length ? `${actionsNow.length} требуют действия` : "Всё просмотрено"}
          </strong>
        </header>

        <div className={styles.dailyJournalFilters} role="group" aria-label="Фильтр журнала дня">
          {TRAINER_DAILY_JOURNAL_FILTERS.map((filter) => {
            const count = filterTrainerDailyJournalItems(timelineItems, filter.id, reviewedIds).length;
            return (
              <button
                type="button"
                key={filter.id}
                className={journalFilter === filter.id ? styles.active : ""}
                aria-pressed={journalFilter === filter.id}
                onClick={() => setJournalFilter(filter.id)}
              >
                {filter.label}<span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.dailyJournalTimeline}>
          {filteredItems.length ? <div className={`${styles.dailyJournalBoundary} ${styles.start}`}>Начало дня</div> : null}
          {filteredItems.map((event) => {
            const reviewed = reviewedIds.has(event.id);
            return (
              <article className={`${styles.dailyJournalEvent} ${event.requiresAction ? styles.requiresAction : ""} ${reviewed ? styles.reviewed : ""}`} key={event.id}>
                <time>{event.timeLabel}</time>
                <span className={styles.dailyJournalLine} aria-hidden="true"><i /></span>
                {renderAvatar(event.client, "small")}
                <div className={styles.dailyJournalEventContent}>
                  <span><JournalIcon type={event.icon} />{event.clientName}</span>
                  <strong>{event.title}</strong>
                  <small>{event.detail}</small>
                </div>
                {event.requiresAction ? (
                  reviewed ? (
                    <span className={styles.dailyJournalReviewed}><Check size={14} aria-hidden="true" />Проверено</span>
                  ) : (
                    <button type="button" onClick={() => openEvent(event)}>{event.actionLabel || "Открыть"}</button>
                  )
                ) : <span className={styles.dailyJournalRecorded}>Записано</span>}
              </article>
            );
          })}
          {filteredItems.length ? <div className={`${styles.dailyJournalBoundary} ${styles.end}`}>Сейчас</div> : null}
          {!filteredItems.length ? (
            <div className={styles.dailyJournalEmpty}>
              <Check size={18} aria-hidden="true" />
              {timelineItems.length ? "По этому фильтру событий нет." : "В журнале пока нет событий. Незакрытые задачи показаны выше."}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

export default function TrainerDailyJournal({ actionCenter, onOpenClient, renderAvatar, trainerName }) {
  const immediateActions = useMemo(() => buildTrainerImmediateActions(actionCenter), [actionCenter]);
  const journal = useMemo(() => buildTrainerDailyJournal(actionCenter), [actionCenter]);
  const contentKey = `${trainerName || "trainer"}:${journal.dateKey}`;

  return (
    <TrainerDailyJournalContent
      key={contentKey}
      immediateActions={immediateActions}
      journal={journal}
      onOpenClient={onOpenClient}
      renderAvatar={renderAvatar}
      trainerName={trainerName}
    />
  );
}

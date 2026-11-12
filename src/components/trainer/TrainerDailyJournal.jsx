import { useMemo, useState } from "react";
import styles from "./TrainerDailyJournal.module.css";
import {
  Bell,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
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

const IMMEDIATE_ACTION_PRIORITY = {
  program: 0,
  feedback: 1,
  workout: 2,
  task: 3,
  nutrition: 4,
  measurement: 5,
  attention: 6
};

const russianPlurals = new Intl.PluralRules("ru");
function plural(count, one, few, many) {
  return ({ one, few, many })[russianPlurals.select(count)] || many;
}

function sortImmediateActions(first, second) {
  const priorityDifference = (IMMEDIATE_ACTION_PRIORITY[first?.icon] ?? 99) - (IMMEDIATE_ACTION_PRIORITY[second?.icon] ?? 99);
  if (priorityDifference) return priorityDifference;

  return String(first?.clientName || "").localeCompare(String(second?.clientName || ""), "ru");
}

function TrainerDailyJournalContent({ immediateActions, journal, onOpenClient, renderAvatar, trainerName, clients = [], onOpenClients, onOpenPrograms }) {
  const [reviewedIds, setReviewedIds] = useState(() => readReviewedIds(trainerName, journal.dateKey));
  const [journalFilter, setJournalFilter] = useState("all");
  const actionsNow = useMemo(() => {
    const seen = new Set();
    const standingActions = immediateActions.map((action) => ({ ...action, isStanding: true }));
    const dailyActions = journal.items.filter((item) => item.requiresAction);

    return [...standingActions, ...dailyActions].filter((action) => {
      if (!action?.id || seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    }).sort(sortImmediateActions);
  }, [immediateActions, journal.items]);
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

  function openTimelineEvent(event) {
    if (event.requiresAction && !reviewedIds.has(event.id)) acknowledge(event.id);
    openClient(event);
  }

  function openImmediateAction(action) {
    // Opening means viewed, never resolved: the signal stays until source data changes.
    if (!action.isStanding) acknowledge(action.id);
    openClient(action);
  }

  const firstAction = actionsNow[0];
  const setupActions = actionsNow.filter((action) => action.title === "Нужно настроить клиента");
  const needsSetup = firstAction?.title === "Нужно настроить клиента";
  const primaryTitle = needsSetup && setupActions.length > 1
    ? `${setupActions.length} ${plural(setupActions.length, "клиент ждёт", "клиента ждут", "клиентов ждут")} настройки`
    : needsSetup ? "Клиент ждёт настройки" : firstAction?.title;
  const taskClientIds = new Set(actionsNow.map((action) => action.client?.id));
  const readyClients = clients.filter((client) => !client.archived && !client.isTest && !taskClientIds.has(client.id)).slice(0, 2);

  function queueRow(action) {
    return <button key={action.id} type="button" className={styles.queueRow} onClick={() => openImmediateAction(action)}
      aria-label={`${action.actionLabel || "Открыть"}: ${action.clientName}. ${action.title}. ${action.detail}`}>
      <span><small>{action.clientName}</small><strong>{action.title}</strong></span><ChevronRight size={18} aria-hidden="true" />
    </button>;
  }

  return (
    <div className={styles.dashboardLayout}>
      {actionsNow.length ? (
        <section className={styles.priorityPanel} data-testid="trainer-priority-panel" aria-label="Действия, которые нужно выполнить сейчас">
          <header className={styles.priorityHead}>
            <span><JournalIcon type={firstAction.icon} />{needsSetup ? "Сначала — настройка" : "Следующее действие"}</span>
            <small>{actionsNow.length} {plural(actionsNow.length, "задача", "задачи", "задач")}</small>
          </header>
          <h2>{primaryTitle}</h2>
          <p>{needsSetup ? "Подготовь программу, даты занятий и питание." : firstAction.detail}</p>
          <div className={styles.priorityClient}>
            {renderAvatar(firstAction.client, "small")}
            <div><strong>{firstAction.clientName}</strong><small>{needsSetup ? firstAction.detail : firstAction.title}</small></div>
          </div>
          <button type="button" data-testid="trainer-priority-action" className={styles.primaryAction}
            aria-label={`${firstAction.actionLabel || "Открыть"}: ${firstAction.clientName}. ${firstAction.title}`}
            onClick={() => openImmediateAction(firstAction)}>
            {needsSetup ? "Настроить клиента" : firstAction.actionLabel || "Открыть клиента"}<ArrowRight size={19} aria-hidden="true" />
          </button>
          {actionsNow.length > 1 ? <div className={styles.nextAction}><span>Следом</span>{queueRow(actionsNow[1])}</div> : null}
          {actionsNow.length > 2 ? <details className={styles.remainingActions}><summary>Ещё задачи · {actionsNow.length - 2}</summary>{actionsNow.slice(2).map(queueRow)}</details> : null}
        </section>
      ) : <section className={styles.priorityPanel} data-testid="trainer-priority-panel">
        <header className={styles.priorityHead}><span><Check size={16} aria-hidden="true" />Всё проверено</span></header>
        <h2>Срочных задач нет</h2>
        <p>По доступным данным нет незакрытых сигналов. Посмотри клиентов или подготовь следующий план.</p>
        <button type="button" className={styles.primaryAction} onClick={onOpenClients}>Мои клиенты<ArrowRight size={19} aria-hidden="true" /></button>
      </section>}

      <div className={styles.secondaryColumn}>
      <section className={styles.dailyJournalSection} aria-label="Журнал дня">
        <header className={styles.dailyJournalHead}>
          <div>
            <h2>События за сегодня</h2>
          </div>
        </header>

        {timelineItems.length ? <div className={styles.dailyJournalFilters} role="group" aria-label="Фильтр журнала дня">
          {TRAINER_DAILY_JOURNAL_FILTERS.map((filter) => {
            const count = filterTrainerDailyJournalItems(timelineItems, filter.id, reviewedIds).length;
            return (
              <button
                type="button"
                key={filter.id}
                className={journalFilter === filter.id ? styles.active : ""}
                aria-pressed={journalFilter === filter.id}
                aria-label={`${filter.label}: ${count}`}
                onClick={() => setJournalFilter(filter.id)}
              >
                {filter.id === "all" ? "Все" : filter.id === "reviewed" ? "Просмотрено" : filter.label}<span>{count}</span>
              </button>
            );
          })}
        </div> : null}

        <div className={styles.dailyJournalTimeline}>
          {filteredItems.map((event) => {
            const reviewed = reviewedIds.has(event.id);
            return (
              <article
                className={`${styles.dailyJournalEvent} ${styles.dailyJournalEventClickable} ${event.requiresAction ? styles.requiresAction : ""} ${reviewed ? styles.reviewed : ""}`}
                key={event.id}
                role="button"
                tabIndex={0}
                aria-label={`Открыть: ${event.clientName}. ${event.title}. ${event.detail}`}
                onClick={() => openTimelineEvent(event)}
                onKeyDown={(eventKey) => {
                  if (eventKey.key !== "Enter" && eventKey.key !== " ") return;
                  eventKey.preventDefault();
                  openTimelineEvent(event);
                }}
              >
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
                    <span className={styles.dailyJournalReviewed}><Check size={14} aria-hidden="true" />Просмотрено</span>
                  ) : (
                    <span className={styles.dailyJournalEventAction} aria-hidden="true">{event.actionLabel || "Открыть"}</span>
                  )
                ) : <span className={styles.dailyJournalRecorded}>Записано</span>}
              </article>
            );
          })}
          {!filteredItems.length ? (
            <div className={styles.dailyJournalEmpty}>
              <Check size={18} aria-hidden="true" />
              <div><strong>{timelineItems.length ? "По этому фильтру событий нет" : "Новых событий пока нет"}</strong>
                <small>{actionsNow.length ? "Незакрытые задачи — в блоке действий." : "Здесь появятся тренировки, питание и замеры за сегодня."}</small></div>
            </div>
          ) : null}
        </div>
      </section>
      <section className={styles.quickLinks} aria-label="Клиенты и программы">
        <header><h2>Мои клиенты</h2><button type="button" onClick={onOpenClients}>Все · {clients.filter((client) => !client.archived && !client.isTest).length}</button></header>
        <div>
          {readyClients.map((client) => <button key={client.id} type="button" onClick={() => onOpenClient?.(client, "overview")}>
            {renderAvatar(client, "small")}<span><strong>{client.name || client.displayName || "Клиент"}</strong><small>Открыть план и результаты</small></span><ChevronRight size={18} aria-hidden="true" />
          </button>)}
          <button type="button" onClick={onOpenPrograms}><span className={styles.quickIcon}><ClipboardList size={20} aria-hidden="true" /></span><span><strong>Шаблоны программ</strong><small>Основа для персональных планов</small></span><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </section>
      </div>
    </div>
  );
}

export default function TrainerDailyJournal({ actionCenter, onOpenClient, renderAvatar, trainerName, trainerUid, clients, onOpenClients, onOpenPrograms }) {
  const immediateActions = useMemo(() => buildTrainerImmediateActions(actionCenter), [actionCenter]);
  const journal = useMemo(() => buildTrainerDailyJournal(actionCenter), [actionCenter]);
  const contentKey = `${trainerUid || trainerName || "trainer"}:${journal.dateKey}`;

  return (
    <TrainerDailyJournalContent
      key={contentKey}
      immediateActions={immediateActions}
      journal={journal}
      onOpenClient={onOpenClient}
      renderAvatar={renderAvatar}
      trainerName={trainerUid || trainerName}
      clients={clients}
      onOpenClients={onOpenClients}
      onOpenPrograms={onOpenPrograms}
    />
  );
}

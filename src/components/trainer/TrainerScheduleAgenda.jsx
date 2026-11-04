import { useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, History, Info, LockKeyhole } from "lucide-react";
import { buildWorkoutScheduleCalendarEntries, toWorkoutDateKey } from "../../utils/workoutSchedule.js";
import { getSubscriptionStatus } from "../../utils/clientSubscription.js";
import { formatRussianCount } from "../../utils/russianCount.js";
import { ADMIN_CALENDAR_DAYS } from "../../utils/adminClientCalendar.js";
import { distributeAgendaWeekdays, getAgendaDateDraft, getAgendaDisplaySlots, getAgendaScheduleSaveHint, getAgendaWeekdayDefaults, isAgendaSlotEditable, validateAgendaDateDraft } from "../../utils/trainerScheduleAgenda.js";
import { TrainerSheetCloseContext } from "./TrainerSheetCloseContext.js";
import styles from "./TrainerScheduleAgenda.module.css";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const STATUS_TEXT = { planned: "Запланирована", completed: "Выполнена", completed_off_date: "В другой день", missed: "Пропущена", moved: "Перенесена", shifted: "Смещена", pastCompleted: "Прошлая программа" };
const dateValue = value => value ? new Date(`${value}T12:00:00`) : null;
const formatDate = (value, options = { day: "numeric", month: "short" }) => value ? dateValue(value).toLocaleDateString("ru-RU", options) : "Не назначена";
const sessions = value => formatRussianCount(value, ["занятие", "занятия", "занятий"]);
const counterDraft = subscription => ({ purchasedSessions: Math.max(0, Math.trunc(Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0)), usedSessions: Math.max(0, Math.trunc(Number(subscription.usedSessions) || 0)) });

function Status({ status }) {
  return <span className={styles.status} data-status={status}>{["completed", "completed_off_date", "pastCompleted"].includes(status) ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{STATUS_TEXT[status] || "Запланирована"}</span>;
}

function MonthCalendar({ month, selectedDate, entries, range, today, onMonth, onSelect, onToday }) {
  const first = dateValue(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7) * 7;
  const byDate = new Map();
  entries.forEach(entry => byDate.set(entry.date, [...(byDate.get(entry.date) || []), entry]));
  return <section className={`${styles.inlinePanel} ${styles.calendarPanel}`} aria-label="Календарь занятий">
    <div className={styles.calendarTitle}><div><h3>Календарь занятий</h3><p>{range.startDate ? `${formatDate(range.startDate)} — ${formatDate(range.endDate)}` : "Даты ещё не назначены"}</p></div><button type="button" className={styles.secondaryButton} onClick={onToday}>Сегодня</button></div>
    <div className={styles.calendarHead}><button type="button" className={styles.iconButton} aria-label="Предыдущий месяц" onClick={() => onMonth(-1)}><ChevronLeft size={18} /></button><strong>{first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong><button type="button" className={styles.iconButton} aria-label="Следующий месяц" onClick={() => onMonth(1)}><ChevronRight size={18} /></button></div>
    <div className={styles.calendarWeekdays} aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
    <div className={styles.calendarGrid}>{Array.from({ length: count }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), index - offset + 1, 12);
      const key = toWorkoutDateKey(date), marks = byDate.get(key) || [];
      return <button type="button" key={key} data-date={key} data-subscription-range={range.startDate && key >= range.startDate && key <= range.endDate ? "true" : undefined} data-range-start={key === range.startDate ? "true" : undefined} data-range-end={key === range.endDate ? "true" : undefined} className={`${styles.calendarDay} ${date.getMonth() !== first.getMonth() ? styles.outsideDay : ""} ${selectedDate === key ? styles.selectedDay : ""}`} aria-current={key === today ? "date" : undefined} aria-pressed={selectedDate === key} aria-label={`${formatDate(key, { day: "numeric", month: "long" })}${marks.length ? `: ${marks.map(mark => `${mark.title || `Тренировка ${mark.order}`} — ${STATUS_TEXT[mark.status] || "Запланирована"}`).join(", ")}` : ", нет занятий"}`} onClick={() => onSelect(key)}><b>{date.getDate()}</b><span className={styles.dots} aria-hidden="true">{marks.map(mark => <span key={mark.id} data-event-status={mark.status} className={`${styles.dot} ${["completed", "completed_off_date", "pastCompleted"].includes(mark.status) ? styles.completedDot : ""}`} />)}</span></button>;
    })}</div>
    <div className={styles.calendarLegend} aria-label="Обозначения календаря"><span><i className={styles.legendMark} data-kind="completed" aria-hidden="true" />Выполнено</span><span><i className={styles.legendMark} data-kind="planned" aria-hidden="true" />Запланировано</span><span><i className={styles.legendMark} data-kind="other" aria-hidden="true" />Пропуск / перенос</span><span><i className={styles.legendMark} data-kind="period" aria-hidden="true" />Период занятий</span></div>
    <p className={styles.calendarTip}>Выберите дату, чтобы увидеть занятия. Подсветка — период занятий, не срок абонемента.</p>
  </section>;
}

export default function TrainerScheduleAgenda({ client, workouts = [], slots: scheduleSlots = [], archivedEntries = [], range = {}, onSaveSchedule, onSaveSubscription, status = "", startEditing = false, onSaved }) {
  const uid = useId(), closeContext = useContext(TrainerSheetCloseContext);
  const today = toWorkoutDateKey(new Date());
  const slots = getAgendaDisplaySlots(scheduleSlots, workouts, client?.workoutCalendar?.plannedWorkouts || []);
  const subscription = client?.subscription || {};
  const subscriptionStatus = getSubscriptionStatus(subscription);
  const hasSubscription = subscription.purchasedSessions !== undefined || subscription.totalSessions !== undefined || subscription.usedSessions !== undefined;
  const editableSlots = slots.filter(slot => isAgendaSlotEditable(slot, today));
  const initialSlot = editableSlots[0] || slots.at(-1);
  const configuredDays = client?.workoutCalendar?.trainingDays || client?.trainingDays || [];
  const [tab, setTab] = useState("schedule");
  const [selectedId, setSelectedId] = useState(() => initialSlot?.workoutId || "");
  const [selectedDate, setSelectedDate] = useState(() => initialSlot?.completedDate || initialSlot?.plannedDate || today);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [month, setMonth] = useState(() => (initialSlot?.completedDate || initialSlot?.plannedDate || today).slice(0, 7));
  const [editor, setEditor] = useState(() => startEditing && editableSlots.length ? "schedule" : "");
  const [dateDraft, setDateDraft] = useState(() => getAgendaDateDraft(slots));
  const [days, setDays] = useState(() => getAgendaWeekdayDefaults(slots, today, configuredDays).days);
  const [startDate, setStartDate] = useState(() => getAgendaWeekdayDefaults(slots, today).startDate);
  const [manualDateIds, setManualDateIds] = useState([]);
  const [subscriptionDraft, setSubscriptionDraft] = useState(() => counterDraft(subscription));
  const [resume, setResume] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discardRequested, setDiscardRequested] = useState(false);
  const rootRef = useRef(null);
  const savedDates = getAgendaDateDraft(slots);
  const dateDirty = JSON.stringify(dateDraft) !== JSON.stringify(savedDates);
  const scheduleSaveHint = getAgendaScheduleSaveHint({ saving, canSave: Boolean(onSaveSchedule), days, startDate, today, dateDirty });
  const balanceDirty = JSON.stringify(subscriptionDraft) !== JSON.stringify(counterDraft(subscription)) || resume || editor === "renew";
  const dirty = editor === "schedule" ? dateDirty : Boolean(editor) && balanceDirty;
  const currentSlot = slots.find(slot => slot.workoutId === selectedId);
  const calendarEntries = [...buildWorkoutScheduleCalendarEntries(slots), ...archivedEntries];
  const visibleSlots = [...slots].sort((a, b) => (a.completedDate || a.plannedDate || "9999").localeCompare(b.completedDate || b.plannedDate || "9999") || a.order - b.order);
  const monthEntries = calendarEntries.filter(entry => entry.date === selectedDate);
  const saveError = error.startsWith("Не удалось сохранить") && /не удалось|не получилось|изменил|ошибк|нет доступа/i.test(status) ? status : error;
  const feedback = saveError ? <p className={styles.error} role="alert">{saveError}</p>
    : notice ? <p className={styles.success} role="status">{notice}</p> : null;

  useEffect(() => closeContext?.register(() => {
    if (saving) return false;
    if (!dirty) return true;
    setDiscardRequested(true);
    return false;
  }), [closeContext, dirty, saving]);
  useEffect(() => {
    if (discardRequested) rootRef.current?.querySelector('[aria-label="Несохранённые изменения"]')?.scrollIntoView({ block: "nearest" });
  }, [discardRequested]);

  function cancelEditing() {
    if (saving) return;
    setDateDraft(savedDates); setSubscriptionDraft(counterDraft(subscription)); setResume(false);
    setEditor(""); setError(""); setNotice(""); setDiscardRequested(false);
  }

  function switchTab(next) {
    if (saving) return;
    if (dirty) { setDiscardRequested(true); return; }
    cancelEditing(); setTab(next);
  }

  function beginSchedule(slot = initialSlot) {
    const defaults = getAgendaWeekdayDefaults(slots, today, configuredDays);
    setDateDraft(savedDates); setSelectedId(slot?.workoutId || ""); setEditor("schedule");
    setDays(defaults.days); setStartDate(defaults.startDate); setManualDateIds([]);
    setError(""); setNotice("");
  }

  async function saveSchedule() {
    const validation = validateAgendaDateDraft(slots, dateDraft, today);
    if (!validation.ok) { setError(validation.message); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await onSaveSchedule?.({ workoutDates: validation.workoutDates, trainingDays: days.map(day => ADMIN_CALENDAR_DAYS[day - 1].id) }, workouts);
      if (result === false) { setError("Не удалось сохранить даты. Черновик оставлен — проверьте сообщение и повторите попытку."); return; }
      setEditor(""); setDiscardRequested(false); setNotice("Расписание сохранено");
      await onSaved?.();
    } catch { setError("Не удалось сохранить расписание. Проверьте соединение и повторите попытку."); }
    finally { setSaving(false); }
  }

  function updateWeekdays(nextDays, nextStartDate = startDate) {
    setDays(nextDays); setStartDate(nextStartDate); setError(""); setNotice("");
    if (!nextDays.length || !nextStartDate) return;
    const result = distributeAgendaWeekdays(slots, dateDraft, nextDays, nextStartDate, today);
    if (!result.ok) { setError(result.message); return; }
    setDateDraft(result.draft); setManualDateIds([]);
  }

  function updateDate(workoutId, value) {
    setDateDraft(previous => ({ ...previous, [workoutId]: value }));
    setManualDateIds(previous => [...new Set([...previous, workoutId])]);
    setError(""); setNotice("");
  }

  async function saveSubscription() {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await onSaveSubscription?.({ subscriptionOnly: true, renewSubscription: editor === "renew", resumeSubscription: subscriptionStatus.id === "frozen" && resume, subscription: { ...subscription, periodMode: "sessions", ...subscriptionDraft } });
      if (result === false) { setError("Не удалось сохранить абонемент. Значения оставлены — повторите попытку."); return; }
      setEditor(""); setResume(false); setDiscardRequested(false); setNotice(editor === "renew" ? "Абонемент продлён" : "Абонемент сохранён");
    } catch { setError("Не удалось сохранить абонемент. Проверьте соединение и повторите попытку."); }
    finally { setSaving(false); }
  }

  function selectDate(value) {
    setSelectedDate(value);
    const mark = calendarEntries.find(entry => entry.date === value && slots.some(slot => slot.workoutId === entry.workoutId));
    if (mark) setSelectedId(mark.workoutId);
  }

  function shiftMonth(delta) {
    const date = dateValue(`${month}-01`); date.setMonth(date.getMonth() + delta); setMonth(toWorkoutDateKey(date).slice(0, 7));
  }

  const scheduleActions = <div className={`${styles.root} ${styles.pinnedActions}`} data-trainer-schedule-actions="true"><button type="button" className={styles.secondaryButton} onClick={cancelEditing} disabled={saving}>Отмена</button><button type="button" className={styles.primaryButton} onClick={saveSchedule} disabled={saving || !onSaveSchedule || !days.length || !startDate || startDate < today || !dateDirty} aria-describedby={scheduleSaveHint ? `${uid}-schedule-save-hint` : undefined}>{saving ? "Сохранение…" : "Сохранить даты"}</button></div>;
  const scheduleEditor = editor === "schedule" ? <section className={`${styles.inlinePanel} ${styles.scheduleEditor}`} aria-label="Настройка дней тренировок">
    <div className={styles.heading}><div><h3>Дни тренировок</h3><p>Выберите дни недели — даты заполнятся автоматически.</p></div></div>
    <fieldset className={styles.weekdaysField}>
      <legend>Дни недели</legend>
      <div className={styles.weekdayGrid}>{WEEKDAYS.map((day, index) => <label key={day} className={`${styles.weekday} ${days.includes(index + 1) ? styles.weekdaySelected : ""}`}><input type="checkbox" checked={days.includes(index + 1)} disabled={saving} onChange={event => updateWeekdays(event.target.checked ? [...days, index + 1].sort((a, b) => a - b) : days.filter(value => value !== index + 1))} /><span>{day}</span></label>)}</div>
    </fieldset>
    <div className={styles.startDateRow}>
      <label className={styles.field}>Начиная с<input type="date" value={startDate} min={today} onChange={event => updateWeekdays(days, event.target.value)} disabled={saving} /></label>
      <p id={`${uid}-schedule-save-hint`} className={styles.help} role="status">{scheduleSaveHint || `Будет назначено ${sessions(editableSlots.length)}.`}{manualDateIds.length ? " Смена дней недели заполнит даты заново." : ""}</p>
    </div>
    <div className={styles.datePreview}>
      <div className={styles.previewHeading}><h4>Даты занятий</h4><span>Можно изменить вручную</span></div>
      <div className={styles.previewList}>{editableSlots.map(slot => <div className={`${styles.previewRow} ${styles.datePreviewRow}`} key={slot.workoutId}>
        <div><strong>{slot.workoutName}</strong>{manualDateIds.includes(slot.workoutId) ? <small>Изменено вручную</small> : null}</div>
        <label className={`${styles.field} ${styles.datePreviewField}`}><span className={styles.visuallyHidden}>Новая дата — {slot.workoutName}</span><input type="date" value={dateDraft[slot.workoutId] || ""} min={today} onChange={event => updateDate(slot.workoutId, event.target.value)} disabled={saving} /></label>
      </div>)}</div>
    </div>
    <p className={styles.help}><LockKeyhole size={14} aria-hidden="true" /> Выполненные занятия и абонемент не меняются.</p>
    {feedback}
    {closeContext?.footerHost ? createPortal(scheduleActions, closeContext.footerHost) : <div className={styles.formActions}>{scheduleActions}</div>}
  </section> : null;

  return <section ref={rootRef} className={`${styles.root} trainerWorkoutSchedulePlanner`} data-testid="trainer-subscription-calendar" aria-busy={saving}>
    <nav className={styles.tabs} role="tablist" aria-label="Расписание и абонемент">{[["schedule", "Расписание"], ["subscription", "Абонемент"]].map(([value, label]) => <button type="button" key={value} id={`${uid}-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${uid}-panel`} className={tab === value ? styles.activeTab : ""} onClick={() => switchTab(value)} disabled={saving}>{label}</button>)}</nav>
    <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-${tab}`}>
      {tab === "schedule" ? editor === "schedule" ? scheduleEditor : <>
        {client?.workoutCalendar?.clientScheduleRequiresReview ? <div className={styles.topLine}><p className={styles.notice}><Info size={17} aria-hidden="true" /><span>Клиент изменил дни тренировок. Проверьте даты и сохраните расписание.</span></p></div> : null}
        <div className={styles.heading}><div><h3>Занятия программы</h3><p>{slots.length ? `${slots.filter(slot => slot.isCompleted).length} из ${slots.length} выполнено · по датам` : "Сначала назначьте программу"}</p></div><div className={styles.headingActions}><button type="button" className={styles.primaryButton} disabled={saving || !editableSlots.length || !onSaveSchedule || Boolean(editor)} onClick={() => beginSchedule()}><CalendarDays size={17} aria-hidden="true" />Настроить дни</button></div></div>
        {!slots.length ? <div className={styles.empty}>Сначала назначьте клиенту программу тренировок.</div> : <><p className={styles.help}>Выберите занятие, чтобы посмотреть даты и состояние. Завершённые тренировки доступны только для просмотра.</p><div className={styles.scheduleGrid}><div className={styles.sessionList}>{visibleSlots.map(slot => {
          const date = slot.completedDate || slot.plannedDate;
          return <button type="button" className={`${styles.sessionRow} ${selectedId === slot.workoutId ? styles.selectedRow : ""}`} key={slot.workoutId} aria-pressed={selectedId === slot.workoutId} onClick={() => { setSelectedId(slot.workoutId); setSelectedDate(date || today); }}><span className={styles.dateBadge}><strong>{date ? dateValue(date).getDate() : "—"}</strong><small>{date ? formatDate(date, { month: "short" }) : "без даты"}</small></span><span className={styles.sessionCopy}><strong>{slot.workoutName}</strong><small>{slot.isCompletedOffDate ? `По плану: ${formatDate(slot.plannedDate)}` : !slot.plannedDate ? "Нужно назначить дату" : slot.isCompleted ? "Результат сохранён" : `День ${slot.order} программы`}</small></span><Status status={slot.status} /><ChevronRight size={16} aria-hidden="true" /></button>;
        })}</div>{currentSlot ? <section className={styles.details} aria-label="Подробности занятия"><div className={styles.detailHeading}><small>Выбранное занятие</small><h3>{currentSlot.workoutName}</h3></div><Status status={currentSlot.status} /><dl className={styles.detailList}><div><dt>По плану</dt><dd>{formatDate(currentSlot.plannedDate, { day: "numeric", month: "long", year: "numeric" })}</dd></div>{currentSlot.completedDate ? <div><dt>Выполнена</dt><dd>{formatDate(currentSlot.completedDate, { day: "numeric", month: "long", year: "numeric" })}</dd></div> : null}{currentSlot.shiftedDate ? <div><dt>Смещение</dt><dd>{formatDate(currentSlot.shiftedDate)}</dd></div> : null}<div><dt>Программа</dt><dd>{workouts.find(workout => workout.id === currentSlot.workoutId)?.assignedProgramName || client?.assignedProgramName || "Персональная программа"}</dd></div></dl>{isAgendaSlotEditable(currentSlot, today) ? <button type="button" className={styles.secondaryButton} disabled={saving || Boolean(editor) || !onSaveSchedule} onClick={() => beginSchedule(currentSlot)}>Изменить дату</button> : <p className={styles.detailNote}><LockKeyhole size={16} aria-hidden="true" />{currentSlot.isCompleted ? "Результат и фактическая дата сохранены в истории." : "Прошлая дата и её состояние сохранены. Здесь изменяются только будущие запланированные занятия."}</p>}</section> : null}</div></>}
        {archivedEntries.length ? <><button type="button" className={styles.historyToggle} aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}><History size={17} aria-hidden="true" />Прошлые программы · {archivedEntries.length}<ChevronDown size={16} aria-hidden="true" /></button>{historyOpen ? <div className={styles.previewList}>{archivedEntries.map(entry => <div className={styles.previewRow} key={entry.id}><span>{entry.title}</span><time>{formatDate(entry.date, { day: "numeric", month: "long", year: "numeric" })}</time></div>)}<p className={styles.help}>Показаны загруженные записи. Полная история доступна в разделе «История тренировок».</p></div> : null}</> : null}
      </> : <>
        <section className={styles.subscriptionOverview} aria-label="Баланс абонемента">
          <div className={styles.subscriptionOverviewHead}><h3>Абонемент клиента</h3><span className={styles.status} data-tone={subscriptionStatus.tone}>{hasSubscription ? subscriptionStatus.label : "Не настроен"}</span></div>
          <div className={styles.balanceOverview}><div className={styles.remainingCount}><span>Осталось занятий</span><strong>{hasSubscription ? subscriptionStatus.remainingSessions : "—"}</strong></div><dl className={styles.balanceFacts}>{[["Куплено", subscriptionStatus.purchasedSessions], ["Использовано", subscriptionStatus.usedSessions]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{hasSubscription ? value || 0 : "—"}</dd></div>)}</dl></div>
          {hasSubscription ? <div className={styles.progress} role="progressbar" aria-label="Использовано занятий" aria-valuemin="0" aria-valuemax={Math.max(subscriptionStatus.purchasedSessions, subscriptionStatus.usedSessions, 1)} aria-valuenow={subscriptionStatus.usedSessions}><span style={{ width: `${Math.min(100, subscriptionStatus.purchasedSessions ? subscriptionStatus.usedSessions / subscriptionStatus.purchasedSessions * 100 : 0)}%` }} /></div> : null}
          <div className={styles.balanceFooter}>
            <details className={styles.balanceExplanation}><summary>Как считается остаток?</summary><p>Куплено минус использовано. Количество дат в календаре на баланс не влияет.</p></details>
            {editor === "subscription" || editor === "renew" ? null : <div className={styles.subscriptionActions}>
              <button type="button" className={styles.primaryButton} disabled={!onSaveSubscription} onClick={() => { setSubscriptionDraft(hasSubscription ? { ...counterDraft(subscription), usedSessions: 0 } : counterDraft(subscription)); setEditor(hasSubscription ? "renew" : "subscription"); setError(""); setNotice(""); }}>{hasSubscription ? "Продлить" : "Настроить абонемент"}</button>
              {hasSubscription ? <button type="button" className={styles.secondaryButton} disabled={!onSaveSubscription} onClick={() => { setSubscriptionDraft(counterDraft(subscription)); setEditor("subscription"); setError(""); setNotice(""); }}>Изменить баланс</button> : null}
            </div>}
          </div>
        </section>
        {editor === "subscription" || editor === "renew" ? <section className={styles.inlinePanel} aria-label="Параметры абонемента"><h3>{editor === "renew" ? "Продление абонемента" : "Изменить баланс занятий"}</h3><div className={styles.fieldGrid}><label className={styles.field}>{editor === "renew" ? "Занятий в новом абонементе" : "Продано занятий"}<input type="number" min="0" step="1" inputMode="numeric" value={subscriptionDraft.purchasedSessions} disabled={saving} onChange={event => setSubscriptionDraft(previous => ({ ...previous, purchasedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>{editor === "renew" ? <p className={styles.help}>Будет создан новый цикл. Использовано: 0. История прежнего абонемента сохранится.</p> : <label className={styles.field}>Выполнено занятий<input type="number" min="0" step="1" inputMode="numeric" value={subscriptionDraft.usedSessions} disabled={saving} onChange={event => setSubscriptionDraft(previous => ({ ...previous, usedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>}</div>{subscriptionStatus.id === "frozen" ? <label className={styles.weekday}><input type="checkbox" checked={resume} disabled={saving} onChange={event => setResume(event.target.checked)} /><span>Возобновить абонемент</span></label> : null}<p className={styles.help}>{editor === "renew" ? `Новый баланс: ${sessions(subscriptionDraft.purchasedSessions)}.` : `Осталось: ${sessions(Math.max(0, subscriptionDraft.purchasedSessions - subscriptionDraft.usedSessions))}.`}{subscriptionStatus.id === "frozen" && !resume ? " Заморозка сохранится." : ""}</p><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={cancelEditing} disabled={saving}>Отмена</button><button type="button" className={styles.primaryButton} onClick={saveSubscription} disabled={saving || !onSaveSubscription}>{saving ? "Сохранение…" : editor === "renew" ? "Продлить абонемент" : "Сохранить"}</button></div></section> : null}
        <div className={styles.calendarWithDay}>
          <MonthCalendar month={month} selectedDate={selectedDate} entries={calendarEntries} range={range} today={today} onMonth={shiftMonth} onSelect={selectDate} onToday={() => { setMonth(today.slice(0, 7)); selectDate(today); }} />
          <section className={`${styles.inlinePanel} ${styles.dayPanel}`} aria-label="Занятия выбранной даты" aria-live="polite"><div><small>Выбранный день</small><h3>{formatDate(selectedDate, { day: "numeric", month: "long", year: "numeric" })}</h3></div>{monthEntries.length ? <div className={styles.dayEntries}>{monthEntries.map(entry => <div className={styles.dayEntry} key={entry.id}><CalendarDays size={18} aria-hidden="true" /><div><strong>{entry.title || `Тренировка ${entry.order}`}</strong><Status status={entry.status} /></div></div>)}</div> : <p className={styles.dayEmpty}>Занятий нет. Даты можно назначить во вкладке «Расписание».</p>}</section>
        </div>
      </>}
    </div>
    {discardRequested ? <section className={styles.inlinePanel} role="alert" aria-label="Несохранённые изменения"><strong>Есть несохранённые изменения</strong><p>Продолжите редактирование или отмените правки. Сохранённые данные не изменены.</p><div className={styles.formActions}><button type="button" className={styles.primaryButton} onClick={() => setDiscardRequested(false)}>Продолжить редактирование</button><button type="button" className={styles.secondaryButton} onClick={cancelEditing}>Отменить правки</button></div></section> : null}
    {editor !== "schedule" ? feedback : null}
  </section>;
}

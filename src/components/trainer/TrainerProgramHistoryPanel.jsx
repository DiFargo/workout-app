import { useId, useState } from "react";
import { Archive, ArchiveRestore, ArrowRight, Check, ChevronDown, ChevronUp, Clock3, Dumbbell, Trash2 } from "lucide-react";
import { formatRussianCount } from "../../utils/russianCount.js";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety.js";
import {
  canDeleteEmptyProgramHistoryAssignment,
  canArchiveEmptyHistoricalAssignment,
  getProgramHistorySections,
  getProgramHistoryArchiveState,
  getProgramHistoryStatus,
  getProgramHistoryTimestamp,
  getProgramHistoryWorkoutRows
} from "../../utils/trainerProgramHistoryPresentation.js";
import styles from "./TrainerProgramHistoryPanel.module.css";

const countSets = count => formatRussianCount(count, ["подход", "подхода", "подходов"]);
const countExercises = count => formatRussianCount(count, ["упражнение", "упражнения", "упражнений"]);
const safeCount = value => Math.max(0, Number(value) || 0);

function dateParts(assignment) {
  const timestamp = getProgramHistoryTimestamp(assignment);
  if (!timestamp) return { day: "—", month: "дата", full: "Дата назначения не сохранена" };
  const date = new Date(timestamp);
  return {
    day: new Intl.DateTimeFormat("ru-RU", { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date),
    full: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)
  };
}

function AssignmentBadge({ assignment }) {
  const archived = ["archived", "legacy"].includes(getProgramHistoryArchiveState(assignment));
  const complete = assignment.completion === 100;
  const Icon = archived ? Archive : complete ? Check : Clock3;
  return <span className={`${styles.badge} ${archived || assignment.isBasic ? styles.neutral : complete ? styles.success : styles.active}`}>
    <Icon size={13} aria-hidden="true" />{getProgramHistoryStatus(assignment)}
  </span>;
}

function AssignmentProgress({ assignment }) {
  const count = safeCount(assignment.workoutCount);
  const done = Math.min(count, safeCount(assignment.completedCount));
  const percent = count ? Math.round(done / count * 100) : 0;
  return <div className={styles.progress}>
    <div><span>Выполнено {done} из {count}</span><span>{percent}%</span></div>
    <div className={styles.track} role="progressbar" aria-label="Выполнение программы" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

function AssignmentDetails({ assignment, onAction, saving }) {
  const rows = getProgramHistoryWorkoutRows(assignment);
  const archiveState = getProgramHistoryArchiveState(assignment);
  const archived = archiveState === "archived";
  const needsArchiveConfirmation = archiveState === "legacy" || canArchiveEmptyHistoricalAssignment(assignment);
  const canRestore = archived || ((assignment.archived || assignment.status === "archived") && !needsArchiveConfirmation);
  const canArchive = !assignment.isBasic && (["current", "future"].includes(assignment.status) || needsArchiveConfirmation);
  return <div className={styles.details}>
    <div className={styles.detailsTop}><AssignmentBadge assignment={assignment} /><span>Только просмотр</span></div>
    <p className={styles.notice}>{assignment.isBasic
      ? "Самостоятельный план клиента. Тренер не меняет его архив."
      : needsArchiveConfirmation ? archiveState === "legacy"
        ? "Архив сохранён в прежнем формате. Подтвердите архивирование, чтобы управлять этой копией. Результаты и текущая программа не изменятся."
        : "Эта прошлая копия ещё не архивирована в базе. Сначала уберите её в архив — затем пустую программу можно будет удалить. Текущая программа не изменится."
        : archived ? "Результаты сохранены. Возврат из архива не сбросит выполнение."
        : "Это сохранённое назначение клиента. Просмотр ничего не меняет."}</p>
    {rows.length ? <ul className={styles.workouts} aria-label={`Тренировки программы: ${assignment.name}`}>
      {rows.map(row => <li key={row.key}>
        <details>
          <summary tabIndex={0}><span><strong>{row.name}</strong><small>{row.exercises.length ? `${countExercises(row.exercises.length)} · ${countSets(row.setsCount)}` : "Состав не сохранён"}</small></span>
            <span className={row.completed ? styles.completed : styles.workoutState}>{row.completed ? <><Check size={14} aria-hidden="true" />Выполнена</> : row.missed ? "Пропущена" : "Не выполнена"}</span>
          </summary>
          {row.exercises.length ? <ol className={styles.exerciseList}>{row.exercises.map((exercise, index) => <li key={exercise.id || index}>
            <strong>{exercise.name || `Упражнение ${index + 1}`}</strong>
            {Array.isArray(exercise.sets) && exercise.sets.length ? <span>{exercise.sets.map((set, setIndex) =>
              <span key={set.id || setIndex}>{setIndex + 1}. {set.reps || "—"} повт.{exerciseUsesExternalWeight(exercise) && set.weight != null && set.weight !== "" ? ` × ${set.weight} кг` : ""}{setIndex < exercise.sets.length - 1 ? "; " : ""}</span>
            )}</span> : <span>Подходы не сохранены</span>}
          </li>)}</ol> : <p className={styles.emptyDetails}>Для этой тренировки нет сохранённого состава.</p>}
        </details>
      </li>)}
    </ul> : <p className={styles.emptyDetails}>Подробности тренировок этого назначения не загружены.</p>}
    {!assignment.isBasic && (canRestore || canArchive) ? <div className={styles.actions}>
      {canRestore ? <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => onAction?.(assignment, "restore")}><ArchiveRestore size={17} aria-hidden="true" />{archived ? "Вернуть из архива" : "Вернуть программу в план"}</button>
        : <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => onAction?.(assignment, "archive")}><Archive size={17} aria-hidden="true" />{archiveState === "legacy" ? "Подтвердить архивирование" : "Убрать в архив"}</button>}
      {canDeleteEmptyProgramHistoryAssignment(assignment) ? <div className={styles.deleteGroup}>
        <button type="button" className={styles.deleteButton} disabled={saving} onClick={() => onAction?.(assignment, "delete")}><Trash2 size={17} aria-hidden="true" />Удалить пустую программу</button>
        <small>Перед удалением сервер проверит отсутствие сохранённых занятий и результатов.</small>
      </div> : null}
    </div> : null}
  </div>;
}

function AssignmentList({ assignments, panelId, expandedKey, onToggle, onAction, saving, archived = false }) {
  return assignments.length ? <div className={styles.assignmentList}>{assignments.map((assignment, index) => {
    const date = dateParts(assignment);
    const expanded = expandedKey === assignment.key;
    const id = `${panelId}-assignment-${index}`;
    return <article className={styles.assignment} key={assignment.key}>
      <button className={styles.assignmentToggle} type="button" onClick={() => onToggle(assignment.key)} aria-expanded={expanded} aria-controls={id}>
        <span className={styles.dateTile} aria-hidden="true">{date.day}<small>{date.month}</small></span>
        <span className={styles.assignmentCopy}><strong>{assignment.name || "Индивидуальная программа"}</strong><small>{getProgramHistoryStatus(assignment)} · выполнено {safeCount(assignment.completedCount)} из {safeCount(assignment.workoutCount)}</small><small>{getProgramHistoryTimestamp(assignment) ? `Назначена ${date.full}` : date.full}</small></span>
        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      <div id={id} hidden={!expanded}>{expanded ? <AssignmentDetails assignment={assignment} onAction={onAction} saving={saving} /> : null}</div>
    </article>;
  })}</div> : <div className={styles.empty}><h4>{archived ? "Архив пока пуст" : "Других назначений пока нет"}</h4><p>{archived
    ? "Здесь появятся программы, которые тренер убрал в архив. Результаты в них сохраняются."
    : "Здесь будут прошлые и будущие программы, которые не убраны в архив."}</p></div>;
}

export default function TrainerProgramHistoryPanel({
  assignments = [], currentAssignmentKey = "", hasBasicHistory = false,
  showBasicHistory = false, onShowBasicHistoryChange, onAction,
  saving = false, status = ""
}) {
  const [expandedKey, setExpandedKey] = useState("");
  const [tab, setTab] = useState("programs");
  const panelId = useId();
  const { current, others, archived } = getProgramHistorySections(assignments, currentAssignmentKey);
  const toggle = key => setExpandedKey(value => value === key ? "" : key);
  const selectTab = value => { setTab(value); setExpandedKey(""); };
  const handleTabKeyDown = event => {
    if (saving) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? 1 : tab === "programs" ? 1 : 0;
    selectTab(index ? "archive" : "programs");
    event.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();
  };
  return <section className={styles.root} aria-label="История назначенных программ">
    <div className={styles.tabs} role="tablist" aria-label="Разделы истории программ" onKeyDown={handleTabKeyDown}>
      <button type="button" role="tab" id={`${panelId}-programs-tab`} aria-selected={tab === "programs"} aria-controls={`${panelId}-programs-panel`} tabIndex={tab === "programs" ? 0 : -1} onClick={() => selectTab("programs")} disabled={saving}>
        Программы <span className={styles.tabCount}>{others.length + (current ? 1 : 0)}</span>
      </button>
      <button type="button" role="tab" id={`${panelId}-archive-tab`} aria-selected={tab === "archive"} aria-controls={`${panelId}-archive-panel`} tabIndex={tab === "archive" ? 0 : -1} onClick={() => selectTab("archive")} disabled={saving}>
        <Archive size={16} aria-hidden="true" />Архив <span className={styles.tabCount}>{archived.length}</span>
      </button>
    </div>
    <div role="tabpanel" id={`${panelId}-programs-panel`} aria-labelledby={`${panelId}-programs-tab`} hidden={tab !== "programs"}>
    <div className={styles.columns}>
      <section className={styles.currentSection} aria-label="Текущая программа клиента">
        <h3>Сейчас у клиента</h3>
        {current ? <article className={styles.currentCard}>
          <AssignmentBadge assignment={current} />
          <h4>{current.name || "Индивидуальная программа"}</h4>
          <p>{getProgramHistoryTimestamp(current) ? `Назначена ${dateParts(current).full}` : dateParts(current).full}</p>
          <AssignmentProgress assignment={current} />
          <button type="button" className={styles.primaryButton} aria-expanded={expandedKey === current.key} aria-controls={`${panelId}-current`} onClick={() => toggle(current.key)}>
            {expandedKey === current.key ? "Свернуть программу" : "Посмотреть программу"}{expandedKey === current.key ? <ChevronUp size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          </button>
          <div id={`${panelId}-current`} hidden={expandedKey !== current.key}>{expandedKey === current.key ? <AssignmentDetails assignment={current} onAction={onAction} saving={saving} /> : null}</div>
        </article> : <div className={styles.empty}><Dumbbell size={24} aria-hidden="true" /><h4>Нет текущей программы</h4><p>Здесь появится назначенная программа, которую клиент сможет продолжить.</p></div>}
        <p className={styles.caption}>Архивирование сохраняет выполненные тренировки и результаты.</p>
      </section>
      <section className={styles.otherSection} aria-label="Другие назначения программ">
        <div className={styles.sectionHeading}><h3>Другие назначения</h3><span>{others.length}</span></div>
        {tab === "programs" ? <AssignmentList assignments={others} panelId={`${panelId}-programs`} expandedKey={expandedKey} onToggle={toggle} onAction={onAction} saving={saving} /> : null}
        {others.length ? <p className={styles.caption}>Новые назначения сверху. Одинаковые названия могут относиться к разным назначениям.</p> : null}
      </section>
    </div>
    </div>
    <div role="tabpanel" id={`${panelId}-archive-panel`} aria-labelledby={`${panelId}-archive-tab`} hidden={tab !== "archive"}>
      <h3>Архив программ</h3>
      <p className={styles.archiveCaption}>Откройте программу для просмотра, возврата в план или удаления пустой копии.</p>
      {tab === "archive" ? <AssignmentList assignments={archived} panelId={`${panelId}-archive`} expandedKey={expandedKey} onToggle={toggle} onAction={onAction} saving={saving} archived /> : null}
    </div>
    {hasBasicHistory ? <label className={styles.basicToggle}><span>Показывать самостоятельные планы</span><input type="checkbox" checked={showBasicHistory} onChange={event => onShowBasicHistoryChange?.(event.target.checked)} /></label> : null}
    {status ? <p className={styles.status} role="status">{status}</p> : null}
  </section>;
}

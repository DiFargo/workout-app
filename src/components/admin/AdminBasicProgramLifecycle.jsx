import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FilePlus2,
  History,
  LoaderCircle,
  Pencil,
  Send,
  ShieldCheck,
  X
} from "lucide-react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  ADMIN_BASIC_PROGRAM_STATUSES,
  countAdminBasicProgramsByStatus,
  createBasicProgramMutation,
  createBasicProgramPlan,
  formatBasicProgramWorkouts,
  getAdminBasicProgramStatus,
  getAdminBasicProgramStatusLabel,
  getBasicProgramTransition,
  isAdminManagedBasicProgram,
  parseBasicProgramWorkouts
} from "../../utils/adminBasicProgramLifecycle";
import styles from "./AdminBasicProgramLifecycle.module.css";

const EMPTY_LIST = [];
const PROGRAM_COLLECTION_PATH = ["admin", "basicProgramTemplates", "items"];
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const FILTERS = [
  { id: "all", label: "Все" },
  { id: ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED, label: "Опубликованные" },
  { id: ADMIN_BASIC_PROGRAM_STATUSES.REVIEW, label: "На проверке" },
  { id: ADMIN_BASIC_PROGRAM_STATUSES.DRAFT, label: "Черновики" },
  { id: ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED, label: "Архив" }
];

const ACTION_COPY = {
  created: "создана",
  duplicated: "скопирована",
  updated: "обновлена",
  sent_to_review: "отправлена на проверку",
  returned_to_draft: "возвращена в черновик",
  published: "опубликована",
  archived: "архивирована",
  restored_to_draft: "восстановлена"
};

function getList(...values) {
  return values.find(Array.isArray) || EMPTY_LIST;
}

function getActor() {
  const currentUser = auth.currentUser;
  const email = String(currentUser?.email || "").trim();

  return {
    uid: String(currentUser?.uid || "").trim(),
    name: String(currentUser?.displayName || email.split("@")[0] || "Администратор").trim(),
    email
  };
}

function getMilliseconds(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDate(value) {
  const timestamp = getMilliseconds(value);
  if (!timestamp) return "только что";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function normalizeFallbackProgram(program, index) {
  const source = program && typeof program === "object" ? program : {};
  const plan = createBasicProgramPlan({
    title: source.name || source.title || `Системный шаблон ${index + 1}`,
    description: source.description || source.summary,
    goal: source.goal || source.focus,
    workouts: getList(source.workouts, source.days, source.sessions)
  });

  return {
    id: `system-${String(source.id || index + 1)}`,
    sourceProgramId: String(source.id || `system-${index + 1}`),
    managed: false,
    status: ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED,
    version: 0,
    ...plan,
    updatedAt: null,
    lastAction: "system_template"
  };
}

function normalizeManagedProgram(item) {
  const source = item && typeof item === "object" ? item : {};
  const plan = createBasicProgramPlan({
    title: source.title || source.name,
    description: source.description,
    goal: source.goal,
    workouts: source.workouts
  });

  return {
    ...source,
    id: String(source.id || ""),
    managed: true,
    status: getAdminBasicProgramStatus(source.status),
    version: Math.max(1, Number(source.version) || 1),
    ...plan
  };
}

function countExercises(workouts) {
  return (Array.isArray(workouts) ? workouts : []).reduce((total, workout) => (
    total + (Array.isArray(workout?.exercises) ? workout.exercises.length : 0)
  ), 0);
}

function makeCardSearchText(program) {
  return [
    program.title,
    program.description,
    program.goal,
    ...program.workouts.flatMap((workout) => [workout.name, ...workout.exercises.map((exercise) => exercise.name)])
  ].join(" ").toLocaleLowerCase("ru");
}

function useSheetKeyboard({ containerRef, initialFocusRef, onClose, disabled = false }) {
  useEffect(() => {
    initialFocusRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !disabled) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const nodes = Array.from(containerRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
        .filter((element) => element.getClientRects().length > 0);
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, disabled, initialFocusRef, onClose]);
}

function ModalFrame({ children, labelledBy, onClose, className = "", disabled = false }) {
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  useSheetKeyboard({ containerRef: sheetRef, initialFocusRef: closeRef, onClose, disabled });

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (!disabled && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={sheetRef}
        className={`${styles.sheet} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <button
          ref={closeRef}
          className={styles.closeButton}
          type="button"
          onClick={onClose}
          disabled={disabled}
          aria-label="Закрыть"
        >
          <X aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  );
}

function ProgramEditorSheet({ mode, program, onClose, onSave, saving, saveError }) {
  const initial = useMemo(() => ({
    title: String(program?.title || ""),
    description: String(program?.description || ""),
    goal: String(program?.goal || ""),
    workoutsText: formatBasicProgramWorkouts(program?.workouts || []),
    reason: mode === "duplicate" ? "Создана версия на основе шаблона" : ""
  }), [mode, program]);
  const [draft, setDraft] = useState(initial);
  const [validationError, setValidationError] = useState("");
  const titleId = useId();
  const title = mode === "create" ? "Новая базовая программа" : mode === "duplicate" ? "Создать копию программы" : "Редактировать программу";
  const description = mode === "create"
    ? "Сначала сохраните черновик, затем отправьте его на проверку и опубликуйте."
    : "Изменение создаст новую версию. Уже выданные программы и завершённые тренировки не изменятся.";

  const updateDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
    setValidationError("");
  };

  const handleSubmit = () => {
    const titleValue = String(draft.title || "").trim();
    const workouts = parseBasicProgramWorkouts(draft.workoutsText);

    if (!titleValue) {
      setValidationError("Укажите название программы.");
      return;
    }
    if (!workouts.length || !workouts.some((workout) => workout.exercises.length)) {
      setValidationError("Добавьте хотя бы один день и одно упражнение.");
      return;
    }

    onSave({
      title: titleValue,
      description: draft.description,
      goal: draft.goal,
      workouts,
      reason: draft.reason,
      sourceProgramId: mode === "duplicate" ? program?.sourceProgramId || program?.id || "" : program?.sourceProgramId || ""
    });
  };

  return (
    <ModalFrame labelledBy={titleId} onClose={onClose} disabled={saving} className={styles.editorSheet}>
      <p className={styles.sheetEyebrow}>Базовые программы</p>
      <h2 id={titleId}>{title}</h2>
      <p className={styles.sheetLead}>{description}</p>
      <label className={styles.field}>
        <span>Название</span>
        <input value={draft.title} onChange={updateDraft("title")} disabled={saving} maxLength={90} />
      </label>
      <label className={styles.field}>
        <span>Короткое описание</span>
        <textarea value={draft.description} onChange={updateDraft("description")} disabled={saving} rows="3" maxLength={280} />
      </label>
      <label className={styles.field}>
        <span>Цель или фокус</span>
        <input value={draft.goal} onChange={updateDraft("goal")} disabled={saving} maxLength={120} placeholder="Например: общая физическая подготовка" />
      </label>
      <label className={styles.field}>
        <span>Состав программы</span>
        <small>Одна строка — одна тренировка: «День 1: упражнение; упражнение».</small>
        <textarea
          value={draft.workoutsText}
          onChange={updateDraft("workoutsText")}
          disabled={saving}
          rows="7"
          placeholder="День 1: Жим ногами; Тяга верхнего блока\nДень 2: Жим гантелей лёжа; Планка"
        />
      </label>
      <label className={styles.field}>
        <span>Комментарий к версии</span>
        <input value={draft.reason} onChange={updateDraft("reason")} disabled={saving} maxLength={160} placeholder="Что и почему изменили" />
      </label>
      {validationError ? <p className={styles.error} role="alert">{validationError}</p> : null}
      {saveError ? <p className={styles.error} role="alert">{saveError}</p> : null}
      <div className={styles.sheetActions}>
        <button className={styles.secondaryAction} type="button" onClick={onClose} disabled={saving}>Отмена</button>
        <button className={styles.primaryAction} type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}
          {saving ? "Сохраняем…" : "Сохранить черновик"}
        </button>
      </div>
    </ModalFrame>
  );
}

function TransitionSheet({ transition, onClose, onConfirm, saving, saveError }) {
  const [reason, setReason] = useState("");
  const titleId = useId();
  const targetLabel = getAdminBasicProgramStatusLabel(transition.targetStatus).toLocaleLowerCase("ru");
  const requiresReason = transition.targetStatus === ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED
    || transition.targetStatus === ADMIN_BASIC_PROGRAM_STATUSES.REVIEW;

  const submit = () => {
    if (requiresReason && reason.trim().length < 3) return;
    onConfirm(reason.trim());
  };

  return (
    <ModalFrame labelledBy={titleId} onClose={onClose} disabled={saving} className={styles.transitionSheet}>
      <p className={styles.sheetEyebrow}>Жизненный цикл программы</p>
      <h2 id={titleId}>Перевести в статус «{targetLabel}»?</h2>
      <p className={styles.sheetLead}>
        Будет создана новая неизменяемая версия. Уже назначенные планы останутся в исходном виде.
      </p>
      <label className={styles.field}>
        <span>{requiresReason ? "Причина изменения" : "Комментарий к изменению (необязательно)"}</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows="3"
          maxLength={160}
          disabled={saving}
          placeholder={requiresReason ? "Например: проверена безопасность и состав" : "Кратко зафиксируйте решение"}
        />
      </label>
      {requiresReason && reason.trim().length > 0 && reason.trim().length < 3 ? (
        <p className={styles.error} role="alert">Укажите причину не короче трёх символов.</p>
      ) : null}
      {saveError ? <p className={styles.error} role="alert">{saveError}</p> : null}
      <div className={styles.sheetActions}>
        <button className={styles.secondaryAction} type="button" onClick={onClose} disabled={saving}>Отмена</button>
        <button className={styles.primaryAction} type="button" onClick={submit} disabled={saving || (requiresReason && reason.trim().length < 3)}>
          {saving ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          {saving ? "Сохраняем…" : "Подтвердить"}
        </button>
      </div>
    </ModalFrame>
  );
}

function ProgramHistorySheet({ program, history, loading, onClose }) {
  const titleId = useId();
  return (
    <ModalFrame labelledBy={titleId} onClose={onClose} className={styles.historySheet}>
      <p className={styles.sheetEyebrow}>Версии и аудит</p>
      <h2 id={titleId}>{program.title}</h2>
      <p className={styles.sheetLead}>
        История хранится отдельно от текущей карточки. Изменения не переписывают ранее назначенные программы.
      </p>
      <section className={styles.historyOverview} aria-label="Текущая версия">
        <span>Текущая версия</span>
        <strong>v{program.version || 1}</strong>
        <small>{getAdminBasicProgramStatusLabel(program.status)}</small>
      </section>
      {loading ? <p className={styles.loadingHistory}><LoaderCircle className={styles.spinner} aria-hidden="true" /> Загружаем историю…</p> : null}
      {!loading && !history.length ? <p className={styles.emptyHistory}>Версий пока нет. Следующее сохранение будет зафиксировано в журнале.</p> : null}
      {!loading && history.length ? (
        <ol className={styles.historyList}>
          {history.map((entry) => (
            <li key={entry.id}>
              <span className={styles.historyVersion}>v{entry.version || "—"}</span>
              <div>
                <strong>{ACTION_COPY[entry.action] || "изменена"}</strong>
                <p>{entry.reason || "Без комментария"}</p>
                <small>{entry.actor?.name || entry.actor?.email || "Администратор"} · {formatDate(entry.createdAt)}</small>
              </div>
              <span className={`${styles.statusChip} ${styles[`status${getAdminBasicProgramStatus(entry.status)}`] || ""}`.trim()}>
                {getAdminBasicProgramStatusLabel(entry.status)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </ModalFrame>
  );
}

function ProgramCard({ program, onCreateVersion, onDuplicate, onEdit, onHistory, onTransition }) {
  const workouts = Array.isArray(program.workouts) ? program.workouts : [];
  const exerciseCount = countExercises(workouts);
  const status = getAdminBasicProgramStatus(program.status);
  const transition = (targetStatus) => {
    const result = getBasicProgramTransition(status, targetStatus);
    if (result.allowed) onTransition(program, targetStatus, result.action);
  };
  const actionLabel = program.managed ? "Открыть историю" : "Посмотреть состав";

  return (
    <article className={styles.programCard}>
      <div className={styles.cardTopline}>
        <span className={`${styles.statusChip} ${styles[`status${status}`] || ""}`.trim()}>
          {program.managed ? getAdminBasicProgramStatusLabel(status) : "Системный образец"}
        </span>
        {program.managed ? <span className={styles.versionLabel}>v{program.version}</span> : null}
      </div>
      <div className={styles.cardHeading}>
        <span className={styles.cardIcon} aria-hidden="true"><BookOpen /></span>
        <div>
          <h3>{program.title}</h3>
          <p>{program.description || "Базовый шаблон без короткого описания."}</p>
        </div>
      </div>
      {program.goal ? <p className={styles.focusLine}><ShieldCheck aria-hidden="true" />{program.goal}</p> : null}
      <div className={styles.cardMeta}>
        <span>{workouts.length} {workouts.length === 1 ? "тренировка" : workouts.length < 5 ? "тренировки" : "тренировок"}</span>
        <span>{exerciseCount} {exerciseCount === 1 ? "упражнение" : exerciseCount < 5 ? "упражнения" : "упражнений"}</span>
      </div>
      {program.managed && program.publishedVersion && status !== ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED ? (
        <p className={styles.publishedNotice}>Пока редактируется v{program.version}, для будущих назначений доступна опубликованная v{program.publishedVersion}.</p>
      ) : null}
      <div className={styles.cardActions}>
        <button className={styles.subtleAction} type="button" onClick={() => onHistory(program)}>
          {program.managed ? <History aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {actionLabel}
        </button>
        <button className={styles.subtleAction} type="button" onClick={() => onDuplicate(program)}>
          <Copy aria-hidden="true" />
          Копировать
        </button>
        {program.managed && status !== ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED ? (
          <button className={styles.subtleAction} type="button" onClick={() => onEdit(program)}>
            <Pencil aria-hidden="true" />
            {status === ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED ? "Новая версия" : "Изменить"}
          </button>
        ) : null}
        {!program.managed ? (
          <button className={styles.primaryCardAction} type="button" onClick={() => onCreateVersion(program)}>
            <FilePlus2 aria-hidden="true" />
            Создать версию
          </button>
        ) : null}
      </div>
      {program.managed ? (
        <div className={styles.lifecycleActions}>
          {status === ADMIN_BASIC_PROGRAM_STATUSES.DRAFT ? (
            <button type="button" onClick={() => transition(ADMIN_BASIC_PROGRAM_STATUSES.REVIEW)}><Send aria-hidden="true" />На проверку</button>
          ) : null}
          {status === ADMIN_BASIC_PROGRAM_STATUSES.REVIEW ? (
            <>
              <button type="button" onClick={() => transition(ADMIN_BASIC_PROGRAM_STATUSES.DRAFT)}>Вернуть в черновик</button>
              <button className={styles.publishAction} type="button" onClick={() => transition(ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED)}><CheckCircle2 aria-hidden="true" />Опубликовать</button>
            </>
          ) : null}
          {status === ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED ? (
            <button type="button" onClick={() => transition(ADMIN_BASIC_PROGRAM_STATUSES.DRAFT)}><ArchiveRestore aria-hidden="true" />Восстановить</button>
          ) : null}
          {status !== ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED ? (
            <button className={styles.archiveAction} type="button" onClick={() => transition(ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED)}><Archive aria-hidden="true" />В архив</button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function AdminBasicProgramLifecycle({ fallbackPrograms = [] }) {
  const [managedPrograms, setManagedPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [historyProgram, setHistoryProgram] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const programsCollection = useMemo(() => collection(db, ...PROGRAM_COLLECTION_PATH), []);
  const livePrograms = useMemo(() => managedPrograms.map(normalizeManagedProgram), [managedPrograms]);
  const systemPrograms = useMemo(() => (
    Array.isArray(fallbackPrograms) ? fallbackPrograms.map(normalizeFallbackProgram) : EMPTY_LIST
  ), [fallbackPrograms]);
  const allPrograms = useMemo(() => [...livePrograms, ...systemPrograms], [livePrograms, systemPrograms]);
  const statusCounts = useMemo(() => countAdminBasicProgramsByStatus(livePrograms), [livePrograms]);
  const queryText = search.trim().toLocaleLowerCase("ru");
  const filteredPrograms = useMemo(() => allPrograms.filter((program) => {
    if (filter !== "all" && getAdminBasicProgramStatus(program.status) !== filter) return false;
    return !queryText || makeCardSearchText(program).includes(queryText);
  }), [allPrograms, filter, queryText]);

  const loadPrograms = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError("");
    try {
      const snapshot = await getDocs(programsCollection);
      const next = snapshot.docs
        .map((item) => normalizeManagedProgram({ id: item.id, ...item.data() }))
        .filter(isAdminManagedBasicProgram)
        .sort((left, right) => getMilliseconds(right.updatedAt || right.createdAt) - getMilliseconds(left.updatedAt || left.createdAt));
      setManagedPrograms(next);
    } catch (error) {
      console.error("Basic program lifecycle load failed:", error);
      setLoadError("Не удалось загрузить управляемые программы. Проверьте подключение и права администратора.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [programsCollection]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const saveProgram = async ({ current = null, draft, action, status, reason }) => {
    const actor = getActor();
    const mutation = createBasicProgramMutation({
      current,
      draft,
      action,
      actor,
      reason,
      status
    });
    const programRef = current?.id ? doc(programsCollection, current.id) : doc(programsCollection);
    const versionRef = doc(programRef, "versions", `v${mutation.snapshot.version}-${Date.now()}`);
    const now = new Date();
    const isNew = !current?.id;
    const lifecycleRecord = {
      ...mutation.record,
      id: programRef.id,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
      ...(isNew ? {
        createdAt: serverTimestamp(),
        createdBy: actor
      } : {})
    };
    const versionRecord = {
      ...mutation.snapshot,
      programId: programRef.id,
      createdAt: serverTimestamp()
    };

    setSaving(true);
    setSaveError("");
    try {
      const batch = writeBatch(db);
      batch.set(programRef, lifecycleRecord, { merge: true });
      batch.set(versionRef, versionRecord);
      await batch.commit();

      const localRecord = normalizeManagedProgram({
        ...lifecycleRecord,
        createdAt: isNew ? now : current?.createdAt,
        updatedAt: now
      });
      setManagedPrograms((items) => {
        const next = items.filter((item) => item.id !== localRecord.id);
        return [localRecord, ...next];
      });
      setActionStatus(
        action === "published"
          ? "Программа опубликована. Новые назначения будут использовать эту версию; выданные планы не изменились."
          : action === "archived"
            ? "Программа перенесена в архив. Уже выданные планы сохранены."
            : "Версия программы сохранена в общем каталоге."
      );
      return localRecord;
    } catch (error) {
      console.error("Basic program lifecycle save failed:", error);
      setSaveError("Не удалось сохранить версию. Данные не изменены — попробуйте ещё раз после проверки подключения.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (program) => {
    setHistoryProgram(program);
    setHistory([]);
    if (!program.managed) return;

    setHistoryLoading(true);
    try {
      const snapshot = await getDocs(collection(doc(programsCollection, program.id), "versions"));
      const entries = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => Number(right.version || 0) - Number(left.version || 0));
      setHistory(entries);
    } catch (error) {
      console.error("Basic program version history load failed:", error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveEditor = async (draft) => {
    const current = editor?.program?.managed ? editor.program : null;
    const action = editor?.mode === "duplicate" ? "duplicated" : current ? "updated" : "created";
    const status = current?.status === ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED
      ? ADMIN_BASIC_PROGRAM_STATUSES.DRAFT
      : current?.status || ADMIN_BASIC_PROGRAM_STATUSES.DRAFT;
    const saved = await saveProgram({
      current,
      draft,
      action,
      status,
      reason: draft.reason
    });
    if (saved) setEditor(null);
  };

  const saveTransition = async (reason) => {
    const transition = pendingTransition;
    if (!transition) return;
    const saved = await saveProgram({
      current: transition.program,
      draft: transition.program,
      action: transition.action,
      status: transition.targetStatus,
      reason
    });
    if (saved) setPendingTransition(null);
  };

  const filterCount = (filterId) => {
    if (filterId === "all") return allPrograms.length;
    return statusCounts[filterId] || 0;
  };

  return (
    <section className={styles.lifecycle} data-testid="admin-basic-program-lifecycle">
      <div className={styles.lifecycleHeader}>
        <div>
          <p className={styles.eyebrow}>Управляемые версии</p>
          <h2>Базовые программы</h2>
          <p>Создавайте и публикуйте версии для будущих назначений. Назначенные клиентам планы и их история не меняются.</p>
        </div>
        <button className={styles.newProgramButton} type="button" onClick={() => { setSaveError(""); setEditor({ mode: "create", program: null }); }}>
          <FilePlus2 aria-hidden="true" />
          Новая программа
        </button>
      </div>

      <div className={styles.statsRow} aria-label="Состояние каталога программ">
        <span><CheckCircle2 aria-hidden="true" />{statusCounts.published} опубликовано</span>
        <span><Clock3 aria-hidden="true" />{statusCounts.review} на проверке</span>
        <span><Pencil aria-hidden="true" />{statusCounts.draft} черновиков</span>
        <span><Archive aria-hidden="true" />{statusCounts.archived} в архиве</span>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Найти базовую программу</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Найти базовую программу" />
        </label>
        <div className={styles.filterRow} aria-label="Статус программы">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              className={`${styles.filterButton}${filter === item.id ? ` ${styles.filterButtonActive}` : ""}`}
              type="button"
              onClick={() => setFilter(item.id)}
            >
              {item.label}<b>{filterCount(item.id)}</b>
            </button>
          ))}
        </div>
      </div>

      {loadError ? <div className={styles.warning} role="alert">{loadError}<button type="button" onClick={() => loadPrograms()}>Повторить</button></div> : null}
      {actionStatus ? <p className={styles.statusMessage} role="status">{actionStatus}</p> : null}

      {loading ? <div className={styles.loading}><LoaderCircle className={styles.spinner} aria-hidden="true" />Загружаем управляемые программы…</div> : null}
      {!loading && !filteredPrograms.length ? (
        <div className={styles.emptyState}>
          <BookOpen aria-hidden="true" />
          <strong>Программ по этому запросу нет</strong>
          <p>Создайте черновик или измените фильтр. Системные образцы можно скопировать в новую управляемую версию.</p>
        </div>
      ) : null}
      {!loading && filteredPrograms.length ? (
        <div className={styles.programGrid}>
          {filteredPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onHistory={openHistory}
              onCreateVersion={(source) => { setSaveError(""); setEditor({ mode: "duplicate", program: source }); }}
              onDuplicate={(source) => { setSaveError(""); setEditor({ mode: "duplicate", program: source }); }}
              onEdit={(source) => { setSaveError(""); setEditor({ mode: "edit", program: source }); }}
              onTransition={(programItem, targetStatus, action) => { setSaveError(""); setPendingTransition({ program: programItem, targetStatus, action }); }}
            />
          ))}
        </div>
      ) : null}

      {editor ? (
        <ProgramEditorSheet
          key={`${editor.mode}-${editor.program?.id || "new"}`}
          mode={editor.mode}
          program={editor.program}
          onClose={() => !saving && setEditor(null)}
          onSave={saveEditor}
          saving={saving}
          saveError={saveError}
        />
      ) : null}
      {pendingTransition ? (
        <TransitionSheet
          key={`${pendingTransition.program.id}-${pendingTransition.targetStatus}`}
          transition={pendingTransition}
          onClose={() => !saving && setPendingTransition(null)}
          onConfirm={saveTransition}
          saving={saving}
          saveError={saveError}
        />
      ) : null}
      {historyProgram ? (
        <ProgramHistorySheet
          key={historyProgram.id}
          program={historyProgram}
          history={history}
          loading={historyLoading}
          onClose={() => setHistoryProgram(null)}
        />
      ) : null}
    </section>
  );
}

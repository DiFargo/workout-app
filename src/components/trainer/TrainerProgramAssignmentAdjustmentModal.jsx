import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CircleAlert,
  Dumbbell,
  LoaderCircle,
  Search,
  X
} from "lucide-react";
import { buildTrainerAssignmentProgress, prepareTrainerAssignmentProgressHistory } from "../../utils/trainerAssignmentProgress.js";
import TrainerAssignmentExerciseProgress from "./TrainerAssignmentExerciseProgress.jsx";
import {
  getTrainerProgramAssignmentExercises
} from "../../utils/trainerProgramAssignmentAdjustment.js";
import { sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
import { getTrainerActionErrorStatus } from "../../utils/trainerActionStatus.js";
import {
  buildTrainerClientProgramName,
  normalizeTrainerClientProgramName
} from "../../utils/trainerClientProgramName.js";
import styles from "./TrainerProgramAssignmentAdjustmentModal.module.css";

function formatWeightRange(item = {}) {
  if (!item.usesWeight) return "План новой программы · без дополнительного веса";
  if (item.plannedMinWeight === null) return "План новой программы · рабочий вес не указан";
  if (item.plannedMinWeight === item.plannedMaxWeight) return `План новой программы · ${item.plannedMinWeight} кг`;
  return `План новой программы · ${item.plannedMinWeight}–${item.plannedMaxWeight} кг`;
}

function normalizeExerciseSearch(value = "") {
  return String(value).normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim().replace(/\s+/g, " ");
}

export default function TrainerProgramAssignmentAdjustmentModal(props) {
  return <TrainerProgramAssignmentAdjustmentForm key={`${props.client?.id || ""}:${props.template?.id || ""}`} {...props} />;
}

function TrainerProgramAssignmentAdjustmentForm({
  client,
  template,
  workouts = [],
  history = [],
  onClose,
  onConfirm
}) {
  const confirmButtonRef = useRef(null);
  const errorRef = useRef(null);
  const searchRef = useRef(null);
  const searchId = useId();
  const [adjustments, setAdjustments] = useState({});
  const [exerciseSearch, setExerciseSearch] = useState("");
  const programName = buildTrainerClientProgramName(template?.name, client);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const programExercises = useMemo(() => getTrainerProgramAssignmentExercises(workouts), [workouts]);
  const visibleExercises = useMemo(() => {
    const terms = normalizeExerciseSearch(exerciseSearch).split(" ").filter(Boolean);
    return programExercises.filter(exercise => {
      const name = normalizeExerciseSearch(exercise.name);
      return terms.every(term => name.includes(term));
    });
  }, [programExercises, exerciseSearch]);
  const preparedHistory = useMemo(() => prepareTrainerAssignmentProgressHistory(history), [history]);
  const progressByName = useMemo(() => new Map(programExercises.map(exercise => [exercise.key, buildTrainerAssignmentProgress(history, exercise, preparedHistory)])), [history, programExercises, preparedHistory]);
  const adjustedCount = Object.values(adjustments).filter((value) => Number.parseFloat(String(value).replace(",", ".")) > 0).length;

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const button = confirmButtonRef.current;
      const dialog = button?.closest('[role="dialog"]');
      if (!dialog?.contains(document.activeElement)) button?.focus();
    }, 60);
    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  function updateAdjustment(key, value) {
    const nextValue = sanitizeExerciseWeightInput(value);
    if (!/^\d*(?:[.,]\d*)?$/.test(nextValue)) return;
    setAdjustments((current) => ({ ...current, [key]: nextValue }));
    setError("");
  }

  function clearExerciseSearch() {
    setExerciseSearch("");
    searchRef.current?.focus();
  }

  async function confirm() {
    if (saving) return;
    const resolvedProgramName = normalizeTrainerClientProgramName(programName);
    if (!resolvedProgramName) {
      setError("Введите название программы для клиента.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await onConfirm?.({
        loadAdjustments: adjustments,
        programName: resolvedProgramName
      });
      if (result === false) throw new Error("program-assignment-failed");
      onClose?.();
    } catch (saveError) {
      console.error("Program assignment adjustment failed:", saveError);
      setError(saveError?.assignmentMessage || getTrainerActionErrorStatus(saveError,
        "Не удалось назначить программу. Проверьте выбранную программу и повторите попытку."));
    } finally {
      setSaving(false);
    }
  }

  const clientName = client?.name || client?.email || "клиенту";

  const modal = (
    <div className={styles.backdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose?.();
    }}>
      <section className={`${styles.modal} ${styles.assignmentSheet}`} role="dialog" aria-modal="true" aria-labelledby="trainer-program-assignment-title" data-trainer-modal-surface="true" data-trainer-modal-frame="true">
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            <span>НАЗНАЧЕНИЕ ПРОГРАММЫ</span>
            <h2 id="trainer-program-assignment-title">Корректировка под клиента</h2>
            <p>Проверьте динамику упражнений и при необходимости добавьте поправку к рабочим весам.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Закрыть окно корректировки"><X size={19} /></button>
        </header>

        <div className={styles.content} data-trainer-modal-content="true">
          <section className={styles.summary}>
            <span><Dumbbell size={19} /></span>
            <div>
              <small>Клиент · {clientName}</small>
              <strong>{template?.name || "Новая программа"}</strong>
              <p>{programExercises.length} упражнений · шаблон останется без изменений</p>
            </div>
          </section>

          <div className={styles.searchField} role="search" aria-label="Поиск упражнений в программе">
            <label htmlFor={searchId}>Поиск упражнений</label>
            <div className={styles.searchControl}>
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                value={exerciseSearch}
                onChange={event => setExerciseSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Escape" && exerciseSearch) {
                    event.preventDefault();
                    event.stopPropagation();
                    clearExerciseSearch();
                  }
                }}
                placeholder="Найти упражнение в программе"
                autoComplete="off"
                aria-describedby={`${searchId}-count`}
                disabled={saving}
              />
              {exerciseSearch && <button type="button" onClick={clearExerciseSearch} disabled={saving} aria-label="Очистить поиск упражнений"><X size={18} aria-hidden="true" /></button>}
            </div>
            <p id={`${searchId}-count`} data-testid="assignment-search-count" role="status" aria-live="polite" aria-atomic="true">Упражнения: найдено {visibleExercises.length} из {programExercises.length}</p>
          </div>

          <p className={styles.hint}>План новой программы показан отдельно от истории. Сравнение «план / факт» использует план, сохранённый на дату той тренировки. Поправка применяется только к новой копии программы.</p>

          <section className={styles.exerciseList} aria-label="Корректировка нагрузки по упражнениям">
            {visibleExercises.map((exercise) => {
              const progress = progressByName.get(exercise.key);
              return (
                <article className={styles.exercise} key={exercise.key} data-testid="assignment-exercise-card">
                  <div className={styles.exerciseHeading}>
                    <span className={`${styles.statusIcon} ${styles.neutral}`}><Dumbbell size={17} aria-hidden="true" /></span>
                    <div>
                      <strong>{exercise.name}</strong>
                      <small>{formatWeightRange(exercise)}</small>
                    </div>
                  </div>
                  <TrainerAssignmentExerciseProgress progress={progress} />
                  {exercise.usesWeight && exercise.plannedMinWeight !== null ? (
                    <label className={styles.adjustment}>
                      <span>Поправка к весам</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={adjustments[exercise.key] ?? ""}
                        onChange={(event) => updateAdjustment(exercise.key, event.target.value)}
                        placeholder="0"
                        aria-label={`Поправка веса для упражнения ${exercise.name}`}
                        disabled={saving}
                      />
                      <em>кг</em>
                    </label>
                  ) : <small className={styles.bodyweight}>{exercise.usesWeight ? "Для поправки сначала укажите рабочие веса в программе." : "Коррекция веса не нужна"}</small>}
                </article>
              );
            })}
            {!programExercises.length ? <div className={styles.empty}>В программе пока нет упражнений для корректировки.</div> : null}
            {!!programExercises.length && !visibleExercises.length && <div className={styles.searchEmpty} data-testid="assignment-search-empty">
              <strong>Упражнения не найдены</strong>
              <p>Попробуйте другую часть названия или очистите поиск. Введённые поправки к весам сохранены.</p>
              <button type="button" onClick={clearExerciseSearch} disabled={saving}>Показать все упражнения</button>
            </div>}
          </section>
          {error ? <p ref={errorRef} className={styles.error} role="alert"><CircleAlert size={16} />{error}</p> : null}
        </div>

        <footer className={styles.footer} data-trainer-modal-footer="true">
          <button type="button" onClick={onClose} disabled={saving}>Отмена</button>
          <button ref={confirmButtonRef} className={styles.confirm} type="button" onClick={confirm} disabled={saving}>
            {saving ? <LoaderCircle className={styles.spinner} size={17} /> : <Check size={17} />}
            {saving ? "Назначаю…" : adjustedCount ? `Назначить с правками (${adjustedCount})` : "Назначить программу"}
          </button>
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

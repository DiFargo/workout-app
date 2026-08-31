import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Check,
  CircleAlert,
  Dumbbell,
  LoaderCircle,
  Minus,
  TrendingDown,
  TrendingUp,
  X
} from "lucide-react";
import { analyzeExerciseProgress } from "../../utils/exerciseProgress.js";
import {
  getTrainerProgramAssignmentExercises
} from "../../utils/trainerProgramAssignmentAdjustment.js";
import { sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
import styles from "./TrainerProgramAssignmentAdjustmentModal.module.css";

function formatWeightRange(item = {}) {
  if (!item.usesWeight || item.plannedMinWeight === null) return "Без дополнительного веса";
  if (item.plannedMinWeight === item.plannedMaxWeight) return `${item.plannedMinWeight} кг в плане`;
  return `${item.plannedMinWeight}–${item.plannedMaxWeight} кг в плане`;
}

function getProgressMeta(item) {
  if (!item) {
    return {
      label: "Нет сравнения",
      description: "По этому упражнению ещё недостаточно заполненных тренировок.",
      icon: Activity,
      tone: "neutral"
    };
  }
  if (item.status === "progress") {
    return {
      label: "Прогресс",
      description: `Последний рабочий вес ${item.current?.bestWeight || "—"} кг; динамика ${item.changes?.e1rmPct >= 0 ? "+" : ""}${item.changes?.e1rmPct ?? 0}% по e1RM.`,
      icon: TrendingUp,
      tone: "positive"
    };
  }
  if (item.status === "regression") {
    return {
      label: "Возможный регресс",
      description: `Последний рабочий вес ${item.current?.bestWeight || "—"} кг. Проверьте восстановление и оставьте запас нагрузки.`,
      icon: TrendingDown,
      tone: "negative"
    };
  }
  if (item.status === "adaptation" || item.status === "mixed") {
    return {
      label: item.status === "adaptation" ? "Адаптация" : "Смешанная динамика",
      description: "Данные пока не стоит трактовать как прямой рост или спад нагрузки.",
      icon: CircleAlert,
      tone: "warning"
    };
  }
  return {
    label: "Стабильно",
    description: `Последний рабочий вес ${item.current?.bestWeight || "—"} кг; заметного изменения нагрузки нет.`,
    icon: Minus,
    tone: "neutral"
  };
}

export default function TrainerProgramAssignmentAdjustmentModal({
  client,
  template,
  workouts = [],
  history = [],
  onClose,
  onConfirm
}) {
  const confirmButtonRef = useRef(null);
  const [adjustments, setAdjustments] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const programExercises = useMemo(() => getTrainerProgramAssignmentExercises(workouts), [workouts]);
  const progressByName = useMemo(() => new Map(
    analyzeExerciseProgress(history).map((item) => [String(item.name || "").normalize("NFKC").toLocaleLowerCase("ru-RU").trim(), item])
  ), [history]);
  const adjustedCount = Object.values(adjustments).filter((value) => Number.parseFloat(String(value).replace(",", ".")) > 0).length;

  useEffect(() => {
    const timer = window.setTimeout(() => confirmButtonRef.current?.focus(), 60);
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

  async function confirm() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await onConfirm?.(adjustments);
      if (result === false) throw new Error("program-assignment-failed");
      onClose?.();
    } catch (saveError) {
      console.error("Program assignment adjustment failed:", saveError);
      setError("Не удалось назначить программу. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  const clientName = client?.name || client?.email || "клиенту";

  const modal = (
    <div className={styles.backdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose?.();
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="trainer-program-assignment-title" data-trainer-modal-surface="true" data-trainer-modal-frame="true">
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

          <p className={styles.hint}>Поправка применяется только к копии этой программы у клиента и сохраняет разницу весов между днями.</p>

          <section className={styles.exerciseList} aria-label="Корректировка нагрузки по упражнениям">
            {programExercises.map((exercise) => {
              const progress = progressByName.get(exercise.key);
              const meta = getProgressMeta(progress);
              const Icon = meta.icon;
              return (
                <article className={styles.exercise} key={exercise.key}>
                  <div className={styles.exerciseHeading}>
                    <span className={`${styles.statusIcon} ${styles[meta.tone]}`}><Icon size={17} /></span>
                    <div>
                      <strong>{exercise.name}</strong>
                      <small>{formatWeightRange(exercise)}</small>
                    </div>
                    <b className={`${styles.status} ${styles[meta.tone]}`}>{meta.label}</b>
                  </div>
                  <p>{meta.description}</p>
                  {exercise.usesWeight ? (
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
                      />
                      <em>кг</em>
                    </label>
                  ) : <small className={styles.bodyweight}>Коррекция веса не нужна</small>}
                </article>
              );
            })}
            {!programExercises.length ? <div className={styles.empty}>В программе пока нет упражнений для корректировки.</div> : null}
          </section>
          {error ? <p className={styles.error} role="alert"><CircleAlert size={16} />{error}</p> : null}
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

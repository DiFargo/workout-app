import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Dumbbell,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-react";

import styles from "./TrainerExerciseLoadReviewModal.module.css";

function formatDate(value) {
  const date = value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) return "дата не назначена";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long"
  }).format(date);
}

function cloneSets(exercise) {
  const sets = Array.isArray(exercise?.sets) && exercise.sets.length
    ? exercise.sets
    : [{ reps: "", weight: "" }];

  return sets.map((set) => ({ ...set }));
}

export default function TrainerExerciseLoadReviewModal({
  item,
  target,
  reviewKey,
  onClose,
  onResolve,
  onSaveAdjustment
}) {
  const okayButtonRef = useRef(null);
  const [sets, setSets] = useState(() => cloneSets(target?.exercise));
  const [rest, setRest] = useState(target?.exercise?.rest || "90 сек");
  const [savingMode, setSavingMode] = useState("");
  const [error, setError] = useState("");
  const requiresWeight = target?.exercise?.requiresWeight ?? target?.exercise?.usesWeight ?? true;

  useEffect(() => {
    setSets(cloneSets(target?.exercise));
    setRest(target?.exercise?.rest || "90 сек");
    setError("");
  }, [target?.exercise, target?.workoutId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => okayButtonRef.current?.focus(), 80);

    function handleKeyDown(event) {
      if (event.key === "Escape" && !savingMode) onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, savingMode]);

  function updateSet(index, field, value) {
    setSets((current) => current.map((set, setIndex) => (
      setIndex === index ? { ...set, [field]: value } : set
    )));
    setError("");
  }

  function addSet() {
    const source = sets[0] || { reps: "", weight: "" };
    setSets((current) => [...current, { ...source, id: undefined }]);
  }

  function removeSet(index) {
    if (sets.length <= 1) return;
    setSets((current) => current.filter((_, setIndex) => setIndex !== index));
  }

  async function resolve(decision, adjustmentTarget = target) {
    const result = await onResolve?.({
      reviewKey,
      decision,
      exerciseName: item?.name || "",
      previousDate: item?.previous?.date || "",
      currentDate: item?.current?.date || "",
      workoutId: adjustmentTarget?.workoutId || "",
      exerciseId: adjustmentTarget?.exerciseId || ""
    });

    if (!result) throw new Error("review-save-failed");
  }

  async function confirmOkay() {
    if (savingMode) return;
    setSavingMode("accepted");
    setError("");
    try {
      await resolve("accepted");
      onClose?.();
    } catch (saveError) {
      console.error("Exercise progress review save failed:", saveError);
      setError("Не удалось сохранить решение. Попробуйте ещё раз.");
    } finally {
      setSavingMode("");
    }
  }

  async function saveAdjustment() {
    if (savingMode || !target) return;
    setSavingMode("adjusted");
    setError("");
    try {
      const saved = await onSaveAdjustment?.({
        workoutId: target.workoutId,
        exerciseId: target.exerciseId,
        workoutIndex: target.workoutIndex,
        exerciseIndex: target.exerciseIndex,
        patch: {
          rest: rest.trim() || "90 сек",
          sets: sets.map((set) => ({
            ...set,
            reps: set.reps ?? "",
            weight: requiresWeight ? (set.weight ?? "") : ""
          }))
        }
      });
      if (!saved) throw new Error("exercise-save-failed");
      await resolve("adjusted", target);
      onClose?.();
    } catch (saveError) {
      console.error("Exercise load adjustment save failed:", saveError);
      setError("Не удалось сохранить изменения. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setSavingMode("");
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !savingMode) onClose?.();
    }}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-busy={Boolean(savingMode)}
        aria-labelledby="trainer-load-review-title"
        aria-describedby="trainer-load-review-description"
      >
        <header className={styles.header}>
          <div>
            <span>РЕШЕНИЕ ТРЕНЕРА</span>
            <h2 id="trainer-load-review-title">Корректировка нагрузки</h2>
            <p id="trainer-load-review-description">
              Подтвердите текущую нагрузку или измените упражнение в следующей тренировке.
            </p>
          </div>
          <button type="button" disabled={Boolean(savingMode)} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <section className={styles.issueCard}>
          <span className={styles.exerciseIcon}><Dumbbell size={21} /></span>
          <div>
            <strong>{item?.name || "Упражнение"}</strong>
            <small>
              {item?.previous?.bestWeight || "—"} кг × {item?.previous?.averageReps || "—"} × {item?.previous?.sets || "—"}
              {" → "}
              {item?.current?.bestWeight || "—"} кг × {item?.current?.averageReps || "—"} × {item?.current?.sets || "—"}
            </small>
            <p>{item?.explanation || "Нагрузка требует решения тренера."}</p>
          </div>
        </section>

        <section className={styles.okayChoice}>
          <div>
            <span className={styles.choiceNumber}>1</span>
            <div><strong>Текущая нагрузка подходит</strong><small>Сигнал будет отмечен как проверенный и исчезнет из списка важных.</small></div>
          </div>
          <button ref={okayButtonRef} type="button" disabled={Boolean(savingMode)} onClick={confirmOkay}>
            {savingMode === "accepted" ? <LoaderCircle className={styles.spinner} size={16} /> : <Check size={16} />}
            {savingMode === "accepted" ? "Сохраняю…" : "Всё в порядке"}
          </button>
        </section>

        <div className={styles.divider}><span>или</span></div>

        <section className={styles.editorChoice}>
          <header>
            <span className={styles.choiceNumber}>2</span>
            <div><strong>Изменить упражнение</strong><small>Правки применятся только к ближайшей будущей тренировке.</small></div>
          </header>

          {target ? (
            <>
              <div className={styles.targetWorkout}>
                <span>Следующая тренировка</span>
                <strong>{target.workout?.name || "Тренировка"} · {formatDate(target.date)}</strong>
              </div>

              <div className={styles.setHeader} aria-hidden="true">
                <span>Подход</span><span>Повторы</span><span>{requiresWeight ? "Вес, кг" : "Без веса"}</span><span />
              </div>
              <div className={styles.setList}>
                {sets.map((set, index) => (
                  <div className={styles.setRow} key={set.id || index}>
                    <strong>{index + 1}</strong>
                    <label>
                      <span>Повторы, подход {index + 1}</span>
                      <input
                        inputMode="numeric"
                        value={set.reps ?? ""}
                        onChange={(event) => updateSet(index, "reps", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Вес, подход {index + 1}</span>
                      <input
                        inputMode="decimal"
                        disabled={!requiresWeight}
                        value={requiresWeight ? (set.weight ?? "") : ""}
                        onChange={(event) => updateSet(index, "weight", event.target.value)}
                      />
                    </label>
                    <button type="button" disabled={sets.length <= 1 || Boolean(savingMode)} onClick={() => removeSet(index)} aria-label={`Удалить подход ${index + 1}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.editorFooter}>
                <button type="button" disabled={Boolean(savingMode)} onClick={addSet}><Plus size={15} />Добавить подход</button>
                <label><span>Отдых</span><input value={rest} onChange={(event) => setRest(event.target.value)} placeholder="90 сек" /></label>
              </div>

              <button className={styles.saveButton} type="button" disabled={Boolean(savingMode)} onClick={saveAdjustment}>
                {savingMode === "adjusted" ? <LoaderCircle className={styles.spinner} size={17} /> : <Save size={17} />}
                {savingMode === "adjusted" ? "Сохраняю…" : "Сохранить изменения"}
              </button>
            </>
          ) : (
            <div className={styles.noTarget}>
              <CircleAlert size={17} />
              <span>В будущих тренировках это упражнение не найдено. Можно подтвердить, что текущая нагрузка подходит.</span>
            </div>
          )}
        </section>

        {error ? <p className={styles.error} role="alert"><CircleAlert size={15} />{error}</p> : null}
      </section>
    </div>
  );
}

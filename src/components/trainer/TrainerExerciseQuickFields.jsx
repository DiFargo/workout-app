import { useState } from "react";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety";
import { sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
import { getUniformSetValue, resizeTrainerSets } from "../../utils/trainerQuickSets.js";
import styles from "./TrainerExerciseQuickFields.module.css";

export default function TrainerExerciseQuickFields({ exercise, disabled = false, onChange, onDetails, className = "" }) {
  const sets = exercise.sets?.length ? exercise.sets : [{ reps: "", weight: "" }];
  const [reserve, setReserve] = useState([]);
  const weight = exerciseUsesExternalWeight(exercise);
  const setCount = (value) => {
    if (disabled) return;
    const retained = [...sets.map((set) => ({ ...set })), ...reserve.slice(sets.length)];
    setReserve(retained);
    onChange({ sets: resizeTrainerSets(sets, Number(value), retained) });
  };
  return <span className={`${styles.fields} ${className}`}>
    <label><span>Подходы</span><input aria-label={`Подходы: ${exercise.name}`} type="number" inputMode="numeric" min="1" max="12" value={sets.length} disabled={disabled} onChange={(event) => setCount(event.target.value)} /></label>
    {[['reps', 'Повторы · все', 'Повторы'], ['weight', 'Вес, кг · все', 'Вес']].map(([field, label, accessible]) => {
      const value = getUniformSetValue(sets, field);
      const unavailable = field === "weight" && !weight;
      return <label key={field}><span>{label}</span>{value === null && !unavailable
        ? <button type="button" onClick={onDetails} aria-label={`${accessible}: разные по подходам. ${exercise.name}`}>Разные</button>
        : <input aria-label={`${accessible}: ${exercise.name}`} title="Применяется ко всем подходам" inputMode={field === "weight" ? "decimal" : "numeric"} value={unavailable ? "—" : value} disabled={disabled || unavailable} onChange={(event) => { if (!disabled) onChange({ sets: sets.map((set) => ({ ...set, [field]: field === "weight" ? sanitizeExerciseWeightInput(event.target.value) : event.target.value })) }); }} />}</label>;
    })}
    <label><span>Отдых, сек</span><input aria-label={`Отдых: ${exercise.name}`} inputMode="numeric" value={String(exercise.rest || "").replace(/\s*сек\.?$/i, "")} placeholder="90" disabled={disabled} onChange={(event) => { if (!disabled) onChange({ rest: event.target.value ? `${event.target.value} сек` : "" }); }} /></label>
    {!disabled && reserve.length > sets.length ? <button type="button" className={styles.undo} onClick={() => setCount(reserve.length)}>Вернуть удалённые подходы</button> : null}
  </span>;
}

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronUp, Copy, ListOrdered, MessageSquare, MoreVertical, Replace, Settings2, Trash2 } from "lucide-react";
import TrainerEditorSheet from "./TrainerEditorSheet.jsx";
import TrainerExerciseQuickFields from "./TrainerExerciseQuickFields.jsx";
import { getTrainerExerciseAlternatives, MAX_TRAINER_EXERCISE_ALTERNATIVES } from "../../utils/trainerExerciseAlternatives.js";
import { getUniformSetValue } from "../../utils/trainerQuickSets.js";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety.js";
import { sanitizeExerciseSetPatch, sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput.js";
import styles from "./TrainerProgramExerciseAccordion.module.css";

export default function TrainerProgramExerciseAccordion({
  exercise, index, muscle, expanded, onToggle, onChange, onOpenDetails,
  onChooseExercise, onDuplicate, onDelete, onMoveUp, onMoveDown,
  canMoveUp, canMoveDown, availableAlternatives, onAddAlternative, onRemoveAlternative
}) {
  const panelId = useId();
  const sets = exercise.sets?.length ? exercise.sets : [{ reps: "", weight: "" }];
  const usesWeight = exerciseUsesExternalWeight(exercise);
  const reps = getUniformSetValue(sets, "reps");
  const weight = getUniformSetValue(sets, "weight");
  const varied = reps === null || (usesWeight && weight === null);
  const [showSets, setShowSets] = useState(() => varied);
  const [section, setSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const alternatives = getTrainerExerciseAlternatives(exercise);
  const rest = String(exercise.rest || "").trim().replace(/\s*сек\.?$/i, " с");
  const summary = [
    varied ? `${sets.length} подх. · разная нагрузка` : `${sets.length} × ${reps || "—"}`,
    !varied && usesWeight && weight !== "" ? `${weight} кг` : "",
    rest ? `отдых ${rest}` : ""
  ].filter(Boolean).join(" · ");
  const menuAction = (action) => { setMenuOpen(false); action?.(); };
  const updateOneSet = (setIndex, patch) => onChange({
    setMode: "individual",
    sets: sets.map((set, current) => current === setIndex ? { ...set, ...sanitizeExerciseSetPatch(patch) } : set)
  });

  return <article className={`${styles.card}${expanded ? ` ${styles.open}` : ""}`} data-program-exercise-card={exercise.id}>
    <div className={styles.header}>
      <span className={styles.number}>{index + 1}</span>
      <button className={styles.toggle} type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId}>
        <span><strong>{exercise.name || "Упражнение"}</strong><small>{expanded ? "Настройка нагрузки" : muscle}</small></span>
        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      <button type="button" className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label={`Действия: ${exercise.name || "упражнение"}`}><MoreVertical size={18} aria-hidden="true" /></button>
    </div>
    {!expanded ? <p className={styles.summary}>{summary}{alternatives.length ? ` · ${alternatives.length} альт.` : ""}</p> : null}
    <div id={panelId} className={styles.panel} hidden={!expanded}>
      <TrainerExerciseQuickFields className={styles.fields} exercise={exercise} individual={showSets} compactLabels onChange={onChange} onDetails={() => setShowSets(true)} />
      {showSets ? <section className={styles.sets} aria-label={`Отдельные подходы: ${exercise.name}`}>
        <div className={styles.setLegend}><span>Подход</span><span>Повторы</span><span>Вес, кг</span></div>
        {sets.map((set, setIndex) => <div className={styles.setRow} key={set.id || `${exercise.id}-${setIndex}`}>
          <span>{setIndex + 1}</span>
          <input inputMode="numeric" value={set.reps ?? ""} onChange={event => updateOneSet(setIndex, { reps: event.target.value })} aria-label={`Повторы, подход ${setIndex + 1}: ${exercise.name}`} />
          <input inputMode="decimal" disabled={!usesWeight} value={usesWeight ? sanitizeExerciseWeightInput(set.weight) ?? "" : "—"} onChange={event => updateOneSet(setIndex, { weight: sanitizeExerciseWeightInput(event.target.value) })} aria-label={`Вес, подход ${setIndex + 1}: ${exercise.name}`} />
        </div>)}
      </section> : <p className={styles.hint}>{varied ? "Нагрузка различается. Откройте «По подходам» для точной настройки." : "Вес и повторы применяются ко всем подходам."}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={() => setShowSets(value => !value)} aria-expanded={showSets}><ListOrdered size={16} aria-hidden="true" />По подходам</button>
        <button type="button" onClick={() => setSection(value => value === "alternatives" ? "" : "alternatives")} aria-expanded={section === "alternatives"}><Replace size={16} aria-hidden="true" />Альтернативы{alternatives.length ? ` · ${alternatives.length}` : ""}</button>
        <button type="button" onClick={() => setSection(value => value === "note" ? "" : "note")} aria-expanded={section === "note"}><MessageSquare size={16} aria-hidden="true" />{exercise.note ? "Есть заметка" : "Заметка"}</button>
      </div>
      {section === "alternatives" ? <section className={styles.secondary} aria-label={`Альтернативы: ${exercise.name}`}>
        <p>Клиент сможет выбрать только назначенные вами варианты.</p>
        {alternatives.map(alternative => <div className={styles.alternative} key={alternative.libraryExerciseId || alternative.id}><span>{alternative.name}</span><button type="button" onClick={() => onRemoveAlternative(alternative.libraryExerciseId || alternative.id)} aria-label={`Удалить альтернативу «${alternative.name}»`}><Trash2 size={16} aria-hidden="true" /></button></div>)}
        <label><span>Добавить из библиотеки</span><select value="" disabled={alternatives.length >= MAX_TRAINER_EXERCISE_ALTERNATIVES || !availableAlternatives.length} onChange={event => onAddAlternative(event.target.value)} aria-label={`Добавить альтернативу для ${exercise.name || "упражнения"}`}>
          <option value="">{alternatives.length >= MAX_TRAINER_EXERCISE_ALTERNATIVES ? "Добавлен максимум вариантов" : "Выберите упражнение"}</option>
          {availableAlternatives.map(item => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}
        </select></label>
      </section> : null}
      {section === "note" ? <label className={styles.note}><span>Заметка к упражнению</span><textarea maxLength={2000} rows={3} value={exercise.note || ""} onChange={event => onChange({ note: event.target.value })} placeholder="Важные детали для этой тренировки" /></label> : null}
      <button className={styles.choose} type="button" onClick={onChooseExercise}><BookOpen size={16} aria-hidden="true" />Выбрать другое из библиотеки</button>
    </div>
    {menuOpen ? <TrainerEditorSheet title="Действия с упражнением" className={styles.sheet} bodyClassName={styles.sheetBody} onClose={() => setMenuOpen(false)}>
      <p>{exercise.name}</p>
      <button type="button" onClick={() => menuAction(onOpenDetails)}><Settings2 size={18} aria-hidden="true" />Дополнительные параметры</button>
      <button type="button" disabled={!canMoveUp} onClick={() => menuAction(onMoveUp)}><ArrowUp size={18} aria-hidden="true" />Переместить выше</button>
      <button type="button" disabled={!canMoveDown} onClick={() => menuAction(onMoveDown)}><ArrowDown size={18} aria-hidden="true" />Переместить ниже</button>
      <button type="button" onClick={() => menuAction(onDuplicate)}><Copy size={18} aria-hidden="true" />Создать копию упражнения</button>
      <button className={styles.danger} type="button" onClick={() => menuAction(onDelete)}><Trash2 size={18} aria-hidden="true" />Удалить из тренировки</button>
    </TrainerEditorSheet> : null}
  </article>;
}

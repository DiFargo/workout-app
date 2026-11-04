import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, History, ListOrdered, LockKeyhole, MoreVertical, Settings2, Trash2 } from "lucide-react";
import TrainerEditorSheet from "./TrainerEditorSheet.jsx";
import TrainerExerciseQuickFields from "./TrainerExerciseQuickFields.jsx";
import TrainerLibraryExercisePreview from "./TrainerLibraryExercisePreview.jsx";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety.js";
import { getUniformSetValue } from "../../utils/trainerQuickSets.js";
import { formatRussianCount } from "../../utils/russianCount.js";
import styles from "./TrainerClientProgramExerciseCard.module.css";

export default function TrainerClientProgramExerciseCard({
  exercise, index, readOnly = false, video, progressTitle, progressDetails,
  hasHistory = false, historyLoadError = false, onChange, onDetails,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown, onDelete, expanded = false, onToggle
}) {
  const panelId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = exercise.name || "Упражнение";
  const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
  const usesWeight = exerciseUsesExternalWeight(exercise);
  const reps = getUniformSetValue(sets, "reps");
  const weight = getUniformSetValue(sets, "weight");
  const varied = reps === null || (usesWeight && weight === null);
  const restValue = String(exercise.rest || "").trim();
  const rest = /^\d+(?:[.,]\d+)?$/.test(restValue)
    ? `${restValue} с`
    : restValue.replace(/\s*сек\.?$/i, " с");
  const summary = sets.length ? [
    formatRussianCount(sets.length, ["подход", "подхода", "подходов"]),
    varied ? "разная нагрузка" : `${reps || "—"} повт.`,
    !varied && usesWeight && weight !== "" ? `${weight} кг` : "",
    rest ? `отдых ${rest}` : ""
  ].filter(Boolean).join(" · ") : "Нагрузка пока не настроена";
  const runMenuAction = (action) => {
    setMenuOpen(false);
    action?.();
  };

  return <div className={`${styles.root}${expanded ? ` ${styles.open}` : ""}`} data-client-program-exercise-card={exercise.id}>
    <div className={styles.header}>
      <span className={styles.number} aria-label={`Упражнение ${index + 1}`}>{index + 1}</span>
      <span className={styles.preview}><TrainerLibraryExercisePreview video={video} previewTime={exercise.videoPosterTime} poster={exercise.image || exercise.thumbnail} /></span>
      <button className={styles.toggle} type="button" onClick={onToggle}
        aria-expanded={expanded} aria-controls={panelId}
        aria-label={`${expanded ? "Свернуть нагрузку" : readOnly ? "Посмотреть нагрузку" : "Настроить нагрузку"}: ${name}`}>
        <span><strong>{name}</strong><small>{readOnly ? <><LockKeyhole size={12} aria-hidden="true" />Только просмотр</> : expanded ? "Настройка нагрузки" : "Нажмите, чтобы настроить"}</small></span>
        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      <button type="button" className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label={`Действия: ${name}`}><MoreVertical size={18} aria-hidden="true" /></button>
    </div>
    {!expanded ? <p className={styles.summary}>{summary}</p> : null}
    <div id={panelId} className={styles.panel} hidden={!expanded}>
      <p className={styles.planLabel}>План на тренировку</p>
      <TrainerExerciseQuickFields className={styles.fields} exercise={exercise} disabled={readOnly} compactLabels onChange={onChange} onDetails={onDetails} />
      <div className={styles.panelFooter}>
        <p>{varied ? "Нагрузка различается — настройте каждый подход отдельно." : "Вес и повторы — для всех подходов."}</p>
        <button type="button" onClick={onDetails}><ListOrdered size={16} aria-hidden="true" />{readOnly ? "Посмотреть подходы" : "По подходам и параметры"}</button>
      </div>
    </div>
    <details className={styles.history} hidden={!expanded}>
      <summary><History size={16} aria-hidden="true" /><span>{historyLoadError ? hasHistory ? "История загружена не полностью" : "История не загружена" : "История выполнения"}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className={styles.historyBody}>
        <p>{progressTitle || (historyLoadError ? "Не удалось загрузить историю выполнения." : "Истории выполнения пока нет.")}</p>
        {hasHistory && progressDetails ? <p>{progressDetails}</p> : null}
        <small>Это прошлые результаты, а не план этой тренировки.</small>
      </div>
    </details>
    {menuOpen ? <TrainerEditorSheet title="Действия с упражнением" className={styles.sheet} bodyClassName={styles.sheetBody} onClose={() => setMenuOpen(false)}>
      <p>{name}</p>
      <button type="button" onClick={() => runMenuAction(onDetails)}><Settings2 size={18} aria-hidden="true" />{readOnly ? "Посмотреть параметры" : "По подходам и параметры"}</button>
      <button type="button" disabled={readOnly || !canMoveUp} onClick={() => runMenuAction(onMoveUp)}><ArrowUp size={18} aria-hidden="true" />Переместить выше</button>
      <button type="button" disabled={readOnly || !canMoveDown} onClick={() => runMenuAction(onMoveDown)}><ArrowDown size={18} aria-hidden="true" />Переместить ниже</button>
      <button className={styles.danger} type="button" disabled={readOnly} onClick={() => runMenuAction(onDelete)}><Trash2 size={18} aria-hidden="true" />Удалить из тренировки</button>
    </TrainerEditorSheet> : null}
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import TrainerEditorSheet from "./TrainerEditorSheet";
import TrainerExerciseLibrarySearch from "./TrainerExerciseLibrarySearch";
import ProtectedExerciseVideo from "../media/ProtectedExerciseVideo.jsx";
import { sanitizeExerciseSetPatch, sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput.js";
import { formatRussianCount } from "../../utils/russianCount.js";
import styles from "./TrainerClientExerciseSheet.module.css";

export default function TrainerClientExerciseSheet({
  enabled, onClose, children, exercise, video, libraryItems, readOnly = false,
  onSelectExercise, onOpenLibrary, onUpdate, onUpdateSet, onAddSet, onRemoveSet, onDelete
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const contentRef = useRef(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const dialog = contentRef.current?.closest("dialog");
    if (!dialog) return undefined;
    const viewport = window.visualViewport;
    let frame = 0;
    let revealFocus = false;
    const sync = () => {
      dialog.style.setProperty("--exercise-sheet-visible-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty("--exercise-sheet-visible-top", `${viewport?.offsetTop ?? 0}px`);
      if (revealFocus && dialog.contains(document.activeElement) && document.activeElement?.matches("input")) {
        document.activeElement.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      revealFocus = false;
    };
    const schedule = (reveal) => {
      revealFocus ||= reveal;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const resize = () => schedule(true);
    const scroll = () => schedule(false);
    sync();
    window.addEventListener("resize", resize);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", scroll);
    dialog.addEventListener("focusin", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", scroll);
      dialog.removeEventListener("focusin", resize);
    };
  }, [enabled]);
  if (!enabled) return children;
  const sets = Array.isArray(exercise.sets) && exercise.sets.length ? exercise.sets : [{ reps: "", weight: "" }];
  const usesWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;

  return <TrainerEditorSheet title="Настройки упражнения" onClose={onClose}
    className={styles.sheet} bodyClassName={styles.body}
    footer={<><span>{readOnly ? "Выполненная тренировка — только просмотр." : "Правки пока в черновике. Сохраните программу, чтобы применить."}</span><button type="button" onClick={onClose}>{readOnly ? "Закрыть" : "К программе"}</button></>}>
    {readOnly ? <p className={styles.readOnly} role="status">Эта тренировка уже выполнена. Её нагрузка и история не меняются.</p> : null}
    <section ref={contentRef} className={styles.group} aria-label="Выбор упражнения">
      <TrainerExerciseLibrarySearch exercise={exercise} items={libraryItems} disabled={readOnly}
        label="Упражнение из библиотеки" onSelect={onSelectExercise} onOpenLibrary={onOpenLibrary} />
    </section>

    <section className={styles.group} aria-label="Нагрузка по подходам">
      <div className={styles.sectionHeading}><h3>Нагрузка по подходам</h3><span>{formatRussianCount(sets.length, ["подход", "подхода", "подходов"])}</span></div>
      <div className={styles.setLegend} aria-hidden="true"><span>№</span><span>Повторы</span><span>Вес, кг</span><span /></div>
      {sets.map((set, index) => <div className={styles.setRow} key={set.id || index}>
        <span className={styles.number}>{index + 1}</span>
        <input aria-label={`Повторы, подход ${index + 1}`} inputMode="numeric" value={set.reps ?? ""} disabled={readOnly}
          onChange={event => onUpdateSet(index, { reps: event.target.value })} />
        <input aria-label={`Вес, подход ${index + 1}`} inputMode="decimal" value={sanitizeExerciseWeightInput(set.weight) ?? ""} disabled={readOnly || !usesWeight}
          onChange={event => onUpdateSet(index, sanitizeExerciseSetPatch({ weight: event.target.value }))} />
        <button className={styles.removeSet} type="button" disabled={readOnly || sets.length <= 1} aria-label={`Удалить подход ${index + 1}`} onClick={() => onRemoveSet(index)}><Trash2 size={17} aria-hidden="true" /></button>
      </div>)}
      <button className={styles.addSet} type="button" disabled={readOnly} onClick={onAddSet}><Plus size={18} aria-hidden="true" />Добавить подход</button>
    </section>

    <section className={styles.group} aria-label="Отдых и вес">
      <label className={styles.rest}><span>Отдых между подходами</span><input aria-label="Отдых между подходами" inputMode="numeric" value={exercise.rest || ""} placeholder="90 сек" disabled={readOnly} onChange={event => onUpdate({ rest: event.target.value })} /></label>
      <label className={styles.weightToggle}><span><strong>Учитывать вес</strong><small>Выключите для упражнения без отягощения.</small></span><input type="checkbox" checked={usesWeight} disabled={readOnly} onChange={event => onUpdate({ requiresWeight: event.target.checked, usesWeight: event.target.checked })} /></label>
    </section>

    <details className={styles.videoGroup} onToggle={event => setVideoOpen(event.currentTarget.open)}>
      <summary><span>Видео упражнения<small>{video ? "Посмотреть технику выполнения" : "Видео не добавлено"}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={styles.videoBody}>
        {video && videoOpen ? <ProtectedExerciseVideo key={video} src={video} previewTime={exercise.videoPosterTime} poster={exercise.image || exercise.thumbnail || undefined}
          controls playsInline preload="metadata" aria-label={`Видео: ${exercise.name || "упражнение"}`} data-testid="trainer-program-exercise-video" /> : null}
        <p>Видео и превью меняются в библиотеке упражнений.</p>
      </div>
    </details>

    <div className={styles.dangerZone}><button type="button" disabled={readOnly} onClick={onDelete}><Trash2 size={17} aria-hidden="true" />Удалить из тренировки</button><p>В библиотеке и истории упражнение останется.</p></div>
  </TrainerEditorSheet>;
}

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import styles from "./TrainerClientWorkoutPlan.module.css";

export default function TrainerClientExerciseSheet({ enabled, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { if (!enabled) return; const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, [enabled]);
  if (!enabled) return children;
  return <dialog ref={ref} className={styles.clientExerciseSheet} aria-label="Настройки упражнения" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <header><h2>Настройки упражнения</h2><button type="button" aria-label="Закрыть настройки упражнения" onClick={onClose}><X size={20} /></button></header>
    <div className={styles.clientExerciseSheetBody}>{children}</div>
    <footer><span>Изменения применятся после сохранения программы</span><button type="button" onClick={onClose}>Готово</button></footer>
  </dialog>;
}

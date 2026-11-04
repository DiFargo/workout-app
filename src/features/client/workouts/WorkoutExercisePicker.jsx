import { useId } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, X } from "lucide-react";
import styles from "./WorkoutExercisePicker.module.css";

const STATUS_LABELS = {
  completed: "Выполнено",
  partial: "Не завершено",
  pending: "Не начато"
};

// This controlled sheet only selects an execution-step index. The caller owns
// navigation guards, unfinished sets and closing after an accepted selection.
// AppBootstrap's useModalFocusTrap owns focus, inert background and body locking.
export default function WorkoutExercisePicker({ open = false, items = [], onClose, onSelectStep }) {
  const titleId = useId();
  if (!open || typeof document === "undefined") return null;
  const rows = Array.isArray(items) ? items : [];

  return createPortal(
    <div
      className={styles.overlay}
      data-modal-backdrop="true"
      data-testid="workout-exercise-picker-backdrop"
      onClick={onClose}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-modal-surface="true"
        data-testid="workout-exercise-picker"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
        }}
      >
        <header className={styles.header}>
          <h2 id={titleId}>Упражнения тренировки</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть список упражнений">
            <X aria-hidden="true" />
          </button>
        </header>
        <ul className={styles.list} aria-label="Выбрать упражнение">
          {rows.map((item, index) => {
            const validStep = Number.isInteger(item.stepIndex) && item.stepIndex > 0;
            const statusLabel = STATUS_LABELS[item.status] || "";
            return (
              <li key={item.key ?? item.stepIndex}>
                <button
                  type="button"
                  className={`${styles.row} ${item.current ? styles.current : ""}`}
                  data-testid="workout-exercise-picker-item"
                  data-step-index={item.stepIndex}
                  aria-current={item.current ? "step" : undefined}
                  disabled={!validStep}
                  onClick={() => onSelectStep?.(item.stepIndex)}
                >
                  <span className={`${styles.number} ${item.status === "completed" ? styles.completed : ""}`} aria-hidden="true">
                    {item.status === "completed" ? <Check /> : index + 1}
                  </span>
                  <span className={styles.copy}>
                    <span className={styles.title}>{item.title || "Упражнение"}</span>
                    {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
                    <span className={styles.meta}>
                      {item.current ? <span className={styles.currentLabel}>Сейчас</span> : null}
                      {statusLabel ? <span>{statusLabel}</span> : null}
                    </span>
                  </span>
                  <ChevronRight className={styles.chevron} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {rows.length === 0 ? <li className={styles.empty}>В этой тренировке пока нет упражнений.</li> : null}
        </ul>
        <p className={styles.hint}>Переход не отмечает подходы выполненными.</p>
      </section>
    </div>,
    document.body
  );
}

import { GraduationCap, MessageSquare, RefreshCw } from "lucide-react";

import styles from "./BasicWorkoutExerciseExplainer.module.css";

const EXPLAINER_ACTIONS = [
  { id: "technique", label: "Техника", Icon: GraduationCap },
  { id: "swap", label: "Заменить", Icon: RefreshCw },
  { id: "note", label: "Заметки", Icon: MessageSquare }
];

export default function BasicWorkoutExerciseExplainer({
  children,
  onOpenTechnique,
  onOpenSwap,
  onOpenNote,
  isNoteOpen = false
}) {
  return (
    <section className={styles.explainer} data-testid="basic-workout-exercise-explainer" aria-label="Материалы к упражнению">
      <div className={styles.content}>{children}</div>

      <nav className={styles.tabs} aria-label="Действия с упражнением">
        {EXPLAINER_ACTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${id === "note" && isNoteOpen ? styles.activeTab : ""}`}
            aria-label={id === "swap"
              ? "Заменить упражнение"
              : id === "note"
                ? "Открыть заметку тренеру"
                : `Открыть раздел «${label}»`}
            aria-pressed={id === "note" ? isNoteOpen : undefined}
            disabled={id === "swap" && !onOpenSwap}
            onClick={(event) => {
              event.stopPropagation();
              if (id === "technique") onOpenTechnique?.(event);
              if (id === "swap") onOpenSwap?.();
              if (id === "note") onOpenNote?.(event);
            }}
            onTouchStart={(event) => event.stopPropagation()}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}

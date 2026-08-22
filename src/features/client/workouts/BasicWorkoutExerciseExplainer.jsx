import { useState } from "react";
import { BicepsFlexed, RefreshCw } from "lucide-react";

import { getBasicWorkoutExercisePresentation } from "../../../utils/basicWorkoutExercisePresentation.js";
import BasicWorkoutExerciseIllustration from "./BasicWorkoutExerciseIllustration.jsx";
import styles from "./BasicWorkoutExerciseExplainer.module.css";

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="4" />
      <path d="m10 9 5 3-5 3z" />
    </svg>
  );
}

const EXPLAINER_TABS = [
  { id: "video", label: "Видео", Icon: VideoIcon },
  { id: "muscles", label: "Мышцы", Icon: BicepsFlexed },
  { id: "swap", label: "Заменить", Icon: RefreshCw }
];

export default function BasicWorkoutExerciseExplainer({ children, exercise, onOpenSwap }) {
  const [activeTab, setActiveTab] = useState("video");
  const presentation = getBasicWorkoutExercisePresentation(exercise);

  return (
    <section className={styles.explainer} data-testid="basic-workout-exercise-explainer" aria-label="Материалы к упражнению">
      <div className={`${styles.content} ${activeTab === "video" ? styles.videoContent : styles.referenceContent}`}>
        {activeTab === "video" ? children : (
          <div className={`${styles.referenceCard} ${styles.muscleReferenceCard}`}>
            <div className={styles.referenceCopy}>
              <span>Что работает</span>
              <h2>{presentation.title}</h2>
            </div>
            <BasicWorkoutExerciseIllustration exercise={exercise} presentation={presentation} />
            <p>
              <strong>Основные:</strong> {presentation.primaryMuscles.join(" · ")}
              {presentation.secondaryMuscles.length ? (
                <>
                  <br />
                  <span>Дополнительно: {presentation.secondaryMuscles.join(" · ")}</span>
                </>
              ) : null}
            </p>
          </div>
        )}
      </div>

      <nav className={styles.tabs} aria-label="Разделы упражнения">
        {EXPLAINER_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${activeTab === id ? styles.activeTab : ""}`}
            aria-label={id === "swap" ? "Заменить упражнение" : label}
            aria-pressed={id === "swap" ? undefined : activeTab === id}
            disabled={id === "swap" && !onOpenSwap}
            onClick={(event) => {
              event.stopPropagation();
              if (id === "swap") {
                onOpenSwap?.();
                return;
              }
              setActiveTab(id);
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

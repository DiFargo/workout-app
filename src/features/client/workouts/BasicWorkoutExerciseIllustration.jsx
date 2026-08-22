import { useState } from "react";
import {
  getBasicWorkoutGroupIllustrationSource,
  getBasicWorkoutMannequinIllustrationSource
} from "../../../utils/basicWorkoutMannequinIllustration.js";
import styles from "./BasicWorkoutExerciseExplainer.module.css";

export default function BasicWorkoutExerciseIllustration({ exercise, presentation }) {
  const sourceCandidates = [
    presentation?.imageUrl,
    exercise?.basicExerciseImageUrl,
    exercise?.imageUrl,
    exercise?.image,
    exercise?.thumbnail,
    getBasicWorkoutMannequinIllustrationSource(exercise, presentation, { allowGroupFallback: false }),
    getBasicWorkoutGroupIllustrationSource(exercise, presentation),
    getBasicWorkoutMannequinIllustrationSource(exercise, presentation)
  ]
    .map((source) => String(source || "").trim())
    .filter((source, index, allSources) => source && allSources.indexOf(source) === index);
  const sourceKey = `${exercise?.id || "exercise"}:${sourceCandidates.join("|")}`;
  const [failureState, setFailureState] = useState({ key: "", sources: [] });
  const failedSources = failureState.key === sourceKey ? failureState.sources : [];
  const source = sourceCandidates.find((candidate) => !failedSources.includes(candidate));

  if (!source) {
    return (
      <div
        className={styles.exerciseIllustrationFallback}
        role="img"
        aria-label="Схема мышц пока недоступна"
        data-testid="basic-workout-exercise-illustration-fallback"
      >
        <span aria-hidden="true">✦</span>
        <strong>Схема мышц пока недоступна</strong>
      </div>
    );
  }

  return (
    <img
      className={styles.exerciseIllustration}
      src={source}
      alt={`Иллюстрация упражнения: ${presentation?.title || "работающие мышцы"}`}
      data-testid="basic-workout-exercise-illustration"
      decoding="async"
      loading="lazy"
      onError={() => {
        setFailureState((current) => {
          const previousSources = current.key === sourceKey ? current.sources : [];
          if (previousSources.includes(source)) return current;
          return { key: sourceKey, sources: [...previousSources, source] };
        });
      }}
    />
  );
}

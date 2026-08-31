import styles from "./WorkoutStageActionPanel.module.css";

export default function WorkoutStageActionPanel({
  isLastExercise,
  isWarmup,
  onNext,
  onPrevious,
  onWarmupBack
}) {
  if (isWarmup) {
    return (
      <div
        className={`${styles.panel} ${styles.warmupPanel}`}
        data-css-module-scope="workout-stage-action-panel"
      >
        <div className={`${styles.navigationRow} ${styles.warmupNavigationRow}`}>
          <button
            type="button"
            className={`${styles.button} ${styles.warmupPreviousButton}`}
            data-css-module-control="workout-stage-action-panel"
            onClick={onWarmupBack}
          >
            Назад
          </button>

          <button
            type="button"
            className={`${styles.button} ${styles.warmupReadyButton}`}
            data-css-module-control="workout-stage-action-panel"
            onClick={onNext}
          >
            Начать тренировку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.panel} ${styles.exercisePanel}`}
      data-css-module-scope="workout-stage-action-panel"
    >
      <div className={`${styles.navigationRow} ${styles.exerciseNavigationRow}`}>
        <button
          type="button"
          className={`${styles.button} ${styles.exercisePrevButton}`}
          data-css-module-control="workout-stage-action-panel"
          onClick={onPrevious}
        >
          Предыдущее
        </button>

        <button
          type="button"
          className={`${styles.button} ${styles.exerciseNextButton}`}
          data-css-module-control="workout-stage-action-panel"
          onClick={onNext}
        >
          {isLastExercise ? "Завершить" : "Следующее"}
        </button>
      </div>
    </div>
  );
}

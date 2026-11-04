import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./WorkoutStageActionPanel.module.css";

export default function WorkoutStageActionPanel({
  isLastExercise,
  isWarmup,
  onNext,
  onPrevious,
  onWarmupBack,
  primaryAction,
  onPrimaryAction,
  primaryActionDisabled = false,
  skippingRest = false,
  children
}) {
  if (isWarmup) {
    return (
      <div
        className={`${styles.panel} ${styles.warmupPanel}`}
        data-css-module-scope="workout-stage-action-panel"
      >
        {children}
        <div className={`${styles.navigationRow} ${styles.warmupNavigationRow}`}>
          <button
            type="button"
            className={`${styles.button} ${styles.warmupPreviousButton}`}
            data-css-module-control="workout-stage-action-panel"
            onClick={onWarmupBack}
          >
            <ChevronLeft aria-hidden="true" />Назад
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
      className={`${styles.panel} ${styles.exercisePanel} ${primaryAction ? styles.dynamicPanel : ""}`}
      data-css-module-scope="workout-stage-action-panel"
    >
      {children}
      <div className={`${styles.navigationRow} ${styles.exerciseNavigationRow}`}>
        {primaryAction ? <button
          type="button"
          className={`${styles.button} ${styles.exerciseNextButton} ${styles.dynamicButton}`}
          data-testid="workout-primary-action"
          data-action={primaryAction.kind}
          data-css-module-control="workout-stage-action-panel"
          disabled={primaryActionDisabled || primaryAction.disabled}
          onClick={onPrimaryAction}
          aria-label={primaryAction.label}
          aria-description={skippingRest ? "Переход с пропуском оставшегося отдыха" : undefined}
        >
          <span className={styles.dynamicCopy}>
            <span>{primaryAction.label}</span>
            {skippingRest ? <small>Пропустить остаток отдыха</small> : null}
          </span>
          {primaryAction.kind !== "complete" ? <ChevronRight aria-hidden="true" /> : null}
        </button> : <>
        <button
          type="button"
          className={`${styles.button} ${styles.exercisePrevButton}`}
          data-css-module-control="workout-stage-action-panel"
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" />Предыдущее
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.exerciseNextButton}`}
          data-css-module-control="workout-stage-action-panel"
          onClick={onNext}
        >
          {isLastExercise ? "Завершить" : "Следующее"}
          <ChevronRight aria-hidden="true" />
        </button>
        </>}
      </div>
    </div>
  );
}

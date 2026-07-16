import styles from "./WorkoutWarmupStage.module.css";

export function WorkoutWarmupHeader({ completedStepsCount, dayLabel, stepCount }) {
  return (
    <header className={styles.planHeader} data-css-module-scope="workout-warmup">
      <div className={styles.planMeta}>
        <span className={styles.planBadge}>Подготовка</span>
        <span className={styles.planWorkout}>{dayLabel}</span>
      </div>
      <span className={styles.planAccent} aria-hidden="true" />
      <span className={styles.planSummary}>
        {completedStepsCount} из {stepCount} шагов · около 5 минут
      </span>
    </header>
  );
}

export function WorkoutWarmupBody({
  completedSteps,
  onSetTimerPreset,
  onToggleStep,
  onToggleTimer,
  timerDuration,
  timerRunning,
  timerSeconds,
  timerText,
  warmupSteps
}) {
  return (
    <div className={styles.hero} data-css-module-scope="workout-warmup">
      <div className={styles.intro}>
        <span className={styles.introMarker} aria-hidden="true">i</span>
        <div>
          <strong>Подготовь тело к нагрузке</strong>
          <p>Разогрей суставы и подготовься к рабочим подходам.</p>
        </div>
      </div>

      <div className={styles.steps}>
        {warmupSteps.map((step, stepIndex) => {
          const completed = completedSteps.includes(stepIndex);

          return (
            <button
              type="button"
              className={`${styles.item} ${completed ? styles.completed : ""}`}
              data-css-module-control="workout-warmup"
              key={step.title}
              onClick={() => onToggleStep(stepIndex)}
            >
              <span className={styles.itemMarker} aria-hidden="true">
                {completed ? "✓" : String(stepIndex + 1).padStart(2, "0")}
              </span>
              <span className={styles.itemContent}>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.timer}>
        <div className={styles.timerSummary}>
          <span>Таймер разминки</span>
          <strong>{timerText}</strong>
        </div>
        <div className={styles.timerControls}>
          {[180, 300].map((seconds) => (
            <button
              type="button"
              className={`${styles.timerButton} ${timerDuration === seconds ? styles.timerButtonActive : ""}`}
              data-css-module-control="workout-warmup"
              aria-pressed={timerDuration === seconds}
              key={seconds}
              onClick={() => onSetTimerPreset(seconds)}
            >
              {seconds / 60} мин
            </button>
          ))}
          <button
            type="button"
            className={styles.timerButton}
            data-css-module-control="workout-warmup"
            onClick={onToggleTimer}
          >
            {timerRunning ? "Пауза" : timerSeconds < timerDuration ? "Продолжить" : "Старт"}
          </button>
        </div>
      </div>
    </div>
  );
}

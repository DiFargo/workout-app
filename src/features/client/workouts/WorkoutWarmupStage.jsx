export function WorkoutWarmupHeader({ completedStepsCount, dayLabel, stepCount }) {
  return (
    <header className="warmupPlanHeader">
      <div className="warmupPlanMeta">
        <span className="warmupPlanBadge">Подготовка</span>
        <span className="warmupPlanWorkout">{dayLabel}</span>
      </div>
      <span className="warmupPlanAccent" aria-hidden="true" />
      <span className="warmupPlanSummary">
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
    <div className="warmupExerciseHero">
      <div className="warmupExerciseIntro">
        <span aria-hidden="true">i</span>
        <div>
          <strong>Подготовь тело к нагрузке</strong>
          <p>Разогрей суставы и подготовься к рабочим подходам.</p>
        </div>
      </div>

      <div className="warmupExerciseSteps">
        {warmupSteps.map((step, stepIndex) => {
          const completed = completedSteps.includes(stepIndex);

          return (
            <button
              type="button"
              className={`warmupExerciseItem ${completed ? "completed" : ""}`}
              key={step.title}
              onClick={() => onToggleStep(stepIndex)}
            >
              <span aria-hidden="true">
                {completed ? "✓" : String(stepIndex + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="warmupTimer">
        <div>
          <span>Таймер разминки</span>
          <strong>{timerText}</strong>
        </div>
        <div className="warmupTimerControls">
          {[180, 300].map((seconds) => (
            <button
              type="button"
              className={timerDuration === seconds ? "active" : ""}
              key={seconds}
              onClick={() => onSetTimerPreset(seconds)}
            >
              {seconds / 60} мин
            </button>
          ))}
          <button type="button" onClick={onToggleTimer}>
            {timerRunning ? "Пауза" : timerSeconds < timerDuration ? "Продолжить" : "Старт"}
          </button>
        </div>
      </div>
    </div>
  );
}

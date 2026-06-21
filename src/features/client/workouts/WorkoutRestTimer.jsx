export default function WorkoutRestTimer({
  activeDuration,
  onAddTime,
  onSkip,
  onStart,
  timerText
}) {
  return (
    <div className="workoutRestTimer">
      <div>
        <span>Отдых между подходами</span>
        <strong>{timerText}</strong>
      </div>
      <div>
        {[60, 90, 120].map((seconds) => (
          <button
            type="button"
            className={activeDuration === seconds ? "active" : ""}
            key={seconds}
            onClick={() => onStart(seconds)}
          >
            {seconds}
          </button>
        ))}
        <button type="button" onClick={onAddTime}>
          +30
        </button>
        <button type="button" onClick={onSkip}>
          Пропустить
        </button>
      </div>
    </div>
  );
}

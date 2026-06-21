export default function WorkoutStageActionPanel({
  isLastExercise,
  isWarmup,
  onNext,
  onPrevious,
  onWarmupBack
}) {
  if (isWarmup) {
    return (
      <div className="warmupBottomPanel workoutStageActionPanel">
        <div className="warmupNavigationRow">
          <button
            type="button"
            className="warmupPreviousButton"
            onClick={onWarmupBack}
          >
            Назад
          </button>

          <button
            type="button"
            className="warmupReadyButton"
            onClick={onNext}
          >
            Начать тренировку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exerciseActionPanel workoutStageActionPanel">
      <div className="exerciseNavigationRow">
        <button
          type="button"
          className="exercisePrevButton"
          onClick={onPrevious}
        >
          Назад
        </button>

        <button
          type="button"
          className="exerciseNextButton"
          onClick={onNext}
        >
          {isLastExercise ? "К итогам" : "Далее"}
        </button>
      </div>
    </div>
  );
}

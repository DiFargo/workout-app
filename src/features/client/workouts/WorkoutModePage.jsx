export default function WorkoutModePage({
  appVersion,
  workoutModeRemember,
  renderClientMainBottomBar,
  canUseTrainerFeatures,
  onBackToMain,
  onOpenBasicWorkoutQuiz,
  onOpenIndividualWorkouts,
  onToggleWorkoutModeRemember,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  return (
    <div className="workoutModePage">
      <div className="appVersionBadge clientPageVersionBadge">{appVersion}</div>
      <button className="workoutModeBack" type="button" onClick={onBackToMain}>
        ←
      </button>

      <section className="workoutModeHero">
        <span>ТРЕНИРОВКИ</span>
        <h1>Режим запуска</h1>
        <p>Можно тренироваться по базовой программе или по индивидуальному плану от тренера.</p>
      </section>

      <section className="workoutModeCards">
        <button className="workoutModeCard" type="button" onClick={onOpenBasicWorkoutQuiz}>
          <span className="workoutModeIcon">Б</span>
          <div>
            <strong>Базовые тренировки</strong>
            <small>Короткий опрос и готовый план из базы приложения.</small>
          </div>
          <i>›</i>
          </button>

        <button className="workoutModeCard premium" type="button" onClick={onOpenIndividualWorkouts}>
          <span className="workoutModeIcon">И</span>
          <div>
            <strong>Индивидуальный план</strong>
            <small>Тренировки, которые создал и назначил тренер.</small>
          </div>
          <i>›</i>
        </button>
      </section>

      <label className="workoutModeRemember">
        <input
          type="checkbox"
          checked={workoutModeRemember}
          onChange={(event) => onToggleWorkoutModeRemember(event.target.checked)}
        />
        <span>Запомнить выбор и больше не спрашивать</span>
      </label>

      {renderClientMainBottomBar?.(
        "workouts",
        {
          className: "mainMenuBottomBar profileBottomTabBar workoutModeBottomBar",
          isTrainerMode: canUseTrainerFeatures,
          onGoMain: onBackToMain,
          onOpenTraining,
          onOpenNutrition,
          onOpenCabinet,
          onOpenTrainerClients,
          onOpenTrainerPrograms,
          onLoadTrainerCabinet
        }
      )}
    </div>
  );
}

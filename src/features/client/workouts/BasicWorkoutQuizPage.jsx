import { buildBasicWorkoutPlanFromQuiz } from "../../../utils/basicWorkoutPlanBuilder";

export default function BasicWorkoutQuizPage({
  appVersion,
  renderClientMainBottomBar,
  basicWorkoutQuiz,
  onBasicWorkoutQuizChange,
  onGoBackToMode,
  onApplyBasicWorkoutPlan,
  canUseTrainerFeatures,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const previewPlan = buildBasicWorkoutPlanFromQuiz(basicWorkoutQuiz);

  return (
    <div className="basicQuizPage">
      <div className="appVersionBadge clientPageVersionBadge">{appVersion}</div>
      <button className="workoutModeBack" type="button" onClick={onGoBackToMode} aria-label="Назад к выбору режима">
        ←
      </button>

      <section className="workoutModeHero">
        <span>БАЗОВЫЕ ТРЕНИРОВКИ</span>
        <h1>Базовый подбор</h1>
        <p>Ответь на 3 вопроса — приложение предложит стартовый план тренировок.</p>
      </section>

      <section className="basicQuizCard">
        <label>
          <span>Цель</span>
          <select
            aria-label="Цель тренировки"
            value={basicWorkoutQuiz.goal}
            onChange={(event) => onBasicWorkoutQuizChange((prev) => ({ ...prev, goal: event.target.value }))}
          >
            <option value="muscle">Набрать мышцы</option>
            <option value="beginner">Начать тренироваться</option>
          </select>
        </label>

        <label>
          <span>Опыт</span>
          <select
            aria-label="Опыт тренировок"
            value={basicWorkoutQuiz.level}
            onChange={(event) => onBasicWorkoutQuizChange((prev) => ({ ...prev, level: event.target.value }))}
          >
            <option value="beginner">Новичок</option>
            <option value="middle">Уже тренировался</option>
          </select>
        </label>

        <label>
          <span>Сколько тренировок в неделю</span>
          <select
            aria-label="Тренировок в неделю"
            value={basicWorkoutQuiz.days}
            onChange={(event) => onBasicWorkoutQuizChange((prev) => ({ ...prev, days: event.target.value }))}
          >
            <option value="3">3 тренировки</option>
            <option value="4">4 тренировки</option>
          </select>
        </label>
      </section>

      <section className="basicQuizPreview">
        <span>Рекомендуемый план</span>
        <strong>{previewPlan.name}</strong>
        <p>{previewPlan.description}</p>
        <div>
          <b>{previewPlan.workouts.length}</b>
          <small>тренировки</small>
          <b>{previewPlan.workouts.reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0)}</b>
          <small>упражнений</small>
        </div>
      </section>

      <button className="basicQuizStartBtn" type="button" onClick={onApplyBasicWorkoutPlan}>
        Подобрать план
      </button>

      {renderClientMainBottomBar?.(
        "workouts",
        {
          className: "mainMenuBottomBar profileBottomTabBar workoutModeBottomBar",
          isTrainerMode: canUseTrainerFeatures,
          onGoMain,
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

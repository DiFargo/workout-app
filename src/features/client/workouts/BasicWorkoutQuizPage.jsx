import { useState } from "react";
import { Paperclip } from "lucide-react";

import { buildBasicWorkoutPlanFromQuiz } from "../../../utils/basicWorkoutPlanBuilder";
import { WorkoutModePickerDialog } from "./WorkoutListDialogs";

export default function BasicWorkoutQuizPage({
  renderClientMainBottomBar,
  workoutModePreference,
  workoutModeRemember,
  basicWorkoutQuiz,
  onBasicWorkoutQuizChange,
  onOpenIndividualWorkouts,
  onOpenBasicWorkouts,
  onApplyBasicWorkoutPlan,
  onToggleWorkoutModeRemember,
  canUseTrainerFeatures,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const [workoutModePickerOpen, setWorkoutModePickerOpen] = useState(false);
  const previewPlan = buildBasicWorkoutPlanFromQuiz(basicWorkoutQuiz);
  const resolvedWorkoutModePreference = workoutModePreference || { mode: "basic" };

  return (
    <div className="basicQuizPage">
      <header className="workoutModeTopBar basicQuizTopBar">
        <h1 className="workoutModeHeroTitle">Базовые тренировки</h1>
        <div className="workoutModeTopActions workoutHeaderActions">
          <button className="workoutModeTopButton workoutModeHeaderButton" type="button" onClick={() => setWorkoutModePickerOpen(true)} aria-label="Открыть режим запуска">
            <Paperclip aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="basicQuizCard">
        <div className="basicQuizSectionHeader">
          <span>БАЗОВЫЙ ПОДБОР</span>
          <h2>Подбор плана</h2>
          <p>Ответь на 3 вопроса — приложение предложит стартовый план тренировок.</p>
        </div>

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
        <div className="basicQuizPreviewStats">
          <span>
            <b>{previewPlan.workouts.length}</b>
            <small>тренировки</small>
          </span>
          <span>
            <b>{previewPlan.workouts.reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0)}</b>
            <small>упражнений</small>
          </span>
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

      <WorkoutModePickerDialog
        open={workoutModePickerOpen}
        workoutModePreference={resolvedWorkoutModePreference}
        rememberChoice={workoutModeRemember}
        onClose={() => setWorkoutModePickerOpen(false)}
        onOpenBasic={() => {
          setWorkoutModePickerOpen(false);
          onOpenBasicWorkouts();
        }}
        onOpenIndividual={() => {
          setWorkoutModePickerOpen(false);
          onOpenIndividualWorkouts();
        }}
        onRememberChoiceChange={onToggleWorkoutModeRemember}
      />
    </div>
  );
}

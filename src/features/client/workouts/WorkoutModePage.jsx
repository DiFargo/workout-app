import { useState } from "react";
import { Home, Paperclip } from "lucide-react";
import { WorkoutModePickerDialog } from "./WorkoutListDialogs";

export default function WorkoutModePage({
  workoutModePreference,
  workoutModeRemember,
  renderClientMainBottomBar,
  canUseTrainerFeatures,
  onBackToMain,
  onOpenBasicWorkouts,
  onOpenIndividualWorkouts,
  onToggleWorkoutModeRemember,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const [workoutModePickerOpen, setWorkoutModePickerOpen] = useState(false);
  const resolvedWorkoutModePreference = workoutModePreference || { mode: "individual" };

  return (
    <div className="workoutModePage">
      <header className="workoutModeTopBar">
        <section className="workoutModeHero">
          <span>ТРЕНИРОВКИ</span>
          <h1>Режим запуска</h1>
        </section>
        <div className="workoutModeTopActions">
          <button className="workoutModeTopButton" type="button" onClick={onBackToMain} aria-label="Открыть главную">
            <Home aria-hidden="true" />
          </button>
          <button className="workoutModeTopButton" type="button" onClick={() => setWorkoutModePickerOpen(true)} aria-label="Выбрать режим запуска тренировки">
            <Paperclip aria-hidden="true" />
          </button>
        </div>
      </header>

      <p className="workoutModeLead">
        Можно тренироваться по базовой программе или по индивидуальному плану от тренера.
      </p>

      <section className="workoutModeCards">
        <button className="workoutModeCard" type="button" onClick={onOpenBasicWorkouts}>
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

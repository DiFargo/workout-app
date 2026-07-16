import { useState } from "react";
import { Home, Paperclip } from "lucide-react";
import { WorkoutModePickerDialog } from "./WorkoutListDialogs";
import styles from "./WorkoutModePage.module.css";

export default function WorkoutModePage({
  workoutModePreference,
  workoutModeRemember,
  onBackToMain,
  onOpenBasicWorkouts,
  onOpenIndividualWorkouts,
  onToggleWorkoutModeRemember,
}) {
  const [workoutModePickerOpen, setWorkoutModePickerOpen] = useState(false);
  const resolvedWorkoutModePreference = workoutModePreference || { mode: "individual" };

  return (
    <div className={styles.page} data-testid="workout-mode-page" data-css-module-scope="workout-mode">
      <header className={styles.topBar} data-testid="workout-mode-header">
        <section className={styles.hero} data-testid="workout-mode-hero">
          <span>ТРЕНИРОВКИ</span>
          <h1>Режим запуска</h1>
        </section>
        <div className={styles.topActions}>
          <button className={styles.topButton} type="button" onClick={onBackToMain} aria-label="Открыть главную">
            <Home aria-hidden="true" />
          </button>
          <button className={styles.topButton} type="button" onClick={() => setWorkoutModePickerOpen(true)} aria-label="Выбрать режим запуска тренировки">
            <Paperclip aria-hidden="true" />
          </button>
        </div>
      </header>

      <p className={styles.lead} data-testid="workout-mode-lead">
        Можно тренироваться по базовой программе или по индивидуальному плану от тренера.
      </p>

      <section className={styles.cards} data-testid="workout-mode-cards">
        <button className={styles.card} data-testid="workout-mode-card" type="button" onClick={onOpenBasicWorkouts}>
          <span className={styles.icon}>Б</span>
          <div>
            <strong>Базовые тренировки</strong>
            <small>Короткий опрос и готовый план из базы приложения.</small>
          </div>
          <i>›</i>
        </button>

        <button className={[styles.card, styles.premium].join(" ")} data-testid="workout-mode-card" type="button" onClick={onOpenIndividualWorkouts}>
          <span className={styles.icon}>И</span>
          <div>
            <strong>Индивидуальный план</strong>
            <small>Тренировки, которые создал и назначил тренер.</small>
          </div>
          <i>›</i>
        </button>
      </section>

      <label className={styles.remember} data-testid="workout-mode-remember">
        <input
          type="checkbox"
          checked={workoutModeRemember}
          onChange={(event) => onToggleWorkoutModeRemember(event.target.checked)}
        />
        <span>Запомнить выбор и больше не спрашивать</span>
      </label>


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

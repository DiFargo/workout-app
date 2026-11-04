import styles from "./WorkoutSectionNavigation.module.css";

export default function WorkoutSectionNavigation({ active, onOpenWorkouts, onOpenPlan, onOpenHistory }) {
  return (
    <nav className={styles.navigation} aria-label="Раздел тренировок">
      {[
        ["workouts", "Обзор", onOpenWorkouts],
        ["plan", "План", onOpenPlan],
        ["history", "История", onOpenHistory]
      ].map(([key, label, onClick]) => (
        <button key={key} type="button" aria-current={active === key ? "page" : undefined} onClick={onClick}>
          {label}
        </button>
      ))}
    </nav>
  );
}

import styles from "./BasicWorkoutFormatSwitcher.module.css";

export default function BasicWorkoutFormatSwitcher({ mode, onToday, onMonth }) {
  return <nav className={styles.switcher} aria-label="Формат базовой тренировки" data-testid="basic-workout-plan-switcher">
    <button type="button" aria-current={mode === "today" ? "page" : undefined} onClick={mode === "today" ? undefined : onToday}>
      Сейчас
    </button>
    <button type="button" aria-current={mode === "month" ? "page" : undefined} onClick={mode === "month" ? undefined : onMonth}>
      На месяц
    </button>
  </nav>;
}

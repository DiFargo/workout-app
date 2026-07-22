import { Clock3, Play, Square } from "lucide-react";
import { formatCompactTimer } from "../../../domain/workoutPresentation";
import styles from "./WorkoutRestTimer.module.css";

export default function WorkoutRestTimer({
  duration = 90,
  running,
  seconds = 0,
  onStart,
  onSecondsChange,
  onRunningChange
}) {
  const shownSeconds = seconds > 0 ? seconds : duration;
  const primaryActionLabel = running ? "Стоп" : seconds > 0 ? "Продолжить" : "Старт";
  const primaryActionAriaLabel = running
    ? "Остановить таймер отдыха"
    : seconds > 0
      ? "Продолжить таймер отдыха"
      : "Запустить таймер отдыха";

  function toggleTimer() {
    if (running) {
      onRunningChange?.(false);
      return;
    }

    if (seconds > 0) {
      onRunningChange?.(true);
      return;
    }

    onStart?.(duration);
  }

  function changeSeconds(delta) {
    const next = Math.max(0, shownSeconds + delta);
    onSecondsChange?.(next);
    onRunningChange?.(next > 0);
  }

  return (
    <section className={styles.root} data-testid="workout-rest-timer">
      <Clock3 aria-hidden="true" />
      <button type="button" className={styles.timer} onClick={toggleTimer} aria-label={primaryActionAriaLabel}>
        <small>Таймер отдыха</small>
        <strong>{formatCompactTimer(shownSeconds)}</strong>
      </button>
      <button
        type="button"
        className={`${styles.startButton} ${running ? styles.running : ""}`}
        data-testid="workout-rest-timer-start"
        onClick={toggleTimer}
        aria-label={primaryActionAriaLabel}
      >
        {running ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
        <span>{primaryActionLabel}</span>
      </button>
      <div className={styles.controls}>
        <button type="button" onClick={() => changeSeconds(-15)}>−15</button>
        <button type="button" className={styles.add} onClick={() => changeSeconds(15)}>+15</button>
      </div>
    </section>
  );
}

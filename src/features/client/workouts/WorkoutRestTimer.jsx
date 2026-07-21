import { Clock3 } from "lucide-react";
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

  function changeSeconds(delta) {
    const next = Math.max(0, shownSeconds + delta);
    onSecondsChange?.(next);
    onRunningChange?.(next > 0);
  }

  return (
    <section className={styles.root} data-testid="workout-rest-timer">
      <Clock3 aria-hidden="true" />
      <button type="button" className={styles.timer} onClick={() => onStart?.(shownSeconds)} aria-label={running ? "Перезапустить таймер отдыха" : "Запустить таймер отдыха"}>
        <small>Таймер отдыха</small>
        <strong>{formatCompactTimer(shownSeconds)}</strong>
      </button>
      <div className={styles.controls}>
        <button type="button" onClick={() => changeSeconds(-15)}>−15</button>
        <button type="button" className={styles.add} onClick={() => changeSeconds(15)}>+15</button>
      </div>
    </section>
  );
}

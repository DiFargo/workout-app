import { Clock3, Pause, Play, Square, X } from "lucide-react";
import { formatCompactTimer } from "../../../domain/workoutPresentation";
import { useBodyScrollLock } from "../../../shared/hooks/useBodyScrollLock";
import styles from "./WorkoutRestTimer.module.css";

export default function WorkoutRestTimer({
  duration = 90,
  running,
  seconds = 0,
  onStart,
  onSecondsChange,
  onRunningChange,
  compact = false,
  expanded = false,
  onMinimize
}) {
  useBodyScrollLock(expanded, { lockHtml: true });

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

  if (expanded) {
    return (
      <div className={styles.expandedBackdrop} role="dialog" aria-modal="true" aria-label="Таймер отдыха">
        <section className={styles.expandedTimer} data-testid="workout-rest-timer-expanded">
          <button
            type="button"
            className={styles.minimizeButton}
            onClick={onMinimize}
            aria-label="Свернуть таймер отдыха"
          >
            <X aria-hidden="true" />
          </button>
          <div className={styles.expandedLabel}>
            <Clock3 aria-hidden="true" />
            <span>Таймер отдыха</span>
          </div>
          <strong className={styles.expandedCountdown}>{formatCompactTimer(shownSeconds)}</strong>
          <p>{running ? "Отдыхайте перед следующим подходом" : "Таймер на паузе"}</p>
          <div className={styles.expandedControls} aria-label="Корректировка таймера отдыха">
            <button type="button" onClick={() => changeSeconds(-15)} aria-label="Убавить 15 секунд">−15</button>
            <button
              type="button"
              className={`${styles.expandedPrimary} ${running ? styles.running : ""}`}
              onClick={toggleTimer}
              aria-label={primaryActionAriaLabel}
            >
              {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              <span>{primaryActionLabel}</span>
            </button>
            <button type="button" onClick={() => changeSeconds(15)} aria-label="Добавить 15 секунд">+15</button>
          </div>
          <button type="button" className={styles.keepCompactButton} onClick={onMinimize}>
            Свернуть таймер
          </button>
        </section>
      </div>
    );
  }

  if (compact) {
    return (
      <section className={`${styles.root} ${styles.compact}`} data-testid="workout-rest-timer">
        <Clock3 aria-hidden="true" />
        <button
          type="button"
          className={styles.timer}
          onClick={toggleTimer}
          aria-label={primaryActionAriaLabel}
        >
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
        <div className={styles.controls} aria-label="Корректировка таймера отдыха">
          <button type="button" onClick={() => changeSeconds(-15)} aria-label="Убавить 15 секунд">−15</button>
          <button type="button" className={styles.add} onClick={() => changeSeconds(15)} aria-label="Добавить 15 секунд">+15</button>
        </div>
      </section>
    );
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

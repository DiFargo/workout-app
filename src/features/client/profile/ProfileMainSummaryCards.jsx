import { CalendarDays, ChevronRight } from "lucide-react";
import styles from "./ProfileMainSummaryCards.module.css";

function splitWorkoutTitle(value) {
  const title = String(value || "").trim();
  const match = title.match(/^(День\s*\d+)\s*[·—–-]\s*(.+)$/iu);
  return match
    ? { dayLabel: match[1], workoutTitle: match[2] }
    : { dayLabel: "", workoutTitle: title };
}

export function ProfileNextWorkoutCard({
  title = "Следующая тренировка",
  dateText = "Дата уточняется",
  exerciseCount = 0,
  eyebrow = "СЛЕДУЮЩАЯ ТРЕНИРОВКА",
  actionLabel = "Открыть тренировку",
  state = "ready",
  onOpen
}) {
  const { dayLabel, workoutTitle } = splitWorkoutTitle(title);

  return (
    <article
      className={styles.nextCard}
      data-testid="profile-main-next-workout"
      data-state={state}
      data-has-day-label={Boolean(dayLabel)}
    >
      <span className={styles.rail} aria-hidden="true" />
      <span className={styles.eyebrow} data-testid="profile-main-next-eyebrow">{eyebrow}</span>
      {dayLabel && <span className={styles.dayLabel}>{dayLabel}</span>}
      <h2 data-testid="profile-main-next-title">{workoutTitle}</h2>
      <div className={styles.nextMeta} data-testid="profile-main-next-meta">
        <CalendarDays aria-hidden="true" />
        <span data-testid="profile-main-next-meta-text">{dateText}{exerciseCount ? `  •  ${exerciseCount} упражнений` : ""}</span>
      </div>
      <button type="button" data-testid="profile-main-next-open" onClick={onOpen}>{actionLabel}</button>
    </article>
  );
}

export function ProfileLastWorkoutCard({ dateText, onOpen }) {
  return (
    <button
      type="button"
      className={styles.lastCard}
      data-testid="profile-main-last-workout"
      onClick={onOpen}
    >
      <CalendarDays className={styles.lastIcon} aria-hidden="true" />
      <span>
        <small>Последняя тренировка</small>
        <strong>{dateText || "Нет данных"}</strong>
      </span>
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

export default function ProfileMainSummaryCards(props) {
  return (
    <div className={styles.summaryGrid} data-testid="profile-main-summary-grid">
      <ProfileNextWorkoutCard
        title={props.nextWorkoutTitle || props.nextTrainingText}
        dateText={props.nextWorkoutDate || props.nextTrainingText}
        exerciseCount={props.nextWorkoutExerciseCount}
        eyebrow={props.nextWorkoutEyebrow}
        actionLabel={props.nextWorkoutActionLabel}
        state={props.nextWorkoutState}
        onOpen={props.onOpenNextWorkout}
      />
      <ProfileLastWorkoutCard dateText={props.lastWorkoutDate} onOpen={props.onOpenLastWorkout} />
    </div>
  );
}

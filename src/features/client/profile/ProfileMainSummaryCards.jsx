import { CalendarDays, ChevronRight } from "lucide-react";
import styles from "./ProfileMainSummaryCards.module.css";

export function ProfileNextWorkoutCard({
  title = "Следующая тренировка",
  dateText = "Дата уточняется",
  exerciseCount = 0,
  onOpen
}) {
  return (
    <article className={styles.nextCard} data-testid="profile-main-next-workout">
      <span className={styles.rail} aria-hidden="true" />
      <span className={styles.eyebrow}>СЛЕДУЮЩАЯ ТРЕНИРОВКА</span>
      <h2>{title}</h2>
      <div className={styles.nextMeta}>
        <CalendarDays aria-hidden="true" />
        <span>{dateText}{exerciseCount ? `  •  ${exerciseCount} упражнений` : ""}</span>
      </div>
      <button type="button" onClick={onOpen}>Открыть план</button>
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
        onOpen={props.onOpenNextWorkout}
      />
      <ProfileLastWorkoutCard dateText={props.lastWorkoutDate} onOpen={props.onOpenLastWorkout} />
    </div>
  );
}

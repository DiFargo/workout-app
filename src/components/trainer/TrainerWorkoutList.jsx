import { Check, ChevronDown } from "lucide-react";
import { buildTrainerWorkoutReview } from "../../utils/trainerActionCenter.js";
import { getTrainerWorkoutReviewKey } from "../../utils/trainerWorkoutReviewDecision.js";
import TrainerClientDisclosure from "./TrainerClientDisclosure";
import styles from "./TrainerWorkoutList.module.css";

function describeSets(exercise) {
  const sets = Array.isArray(exercise?.sets) ? exercise.sets : Array.isArray(exercise?.plannedSets) ? exercise.plannedSets : [];
  if (!sets.length) return exercise?.setCount || exercise?.setsCount ? `${exercise.setCount || exercise.setsCount} подх.` : "—";
  return sets.map(set => {
    const reps = set.reps || set.completedReps;
    const weight = set.enteredWeight || set.completedWeight || set.weight;
    return `${reps || "—"}${Number(weight) > 0 ? ` × ${weight} кг` : " повт."}`;
  }).join(" · ");
}

export default function TrainerWorkoutList({ workouts, slots, history, completion, reviewedKeys, localReviewedKeys, onOpen }) {
  return <details className={`trainerClientWorkoutList ${styles.list}`}>
    <summary className={styles.toggle}>
      <span className={styles.heading}><h2>Тренировки программы</h2><span>{completion}% выполнено</span><ChevronDown size={18} className={styles.chevron} /></span>
      <progress max="100" value={completion} aria-label="Выполнение программы" />
    </summary>
    <div className={styles.rows}>
      {workouts.map((workout, index) => {
        const slot = slots.find(item => item.workoutId === String(workout.id || "")) || slots[index];
        // Match immutable workout IDs within this assignment; repeated names are not identities.
        const saved = history.filter(item => workout.id && String(item.workoutId) === String(workout.id))
          .sort((a, b) => new Date(b.completedAt || b.finishedAt || b.date || b.createdAt).getTime() - new Date(a.completedAt || a.finishedAt || a.date || a.createdAt).getTime())[0];
        const review = saved ? buildTrainerWorkoutReview(saved, workout) : null;
        const reviewed = review && (reviewedKeys.has(getTrainerWorkoutReviewKey(review)) || localReviewedKeys.includes(getTrainerWorkoutReviewKey(review)));
        return <TrainerClientDisclosure key={workout.id || index} title={<span className="trainerWorkoutRowLabel"><span>{index + 1}. {workout.name || workout.title || "Тренировка"}</span>{slot?.isCompleted ? <small className="trainerWorkoutCompleted"><Check size={14} />Выполнена</small> : null}</span>}>
          <div className={styles.content}>
            {review ? <>
              <div className={styles.reviewHeading}><span>План и факт</span><span>{reviewed ? "Проверено тренером" : "Не проверено"}</span></div>
              <div className={styles.metrics}>
                <span>Упражнения <b>{review.completedExercisesCount}/{review.plannedExercisesCount}</b></span>
                <span>Подходы <b>{review.completedSetsCount}/{review.plannedSetsCount}</b></span>
                <span>Объём <b>{review.volumeKg} кг</b></span>
                <span>Пропуски <b>{review.skippedExercises.length}</b></span>
              </div>
            </> : <p className={styles.note}>{slot?.isCompleted ? "Тренировка отмечена выполненной. Подробная запись пока недоступна." : "План тренировки. Результаты появятся после выполнения."}</p>}
            <ul className={styles.exercises}>
              {(workout.exercises || []).map((exercise, exerciseIndex) => {
                const actual = saved?.exercises?.find(item => (exercise.id && item.id === exercise.id) || (item.name || item.exerciseName) === (exercise.name || exercise.exerciseName));
                return <li key={exercise.id || exerciseIndex}>
                  <strong>{exercise.name || exercise.exerciseName || "Упражнение"}</strong>
                  <span>План: {describeSets(exercise)}</span>
                  {review ? <span>Факт: {actual ? describeSets(actual) : "Нет записи"}</span> : null}
                </li>;
              })}
            </ul>
            {review && (review.feedbackTitle || review.clientComment) ? <div className={styles.comment}><strong>{review.feedbackTitle || "Комментарий клиента"}</strong>{review.clientComment ? <p>{review.clientComment}</p> : null}</div> : null}
            <button type="button" className="trainerClientTextAction" onClick={() => onOpen(workout.id)}>Открыть тренировку</button>
          </div>
        </TrainerClientDisclosure>;
      })}
    </div>
  </details>;
}

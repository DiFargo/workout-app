import { Check, ChevronDown } from "lucide-react";
import { buildTrainerWorkoutReview } from "../../utils/trainerActionCenter.js";
import { getTrainerWorkoutReviewKey } from "../../utils/trainerWorkoutReviewDecision.js";
import TrainerClientDisclosure from "./TrainerClientDisclosure";
import styles from "./TrainerWorkoutList.module.css";

const firstValue = (...values) => values.find(value => value !== undefined && value !== null && value !== "");
function setText(set) {
  if (!set) return "Нет записи";
  const reps = firstValue(set.completedReps, set.reps);
  const weight = firstValue(set.enteredWeight, set.completedWeight, set.weight);
  return `${reps ?? "—"} повт.${Number(weight) > 0 ? ` × ${weight} кг` : ""}`;
}
const setsOf = exercise => Array.isArray(exercise?.sets) ? exercise.sets : exercise?.plannedSets || [];
function compactSets(sets) {
  const values = sets.map(setText);
  if (!values.length) return "Подходы не записаны";
  if (values.every(value => value === values[0])) return `${values.length} подх. · ${values[0]}`;
  return `${values.length} подх. · ${[...new Set(values)].join(" / ")}`;
}

function ExerciseResult({ exercise, actual, hasReview, index }) {
  const plan = setsOf(exercise);
  const fact = setsOf(actual);
  const missing = !fact.length || fact.some(set => !(firstValue(set.completedReps, set.reps)));
  const matches = !missing && plan.length === fact.length && plan.every((set, i) => setText(set) === setText(fact[i]));
  const status = missing ? "Нет записи" : matches ? "По плану" : "Есть отличия";
  return <details className={styles.exercise}>
    <summary className={styles.exerciseToggle}>
      <span className={styles.number}>{index + 1}</span>
      <span className={styles.exerciseInfo}>
        <strong>{exercise.name || exercise.exerciseName || "Упражнение"}</strong>
        <span>{compactSets(hasReview && fact.length ? fact : plan)}</span>
      </span>
      {hasReview ? <small className={matches ? styles.matched : missing ? styles.missing : styles.changed}>{matches ? <Check size={13} /> : null}{status}</small> : null}
      <ChevronDown size={16} className={styles.exerciseChevron} />
    </summary>
    <div className={styles.setDetails}>
      <div className={styles.setRow}><span>Подход</span><span>План</span>{hasReview ? <span>Факт</span> : null}</div>
      {Array.from({ length: Math.max(plan.length, fact.length) }, (_, i) => <div className={styles.setRow} key={i}>
        <span>{i + 1}</span><span>{plan[i] ? setText(plan[i]) : "—"}</span>
        {hasReview ? <span>{setText(fact[i])}</span> : null}
      </div>)}
    </div>
  </details>;
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
              <div className={styles.reviewHeading}><span>Результат тренировки</span><span>{reviewed ? "Проверено тренером" : "Не проверено"}</span></div>
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
                return <li key={exercise.id || exerciseIndex}><ExerciseResult exercise={exercise} actual={actual} hasReview={Boolean(review)} index={exerciseIndex} /></li>;
              })}
            </ul>
            {review && (review.feedbackTitle || review.clientComment) ? <div className={styles.comment}><span className={styles.commentLabel}>Обратная связь клиента</span><strong>{review.feedbackTitle || "Комментарий"}</strong>{review.clientComment ? <p>{review.clientComment}</p> : null}</div> : null}
            <button type="button" className="trainerClientTextAction" onClick={() => onOpen(workout.id)}>Открыть тренировку</button>
          </div>
        </TrainerClientDisclosure>;
      })}
    </div>
  </details>;
}

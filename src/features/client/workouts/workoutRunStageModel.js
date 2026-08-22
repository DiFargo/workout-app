import {
  buildWorkoutFinishSummary,
  getWorkoutPresentation,
  getWorkoutWarmupSteps
} from "../../../domain/workoutPresentation";
import { hasWorkoutSetEntry, isWorkoutSetCompleted } from "../../../utils/auditSafety";
import { getWorkoutExecutionSteps, sortWorkoutDays } from "../../../utils/workoutPlanNormalization";

export function buildWorkoutRunStageModel({
  currentExerciseIndex,
  history,
  isWorkoutSaved,
  normalizeExercise,
  openVideoId,
  plan,
  workout,
  workoutDurationText,
  workoutFinishedAt,
  workoutHistorySyncState,
  workoutStarted
}) {
  const executionSteps = getWorkoutExecutionSteps(workout);
  const isStartSlide = !workoutStarted;
  const isFinishSlide = workoutStarted && currentExerciseIndex === executionSteps.length + 1;
  const warmupExercise = {
    id: "warmup",
    name: "Разминка",
    video: "",
    sets: []
  };
  const warmupSteps = getWorkoutWarmupSteps(workout);

  const currentStep = currentExerciseIndex > 0 ? executionSteps[currentExerciseIndex - 1] : null;
  const sourceExercise = currentStep ? workout.exercises[currentStep.exerciseIndex] : null;
  const exercise =
    isStartSlide || isFinishSlide
      ? null
      : currentExerciseIndex === 0
        ? warmupExercise
        : sourceExercise
          ? {
              ...normalizeExercise(sourceExercise),
              runtimeSetIndex: currentStep.setIndex,
              runtimeGroup: currentStep.group
            }
          : null;

  const exerciseVideoFailed = exercise?.id && openVideoId === `error:${exercise.id}`;
  const exerciseAiWeightAdjustments = exercise?.id && exercise.id !== "warmup"
    ? exercise.sets
        .filter((set) =>
          set.aiOriginalWeight &&
          String(set.aiOriginalWeight) !== String(set.weight)
        )
        .map((set) => `${set.aiOriginalWeight} → ${set.weight} кг`)
    : [];
  const sharedExerciseAiWeightAdjustment =
    exerciseAiWeightAdjustments.length === exercise?.sets?.length &&
    new Set(exerciseAiWeightAdjustments).size === 1
      ? exerciseAiWeightAdjustments[0]
      : "";

  const currentWorkoutSets = workout.exercises.flatMap((item) =>
    item.sets.map((set) => {
      const completed = isWorkoutSetCompleted(set);
      const weight = Number(set.enteredWeight || (set.completed ? set.weight : "")) || 0;
      const hasEnteredReps = hasWorkoutSetEntry(set.enteredReps);
      const enteredReps = Number(hasEnteredReps ? set.enteredReps : (set.completed ? set.reps : "")) || 0;
      const reps = hasEnteredReps
        ? enteredReps
        : completed
          ? Number(set.reps || 8) || 0
          : 0;

      return {
        reps,
        weight,
        completed
      };
    })
  );

  const totalSetsDone = currentWorkoutSets.filter(
    (set) => set.completed
  ).length;

  const totalVolumeDone = currentWorkoutSets.reduce(
    (sum, set) => sum + (set.weight > 0 ? set.reps * set.weight : 0),
    0
  );

  const previousSameWorkout = history.find(
    (item) => (
      (item.workoutId === workout.id || item.workout === workout.name) &&
      (
        !workout.assignedProgramUpdatedAt ||
        item.assignedProgramUpdatedAt === workout.assignedProgramUpdatedAt
      ) &&
      (
        !workoutFinishedAt ||
        new Date(item.date).getTime() < workoutFinishedAt - 1000
      )
    )
  );

  const previousVolume = previousSameWorkout
    ? previousSameWorkout.exercises?.reduce((exerciseSum, item) => {
        const setsVolume = item.sets?.reduce((setSum, set) => {
          const reps = Number(set.reps) || 0;
          const weight = Number(set.weight) || 0;
          return setSum + reps * weight;
        }, 0) || 0;

        return exerciseSum + setsVolume;
      }, 0)
    : 0;

  const volumeProgress =
    previousVolume > 0
      ? Math.round(((totalVolumeDone - previousVolume) / previousVolume) * 100)
      : null;

  const completedExercisesCount = workout.exercises.filter((item) =>
    item.sets?.some(isWorkoutSetCompleted)
  ).length;
  const incompleteExerciseNames = workout.exercises
    .filter((item) => !item.sets?.some(isWorkoutSetCompleted))
    .map((item) => item.name)
    .filter(Boolean);

  const sortedPlanWorkouts = sortWorkoutDays(plan.workouts || []);
  const workoutPosition = sortedPlanWorkouts.findIndex((item) => item.id === workout.id);
  const finishPresentation = getWorkoutPresentation(
    workout,
    workoutPosition >= 0 ? workoutPosition : 0
  );
  const {
    stats: finishStats,
    progressText: finishProgressText,
    adviceText: finishAdviceText,
    syncText: finishSyncText
  } = buildWorkoutFinishSummary({
    workoutDurationText,
    completedExercisesCount,
    totalSetsDone,
    totalVolumeDone,
    volumeProgress,
    isWorkoutSaved,
    workoutHistorySyncState
  });

  return {
    completedExercisesCount,
    exercise,
    exerciseAiWeightAdjustments,
    executionSteps,
    exerciseVideoFailed,
    finishAdviceText,
    finishPresentation,
    finishProgressText,
    finishStats,
    finishSyncText,
    incompleteExerciseNames,
    isFinishSlide,
    isStartSlide,
    sharedExerciseAiWeightAdjustment,
    warmupSteps
  };
}

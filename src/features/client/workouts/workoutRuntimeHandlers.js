import { doc, setDoc } from "firebase/firestore";

import { hasWorkoutSetEntry } from "../../../utils/auditSafety";
import { replaceBasicWorkoutExerciseInPlan } from "../../../utils/basicWorkoutAlternatives";
import { applyBasicWorkoutStartingWeightFeedback } from "../../../utils/basicWorkoutStartingWeights";
import { replaceTrainerAssignedExerciseInWorkout } from "../../../utils/trainerExerciseAlternatives";
import { safeWriteUserJsonStorage } from "../../../utils/userScopedStorage";
import {
  getWorkoutGroupConfig,
  makeGroupedWorkoutSets,
  makeThreeSets
} from "../../../utils/workoutPlanNormalization";

function getGroupRestDuration(group) {
  const value = String(group?.restAfterRound || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return Number(value?.[0]) || 90;
}

export function createWorkoutRuntimeHandlers({
  BASIC_WORKOUT_PLAN_STORAGE_KEY,
  auth,
  db,
  plan,
  workout,
  restTimerDuration,
  deckRef,
  setPlan,
  setExerciseValidationMessage,
  setRestTimerDuration,
  setRestTimerSeconds,
  setRestTimerRunning,
  setWarmupCompletedSteps,
  setWarmupTimerDuration,
  setWarmupTimerSeconds,
  setWarmupTimerRunning
}) {
  function updateWorkout(cb) {
    if (!workout) return;

    setPlan((planState) => ({
      ...planState,
      workouts: planState.workouts.map((workoutItem) => (
        workoutItem.id === workout.id ? cb(workoutItem) : workoutItem
      ))
    }));
  }

  function addSet(id) {
    updateWorkout((workoutItem) => ({
      ...workoutItem,
      exercises: workoutItem.exercises.map((exercise) =>
        exercise.id === id
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  reps: exercise.name?.includes("Пресс") ? 15 : 8,
                  weight: "",
                  enteredReps: "",
                  enteredWeight: ""
                }
              ]
            }
          : exercise
      )
    }));
  }

  function updateSet(id, index, field, value) {
    updateWorkout((workoutItem) => ({
      ...workoutItem,
      exercises: workoutItem.exercises.map((exercise) =>
        exercise.id === id
          ? {
              ...exercise,
              sets: exercise.sets.map((set, setIndex) => {
                if (setIndex !== index) return set;

                return { ...set, [field]: value };
              })
            }
          : exercise
      )
    }));

    if (field === "enteredWeight" && hasWorkoutSetEntry(value)) {
      setExerciseValidationMessage("");
    }
  }

  function updateExerciseNote(exerciseId, note) {
    updateWorkout((currentWorkout) => ({
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((exercise) => (
        exercise.id === exerciseId
          ? { ...exercise, clientNote: note }
          : exercise
      ))
    }));
  }

  function replaceBasicWorkoutExercise(exerciseId, alternative) {
    const isBasicWorkout = workout?.source === "basic" || plan?.source === "basic";
    if (!isBasicWorkout || !workout?.id || !alternative?.name) return false;

    const { plan: nextPlan, replacement } = replaceBasicWorkoutExerciseInPlan(
      plan,
      workout.id,
      exerciseId,
      alternative
    );
    if (!replacement) return false;

    setPlan(nextPlan);

    const currentUser = auth?.currentUser;
    if (!currentUser?.uid) return true;

    safeWriteUserJsonStorage(BASIC_WORKOUT_PLAN_STORAGE_KEY, currentUser.uid, nextPlan);

    if (db) {
      const nextWorkout = nextPlan.workouts.find((item) => item.id === workout.id);
      const updatedAt = new Date().toISOString();

      Promise.all([
        setDoc(doc(db, "users", currentUser.uid, "workouts", workout.id), {
          source: "basic",
          exercises: nextWorkout?.exercises || [],
          updatedAt
        }, { merge: true }),
        setDoc(doc(db, "users", currentUser.uid), {
          basicWorkoutPlan: nextPlan,
          updatedAt
        }, { merge: true })
      ]).catch((error) => {
        console.warn("Basic workout exercise replacement sync error", error);
      });
    }

    return true;
  }

  function replaceTrainerAssignedWorkoutExercise(exerciseId, alternative) {
    const isBasicWorkout = workout?.source === "basic" || plan?.source === "basic";
    if (isBasicWorkout || !workout?.id || !alternative?.name) return false;

    const result = replaceTrainerAssignedExerciseInWorkout(workout, exerciseId, alternative);
    if (!result.replacement) return false;

    setPlan((planState) => ({
      ...planState,
      workouts: planState.workouts.map((workoutItem) => (
        workoutItem.id === workout.id ? result.workout : workoutItem
      ))
    }));

    const currentUser = auth?.currentUser;
    if (currentUser?.uid && db) {
      setDoc(doc(db, "users", currentUser.uid, "workouts", workout.id), {
        exercises: result.workout.exercises,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch((error) => {
        console.warn("Trainer-assigned workout exercise replacement sync error", error);
      });
    }

    return true;
  }

  function confirmBasicStartingWeightFeedback(exerciseId, feedback) {
    const isBasicWorkout = workout?.source === "basic" || plan?.source === "basic";
    if (!isBasicWorkout || !workout?.id || !exerciseId) return false;

    const result = applyBasicWorkoutStartingWeightFeedback(
      plan,
      workout.id,
      exerciseId,
      feedback
    );
    if (!result.changed) return false;

    setPlan(result.plan);

    const currentUser = auth?.currentUser;
    if (!currentUser?.uid) return true;

    safeWriteUserJsonStorage(BASIC_WORKOUT_PLAN_STORAGE_KEY, currentUser.uid, result.plan);

    if (db) {
      const updatedAt = new Date().toISOString();
      Promise.all([
        ...result.plan.workouts.map((workoutItem) => setDoc(
          doc(db, "users", currentUser.uid, "workouts", workoutItem.id),
          {
            source: "basic",
            exercises: workoutItem.exercises || [],
            updatedAt
          },
          { merge: true }
        )),
        setDoc(doc(db, "users", currentUser.uid), {
          basicWorkoutPlan: result.plan,
          updatedAt
        }, { merge: true })
      ]).catch((error) => {
        console.warn("Basic workout starting weight sync error", error);
      });
    }

    return true;
  }

  function openWorkoutExerciseModal(setModalId, exerciseId, triggerElement) {
    triggerElement?.blur();
    if (deckRef.current) {
      deckRef.current.scrollTop = 0;
    }
    setModalId(exerciseId);
  }

  function closeWorkoutExerciseModal(setModalId) {
    setModalId("");
    const restoreScroll = () => {
      if (deckRef.current) {
        deckRef.current.scrollTop = 0;
      }
    };
    window.requestAnimationFrame(() => {
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });
    window.setTimeout(restoreScroll, 100);
  }

  function startRestTimer(duration = restTimerDuration) {
    const nextDuration = Number(duration) || 90;
    setRestTimerDuration(nextDuration);
    setRestTimerSeconds(nextDuration);
    setRestTimerRunning(true);
  }

  function toggleWorkoutSetCompleted(exerciseId, setIndex) {
    const exerciseItem = workout?.exercises?.find((item) => item.id === exerciseId);
    const setItem = exerciseItem?.sets?.[setIndex];
    const nextCompleted = !setItem?.completed;
    const group = getWorkoutGroupConfig(workout, exerciseItem);
    const groupExerciseCount = Math.max(
      Number(exerciseItem?.taskBlockExerciseCount) || 0,
      Array.isArray(group?.exerciseIds) ? group.exerciseIds.length : 0
    );
    const isLastExerciseInGroup = !group || (
      Number(exerciseItem?.taskBlockExerciseIndex || 0) >= Math.max(0, groupExerciseCount - 1)
    );

    updateSet(exerciseId, setIndex, "completed", nextCompleted);
    if (nextCompleted) {
      setExerciseValidationMessage("");
      if (isLastExerciseInGroup) {
        startRestTimer(group ? getGroupRestDuration(group) : restTimerDuration);
        navigator.vibrate?.(45);
        return true;
      }
      navigator.vibrate?.(45);
    }

    return false;
  }

  function toggleWarmupStep(stepIndex) {
    setWarmupCompletedSteps((current) => (
      current.includes(stepIndex)
        ? current.filter((item) => item !== stepIndex)
        : [...current, stepIndex]
    ));
  }

  function setWarmupTimerPreset(seconds) {
    setWarmupTimerDuration(seconds);
    setWarmupTimerSeconds(seconds);
    setWarmupTimerRunning(false);
  }

  function resetWorkout() {
    if (!workout) return;

    setPlan((planState) => ({
      ...planState,
      workouts: planState.workouts.map((workoutItem) =>
        workoutItem.id === workout.id
          ? {
              ...workoutItem,
              exercises: workoutItem.exercises.map((exercise) => {
                const defaultReps = exercise.name.includes("Пресс") ? 15 : 8;
                const group = getWorkoutGroupConfig(workoutItem, exercise);

                return {
                  ...exercise,
                  sets: group
                    ? makeGroupedWorkoutSets([], group.rounds, defaultReps)
                    : makeThreeSets([], defaultReps)
                };
              })
            }
          : workoutItem
      )
    }));
  }

  return {
    addSet,
    updateSet,
    updateExerciseNote,
    replaceBasicWorkoutExercise,
    replaceTrainerAssignedWorkoutExercise,
    confirmBasicStartingWeightFeedback,
    openWorkoutExerciseModal,
    closeWorkoutExerciseModal,
    startRestTimer,
    toggleWorkoutSetCompleted,
    toggleWarmupStep,
    setWarmupTimerPreset,
    resetWorkout
  };
}

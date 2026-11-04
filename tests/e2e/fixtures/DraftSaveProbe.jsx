// Local verification fixture: synthetic data only, never part of a release.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useWorkoutRuntimeEffects } from "../../../src/features/client/workouts/useWorkoutRuntimeEffects.js";
import WorkoutRunRoute from "../../../src/features/client/workouts/WorkoutRunRoute.jsx";

const noop = () => {};
const uid = "local-draft-save-probe";
const auth = { currentUser: { uid } };
const workout = { id: "local-day", name: "День 4", assignedProgramUpdatedAt: "fixture-1", exercises: [{
  id: "local-leg-extension", name: "Разгибание ног в тренажёре", sets: [{ weight: 50, reps: 12 }]
}] };
const basePlan = { workouts: [workout], readModel: { completionHistory: Array(100).fill({ id: "synthetic-history", value: "x".repeat(100) }) } };
const originalSetItem = Storage.prototype.setItem;
let failWrites = false;
Storage.prototype.setItem = function(key, value) {
  if (failWrites && key === `workout_active_draft_v1:${uid}:${workout.id}`) {
    throw new DOMException("Synthetic quota failure", "QuotaExceededError");
  }
  return originalSetItem.call(this, key, value);
};

export default function Probe() {
  const [plan, setPlan] = useState(basePlan);
  const [index, setCurrentExerciseIndex] = useState(0);
  const [validation, setExerciseValidationMessage] = useState("");
  const [warmupCompletedSteps, setWarmupCompletedSteps] = useState([]);
  const [warmupTimerSeconds, setWarmupTimerSeconds] = useState(300);
  const [warmupTimerRunning, setWarmupTimerRunning] = useState(false);
  const inlineVideoControlsTimerRef = useRef(null);
  const timerTickRef = useRef(0);
  const props = {
    auth, user: auth.currentUser, plan, workout: plan.workouts[0], selectedWorkoutId: workout.id,
    currentExerciseIndex: index, setCurrentExerciseIndex, workoutStarted: true, isWorkoutSaved: false,
    showFirstSetupOnboarding: false, aiNutritionProfileDraft: {}, onboardingStep: 0,
    workoutStartedAt: 1000, workoutFinishedAt: null, workoutDurationText: "0 сек", history: [],
    inlineVideoControlsTimerRef, timerTickRef, workoutVideoCacheKey: "", deckRef: null,
    warmupCompletedSteps, warmupTimerDuration: 300, warmupTimerSeconds, warmupTimerRunning,
    setWarmupTimerSeconds, setWarmupTimerRunning, restTimerDuration: 90, restTimerSeconds: 90,
    restTimerRunning: false, normalizeExercise: value => value, workoutClientComment: "",
    exerciseValidationMessage: validation, setExerciseValidationMessage,
    ...Object.fromEntries(["setExerciseHistoryOpenId", "setExerciseNoteOpenId", "setExerciseTechniqueOpenId",
      "setInlinePlayingVideoId", "setInlineVideoControlsVisible", "setRestTimerRunning", "setRestTimerSeconds",
      "setTimerTick", "setVideoLoadingId", "requestLeaveWorkout", "goToPreviousExercise", "setPostWorkoutFeedbackOpen",
      "setFullscreenVideo", "setOpenVideoId", "setSelectedWorkoutId", "setWorkoutStarted", "setWorkoutStartedAt",
      "setWorkoutFinishedAt", "setIsWorkoutSaved", "setShowWorkoutSavedCard", "setPendingWorkoutFeedback",
      "setPostWorkoutFeedback", "setWorkoutExitPromptOpen", "setWorkoutIncompleteConfirmOpen"].map(key => [key, noop])),
    goToNextExercise: () => setCurrentExerciseIndex(value => value + 1),
    setWarmupTimerPreset: seconds => setWarmupTimerSeconds(seconds),
    toggleWarmupStep: step => setWarmupCompletedSteps(value => value.includes(step) ? value.filter(item => item !== step) : [...value, step])
  };
  const effects = useWorkoutRuntimeEffects(props);
  useEffect(() => {
    window.__draftSaveProbe = {
      fail() { failWrites = true; window.dispatchEvent(new Event("focus")); },
      recover() { failWrites = false; window.dispatchEvent(new Event("focus")); },
      formError() { setExerciseValidationMessage("Укажите число повторов"); },
      clearFormError() { setExerciseValidationMessage(""); },
      edit() { setPlan(value => ({ ...value, workouts: [{ ...value.workouts[0], exercises: [{ ...value.workouts[0].exercises[0], sets: [{ weight: 50, reps: 12, enteredWeight: "55", enteredReps: "12", completed: true }] }] }] })); },
      read() { return JSON.parse(localStorage.getItem(`workout_active_draft_v1:${uid}:${workout.id}`)); }
    };
    return () => { delete window.__draftSaveProbe; };
  }, []);
  return <WorkoutRunRoute runtime={{ ...props, ...effects }} />;
}

document.getElementById("root").style.display = "none";
const mount = document.createElement("main");
mount.id = "draft-save-probe";
document.body.append(mount);
createRoot(mount).render(<Probe />);

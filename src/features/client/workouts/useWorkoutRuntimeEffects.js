import { useEffect } from "react";

import { safeWriteJsonStorage } from "../../../utils/storageSafety";
import { getWorkoutDraftKey } from "../../../utils/workoutDraftStorage";

export function useWorkoutRuntimeEffects({
  auth,
  currentExerciseIndex,
  inlineVideoControlsTimerRef,
  plan,
  postWorkoutFeedback,
  restTimerDuration,
  restTimerRunning,
  restTimerSeconds,
  selectedWorkoutId,
  timerTickRef,
  user,
  warmupCompletedSteps,
  warmupTimerDuration,
  warmupTimerRunning,
  warmupTimerSeconds,
  workout,
  workoutFinishedAt,
  workoutReadiness,
  workoutStarted,
  workoutStartedAt,
  workoutVideoCacheKey,
  setExerciseHistoryOpenId,
  setExerciseNoteOpenId,
  setExerciseTechniqueOpenId,
  setExerciseValidationMessage,
  setCurrentExerciseIndex,
  setInlinePlayingVideoId,
  setInlineVideoControlsVisible,
  setRestTimerRunning,
  setRestTimerSeconds,
  setTimerTick,
  setVideoLoadingId,
  setWarmupTimerRunning,
  setWarmupTimerSeconds
}) {
  useEffect(() => {
    if (inlineVideoControlsTimerRef.current) {
      window.clearTimeout(inlineVideoControlsTimerRef.current);
      inlineVideoControlsTimerRef.current = null;
    }
    setInlinePlayingVideoId("");
    setInlineVideoControlsVisible(true);
    setVideoLoadingId("");
    setExerciseHistoryOpenId("");
    setExerciseNoteOpenId("");
    setExerciseTechniqueOpenId("");
    setExerciseValidationMessage("");

    return () => {
      if (inlineVideoControlsTimerRef.current) {
        window.clearTimeout(inlineVideoControlsTimerRef.current);
        inlineVideoControlsTimerRef.current = null;
      }
    };
  }, [selectedWorkoutId, currentExerciseIndex]);

  useEffect(() => {
    if (!warmupTimerRunning) return undefined;

    const timer = window.setInterval(() => {
      setWarmupTimerSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setWarmupTimerRunning(false);
          navigator.vibrate?.(120);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [warmupTimerRunning]);

  useEffect(() => {
    if (!restTimerRunning) return undefined;

    const timer = window.setInterval(() => {
      setRestTimerSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRestTimerRunning(false);
          navigator.vibrate?.([100, 80, 100]);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restTimerRunning]);

  useEffect(() => {
    const currentUser = auth.currentUser || user;

    if (!currentUser?.uid || !selectedWorkoutId || !workoutStarted) return;

    const draftAssignmentVersion =
      plan.workouts.find((workoutItem) => workoutItem.id === selectedWorkoutId)
        ?.assignedProgramUpdatedAt ||
      plan.assignedProgramUpdatedAt ||
      "";
    const draft = {
      uid: currentUser.uid,
      workoutId: selectedWorkoutId,
      selectedWorkoutId,
      currentExerciseIndex,
      workoutStartedAt,
      workoutFinishedAt,
      assignedProgramUpdatedAt: draftAssignmentVersion,
      assignmentVersion: draftAssignmentVersion,
      selectedReadiness: workoutReadiness,
      selectedPostWorkoutFeedback: postWorkoutFeedback,
      warmupCompletedSteps,
      warmupTimerDuration,
      warmupTimerSeconds,
      restTimerDuration,
      restTimerSeconds,
      plan,
      savedAt: new Date().toISOString()
    };

    const writeDraft = () => {
      safeWriteJsonStorage(getWorkoutDraftKey(currentUser.uid, selectedWorkoutId), {
        ...draft,
        savedAt: new Date().toISOString()
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") writeDraft();
    };

    writeDraft();
    window.addEventListener("pagehide", writeDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", writeDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    user?.uid,
    selectedWorkoutId,
    currentExerciseIndex,
    workoutStarted,
    workoutStartedAt,
    workoutFinishedAt,
    workoutReadiness,
    postWorkoutFeedback,
    warmupCompletedSteps,
    warmupTimerDuration,
    warmupTimerSeconds,
    restTimerDuration,
    restTimerSeconds,
    plan
  ]);

  useEffect(() => {
    if (!workoutStartedAt || workoutFinishedAt) return undefined;

    const timer = setInterval(() => {
      const now = Date.now();
      timerTickRef.current = now;
      setTimerTick(now);
    }, 1000);

    return () => clearInterval(timer);
  }, [workoutStartedAt, workoutFinishedAt]);

  useEffect(() => {
    if (!workoutVideoCacheKey || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready
      .then((registration) => {
        const worker = navigator.serviceWorker.controller || registration.active;
        worker?.postMessage({
          type: "PREFETCH_WORKOUT_VIDEOS",
          urls: workoutVideoCacheKey.split("|")
        });
      })
      .catch((error) => {
        console.warn("Workout video prefetch unavailable:", error);
      });
  }, [workout?.id, workoutVideoCacheKey]);

  useEffect(() => {
    if (!workout) return;

    if (currentExerciseIndex > workout.exercises.length + 1) {
      setCurrentExerciseIndex(0);
    }
  }, [workout, currentExerciseIndex]);
}

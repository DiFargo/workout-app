import { useEffect, useRef } from "react";

import { safeWriteJsonStorage } from "../../../utils/storageSafety";
import { getWorkoutDraftKey } from "../../../utils/workoutDraftStorage";
import { getWorkoutExecutionSteps } from "../../../utils/workoutPlanNormalization";
import {
  createWorkoutCountdownDeadline,
  getWorkoutCountdownRemainingSeconds
} from "./workoutCountdownTimer";

function getSafeCountdownSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

function useWallClockCountdown({
  completionVibration,
  running,
  seconds,
  setRunning,
  setSeconds
}) {
  const deadlineRef = useRef(0);
  const lastReportedSecondsRef = useRef(null);
  const secondsRef = useRef(getSafeCountdownSeconds(seconds));

  useEffect(() => {
    secondsRef.current = getSafeCountdownSeconds(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!running) {
      deadlineRef.current = 0;
      lastReportedSecondsRef.current = secondsRef.current;
      return undefined;
    }

    const initialSeconds = secondsRef.current;
    if (!initialSeconds) {
      setRunning(false);
      return undefined;
    }

    const deadline = createWorkoutCountdownDeadline(initialSeconds);
    deadlineRef.current = deadline;
    lastReportedSecondsRef.current = initialSeconds;
    let completed = false;

    const syncCountdown = () => {
      if (deadlineRef.current !== deadline) return;

      const remainingSeconds = getWorkoutCountdownRemainingSeconds(deadline);
      secondsRef.current = remainingSeconds;
      lastReportedSecondsRef.current = remainingSeconds;
      setSeconds((current) => (current === remainingSeconds ? current : remainingSeconds));

      if (remainingSeconds > 0 || completed) return;

      completed = true;
      deadlineRef.current = 0;
      setRunning(false);
      navigator.vibrate?.(completionVibration === "rest" ? [100, 80, 100] : 120);
    };

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);
    document.addEventListener("visibilitychange", syncCountdown);
    window.addEventListener("focus", syncCountdown);
    window.addEventListener("pageshow", syncCountdown);
    window.addEventListener("pagehide", syncCountdown);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncCountdown);
      window.removeEventListener("focus", syncCountdown);
      window.removeEventListener("pageshow", syncCountdown);
      window.removeEventListener("pagehide", syncCountdown);

      if (deadlineRef.current !== deadline) return;

      const remainingSeconds = getWorkoutCountdownRemainingSeconds(deadline);
      deadlineRef.current = 0;
      secondsRef.current = remainingSeconds;
      lastReportedSecondsRef.current = remainingSeconds;
      setSeconds((current) => (current === remainingSeconds ? current : remainingSeconds));
    };
  }, [completionVibration, running, setRunning, setSeconds]);

  useEffect(() => {
    if (!running || !deadlineRef.current) return;

    const nextSeconds = getSafeCountdownSeconds(seconds);
    if (nextSeconds === lastReportedSecondsRef.current) return;

    if (!nextSeconds) {
      deadlineRef.current = 0;
      setRunning(false);
      return;
    }

    deadlineRef.current = createWorkoutCountdownDeadline(nextSeconds);
    lastReportedSecondsRef.current = nextSeconds;
  }, [running, seconds, setRunning]);
}

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
  useWallClockCountdown({
    completionVibration: "warmup",
    running: warmupTimerRunning,
    seconds: warmupTimerSeconds,
    setRunning: setWarmupTimerRunning,
    setSeconds: setWarmupTimerSeconds
  });

  useWallClockCountdown({
    completionVibration: "rest",
    running: restTimerRunning,
    seconds: restTimerSeconds,
    setRunning: setRestTimerRunning,
    setSeconds: setRestTimerSeconds
  });

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
  }, [
    currentExerciseIndex,
    inlineVideoControlsTimerRef,
    selectedWorkoutId,
    setExerciseHistoryOpenId,
    setExerciseNoteOpenId,
    setExerciseTechniqueOpenId,
    setExerciseValidationMessage,
    setInlinePlayingVideoId,
    setInlineVideoControlsVisible,
    setVideoLoadingId
  ]);

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
    auth.currentUser,
    user,
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

    const syncElapsedTimer = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      timerTickRef.current = now;
      setTimerTick(now);
    };

    syncElapsedTimer();
    const timer = window.setInterval(syncElapsedTimer, 1000);
    document.addEventListener("visibilitychange", syncElapsedTimer);
    window.addEventListener("focus", syncElapsedTimer);
    window.addEventListener("pageshow", syncElapsedTimer);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncElapsedTimer);
      window.removeEventListener("focus", syncElapsedTimer);
      window.removeEventListener("pageshow", syncElapsedTimer);
    };
  }, [setTimerTick, timerTickRef, workoutFinishedAt, workoutStartedAt]);

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

    if (currentExerciseIndex > getWorkoutExecutionSteps(workout).length + 1) {
      setCurrentExerciseIndex(0);
    }
  }, [currentExerciseIndex, setCurrentExerciseIndex, workout]);
}

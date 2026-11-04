import { useEffect, useRef, useState } from "react";

import { clearWorkoutDraft, saveWorkoutDraft } from "../../../utils/workoutDraftStorage";
import { captureAuthSession } from "../../../utils/authSession.js";
import { createWorkoutDraftPlan } from "../../../utils/workoutDraftState";
import { compactStoredWorkoutPlans } from "../../../utils/workoutPlanStorage.js";
import { getWorkoutExecutionSteps } from "../../../utils/workoutPlanNormalization";
import {
  createWorkoutCountdownDeadline,
  getWorkoutCountdownRemainingSeconds
} from "./workoutCountdownTimer";

function getSafeCountdownSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

export function useWallClockCountdown({
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
    let active = true;

    const syncCountdown = () => {
      if (!active || !deadlineRef.current) return;

      const remainingSeconds = getWorkoutCountdownRemainingSeconds(deadlineRef.current);
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

      active = false;
      if (!deadlineRef.current) return;

      const remainingSeconds = getWorkoutCountdownRemainingSeconds(deadlineRef.current);
      deadlineRef.current = 0;
      secondsRef.current = remainingSeconds;
      lastReportedSecondsRef.current = remainingSeconds;
      // A deliberate reset and pause may be committed together (skip rest).
      // Cleanup must not resurrect the old remaining time after that reset.
      setSeconds((current) => (current === 0 || current === remainingSeconds ? current : remainingSeconds));
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
  inlineVideoControlsHideDelay = 850,
  isWorkoutSaved,
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
  workoutClientComment = "",
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
  const [draftWriteFailure, setDraftWriteFailure] = useState(null);
  const draftWriteRequestRef = useRef(0);
  const draftUid = (auth.currentUser || user)?.uid;
  const workoutDraftSaveWarning = workoutStarted && !isWorkoutSaved &&
    draftWriteFailure?.uid === draftUid && draftWriteFailure?.workoutId === selectedWorkoutId &&
    draftWriteFailure?.startedAt === workoutStartedAt
    ? "Не удалось сохранить тренировку на устройстве. Не закрывайте приложение до завершения тренировки."
    : "";
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

    if (!currentUser?.uid || !selectedWorkoutId) return;
    if (isWorkoutSaved) {
      clearWorkoutDraft(currentUser.uid, selectedWorkoutId);
      return;
    }
    if (!workoutStarted) return;

    const draftPlan = createWorkoutDraftPlan(plan, selectedWorkoutId);
    if (!draftPlan) return;

    const draftAssignmentVersion =
      plan.workouts.find((workoutItem) => workoutItem.id === selectedWorkoutId)
        ?.assignedProgramUpdatedAt ||
      plan.assignedProgramUpdatedAt ||
      "";
    const draft = {
      version: 2,
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
      workoutClientComment,
      warmupCompletedSteps,
      warmupTimerDuration,
      warmupTimerSeconds,
      restTimerDuration,
      restTimerSeconds,
      plan: draftPlan,
      savedAt: new Date().toISOString()
    };

    const session = captureAuthSession(auth);
    let active = true;
    let fallbackNoticeTimer = null;
    const writeDraft = () => {
      const request = ++draftWriteRequestRef.current;
      compactStoredWorkoutPlans(currentUser.uid);
      const result = saveWorkoutDraft(currentUser.uid, selectedWorkoutId, {
        ...draft,
        savedAt: new Date().toISOString()
      });
      const reportResult = (saved) => {
        if (!active || !session.isUnchanged() || request !== draftWriteRequestRef.current) return;
        setDraftWriteFailure((current) => {
          if (!active || !session.isUnchanged() || request !== draftWriteRequestRef.current) return current;
          if (saved) return null;
          if (current?.uid === currentUser.uid && current.workoutId === selectedWorkoutId &&
            current.startedAt === workoutStartedAt) return current;
          return { uid: currentUser.uid, workoutId: selectedWorkoutId, startedAt: workoutStartedAt };
        });
      };
      if (typeof result?.then === "function") {
        // A pending fallback is not yet a saved draft. A slow/denied IndexedDB
        // must not silence the warning while countdown updates replace effects.
        if (fallbackNoticeTimer) window.clearTimeout(fallbackNoticeTimer);
        fallbackNoticeTimer = window.setTimeout(() => reportResult(false), 300);
        result.then(saved => {
          if (request === draftWriteRequestRef.current) window.clearTimeout(fallbackNoticeTimer);
          reportResult(saved);
        }, () => reportResult(false));
      }
      else {
        if (fallbackNoticeTimer) window.clearTimeout(fallbackNoticeTimer);
        reportResult(result);
      }
    };

    writeDraft();
    window.addEventListener("pagehide", writeDraft);
    window.addEventListener("pageshow", writeDraft);
    window.addEventListener("focus", writeDraft);
    document.addEventListener("visibilitychange", writeDraft);

    return () => {
      active = false;
      if (fallbackNoticeTimer) window.clearTimeout(fallbackNoticeTimer);
      window.removeEventListener("pagehide", writeDraft);
      window.removeEventListener("pageshow", writeDraft);
      window.removeEventListener("focus", writeDraft);
      document.removeEventListener("visibilitychange", writeDraft);
    };
  }, [
    auth,
    auth.currentUser,
    user,
    selectedWorkoutId,
    isWorkoutSaved,
    currentExerciseIndex,
    workoutStarted,
    workoutStartedAt,
    workoutFinishedAt,
    workoutReadiness,
    postWorkoutFeedback,
    workoutClientComment,
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

  return { workoutDraftSaveWarning, showInlineVideoControlsTemporarily() {
    if (inlineVideoControlsTimerRef.current) window.clearTimeout(inlineVideoControlsTimerRef.current);
    setInlineVideoControlsVisible(true);
    inlineVideoControlsTimerRef.current = window.setTimeout(() => {
      setInlineVideoControlsVisible(false);
      inlineVideoControlsTimerRef.current = null;
    }, inlineVideoControlsHideDelay);
  } };
}

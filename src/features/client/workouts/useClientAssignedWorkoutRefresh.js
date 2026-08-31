import { useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";

export function getClientAssignedProgramRefreshKey(profile = {}) {
  return [
    profile?.assignedProgramUpdatedAt || profile?.assignedProgramAt || "",
    profile?.assignedProgramId || "",
    profile?.assignedWorkoutCount || "",
    profile?.workoutCalendar?.updatedAt || "",
    profile?.workoutCalendar?.assignedProgramUpdatedAt || ""
  ].join("|");
}

export function useClientAssignedWorkoutRefresh({
  db,
  enabled,
  loadWorkoutsFromFirebase,
  onWorkoutCalendarChange,
  refreshEnabled = enabled,
  userId
}) {
  const loadWorkoutsRef = useRef(loadWorkoutsFromFirebase);
  const onWorkoutCalendarChangeRef = useRef(onWorkoutCalendarChange);

  useEffect(() => {
    loadWorkoutsRef.current = loadWorkoutsFromFirebase;
  }, [loadWorkoutsFromFirebase]);

  useEffect(() => {
    onWorkoutCalendarChangeRef.current = onWorkoutCalendarChange;
  }, [onWorkoutCalendarChange]);

  useEffect(() => {
    if (!enabled || !db || !userId) return undefined;

    let active = true;
    let lastAssignmentKey = null;
    let refreshInFlight = false;
    let refreshQueued = false;

    function refreshAssignedWorkouts() {
      if (!active || typeof loadWorkoutsRef.current !== "function") return;
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }

      refreshInFlight = true;
      Promise.resolve(loadWorkoutsRef.current(userId, {
        mode: "individual",
        preserveCurrentPlanOnError: true
      })).catch((error) => {
        console.warn("Assigned workout refresh failed:", error);
      }).finally(() => {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          refreshAssignedWorkouts();
        }
      });
    }

    const unsubscribe = onSnapshot(doc(db, "users", userId), (snapshot) => {
      const profile = snapshot.data() || {};
      onWorkoutCalendarChangeRef.current?.(profile.workoutCalendar || {});

      const assignmentKey = getClientAssignedProgramRefreshKey(profile);
      if (assignmentKey === lastAssignmentKey) return;

      lastAssignmentKey = assignmentKey;
      if (refreshEnabled) refreshAssignedWorkouts();
    }, (error) => {
      console.warn("Assigned workout subscription failed:", error);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [db, enabled, refreshEnabled, userId]);
}

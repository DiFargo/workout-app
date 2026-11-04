import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { captureAuthSession } from "../utils/authSession.js";
import { invalidateSessionResource, runSessionResource } from "../utils/sessionResource.js";
import { createPriorityLoadQueue } from "../utils/priorityLoadQueue.js";

export function getClientResourceDemand({ page, measurementsOpen, photosOpen, nutritionHistoryOpen }) {
  const resources = new Set();
  if (page === "main") ["nutritionDay", "measurementOverview", "photos", "tasks"].forEach(name => resources.add(name));
  if (page === "nutrition") resources.add(nutritionHistoryOpen ? "nutritionHistory" : "nutritionDay");
  if (page === "history") resources.add("history");
  if (page === "measurementWizard" || measurementsOpen) resources.add("measurements");
  if (page === "profile") {
    ["history", "measurements", "photos"].forEach(name => resources.add(name));
    resources.add("nutritionHistory");
  }
  if (page === "aiCoach") ["history", "nutritionHistory", "measurements"].forEach(name => resources.add(name));
  if (photosOpen) resources.add("photos");
  return [...resources];
}

export function useClientDataDemand({ auth, user, appLoading, currentUserRole, page,
  profileActiveTab, measurementsOpen, photosOpen, nutritionHistoryOpen, nutritionDateKey, nutritionRevision, getContext }) {
  const queueRef = useRef(null);
  if (queueRef.current == null) queueRef.current = createPriorityLoadQueue();
  const retryVersionRef = useRef(0);
  const [resourceState, setResourceState] = useState(null);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const retry = useCallback((names) => {
    const session = captureAuthSession(auth);
    if (!session.isCurrent() || user?.uid !== session.uid) return false;
    retryVersionRef.current += 1;
    const requested = names == null ? null : new Set(Array.isArray(names) ? names : [names]);
    invalidateSessionResource(auth, key => {
      if (!key.startsWith("client-demand:")) return false;
      const [, name, owner] = key.split(":");
      return owner === session.uid && (!requested || requested.has(name));
    });
    setRetryGeneration(current => current + 1);
    return true;
  }, [auth, user]);
  const loadVisibleResources = useEffectEvent((isActive) => {
    const session = captureAuthSession(auth);
    if (!session.isCurrent() || user?.uid !== session.uid) return;
    const retryVersion = retryVersionRef.current;
    const isCurrent = () => isActive() && session.isCurrent() && retryVersionRef.current === retryVersion;
    const context = getContext();
    const loaders = {
      history: () => context.loadHistory(),
      nutritionDay: () => context.loadNutritionFromFirebase(session.uid, { mode: "days", dayKeys: [nutritionDateKey], throwOnError: true }),
      nutritionHistory: () => context.loadNutritionFromFirebase(session.uid, { mode: "full" }),
      measurements: () => context.loadProfileMeasurements(session.uid),
      measurementOverview: () => context.loadProfileMeasurementSnapshot(session.uid, { throwOnError: true }),
      photos: () => context.loadClientProgressPhotos(session.uid, { throwOnError: true }),
      tasks: () => context.loadClientTrainerTasks(session.uid, { throwOnError: true })
    };
    const updateResource = (name, status) => {
      if (!isCurrent()) return;
      setResourceState(current => {
        if (!isCurrent()) return current;
        const previous = current?.session.isCurrent() ? current.resources : {};
        const hasValue = status === "ready" || previous[name]?.hasValue === true;
        if (current?.session.isCurrent() && previous[name]?.status === status && previous[name]?.hasValue === hasValue) return current;
        return { session, resources: { ...previous, [name]: { status, hasValue } } };
      });
    };
    const resources = getClientResourceDemand({ page, profileActiveTab, measurementsOpen, photosOpen, nutritionHistoryOpen });
    resources.forEach((name, index) => {
      updateResource(name, "loading");
      const scope = name.startsWith("nutrition") ? `:${nutritionRevision ?? "initial"}:${name === "nutritionDay" ? nutritionDateKey : "full"}` : "";
      void queueRef.current.schedule(() => runSessionResource(auth, `client-demand:${name}:${session.uid}${scope}`,
        () => loaders[name](), { maxAgeMs: 60000 }), {
        priority: page === "main" && index > 1 ? 1 : 0,
        isCurrent
      }).then(value => updateResource(name, name === "measurementOverview" && value == null ? "error" : "ready")).catch(error => {
        if (isCurrent()) {
          updateResource(name, "error");
          console.warn("Visible client data load failed", name, error);
        }
      });
    });
  });
  useEffect(() => {
    if (appLoading || currentUserRole !== "client" || !user?.uid) return undefined;
    let active = true;
    const refresh = () => {
      if (active && document.visibilityState !== "hidden") loadVisibleResources(() => active);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    // Nutrition has its own active-screen freshness clock. Other snapshots are
    // refreshed on demand/return, not by an app-wide background polling loop.
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [appLoading, auth, auth.currentUser, currentUserRole, page, profileActiveTab, measurementsOpen, photosOpen, nutritionHistoryOpen, nutritionDateKey, nutritionRevision, retryGeneration, user]);
  const activeResources = resourceState?.session.isCurrent() && resourceState.session.uid === user?.uid ? resourceState.resources : {};
  const resources = Object.fromEntries(getClientResourceDemand({ page, profileActiveTab, measurementsOpen, photosOpen, nutritionHistoryOpen })
    .map(name => [name, activeResources[name] || { status: "loading", hasValue: false }]));
  return { resources, retry };
}

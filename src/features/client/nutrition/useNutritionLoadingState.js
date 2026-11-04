import { useCallback, useState } from "react";

// Coverage is separate from the diary. A partial read is never a full history,
// and moving to another generation invalidates the old history certificate.
export function mergeNutritionCoverage(current, update) {
    const sameUser = current?.uid === update.uid;
    const changedScope = update.generation !== undefined && (!sameUser ||
      current.generation !== update.generation || current.writerEpoch !== update.writerEpoch);
    const changedRevision = update.revision !== undefined && current?.revision !== update.revision;
    const reusable = sameUser && !changedScope && !changedRevision;
    const next = { ...(sameUser && !changedScope ? current : {}), ...update };
    next.historyComplete = update.complete === true || Boolean(reusable && current.historyComplete);
    if (reusable) {
      next.loadedDayKeys = [...new Set([...(current.loadedDayKeys || []), ...(update.loadedDayKeys || [])])];
      next.missingDayKeys = [...new Set([...(current.missingDayKeys || []), ...(update.missingDayKeys || [])])]
        .filter(key => !next.loadedDayKeys.includes(key));
    }
    return next;
}

export function useNutritionLoadingState({ user, nutrition, cloudReady }) {
  const [coverage, setCoverage] = useState(null);
  const onCoverageChange = useCallback(update => setCoverage(current => ({
    ...mergeNutritionCoverage(current?.sessionUser === user ? current : null, update), sessionUser: user
  })), [user]);
  const matching = coverage?.uid === user?.uid && coverage?.sessionUser === user;
  const scope = nutrition?.__nutritionStorage;
  const scopeMatches = !scope || coverage?.generation === scope.generation && coverage?.writerEpoch === scope.writerEpoch;
  const historyReady = Boolean(cloudReady && matching && scopeMatches && coverage.historyComplete);
  const offlineCache = typeof navigator !== "undefined" && navigator.onLine === false && nutrition?.__uid === user?.uid;
  const isDayReady = dayKey => Boolean(cloudReady && (offlineCache || matching && scopeMatches && (coverage.historyComplete || coverage.complete ||
    coverage.loadedDayKeys?.includes(dayKey) || coverage.missingDayKeys?.includes(dayKey) ||
    coverage.error && nutrition?.__uid === user?.uid && nutrition.days?.[dayKey])));
  return { coverage: matching ? coverage : null, historyReady, isDayReady, onCoverageChange };
}

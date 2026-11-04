import { collection, doc, getDoc, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { TRAINER_SUMMARY_BATCH_TIMEOUT_MS, TRAINER_SUMMARY_CACHE_MS, TRAINER_SUMMARY_LIMITS, TRAINER_SUMMARY_SOURCES, withSummaryDeadline, reconcileTrainerSummary } from "../../utils/trainerSummaryReadState.js";
import { captureAuthSession } from "../../utils/authSession.js";
import { runSessionResource } from "../../utils/sessionResource.js";
import { scheduleTrainerSummaryRead, TRAINER_INITIAL_SUMMARY_PAGE_SIZE } from "./trainerSummaryReadScheduler.js";
import { isNutritionDayStorageEnabled } from "../../utils/nutritionDayStorageConfig.js";

const summaryCaches = new WeakMap();

import {
  getActiveTrainerTasksCount,
  getClientPaymentAttention,
  getClientPlateauInfo
} from "../../domain/clientInsights";
import {
  buildTrainerClientRecentEvents,
  getTrainerAssignmentProgress,
  canLoadTrainerClientDeepSummary,
  getTrainerClientFastSummary,
  getTrainerLastMeasurementAt,
  getTrainerNutritionSummary,
  getTrainerProgramCompletionPercent,
  getTrainerProgramEndingAttention,
  getTrainerSettledCollectionItems,
  getTrainerSettledDocumentData,
  getTrainerSortedHistory,
  getTrainerSortedMeasurements,
  getTrainerSummaryReadFailures,
  getTrainerWorkoutFeedbackAttention,
  getTrainerWorkoutActivitySummary
} from "../../utils/trainerClientSummary";
import { getClientEffectiveNutritionGoals } from "../../utils/clientNutritionPlan";
import { getSubscriptionAttentionLabel, getSubscriptionStatus } from "../../utils/clientSubscription";
import { buildProgressInsight } from "../../utils/progressInsight";
import { getTrainerSummaryPeriodBounds } from "../../utils/trainerSummaryDates";
import { MAX_TRAINER_SUMMARY_CONCURRENCY } from "../../utils/trainerDataReadLimits.js";

function getTrainerClientScheduledDates(client = {}, workouts = []) {
  const calendar = client?.workoutCalendar || {};
  const calendarDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];
  const workoutDates = (Array.isArray(workouts) ? workouts : [])
    .map((workout) => workout?.scheduledDate || workout?.plannedDate)
    .filter(Boolean);
  // Keep the trainer score in lockstep with the client's dashboard: it uses
  // the saved calendar dates first, falling back to workout dates only when
  // there is no saved schedule yet.
  const source = calendarDates.length ? calendarDates : workoutDates;

  return [...new Set(source.filter((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

export function createTrainerClientSummaryLoader({
  db,
  auth,
  trainerClientSummaryRequestRef,
  setTrainerClientSummaries,
  setTrainerClientSummariesLoading
}) {
  async function loadTrainerClientSummaries(clients = [], { retryClientIds, initialOnly = false } = {}) {
    const dayStorage = isNutritionDayStorageEnabled();
    const eligibleClients = Array.isArray(clients) ? clients.filter((client) => client?.id && (client.role || "client") === "client") : [];
    const resourceKey = JSON.stringify(["trainer-summaries", dayStorage, initialOnly, retryClientIds || null,
      eligibleClients.map(client => [client.id, client.updatedAt, client.assignedProgramUpdatedAt, client.workoutCalendar?.updatedAt])]);
    return runSessionResource(auth, resourceKey, async ({ isCurrent: resourceIsCurrent }) => {
    const session = captureAuthSession(auth);
    if (!session.isCurrent()) return;
    const requestId = trainerClientSummaryRequestRef.current + 1;
    trainerClientSummaryRequestRef.current = requestId;
    const safeClients = eligibleClients;
    const startedAt = Date.now();
    const isCurrentRequest = () => resourceIsCurrent() && session.isCurrent() && trainerClientSummaryRequestRef.current === requestId;
    const previousCache = summaryCaches.get(trainerClientSummaryRequestRef);
    const canReuse = Boolean(previousCache?.session.isCurrent());
    const cache = canReuse ? previousCache.cache : new Map();
    summaryCaches.set(trainerClientSummaryRequestRef, { session, cache });
    const visibleIds = new Set(safeClients.map((client) => client.id));
    for (const id of cache.keys()) if (!visibleIds.has(id)) cache.delete(id);
    const requestedClients = safeClients.filter((client) => !retryClientIds || retryClientIds.includes(client.id));
    const queuedClients = initialOnly ? requestedClients.slice(0, TRAINER_INITIAL_SUMMARY_PAGE_SIZE) : requestedClients;
    const queuedIds = new Set(queuedClients.map(client => client.id));
    // A retry spends its deadline on clients that did not finish previously.
    queuedClients.sort((a, b) => Number(cache.get(a.id)?.summary?.trainerSummaryReady || false) - Number(cache.get(b.id)?.summary?.trainerSummaryReady || false));
    setTrainerClientSummariesLoading(true);

    if (!safeClients.length) {
      setTrainerClientSummaries({});
      setTrainerClientSummariesLoading(false);
      return;
    }

    const deferredSummary = (client, previousSummary) => {
      const cached = cache.get(client.id);
      const cacheKey = JSON.stringify([dayStorage, client.updatedAt, client.assignedProgramUpdatedAt, client.workoutCalendar?.updatedAt]);
      if (cached?.summary && cached.cacheKey === cacheKey && TRAINER_SUMMARY_SOURCES.every(source => cached.sources?.[source]?.value && !cached.sources[source].error && cached.sources[source].at &&
        Date.now() - cached.sources[source].at < TRAINER_SUMMARY_CACHE_MS)) return cached.summary;
      const sources = Object.fromEntries(TRAINER_SUMMARY_SOURCES.map(source => [source, { state: "deferred" }]));
      return { ...reconcileTrainerSummary(getTrainerClientFastSummary(client, previousSummary), previousSummary || {}, sources),
        trainerSummaryState: "deferred", trainerSummaryReady: false, trainerSummarySettled: false };
    };
    setTrainerClientSummaries((previous) => !isCurrentRequest() ? previous : Object.fromEntries(
      safeClients.map((client) => {
        const previousSummary = canReuse ? previous[client.id] : undefined;
        if (!queuedIds.has(client.id)) return [client.id, deferredSummary(client, previousSummary)];
        const sources = Object.fromEntries(TRAINER_SUMMARY_SOURCES.map((source) => [source, { state: "loading" }]));
        return [client.id, {
          ...reconcileTrainerSummary(getTrainerClientFastSummary(client, previousSummary), cache.get(client.id)?.summary || {}, sources),
          trainerSummaryReady: false, trainerSummarySettled: false, trainerSummaryState: "loading"
        }];
      })
    ));
    const nextSummaries = Object.fromEntries(safeClients.map((client) => [client.id,
      deferredSummary(client, cache.get(client.id)?.summary)]));
    let nextClientIndex = 0;
    const { weekStart, sevenDayStart, thirtyDayStart } = getTrainerSummaryPeriodBounds();

    const loadClientSummary = async (client) => {
      if (!canLoadTrainerClientDeepSummary(client)) {
        return {
          ...getTrainerClientFastSummary(client),
          trainerSummaryReady: true, trainerSummarySettled: true
        };
      }

      const cached = cache.get(client.id);
      const previous = { ...cached, sources: { ...cached?.sources } };
      const cacheKey = JSON.stringify([dayStorage, client.updatedAt, client.assignedProgramUpdatedAt, client.workoutCalendar?.updatedAt]);
      if (previous.summary?.trainerSummaryReady && previous.cacheKey === cacheKey && TRAINER_SUMMARY_SOURCES.every((source) => previous.sources[source]?.value && !previous.sources[source]?.error && Date.now() - previous.sources[source].at < TRAINER_SUMMARY_CACHE_MS)) return previous.summary;
      const sources = {};
      const version = client.assignedProgramUpdatedAt || client.assignedProgramAt;
      const readers = [
        () => getDocs(query(collection(db, "users", client.id, "history"), orderBy("date", "desc"), limit(TRAINER_SUMMARY_LIMITS.history))),
        async () => {
          if (!dayStorage) return getDoc(doc(db, "users", client.id, "nutrition", "state"));
          // A full paginated API operation occupies one scheduler source slot
          // until every page settles. Never fall back to frozen legacy state.
          const result = await (await import("../../utils/nutritionDayClient.js")).readNutritionState(client.id, { mode: "full" });
          if (!result?.state || result.state.__uid !== client.id || result.coverage?.complete !== true ||
            result.coverage.nextCursor || !Array.isArray(result.coverage.missingDayKeys) || result.coverage.missingDayKeys.length) {
            throw Object.assign(new Error("Питание клиента загружено не полностью."), { code: "nutrition/incomplete-read" });
          }
          return { exists: () => true, data: () => result.state };
        },
        () => getDocs(query(collection(db, "users", client.id, "measurements"), orderBy("date", "desc"), limit(TRAINER_SUMMARY_LIMITS.measurements))),
        () => getDoc(doc(db, "users", client.id, "payments", "current")),
        () => getDocs(query(collection(db, "users", client.id, "workouts"), ...(version ? [where("assignedProgramUpdatedAt", "==", version)] : []), limit(TRAINER_SUMMARY_LIMITS.workouts))),
        () => getDocs(query(collection(db, "users", client.id, "trainerTasks"), limit(TRAINER_SUMMARY_LIMITS.tasks)))
      ];
      const results = await Promise.all(TRAINER_SUMMARY_SOURCES.map(async (source, index) => {
        const saved = source === "nutrition" && Boolean(previous.dayStorage) !== dayStorage ? null : previous.sources[source];
        if (saved?.value && !saved.error && previous.cacheKey === cacheKey && Date.now() - saved.at < TRAINER_SUMMARY_CACHE_MS) {
          sources[source] = { state: "fresh", updatedAt: saved.at };
          return { status: "fulfilled", value: saved.value };
        }
        try {
          const timeoutMs = Math.min(4000, TRAINER_SUMMARY_BATCH_TIMEOUT_MS - (Date.now() - startedAt));
          const deadline = Date.now() + timeoutMs;
          const value = await withSummaryDeadline(() => scheduleTrainerSummaryRead(auth, readers[index],
            () => isCurrentRequest() && Date.now() < deadline), timeoutMs);
          if (!isCurrentRequest()) return { status: "rejected", reason: "superseded" };
          previous.sources[source] = { value, at: Date.now() };
          sources[source] = { state: "fresh", updatedAt: Date.now() };
          return { status: "fulfilled", value };
        } catch (reason) {
          if (!isCurrentRequest()) return { status: "rejected", reason };
          previous.sources[source] = { ...saved, error: true };
          sources[source] = { state: saved?.value ? "stale" : "error", updatedAt: saved?.at || null, code: reason?.code || "read-failed" };
          return saved?.value ? { status: "fulfilled", value: saved.value } : { status: "rejected", reason };
        }
      }));
      const [historyResult, nutritionResult, measurementsResult, paymentResult, workoutsResult, tasksResult] = results;
      const readFailures = getTrainerSummaryReadFailures({
        history: historyResult,
        nutrition: nutritionResult,
        measurements: measurementsResult,
        payment: paymentResult,
        workouts: workoutsResult,
        tasks: tasksResult
      });

      if (readFailures.names.length) {
        console.warn(
          `Trainer summary partial load failed for ${client.id}: ${readFailures.names.join(", ")}`,
          readFailures.reasons
        );
      }

      const clientHistory = getTrainerSortedHistory(getTrainerSettledCollectionItems(historyResult));
      const clientMeasurements = getTrainerSortedMeasurements(
        getTrainerSettledCollectionItems(measurementsResult)
      );
      const clientWorkouts = getTrainerSettledCollectionItems(workoutsResult);
      const clientTasks = getTrainerSettledCollectionItems(tasksResult);

      const nutritionState = getTrainerSettledDocumentData(nutritionResult, dayStorage ? null : client?.nutritionState || null);
      const nutritionSummary = getTrainerNutritionSummary(nutritionState);
      const assignedProgramUpdatedAt = client.assignedProgramUpdatedAt || client.assignedProgramAt || "";
      const { completedWorkoutCount, assignedWorkoutCount } = getTrainerAssignmentProgress(client, clientWorkouts, clientHistory);
      const payment = getTrainerSettledDocumentData(paymentResult);
      const weeklyProgressGoals = getClientEffectiveNutritionGoals(
        client,
        nutritionState,
        client.nutritionGoals || nutritionState?.goals || {}
      );
      const weeklyProgress = buildProgressInsight({
        history: clientHistory,
        measurements: clientMeasurements,
        nutrition: nutritionState || {},
        calorieGoal: Number(weeklyProgressGoals.calories),
        proteinGoal: Number(weeklyProgressGoals.protein),
        scheduledDates: getTrainerClientScheduledDates(client, clientWorkouts),
        goal: client.aiNutritionProfile?.goal || client.profile?.goal || "recomp"
      });
      const workoutActivitySummary = getTrainerWorkoutActivitySummary(clientHistory, {
        weekStart,
        sevenDayStart,
        thirtyDayStart
      });

      // Never turn a capped query into an all-time total or a complete monthly count.
      if (clientWorkouts.length >= TRAINER_SUMMARY_LIMITS.workouts) sources.workouts.state = "limited";
      if (clientTasks.length >= TRAINER_SUMMARY_LIMITS.tasks) sources.tasks.state = "limited";
      if (clientHistory.length >= TRAINER_SUMMARY_LIMITS.history && new Date(clientHistory.at(-1)?.date).getTime() >= thirtyDayStart) sources.history.state = "limited";
      const computed = {
        clientId: client.id,
        ...workoutActivitySummary,
        ...nutritionSummary,
        lastMeasurementAt: getTrainerLastMeasurementAt(clientMeasurements),
        assignedProgramId: client.assignedProgramId || "",
        assignedProgramUpdatedAt,
        assignedWorkoutCount,
        completedWorkoutCount,
        assignmentHistoryComplete: clientHistory.length < TRAINER_SUMMARY_LIMITS.history,
        weeklyProgressScore: weeklyProgress.score,
        plateau: getClientPlateauInfo(clientMeasurements),
        payment,
        paymentAttention: getClientPaymentAttention(payment),
        // Keep the persisted subscription alongside the deep summary. Without
        // it the overview only sees the legacy payment document and can show
        // a false "check subscription" notice for an active period.
        subscriptionStatus: getSubscriptionStatus(client.subscription || {}),
        subscriptionAttentionLabel: client.subscription
          ? getSubscriptionAttentionLabel(client.subscription)
          : "",
        activeTrainerTasksCount: getActiveTrainerTasksCount(clientTasks),
        workoutFeedbackAttention: getTrainerWorkoutFeedbackAttention(clientHistory),
        programEndingAttention: getTrainerProgramEndingAttention(assignedWorkoutCount, completedWorkoutCount),
        recentEvents: buildTrainerClientRecentEvents({
          clientId: client.id,
          historyList: clientHistory,
          nutritionSummary,
          measurements: clientMeasurements
        }),
        programCompletionPercent: getTrainerProgramCompletionPercent(
          assignedWorkoutCount,
          completedWorkoutCount,
          historyResult.status === "fulfilled"
        ),
        trainerSummaryReady: true
      };
      const resolved = reconcileTrainerSummary(computed, previous.summary || {}, sources);
      if (isCurrentRequest()) cache.set(client.id, { ...previous, summary: resolved, cacheKey, dayStorage });
      return resolved;
    };

    const workers = Array.from(
      { length: Math.min(MAX_TRAINER_SUMMARY_CONCURRENCY, queuedClients.length) },
      async () => {
        while (isCurrentRequest() && nextClientIndex < queuedClients.length && Date.now() - startedAt < TRAINER_SUMMARY_BATCH_TIMEOUT_MS) {
          const client = queuedClients[nextClientIndex];
          nextClientIndex += 1;

          try {
            nextSummaries[client.id] = await loadClientSummary(client);
          } catch (error) {
            console.warn(`Trainer summary load failed for ${client.id}:`, error);
            nextSummaries[client.id] = reconcileTrainerSummary(getTrainerClientFastSummary(client), cache.get(client.id)?.summary, Object.fromEntries(TRAINER_SUMMARY_SOURCES.map((source) => [source, { state: "error" }])));
          }

          if (isCurrentRequest()) {
            const resolvedSummary = nextSummaries[client.id];
            setTrainerClientSummaries((previous) => !isCurrentRequest() ? previous : ({
              ...previous,
              [client.id]: resolvedSummary
            }));
          }
        }
      }
    );

    await Promise.all(workers);

    if (isCurrentRequest()) {
      for (const client of queuedClients.slice(nextClientIndex)) {
        const previous = cache.get(client.id)?.summary || getTrainerClientFastSummary(client);
        nextSummaries[client.id] = reconcileTrainerSummary(previous, previous, Object.fromEntries(TRAINER_SUMMARY_SOURCES.map((source) => [source, { state: "stale", code: "summary/timeout" }])));
      }
      setTrainerClientSummaries(nextSummaries);
      setTrainerClientSummariesLoading(false);
    }
    });
  }

  return {
    loadTrainerClientSummaries
  };
}

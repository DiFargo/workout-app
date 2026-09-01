import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  getActiveTrainerTasksCount,
  getClientPaymentAttention,
  getClientPlateauInfo
} from "../../domain/clientInsights";
import {
  buildTrainerClientRecentEvents,
  getTrainerAssignedWorkoutCount,
  canLoadTrainerClientDeepSummary,
  getTrainerClientEmptySummary,
  getTrainerClientFastSummary,
  getTrainerCompletedWorkoutCountForAssignment,
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
  trainerClientSummaryRequestRef,
  setTrainerClientSummaries,
  setTrainerClientSummariesLoading
}) {
  async function loadTrainerClientSummaries(clients = []) {
    const requestId = trainerClientSummaryRequestRef.current + 1;
    trainerClientSummaryRequestRef.current = requestId;
    const safeClients = Array.isArray(clients) ? clients.filter((client) => client?.id) : [];
    setTrainerClientSummariesLoading(true);

    if (!safeClients.length) {
      setTrainerClientSummaries({});
      setTrainerClientSummariesLoading(false);
      return;
    }

    setTrainerClientSummaries((previous) => Object.fromEntries(
      safeClients.map((client) => [client.id, {
        ...getTrainerClientFastSummary(client, previous[client.id]),
        trainerSummaryReady: false
      }])
    ));
    const nextSummaries = {};
    let nextClientIndex = 0;
    const { weekStart, sevenDayStart, thirtyDayStart } = getTrainerSummaryPeriodBounds();

    const loadClientSummary = async (client) => {
      if (!canLoadTrainerClientDeepSummary(client)) {
        return {
          ...getTrainerClientFastSummary(client),
          trainerSummaryReady: true
        };
      }

      const [historyResult, nutritionResult, measurementsResult, paymentResult, workoutsResult, tasksResult] = await Promise.allSettled([
        getDocs(collection(db, "users", client.id, "history")),
        getDoc(doc(db, "users", client.id, "nutrition", "state")),
        getDocs(collection(db, "users", client.id, "measurements")),
        getDoc(doc(db, "users", client.id, "payments", "current")),
        getDocs(collection(db, "users", client.id, "workouts")),
        getDocs(collection(db, "users", client.id, "trainerTasks"))
      ]);
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

      const nutritionState = getTrainerSettledDocumentData(nutritionResult, client?.nutritionState || null);
      const nutritionSummary = getTrainerNutritionSummary(nutritionState);
      const assignedProgramUpdatedAt = client.assignedProgramUpdatedAt || client.assignedProgramAt || "";
      const completedWorkoutCount = getTrainerCompletedWorkoutCountForAssignment(
        clientHistory,
        assignedProgramUpdatedAt,
        client.workoutCalendar || {},
        clientWorkouts
      );
      const assignedWorkoutCount = getTrainerAssignedWorkoutCount(client, clientWorkouts);
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

      return {
        clientId: client.id,
        ...workoutActivitySummary,
        ...nutritionSummary,
        lastMeasurementAt: getTrainerLastMeasurementAt(clientMeasurements),
        assignedProgramId: client.assignedProgramId || "",
        assignedProgramUpdatedAt,
        assignedWorkoutCount,
        completedWorkoutCount,
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
    };

    const workers = Array.from(
      { length: Math.min(MAX_TRAINER_SUMMARY_CONCURRENCY, safeClients.length) },
      async () => {
        while (nextClientIndex < safeClients.length) {
          const client = safeClients[nextClientIndex];
          nextClientIndex += 1;

          try {
            nextSummaries[client.id] = await loadClientSummary(client);
          } catch (error) {
            console.warn(`Trainer summary load failed for ${client.id}:`, error);
            nextSummaries[client.id] = {
              ...getTrainerClientEmptySummary(client),
              trainerSummaryReady: true
            };
          }

          if (trainerClientSummaryRequestRef.current === requestId) {
            const resolvedSummary = nextSummaries[client.id];
            setTrainerClientSummaries((previous) => ({
              ...previous,
              [client.id]: resolvedSummary
            }));
          }
        }
      }
    );

    await Promise.all(workers);

    if (trainerClientSummaryRequestRef.current === requestId) {
      setTrainerClientSummaries(nextSummaries);
      setTrainerClientSummariesLoading(false);
    }
  }

  return {
    loadTrainerClientSummaries
  };
}

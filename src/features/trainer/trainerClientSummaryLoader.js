import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  getClientPaymentAttention,
  getClientPlateauInfo
} from "../../domain/clientInsights";
import {
  buildTrainerClientRecentEvents,
  getTrainerAssignedWorkoutCount,
  getTrainerClientEmptySummary,
  getTrainerClientFastSummary,
  getTrainerCompletedWorkoutCountForAssignment,
  getTrainerLastMeasurementAt,
  getTrainerNutritionSummary,
  getTrainerProgramCompletionPercent,
  getTrainerSettledCollectionItems,
  getTrainerSettledDocumentData,
  getTrainerSortedHistory,
  getTrainerSortedMeasurements,
  getTrainerSummaryReadFailures,
  getTrainerWorkoutActivitySummary
} from "../../utils/trainerClientSummary";
import { getTrainerSummaryPeriodBounds } from "../../utils/trainerSummaryDates";

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

    if (!safeClients.length) {
      setTrainerClientSummaries({});
      setTrainerClientSummariesLoading(false);
      return;
    }

    setTrainerClientSummaries((previous) => Object.fromEntries(
      safeClients.map((client) => [client.id, getTrainerClientFastSummary(client, previous[client.id])])
    ));
    setTrainerClientSummariesLoading(false);
    const nextSummaries = {};
    let nextClientIndex = 0;
    const { weekStart, sevenDayStart, thirtyDayStart } = getTrainerSummaryPeriodBounds();

    const loadClientSummary = async (client) => {
      const [historyResult, nutritionResult, measurementsResult, paymentResult, workoutsResult] = await Promise.allSettled([
        getDocs(collection(db, "users", client.id, "history")),
        getDoc(doc(db, "users", client.id, "nutrition", "state")),
        getDocs(collection(db, "users", client.id, "measurements")),
        getDoc(doc(db, "users", client.id, "payments", "current")),
        getDocs(collection(db, "users", client.id, "workouts"))
      ]);
      const readFailures = getTrainerSummaryReadFailures({
        history: historyResult,
        nutrition: nutritionResult,
        measurements: measurementsResult,
        payment: paymentResult,
        workouts: workoutsResult
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

      const nutritionState = getTrainerSettledDocumentData(nutritionResult, client?.nutritionState || null);
      const nutritionSummary = getTrainerNutritionSummary(nutritionState);
      const assignedProgramUpdatedAt = client.assignedProgramUpdatedAt || client.assignedProgramAt || "";
      const completedWorkoutCount = getTrainerCompletedWorkoutCountForAssignment(
        clientHistory,
        assignedProgramUpdatedAt,
        client.workoutCalendar || {}
      );
      const assignedWorkoutCount = getTrainerAssignedWorkoutCount(client, clientWorkouts);
      const payment = getTrainerSettledDocumentData(paymentResult);
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
        plateau: getClientPlateauInfo(clientMeasurements),
        payment,
        paymentAttention: getClientPaymentAttention(payment),
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
        )
      };
    };

    const workers = Array.from(
      { length: Math.min(4, safeClients.length) },
      async () => {
        while (nextClientIndex < safeClients.length) {
          const client = safeClients[nextClientIndex];
          nextClientIndex += 1;

          try {
            nextSummaries[client.id] = await loadClientSummary(client);
          } catch (error) {
            console.warn(`Trainer summary load failed for ${client.id}:`, error);
            nextSummaries[client.id] = getTrainerClientEmptySummary(client);
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

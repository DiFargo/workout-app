import { collection, doc, getDoc, getDocs, query, orderBy, limit, startAfter } from "firebase/firestore";
import { programDraftSnapshot } from "../../utils/trainerProgramDraft.js";
import { withSummaryDeadline } from "../../utils/trainerSummaryReadState.js";

const historyRequests = new WeakMap();
const HISTORY_PAGE_SIZE = 80;

import { APP_PAGES } from "../../app/appPages";
import { buildAdminClientNutritionStateFromRoot } from "../../utils/trainerClientMirror";
import { getDefaultAdminCalendar } from "../../utils/adminClientCalendar";
import { getMeasurementTimestampValue } from "../../utils/profileMeasurements";
import { getTrainerSummaryTimestamp } from "../../utils/trainerSummaryDates";
import { normalizeExercise, sortWorkoutDays } from "../../utils/workoutPlanNormalization";
import { isTrainerProgramClientVisible } from "../../utils/trainerProgramLifecycle.js";
import { filterTrainerCurrentPlanWorkouts } from "./trainerCurrentPlanWorkouts";

const STATUS_LOAD_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";

function getDocsAsItems(snapshot, withEditorSnapshot = false) {
  const items = [];
  if (snapshot?.forEach) {
    snapshot.forEach((itemDoc) => {
      // The Firestore document id is the address used by all plan actions.
      // Some older assignments also contain a stale `id` field in their data;
      // it must not replace the document id or an edit/delete can target a
      // different workout with the same legacy id.
      items.push({ ...itemDoc.data(), id: itemDoc.id, ...(withEditorSnapshot ? { _editorSnapshot: programDraftSnapshot(itemDoc.data()) } : {}) });
    });
  }
  return items;
}

function getSettledDocs(result) {
  return result.status === "fulfilled"
    ? result.value.docs.map((itemDoc) => ({ ...itemDoc.data(), id: itemDoc.id }))
    : [];
}

export function createTrainerClientOverviewLoader({
  db,
  auth,
  user,
  setSelectedUserId,
  setAdminSelectedClient,
  setAdminClientTab,
  setPage,
  setAdminClientPageOpen,
  setAdminUsersSelectedTab,
  setAdminClientLoading,
  setAdminClientStatus,
  setAdminClientTasks,
  setAdminClientProgressPhotos,
  setAdminClientEvents,
  setAdminClientPayment,
  setAdminPhotoCompareOpen,
  setAdminTaskComposerOpen,
  setAdminProgramControlOpen,
  setUsersList,
  setAdminAllUsersList,
  setAdminClientHistory,
  setAdminSelectedHistoryIds,
  setAdminClientNutrition,
  setAdminClientMeasurements,
  setAdminPaymentDraft,
  setAdminPhotoCompareIds,
  setAdminTrainerNote,
  setAdminCalendarDraft,
  setPlan,
  mirrorClientForTrainer,
  loadAdminTrainingTemplates
}) {
  async function loadHistoryPage(client) {
    const request = historyRequests.get(setAdminClientHistory);
    if (!request || request.clientId !== client.id || !request.cursor || request.loading || !request.hasMore) return false;
    request.loading = true;
    try {
      const snapshot = await withSummaryDeadline(() => getDocs(query(collection(db, "users", client.id, "history"), orderBy("date", "desc"), startAfter(request.cursor), limit(HISTORY_PAGE_SIZE))), 8000);
      if (historyRequests.get(setAdminClientHistory) !== request) return false;
      const items = getDocsAsItems(snapshot);
      request.cursor = snapshot.docs.at(-1) || request.cursor;
      request.hasMore = snapshot.size === HISTORY_PAGE_SIZE;
      setAdminClientHistory((previous) => [...new Map([...previous, ...items].map((item) => [item.id, item])).values()]);
      setAdminSelectedClient((previous) => previous?.id === client.id ? { ...previous, trainerHistoryHasMore: request.hasMore } : previous);
      return true;
    } catch (error) {
      console.warn("Earlier client history load failed:", error);
      return false;
    } finally { request.loading = false; }
  }

  async function loadAdminClientOverview(client, openClientPage = false) {
    if (!client?.id) return;
    if (openClientPage?.historyPage) return loadHistoryPage(client);

    const request = { clientId: client.id, cursor: null, hasMore: false, loading: false };
    historyRequests.set(setAdminClientHistory, request);
    const isCurrentClientRequest = () => historyRequests.get(setAdminClientHistory) === request;

    setSelectedUserId(client.id);
    setAdminSelectedClient(client);
    setAdminClientTab("overview");
    if (openClientPage) {
      setPage(APP_PAGES.ADMIN_USERS);
      setAdminClientPageOpen(true);
      setAdminUsersSelectedTab("overview");
    }
    setAdminClientLoading(true);
    setAdminClientStatus("");
    setPlan?.({ workouts: [], archivedWorkouts: [] });
    setAdminClientTasks([]);
    setAdminClientProgressPhotos([]);
    setAdminClientEvents([]);
    setAdminClientPayment(null);
    setAdminPhotoCompareOpen(false);
    setAdminTaskComposerOpen(false);
    setAdminProgramControlOpen(false);

    try {
      let freshClient = { ...client };
      const currentTrainerUid = auth.currentUser?.uid || user?.uid || "";

      try {
        const clientDocSnap = await getDoc(doc(db, "users", client.id));
        if (clientDocSnap.exists()) {
          freshClient = { id: clientDocSnap.id, ...client, ...clientDocSnap.data() };
        }
      } catch (clientDocError) {
        console.warn("Full client document unavailable, trying trainerClients mirror:", clientDocError);

        if (currentTrainerUid) {
          try {
            const linkedClientSnap = await getDoc(doc(db, "users", currentTrainerUid, "trainerClients", client.id));
            if (linkedClientSnap.exists()) {
              freshClient = {
                ...client,
                ...linkedClientSnap.data(),
                id: client.id,
                uid: client.id,
                clientId: client.id,
                role: "client"
              };
            }
          } catch (linkedClientReadError) {
            console.warn("Trainer client mirror read failed:", linkedClientReadError);
          }
        }
      }

      if (!isCurrentClientRequest()) return;

      setAdminSelectedClient(freshClient);
      setUsersList((prev) => prev.map((item) => item.id === freshClient.id ? { ...item, ...freshClient } : item));
      setAdminAllUsersList((prev) => prev.map((item) => item.id === freshClient.id ? { ...item, ...freshClient } : item));

      let historySnap = null;
      let historyLoadFailed = false;
      let nutritionSnap = null;
      let measurementsSnap = null;
      let workoutsSnap = null;

      try {
        historySnap = await withSummaryDeadline(() => getDocs(query(collection(db, "users", client.id, "history"), orderBy("date", "desc"), limit(HISTORY_PAGE_SIZE))), 8000);
        request.cursor = historySnap.docs.at(-1) || null;
        request.hasMore = historySnap.size === HISTORY_PAGE_SIZE;
      } catch (historyError) {
        console.error("Client history load failed:", historyError);
        historyLoadFailed = true;
        historySnap = null;
      }

      try {
        nutritionSnap = await getDoc(doc(db, "users", client.id, "nutrition", "state"));
      } catch (nutritionError) {
        console.error("Client nutrition load failed:", nutritionError);
        nutritionSnap = null;
      }

      try {
        measurementsSnap = await getDocs(collection(db, "users", client.id, "measurements"));
      } catch (measurementError) {
        console.error("Client measurements load failed:", measurementError);
        measurementsSnap = null;
      }

      try {
        workoutsSnap = await getDocs(collection(db, "users", client.id, "workouts"));
      } catch (workoutsError) {
        console.error("Client workouts load failed:", workoutsError);
        workoutsSnap = null;
      }

      const [tasksResult, photosResult, eventsResult, paymentResult, privateNoteResult] = await Promise.allSettled([
        getDocs(collection(db, "users", client.id, "trainerTasks")),
        getDocs(collection(db, "users", client.id, "progressPhotos")),
        getDocs(collection(db, "users", client.id, "trainerEvents")),
        getDoc(doc(db, "users", client.id, "payments", "current")),
        getDoc(doc(db, "trainerNotes", `${auth.currentUser?.uid || ""}_${client.id}`))
      ]);

      if (!isCurrentClientRequest()) return;

      const clientHistory = getDocsAsItems(historySnap);
      clientHistory.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const loadedWorkouts = getDocsAsItems(workoutsSnap, true).map((workout) => ({
        ...workout,
        name: workout.name || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f",
        status: workout.status || "planned",
        exercises: (workout.exercises || []).map(normalizeExercise)
      }));
      const clientWorkouts = sortWorkoutDays(
        filterTrainerCurrentPlanWorkouts(
          loadedWorkouts.filter((workout) => isTrainerProgramClientVisible({
            lifecycleStatus: workout.assignedProgramLifecycleStatus || "active"
          })),
          freshClient
        )
      );
      const currentWorkoutIds = new Set(
        clientWorkouts.map((workout) => String(workout?.id || "")).filter(Boolean)
      );
      // Older assignments are deliberately kept outside of `plan.workouts`.
      // Editor mutations only persist that active array, while this archive is
      // available to the trainer as read-only context.
      const archivedWorkouts = sortWorkoutDays(
        loadedWorkouts.filter((workout) => !currentWorkoutIds.has(String(workout?.id || "")))
      );

      const clientMeasurements = getDocsAsItems(measurementsSnap);
      clientMeasurements.sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

      const clientTasks = getSettledDocs(tasksResult);
      clientTasks.sort((a, b) => (
        getTrainerSummaryTimestamp(b.createdAt) - getTrainerSummaryTimestamp(a.createdAt)
      ));

      const clientProgressPhotos = getSettledDocs(photosResult);
      clientProgressPhotos.sort((a, b) => (
        getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt)
      ));

      const clientEvents = getSettledDocs(eventsResult);
      clientEvents.sort((a, b) => (
        getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt)
      ));

      const clientPayment = paymentResult.status === "fulfilled" && paymentResult.value.exists()
        ? paymentResult.value.data()
        : null;
      const privateTrainerNote = privateNoteResult.status === "fulfilled" && privateNoteResult.value.exists()
        ? privateNoteResult.value.data()?.text || ""
        : freshClient.trainerNote || "";

      [
        ["tasks", tasksResult],
        ["photos", photosResult],
        ["events", eventsResult],
        ["payment", paymentResult],
        ["private note", privateNoteResult]
      ].forEach(([label, result]) => {
        if (result.status === "rejected") {
          console.warn(`Client ${label} load failed for ${client.id}:`, result.reason);
        }
      });

      const nutritionState = nutritionSnap?.exists?.() ? nutritionSnap.data() : null;
      const mergedNutritionState = buildAdminClientNutritionStateFromRoot(freshClient, nutritionState);
      const fullClientForView = {
        ...freshClient,
        assignedWorkoutCount: clientWorkouts.length,
        nutritionGoals: freshClient.nutritionGoals || mergedNutritionState.goals,
        nutritionPlan: freshClient.nutritionPlan || mergedNutritionState.nutritionPlan,
        aiNutritionPlan: freshClient.aiNutritionPlan || mergedNutritionState.aiNutritionPlan
      };
      // This is intentionally view-only. Do not mirror a transient transport
      // failure back into the client's Firestore profile.
      const clientView = {
        ...fullClientForView,
        trainerHistoryLoadError: historyLoadFailed,
        trainerHistoryHasMore: request.hasMore
      };

      if (!isCurrentClientRequest()) return;

      setAdminSelectedClient(clientView);
      setUsersList((prev) => prev.map((item) => item.id === clientView.id ? { ...item, ...clientView } : item));
      setAdminAllUsersList((prev) => prev.map((item) => item.id === clientView.id ? { ...item, ...clientView } : item));
      await mirrorClientForTrainer(fullClientForView, mergedNutritionState);
      if (!isCurrentClientRequest()) return;

      setAdminClientHistory(clientHistory);
      setAdminSelectedHistoryIds([]);
      setAdminClientNutrition(mergedNutritionState);
      setAdminClientMeasurements(clientMeasurements);
      setAdminClientTasks(clientTasks);
      setAdminClientProgressPhotos(clientProgressPhotos);
      setAdminClientEvents(clientEvents);
      setAdminClientPayment(clientPayment);
      setAdminPaymentDraft({
        assignedFrom: clientPayment?.assignedFrom || "",
        controlUntil: clientPayment?.controlUntil || clientPayment?.nextPaymentAt || clientPayment?.paidUntil || "",
        format: clientPayment?.format || clientPayment?.tariff || "",
        status: ["active", "review", "paused"].includes(clientPayment?.status)
          ? clientPayment.status
          : clientPayment?.status === "overdue"
            ? "paused"
            : clientPayment?.status === "pending"
              ? "review"
              : "active",
        note: clientPayment?.note || ""
      });
      setAdminPhotoCompareIds([
        clientProgressPhotos[0]?.id || "",
        clientProgressPhotos[1]?.id || ""
      ]);
      setAdminTrainerNote(privateTrainerNote);
      setAdminCalendarDraft(getDefaultAdminCalendar(freshClient));
      setPlan?.({
        assignedProgramId: fullClientForView.assignedProgramId || "",
        assignedProgramName: fullClientForView.assignedProgramName || "",
        assignedProgramUpdatedAt: fullClientForView.assignedProgramUpdatedAt || fullClientForView.assignedProgramAt || "",
        workouts: clientWorkouts,
        archivedWorkouts
      });
      await loadAdminTrainingTemplates();
    } catch (error) {
      console.error("Client overview load failed:", error);
      if (isCurrentClientRequest()) {
        setAdminClientStatus(STATUS_LOAD_FAILED);
      }
    } finally {
      if (isCurrentClientRequest()) {
        setAdminClientLoading(false);
      }
    }
  }

  return {
    loadAdminClientOverview
  };
}

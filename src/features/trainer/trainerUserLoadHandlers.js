import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

import { getTrainerClientMirrorPayload } from "../../utils/trainerClientMirror";
import { buildTrainerUserLists, isCurrentTrainerClient } from "../../utils/trainerUserLists";
import { captureAuthSession } from "../../utils/authSession.js";
import { runSessionResource } from "../../utils/sessionResource.js";
import {
  mapWithConcurrency,
  MAX_TRAINER_LINKED_PROFILE_CONCURRENCY
} from "../../utils/trainerDataReadLimits.js";

// Linked-client mirrors may point to a large client base. Do not turn a single
// dashboard refresh into an unbounded fan-out of individual profile reads.

function isPermissionDeniedError(error) {
  return error?.code === "permission-denied" || String(error?.message || "").includes("Missing or insufficient permissions");
}
const userRequests = new WeakMap();

export async function loadTrainerUsersWithDeps({
  db,
  auth,
  adminEmail,
  adminSelectedClient,
  canUseAdminFeatures,
  canUseTrainerFeatures,
  loadTrainerClientSummaries,
  setAdminAllUsersList,
  setAdminClientStatus,
  setAdminSelectedClient,
  setSelectedUserId,
  setTrainerClientSummariesLoading,
  setUsersList
}) {
  return runSessionResource(auth, `trainer-users:${canUseAdminFeatures() ? "admin" : "trainer"}`, async ({ isCurrent: resourceIsCurrent }) => {
  const session = captureAuthSession(auth);
  if (!session.isCurrent() || !canUseTrainerFeatures()) return;
  const request = { session };
  userRequests.set(setUsersList, request);
  const isCurrentRequest = () => resourceIsCurrent() && session.isCurrent() && userRequests.get(setUsersList) === request;
  setTrainerClientSummariesLoading(true);

  const applyUsers = (items = []) => {
    if (!isCurrentRequest()) return null;
    const { users, clients } = buildTrainerUserLists(items, {
      isAdmin: canUseAdminFeatures(),
      adminEmail
    });

    setAdminAllUsersList(users);
    setUsersList(clients);

    if (!adminSelectedClient && clients.length) {
      setSelectedUserId(clients[0].id);
      setAdminSelectedClient(clients[0]);
    }

    return clients;
  };

  try {
    if (canUseAdminFeatures()) {
      const snapshot = await getDocs(collection(db, "users"));
      const users = [];

      snapshot.forEach((userDoc) => {
        users.push({
          ...userDoc.data(),
          id: userDoc.id
        });
      });

      const clients = applyUsers(users);
      if (clients && isCurrentRequest()) void loadTrainerClientSummaries(clients, { initialOnly: true });
      return;
    }

    const trainerUid = session.uid;
    const trainerEmail = String(auth.currentUser?.email || "").toLowerCase();
    const users = [];

    const trainerQueries = [
      trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("trainerId", "==", trainerUid)) : null,
      trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("assignedTrainerId", "==", trainerUid)) : null,
      trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("coachId", "==", trainerUid)) : null,
      trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("createdByUid", "==", trainerUid)) : null,
      trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("trainerEmail", "==", trainerEmail)) : null,
      trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("assignedTrainerEmail", "==", trainerEmail)) : null,
      trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("coachEmail", "==", trainerEmail)) : null,
      trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("createdByEmail", "==", trainerEmail)) : null,
      trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("createdBy", "==", trainerEmail)) : null
    ].filter(Boolean);

    const [queryResults, linkedClientsResult] = await Promise.all([
      Promise.allSettled(trainerQueries.map((trainerQuery) => getDocs(trainerQuery))),
      Promise.allSettled(trainerUid ? [getDocs(collection(db, "users", trainerUid, "trainerClients"))] : [])
    ]);
    if (!isCurrentRequest()) return;
    queryResults.forEach((result) => {
      if (result.status !== "fulfilled") return;
      result.value.forEach((userDoc) => {
        users.push({
          ...userDoc.data(),
          id: userDoc.id
        });
      });
    });

    if (trainerUid) {
      if (linkedClientsResult[0].status === "rejected") throw linkedClientsResult[0].reason;
      const linkedClientsSnap = linkedClientsResult[0].value;
      const loadedProfiles = new Map(users.map((profile) => [profile.id, profile]));
      const linkedClientDocs = [];

      linkedClientsSnap.forEach((linkDoc) => {
        linkedClientDocs.push({
          ...linkDoc.data(),
          id: linkDoc.id,
          trainerLinkDocId: linkDoc.id
        });
      });

      const linkedProfiles = await mapWithConcurrency(
        linkedClientDocs,
        MAX_TRAINER_LINKED_PROFILE_CONCURRENCY,
        async (linkedClient) => {
        if (!isCurrentRequest()) return null;
        const clientId = linkedClient.clientId || linkedClient.uid || linkedClient.id;
        if (!clientId) return null;
        if (loadedProfiles.has(clientId)) return loadedProfiles.get(clientId);

        try {
          const clientDoc = await getDoc(doc(db, "users", clientId));
          if (clientDoc.exists()) {
            return { ...clientDoc.data(), id: clientDoc.id };
          }
        } catch (profileReadError) {
          if (!isPermissionDeniedError(profileReadError)) {
            console.warn("Trainer linked client profile read failed:", profileReadError);
          }
        }

        return {
          ...linkedClient,
          id: clientId,
          uid: clientId,
          clientId,
          trainerLinkOnly: true,
          role: linkedClient.role || "client",
          name: linkedClient.name || linkedClient.email || "Клиент",
          email: linkedClient.email || "",
          trainerId: linkedClient.trainerId || trainerUid,
          trainerEmail: linkedClient.trainerEmail || trainerEmail
        };
        }
      );

      linkedProfiles.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.id) {
          users.push(result.value);
        }
      });
    }

    const currentTrainerClients = users.filter((candidate) => isCurrentTrainerClient(candidate, {
      trainerUid,
      trainerEmail
    }));
    const clients = applyUsers(currentTrainerClients);
    if (clients && isCurrentRequest()) void loadTrainerClientSummaries(clients, { initialOnly: true });
  } catch (err) {
    console.error("Ошибка загрузки пользователей:", err);
    if (!isCurrentRequest()) return;
    setAdminClientStatus("Не получилось загрузить клиентов. Проверь права Firestore для роли тренера.");
    setTrainerClientSummariesLoading(false);
  }
  });
}

export async function mirrorClientForTrainerWithDeps({
  db,
  clientData = {},
  nutritionState = null
}) {
  const clientId = clientData?.id || clientData?.uid || "";
  const trainerId = clientData?.trainerId || clientData?.assignedTrainerId || clientData?.coachId || "";
  if (!clientId || !trainerId) return;

  try {
    await setDoc(
      doc(db, "users", trainerId, "trainerClients", clientId),
      getTrainerClientMirrorPayload({ ...clientData, id: clientId }, nutritionState),
      { merge: true }
    );
  } catch (mirrorError) {
    console.warn("Trainer client mirror write failed:", mirrorError);
  }
}

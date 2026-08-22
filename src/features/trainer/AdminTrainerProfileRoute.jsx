/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { APP_PAGES } from "../../app/appPages";
import AdminTrainerProfile from "../../components/admin/AdminTrainerProfile";
import AdminWorkspace from "../../components/admin/AdminWorkspace";
import {
  assignAdminClient,
  getAdminOperationalUserId,
  manageAdminTrainerInvite,
  setAdminUserAccess,
  updateAdminUserRole
} from "./adminOperationalApi";

const TRAINER_LINK_ID_FIELDS = [
  "trainerId",
  "assignedTrainerId",
  "coachId"
];

const TRAINER_LINK_EMAIL_FIELDS = [
  "trainerEmail",
  "assignedTrainerEmail",
  "coachEmail"
];

// Older accounts can still retain the trainer that created them. Once an
// explicit assignment exists, it always wins over that historical value.
const LEGACY_TRAINER_LINK_ID_FIELDS = ["createdByUid"];
const LEGACY_TRAINER_LINK_EMAIL_FIELDS = ["createdByEmail"];

function getUserId(user) {
  return String(user?.id || user?.uid || "").trim();
}

function getEmail(value) {
  return String(value || "").trim().toLocaleLowerCase("ru");
}

function isAdmin(canUseAdminFeatures) {
  return typeof canUseAdminFeatures === "function"
    ? canUseAdminFeatures()
    : Boolean(canUseAdminFeatures);
}

function isActiveTrainerAccount(user) {
  const role = String(user?.role || "").trim().toLocaleLowerCase("ru");
  const status = String(user?.accountStatus || user?.status || "").trim().toLocaleLowerCase("ru");

  return ["trainer", "coach", "тренер", "коуч"].includes(role)
    && !user?.accessDisabled
    && !["disabled", "blocked", "suspended", "inactive", "revoked", "отозван"].includes(status);
}

export function isAdminTrainerSelection({ canUseAdminFeatures, selectedClient }) {
  return (
    isAdmin(canUseAdminFeatures) &&
    String(selectedClient?.role || "").trim().toLocaleLowerCase("ru") === "trainer"
  );
}

function isAssignedToTrainer(client, trainer) {
  if (String(client?.role || "client").trim().toLocaleLowerCase("ru") !== "client") {
    return false;
  }

  const trainerId = getUserId(trainer);
  const trainerEmail = getEmail(trainer?.email);
  const hasExplicitAssignmentFields = [
    ...TRAINER_LINK_ID_FIELDS,
    ...TRAINER_LINK_EMAIL_FIELDS
  ].some((field) => Object.prototype.hasOwnProperty.call(client || {}, field));
  const hasLinkedId = trainerId && TRAINER_LINK_ID_FIELDS.some(
    (field) => String(client?.[field] || "").trim() === trainerId
  );
  const hasLinkedEmail = trainerEmail && TRAINER_LINK_EMAIL_FIELDS.some(
    (field) => getEmail(client?.[field]) === trainerEmail
  );
  const hasLegacyLinkedId = !hasExplicitAssignmentFields && trainerId && LEGACY_TRAINER_LINK_ID_FIELDS.some(
    (field) => String(client?.[field] || "").trim() === trainerId
  );
  const hasLegacyLinkedEmail = !hasExplicitAssignmentFields && trainerEmail && LEGACY_TRAINER_LINK_EMAIL_FIELDS.some(
    (field) => getEmail(client?.[field]) === trainerEmail
  );

  return Boolean(hasLinkedId || hasLinkedEmail || hasLegacyLinkedId || hasLegacyLinkedEmail);
}

function getTrainerTemplates(templates, trainer) {
  const trainerId = getUserId(trainer);

  if (!trainerId) return [];

  return (Array.isArray(templates) ? templates : []).filter((template) => (
    template?.ownerRole === "trainer" &&
    String(template?.ownerUid || "").trim() === trainerId
  ));
}

function getTrainerLibraryExerciseCount(templates) {
  const exerciseKeys = new Set();

  templates.forEach((template) => {
    (template?.workouts || []).forEach((workout, workoutIndex) => {
      (workout?.exercises || []).forEach((exercise, exerciseIndex) => {
        const key = String(
          exercise?.id ||
          exercise?.sourceId ||
          exercise?.name ||
          `${template?.id || "template"}-${workoutIndex}-${exerciseIndex}`
        ).trim();

        if (key) exerciseKeys.add(key);
      });
    });
  });

  return exerciseKeys.size;
}

/**
 * Keeps the admin's trainer account view distinct from a client's health profile.
 * It only receives account-level and trainer-owned data; client workout callbacks
 * are deliberately not passed through this route.
 */
export default function AdminTrainerProfileRoute({
  adminEmail,
  adminName,
  adminAllUsersList,
  adminTrainingTemplates,
  canUseAdminFeatures,
  loadUsers,
  logout,
  openAdminBaseLibrary,
  openAdminClientsWithFilter,
  onLogout,
  onProfileClick,
  openProfileAccount,
  selectedClient,
  setAdminClientPageOpen,
  setAdminClientStatus,
  setAdminAllUsersList,
  setAdminSelectedClient,
  setPage,
  setTrainerNextSection,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab,
  user,
  usersList
}) {
  const trainer = selectedClient || {};
  const hasAdminAccess = isAdmin(canUseAdminFeatures);
  // Only the admin-wide list can prove that a trainer has no assigned clients.
  // A scoped usersList may be partial, so it is display-only and must not unlock
  // a role downgrade.
  const assignmentsKnown = Array.isArray(adminAllUsersList);
  const availableUsers = Array.isArray(adminAllUsersList)
    ? adminAllUsersList
    : (Array.isArray(usersList) ? usersList : []);
  const assignedClients = availableUsers.filter(
    (client) => isAssignedToTrainer(client, trainer)
  );
  const trainerTemplates = getTrainerTemplates(
    Array.isArray(adminTrainingTemplates) ? adminTrainingTemplates : [],
    trainer
  );
  const libraryExercisesCount = getTrainerLibraryExerciseCount(trainerTemplates);
  const trainerId = getAdminOperationalUserId(trainer);
  const [inviteLifecycle, setInviteLifecycle] = useState(null);
  const replacementTrainers = availableUsers.filter((candidate) => (
    getAdminOperationalUserId(candidate) !== trainerId && isActiveTrainerAccount(candidate)
  ));

  const patchAdminUser = (userId, patch) => {
    if (!userId || typeof setAdminAllUsersList !== "function") return;

    setAdminAllUsersList((previousUsers) => (Array.isArray(previousUsers) ? previousUsers.map((item) => (
      getAdminOperationalUserId(item) === userId ? { ...item, ...patch } : item
    )) : previousUsers));
  };

  const refreshUsers = () => {
    setAdminClientStatus?.("");
    void Promise.resolve().then(() => loadUsers?.()).catch((error) => {
      console.warn("Admin trainer profile refresh failed:", error);
    });
  };

  useEffect(() => {
    if (!hasAdminAccess || !trainerId) {
      return undefined;
    }

    let cancelled = false;
    void manageAdminTrainerInvite({ uid: trainerId, action: "status" })
      .then((result) => {
        const status = String(result?.invite?.status || "").trim();
        if (!cancelled && status) {
          setInviteLifecycle({ uid: trainerId, ...result.invite, status });
        }
      })
      .catch((error) => {
        // Older trainer accounts can predate invitations. Their profile remains
        // usable even when an invitation status is unavailable.
        console.warn("Admin trainer invitation status unavailable:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [hasAdminAccess, trainerId]);

  if (!hasAdminAccess) return null;

  const openUsers = () => {
    setAdminClientStatus?.("");
    setAdminSelectedClient?.(null);
    setAdminClientPageOpen?.(false);
    setTrainerNextSection?.("clients");

    if (typeof openAdminClientsWithFilter === "function") {
      openAdminClientsWithFilter("trainers");
      return;
    }

    setPage?.(APP_PAGES.ADMIN_USERS);
  };

  const openAdminSection = (sectionId) => {
    if (sectionId === "overview") {
      setAdminSelectedClient?.(null);
      setAdminClientPageOpen?.(false);
      setPage?.(APP_PAGES.ADMIN_PANEL);
      return;
    }

    if (sectionId === "users") {
      openUsers();
      return;
    }

    const tab = sectionId === "exercises" ? "exercises" : "programs";
    setAdminSelectedClient?.(null);
    setAdminClientPageOpen?.(false);

    if (typeof openAdminBaseLibrary === "function") {
      openAdminBaseLibrary(tab);
      return;
    }

    setPage?.(APP_PAGES.ADMIN_LIBRARY);
  };

  const openTrainerMaterials = (tab) => {
    setAdminClientStatus?.("");
    setAdminClientPageOpen?.(false);
    setAdminSelectedClient?.(trainer);
    setTrainerNextSection?.("workouts");
    setTrainerProgramManagerOpen?.(tab === "programs");
    setTrainerWorkoutTab?.(tab === "library" ? "library" : "programs");
    setPage?.(APP_PAGES.ADMIN_WORKOUTS);
  };

  const changeTrainerRole = async () => {
    if (!trainerId) throw new Error("trainer_id_missing");

    const result = await updateAdminUserRole({ uid: trainerId, role: "client" });
    patchAdminUser(trainerId, { ...(result?.user || {}), role: "client" });
    setAdminClientStatus?.("Роль тренера снята.");
    refreshUsers();
    openUsers();
    return result;
  };

  const changeTrainerAccess = async ({ action }) => {
    if (!trainerId) throw new Error("trainer_id_missing");

    const result = await setAdminUserAccess({ uid: trainerId, action });
    patchAdminUser(trainerId, {
      ...(result?.user || {}),
      accessDisabled: action === "suspend",
      accountStatus: result?.user?.membershipStatus || (action === "suspend" ? "suspended" : "active")
    });
    setAdminClientStatus?.(action === "suspend" ? "Доступ тренера приостановлен." : "Доступ тренера восстановлен.");
    refreshUsers();
    return result;
  };

  const reassignTrainerClients = async (replacementTrainerId) => {
    const targetTrainerId = String(replacementTrainerId || "").trim();
    if (!trainerId || !targetTrainerId) throw new Error("replacement_trainer_missing");

    const reassignedIds = new Set();
    const results = [];

    for (const client of assignedClients) {
      const clientId = getAdminOperationalUserId(client);
      if (!clientId) continue;

      try {
        const result = await assignAdminClient({ clientId, trainerId: targetTrainerId });
        reassignedIds.add(clientId);
        results.push(result);
      } catch (error) {
        error.reassignedCount = reassignedIds.size;
        error.remainingCount = Math.max(0, assignedClients.length - reassignedIds.size);
        refreshUsers();
        throw error;
      }
    }

    if (typeof setAdminAllUsersList === "function") {
      setAdminAllUsersList((previousUsers) => (Array.isArray(previousUsers) ? previousUsers.map((item) => (
        reassignedIds.has(getAdminOperationalUserId(item))
          ? { ...item, assignedTrainerId: targetTrainerId, trainerId: targetTrainerId, coachId: targetTrainerId }
          : item
      )) : previousUsers));
    }

    setAdminClientStatus?.(`Клиенты переназначены: ${results.length}.`);
    refreshUsers();
    return results;
  };

  const demoteTrainerWithReassignment = async (replacementTrainerId) => {
    const targetTrainerId = String(replacementTrainerId || "").trim();
    if (!trainerId || !targetTrainerId) throw new Error("replacement_trainer_missing");

    const result = await updateAdminUserRole({
      uid: trainerId,
      role: "client",
      reassignClientsToUid: targetTrainerId
    });

    const reassignedClientIds = new Set(assignedClients.map(getAdminOperationalUserId).filter(Boolean));
    setAdminAllUsersList?.((previousUsers) => (Array.isArray(previousUsers) ? previousUsers.map((item) => {
      const userId = getAdminOperationalUserId(item);
      if (userId === trainerId) return { ...item, ...(result?.user || {}), role: "client" };
      if (reassignedClientIds.has(userId)) {
        return { ...item, assignedTrainerId: targetTrainerId, trainerId: targetTrainerId, coachId: targetTrainerId };
      }
      return item;
    }) : previousUsers));

    setAdminClientStatus?.("\u041a\u043b\u0438\u0435\u043d\u0442\u044b \u043f\u0435\u0440\u0435\u0434\u0430\u043d\u044b, \u0440\u043e\u043b\u044c \u0442\u0440\u0435\u043d\u0435\u0440\u0430 \u0441\u043d\u044f\u0442\u0430.");
    refreshUsers();
    openUsers();
    return result;
  };

  const manageTrainerInvite = async (action) => {
    if (!trainerId) throw new Error("trainer_id_missing");
    const result = await manageAdminTrainerInvite({ uid: trainerId, action });
    const inviteStatus = String(result?.invite?.status || "").trim();

    patchAdminUser(trainerId, inviteStatus ? { accountStatus: inviteStatus } : {});
    if (inviteStatus) {
      setInviteLifecycle({ uid: trainerId, ...(result?.invite || {}), status: inviteStatus });
    }
    if (action === "resend") {
      const shareUrl = String(result?.invite?.shareUrl || result?.shareUrl || "").trim();
      if (shareUrl && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
      }
    }
    refreshUsers();
    return result;
  };

  return (
    <AdminWorkspace
      activeSection="users"
      adminEmail={adminEmail || user?.email || ""}
      adminMeta="Системное управление"
      adminName={adminName || user?.displayName || user?.name || user?.email?.split("@")[0] || "Администратор"}
      headerTitle="Профиль тренера"
      onLogout={onLogout || logout}
      onProfileClick={onProfileClick || openProfileAccount}
      subtitle="Профиль тренера, его подопечные и рабочие материалы"
      title="Админка"
      onSectionChange={openAdminSection}
      testId="admin-trainer-profile-workspace"
    >
      <AdminTrainerProfile
        trainer={inviteLifecycle?.uid === trainerId && inviteLifecycle?.status
          ? { ...trainer, accountStatus: inviteLifecycle.status, inviteExpiresAt: inviteLifecycle.expiresAt }
          : trainer}
        clients={assignedClients}
        counts={{
          assignedClients: assignedClients.length,
          assignmentsKnown,
          programs: trainerTemplates.length,
          programsKnown: Array.isArray(adminTrainingTemplates),
          libraryExercises: libraryExercisesCount,
          libraryKnown: Array.isArray(adminTrainingTemplates)
        }}
        onBack={openUsers}
        onOpenClients={() => openAdminClientsWithFilter?.("clients")}
        onOpenPrograms={() => openTrainerMaterials("programs")}
        onOpenLibrary={() => openTrainerMaterials("library")}
        onChangeRole={changeTrainerRole}
        onToggleAccess={changeTrainerAccess}
        onReassignClients={reassignTrainerClients}
        onDemoteWithReassignment={demoteTrainerWithReassignment}
        onResendInvite={() => manageTrainerInvite("resend")}
        onRevokeInvite={() => manageTrainerInvite("revoke")}
        replacementTrainers={replacementTrainers}
      />
    </AdminWorkspace>
  );
}

import { useState } from "react";
import { APP_PAGES } from "../../app/appPages";
import AdminClientAssignmentModal from "../../components/admin/AdminClientAssignmentModal";
import AdminTrainerInviteModal from "../../components/admin/AdminTrainerInviteModal";
import AdminUsersWorkspace, { getAdminUserName, getAdminUserRole } from "../../components/admin/AdminUsersWorkspace";
import AdminWorkspace from "../../components/admin/AdminWorkspace";
import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";
import { assignAdminClient, getAdminOperationalUserId, updateAdminUserRole } from "./adminOperationalApi";

function canUseAdmin(canUseAdminFeatures) {
  return typeof canUseAdminFeatures === "function"
    ? canUseAdminFeatures()
    : Boolean(canUseAdminFeatures);
}

function getUsersLoadError(status) {
  const message = String(status || "").trim();
  const normalized = message.toLocaleLowerCase("ru");

  if (!message) return "";

  return normalized.includes("загрузить пользователей")
    || normalized.includes("загрузить клиентов")
    || normalized.includes("права firestore")
    ? message
    : "";
}

function getRoleFilter(selectedTab, clientFilter) {
  const value = String(clientFilter || selectedTab || "").trim().toLocaleLowerCase("ru");

  if (["trainer", "trainers", "тренер", "тренеры"].includes(value)) return "trainer";
  if (["admin", "admins", "administrator", "administrators", "админ", "администраторы"].includes(value)) return "admin";
  if (["client", "clients", "клиент", "клиенты"].includes(value)) return "client";
  return "all";
}

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidLogin(value) {
  return /^[a-z0-9._-]{3,32}$/.test(value);
}

function isActiveTrainerAccount(user) {
  const status = String(user?.accountStatus || user?.status || "").trim().toLocaleLowerCase("ru");
  return getAdminUserRole(user) === "trainer"
    && !user?.accessDisabled
    && !["disabled", "blocked", "suspended", "inactive", "revoked", "отозван"].includes(status);
}

/**
 * Keeps the administrator directory separate from TrainerClientsWorkspaceRoute.
 * Trainers open their own account profile; client rows continue into the
 * pre-existing administrator client-detail route through the loader contract.
 */
export default function AdminUsersWorkspaceRoute(ctx) {
  const {
    adminAllUsersList,
    adminClientFilter,
    adminClientStatus,
    adminUsersSearch,
    adminUsersSelectedTab,
    canUseAdminFeatures,
    logout,
    loadUsers,
    openAdminBaseLibrary,
    openProfileAccount,
    refreshPage,
    setAdminClientPageOpen,
    setAdminClientStatus,
    setAdminSelectedClient,
    setAdminClientFilter,
    setAdminAllUsersList,
    setAdminUsersSearch,
    setAdminUsersSelectedTab,
    setPage,
    showAppConfirm,
    trainerClientSummariesLoading,
    user
  } = ctx;

  const [trainerInviteOpen, setTrainerInviteOpen] = useState(false);
  const [trainerInviteLoading, setTrainerInviteLoading] = useState(false);
  const [trainerInviteStatus, setTrainerInviteStatus] = useState("");
  const [createdTrainerInvite, setCreatedTrainerInvite] = useState(null);
  const [clientAssignmentOpen, setClientAssignmentOpen] = useState(false);
  const [clientAssignmentSaving, setClientAssignmentSaving] = useState(false);
  const [clientAssignmentStatus, setClientAssignmentStatus] = useState("");
  const [selectedAssignmentClient, setSelectedAssignmentClient] = useState(null);

  const users = Array.isArray(adminAllUsersList) ? adminAllUsersList : [];
  const error = getUsersLoadError(adminClientStatus);
  const activeRole = getRoleFilter(adminUsersSelectedTab, adminClientFilter);
  const activeTrainers = users.filter(isActiveTrainerAccount);

  const openSection = (sectionId) => {
    if (sectionId === "users") return;

    setAdminClientStatus?.("");
    setAdminSelectedClient?.(null);
    setAdminClientPageOpen?.(false);

    if (sectionId === "overview") {
      setPage?.(APP_PAGES.ADMIN_PANEL);
      return;
    }

    const tab = sectionId === "exercises" ? "exercises" : "programs";
    if (typeof openAdminBaseLibrary === "function") {
      openAdminBaseLibrary(tab);
      return;
    }

    setPage?.(APP_PAGES.ADMIN_LIBRARY);
  };

  const openTrainer = (trainer) => {
    setAdminClientStatus?.("");
    setAdminSelectedClient?.(trainer);
    setAdminClientPageOpen?.(true);
  };

  const openClient = (client) => {
    setAdminClientStatus?.("");

    if (typeof ctx.loadAdminClientOverview === "function") {
      void ctx.loadAdminClientOverview(client, true);
      return;
    }

    // Keep the existing detail route reachable even while an older runtime has
    // not provided the async overview loader yet.
    setAdminSelectedClient?.(client);
    setAdminClientPageOpen?.(true);
    setPage?.(APP_PAGES.ADMIN_USERS);
  };

  const retry = () => {
    setAdminClientStatus?.("");

    if (typeof ctx.loadUsers === "function") {
      void ctx.loadUsers();
      return;
    }

    refreshPage?.();
  };

  const changeRoleFilter = (role) => {
    const filter = role === "trainer"
      ? "trainers"
      : role === "admin"
        ? "admins"
        : role === "client"
          ? "clients"
          : "all";

    setAdminUsersSelectedTab?.(role);
    setAdminClientFilter?.(filter);
  };

  const openTrainerInvite = () => {
    setCreatedTrainerInvite(null);
    setTrainerInviteStatus("");
    setTrainerInviteOpen(true);
  };

  const closeTrainerInvite = () => {
    if (trainerInviteLoading) return;
    setTrainerInviteOpen(false);
    setTrainerInviteStatus("");
  };

  const createTrainerInvite = async ({ login: sourceLogin, name: sourceName }) => {
    const login = normalizeLogin(sourceLogin);
    const name = String(sourceName || "").trim();

    if (!name) {
      setTrainerInviteStatus("Укажите имя тренера.");
      return;
    }

    if (!isValidLogin(login)) {
      setTrainerInviteStatus("\u041b\u043e\u0433\u0438\u043d: 3\u201332 \u0441\u0438\u043c\u0432\u043e\u043b\u0430, \u043b\u0430\u0442\u0438\u043d\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044b, \u0442\u043e\u0447\u043a\u0430, \u0434\u0435\u0444\u0438\u0441 \u0438\u043b\u0438 _.");
      return;
    }

    setTrainerInviteLoading(true);
    setTrainerInviteStatus("");

    try {
      const response = await fetchAuthorizedWithTimeout("/api/admin/create-trainer-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, name })
      }, 20000);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const requestError = new Error(result?.error || "admin_trainer_invite_failed");
        requestError.code = result?.error || "admin_trainer_invite_failed";
        throw requestError;
      }

      const createdInvite = {
        ...(result?.trainer || {}),
        activationUrl: result?.activationUrl || "",
        inviteUrl: result?.inviteUrl || "",
        login: result?.login || login,
        shareUrl: result?.shareUrl || ""
      };
      setCreatedTrainerInvite(createdInvite);
      const trainer = result?.trainer;
      const trainerId = String(trainer?.id || trainer?.uid || "").trim();

      if (trainerId && typeof setAdminAllUsersList === "function") {
        const listTrainer = {
          ...trainer,
          accountStatus: trainer?.accountStatus || "pending",
          id: trainerId,
          role: trainer?.role || "trainer"
        };
        setAdminAllUsersList((previousUsers) => [
          listTrainer,
          ...(Array.isArray(previousUsers) ? previousUsers : []).filter((item) => String(item?.id || item?.uid || "") !== trainerId)
        ]);
      }

      if (typeof loadUsers === "function") {
        void Promise.resolve().then(() => loadUsers()).catch((error) => console.warn("Trainer list refresh failed:", error));
      }
    } catch (requestError) {
      console.error("Trainer invite failed:", requestError);
      const code = String(requestError?.code || "").toLowerCase();
      const message = String(requestError?.message || "");

      setTrainerInviteStatus(
        code.includes("already") || message.includes("already")
          ? "\u042d\u0442\u043e\u0442 \u043b\u043e\u0433\u0438\u043d \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442."
          : requestError?.name === "AbortError"
            ? "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f \u0437\u0430\u043d\u044f\u043b\u043e \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435."
            : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u0442\u0440\u0435\u043d\u0435\u0440\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437."
      );
    } finally {
      setTrainerInviteLoading(false);
    }
  };

  const promoteClientToTrainer = async (client) => {
    const targetId = String(client?.id || client?.uid || "").trim();
    if (!canUseAdmin(canUseAdminFeatures) || !targetId || getAdminUserRole(client) !== "client") return false;

    if (typeof showAppConfirm !== "function") {
      setAdminClientStatus?.("Не удалось открыть подтверждение назначения роли.");
      return false;
    }

    const name = getAdminUserName(client);
    const confirmed = await showAppConfirm({
      title: "Назначить тренером?",
      text: `${name} получит доступ к панели тренера, клиентам, программам и личной библиотеке. Данные аккаунта сохранятся.`,
      confirmText: "Назначить тренером",
      cancelText: "Отмена"
    });

    if (!confirmed) return false;

    const result = await updateAdminUserRole({ uid: targetId, role: "trainer" });
    const serverUser = result?.user && typeof result.user === "object" ? result.user : {};

    setAdminAllUsersList?.((previousUsers) => (Array.isArray(previousUsers) ? previousUsers.map((item) => (
      getAdminOperationalUserId(item) === targetId
        ? { ...item, ...serverUser, role: "trainer" }
        : item
    )) : previousUsers));

    void Promise.resolve().then(() => loadUsers?.()).catch((refreshError) => {
      console.warn("Admin promoted-user refresh failed:", refreshError);
    });
    return result;
  };

  const openClientAssignment = (client) => {
    setSelectedAssignmentClient(client);
    setClientAssignmentStatus("");
    setClientAssignmentOpen(true);
  };

  const closeClientAssignment = () => {
    if (clientAssignmentSaving) return;
    setClientAssignmentOpen(false);
    setClientAssignmentStatus("");
  };

  const saveClientAssignment = async (trainerId) => {
    const clientId = getAdminOperationalUserId(selectedAssignmentClient);
    if (!clientId || clientAssignmentSaving) return;

    setClientAssignmentSaving(true);
    setClientAssignmentStatus("");

    try {
      const result = await assignAdminClient({ clientId, trainerId: String(trainerId || "").trim() });
      const serverClient = result?.client && typeof result.client === "object" ? result.client : {};
      const nextTrainerId = String(serverClient.assignedTrainerId || serverClient.trainerId || serverClient.coachId || trainerId || "").trim();

      setAdminAllUsersList?.((previousUsers) => (Array.isArray(previousUsers) ? previousUsers.map((item) => (
        getAdminOperationalUserId(item) === clientId
          ? {
            ...item,
            ...serverClient,
            assignedTrainerId: nextTrainerId || "",
            trainerId: nextTrainerId || "",
            coachId: nextTrainerId || ""
          }
          : item
      )) : previousUsers));

      setClientAssignmentOpen(false);
      void Promise.resolve().then(() => loadUsers?.()).catch((refreshError) => {
        console.warn("Admin client assignment refresh failed:", refreshError);
      });
    } catch (requestError) {
      console.error("Admin client assignment failed:", requestError);
      setClientAssignmentStatus(
        requestError?.status === 404
          ? "Операция назначения пока недоступна. Обновите приложение и попробуйте ещё раз."
          : "Не удалось сохранить назначение. Проверьте подключение и попробуйте ещё раз."
      );
    } finally {
      setClientAssignmentSaving(false);
    }
  };

  if (!canUseAdmin(canUseAdminFeatures)) return null;

  return (
    <AdminWorkspace
      activeSection="users"
      adminEmail={user?.email || ""}
      adminMeta="Системное управление"
      adminName={user?.displayName || user?.name || user?.email?.split("@")[0] || "Администратор"}
      headerTitle="Пользователи и роли"
      onLogout={logout}
      onProfileClick={openProfileAccount}
      onSectionChange={openSection}
      subtitle="Управление типами аккаунтов и доступом к рабочим разделам"
      testId="admin-users-workspace-route"
      title="Админка"
    >
      <AdminUsersWorkspace
        activeRole={activeRole}
        error={error}
        isLoading={Boolean(trainerClientSummariesLoading && !users.length && !error)}
        search={adminUsersSearch}
        users={users}
        onOpenClient={openClient}
        onOpenTrainer={openTrainer}
        onAssignTrainer={openClientAssignment}
        onInviteTrainer={openTrainerInvite}
        onPromoteToTrainer={promoteClientToTrainer}
        onRetry={retry}
        onRoleChange={changeRoleFilter}
        onSearchChange={setAdminUsersSearch}
      />
      <AdminTrainerInviteModal
        createdInvite={createdTrainerInvite}
        isSubmitting={trainerInviteLoading}
        open={trainerInviteOpen}
        status={trainerInviteStatus}
        onClose={closeTrainerInvite}
        onSubmit={createTrainerInvite}
      />
      <AdminClientAssignmentModal
        client={selectedAssignmentClient}
        isSubmitting={clientAssignmentSaving}
        open={clientAssignmentOpen}
        status={clientAssignmentStatus}
        trainers={activeTrainers}
        onClose={closeClientAssignment}
        onSubmit={saveClientAssignment}
      />
    </AdminWorkspace>
  );
}

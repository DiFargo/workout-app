import { fetchAuthorized } from "../../utils/apiClient";
import {
  deleteClientFromTrainerPanelWithDeps,
  downloadTrainerClientExportWithDeps,
  handleTrainerClientActionWithDeps
} from "./trainerClientActionHandlers";
import {
  deleteClientEverywhereFromAdminPanelWithDeps,
  transferClientDataBetweenAccountsWithDeps,
  updateUserTrainerRoleWithDeps
} from "./trainerAccountAdminHandlers";
import {
  recordTrainerEventWithDeps,
  saveAdminTrainerNoteWithDeps
} from "./trainerEventHandlers";
import {
  loadTrainerUsersWithDeps,
  mirrorClientForTrainerWithDeps
} from "./trainerUserLoadHandlers";
import { getTrainerNextCreateClientStateWithDeps } from "./trainerNextCreateClientState";

export function createTrainerBridgeHandlers(getContext) {
  async function saveAdminTrainerNote() {
    const {
      auth,
      db,
      adminSelectedClient,
      adminTrainerNote,
      recordTrainerEvent,
      setAdminClientStatus
    } = getContext();

    return saveAdminTrainerNoteWithDeps({
      db,
      auth,
      adminSelectedClient,
      adminTrainerNote,
      recordTrainerEvent,
      setAdminClientStatus
    });
  }

  async function recordTrainerEvent(clientId, type, title, details = "") {
    const {
      auth,
      currentUserRole,
      db,
      setAdminClientEvents
    } = getContext();

    return recordTrainerEventWithDeps({
      db,
      auth,
      currentUserRole,
      setAdminClientEvents,
      clientId,
      type,
      title,
      details
    });
  }

  async function deleteClientEverywhereFromAdminPanel(client) {
    const {
      canUseAdminFeatures,
      deleteClientFromAdminPanel,
      setAdminClientStatus,
      showAppConfirm
    } = getContext();

    return deleteClientEverywhereFromAdminPanelWithDeps({
      canUseAdminFeatures,
      showAppConfirm,
      fetchAuthorized,
      deleteClientFromAdminPanel,
      setAdminClientStatus,
      client
    });
  }

  async function transferClientDataBetweenAccounts(fromUidOverride = null, toUidOverride = null) {
    const {
      ADMIN_EMAIL,
      adminAllUsersList,
      adminTransferFromUid,
      adminTransferToUid,
      auth,
      canUseTrainerFeatures,
      db,
      loadUsers,
      setAdminTransferLoading,
      setAdminTransferStatus,
      showAppConfirm,
      usersList
    } = getContext();

    return transferClientDataBetweenAccountsWithDeps({
      db,
      auth,
      adminEmail: ADMIN_EMAIL,
      adminTransferFromUid,
      adminTransferToUid,
      adminAllUsersList,
      usersList,
      canUseTrainerFeatures,
      showAppConfirm,
      loadUsers,
      setAdminTransferLoading,
      setAdminTransferStatus,
      fromUidOverride,
      toUidOverride
    });
  }

  async function updateUserTrainerRole(targetUser, makeTrainer = true) {
    const {
      canUseAdminFeatures,
      db,
      setAdminAllUsersList,
      setAdminClientStatus,
      setAdminSelectedClient,
      setUsersList
    } = getContext();

    return updateUserTrainerRoleWithDeps({
      db,
      canUseAdminFeatures,
      setUsersList,
      setAdminAllUsersList,
      setAdminSelectedClient,
      setAdminClientStatus,
      targetUser,
      makeTrainer
    });
  }

  async function loadUsers() {
    const {
      ADMIN_EMAIL,
      adminSelectedClient,
      auth,
      canUseAdminFeatures,
      canUseTrainerFeatures,
      db,
      loadTrainerClientSummaries,
      setAdminAllUsersList,
      setAdminClientStatus,
      setAdminSelectedClient,
      setSelectedUserId,
      setTrainerClientSummariesLoading,
      setUsersList,
      user
    } = getContext();

    return loadTrainerUsersWithDeps({
      db,
      auth,
      user,
      adminEmail: ADMIN_EMAIL,
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
    });
  }

  async function mirrorClientForTrainer(clientData = {}, nutritionState = null) {
    const { db } = getContext();

    return mirrorClientForTrainerWithDeps({
      db,
      clientData,
      nutritionState
    });
  }

  async function deleteClientFromAdminPanel(client, options = {}) {
    const {
      auth,
      canManageClientProgram,
      canUseAdminFeatures,
      canUseTrainerFeatures,
      db,
      loadUsers,
      selectedUserId,
      setAdminClientHistory,
      setAdminClientNutrition,
      setAdminClientPageOpen,
      setAdminClientStatus,
      setAdminSelectedClient,
      setSelectedUserId,
      setTrainerNextSection,
      showAppConfirm,
      user
    } = getContext();

    return deleteClientFromTrainerPanelWithDeps({
      db,
      auth,
      user,
      selectedUserId,
      canUseAdminFeatures,
      canUseTrainerFeatures,
      canManageClientProgram,
      showAppConfirm,
      loadUsers,
      setSelectedUserId,
      setAdminSelectedClient,
      setAdminClientHistory,
      setAdminClientNutrition,
      setAdminClientPageOpen,
      setAdminClientStatus,
      setTrainerNextSection,
      client,
      options
    });
  }

  function downloadTrainerClientExport(client, format = "excel") {
    const {
      adminClientHistory,
      adminClientMeasurements,
      adminClientNutrition,
      getAdminNutritionDaysList,
      setAdminClientStatus
    } = getContext();

    return downloadTrainerClientExportWithDeps({
      adminClientHistory,
      adminClientMeasurements,
      getAdminNutritionDaysList,
      adminClientNutrition,
      setAdminClientStatus,
      client,
      format
    });
  }

  async function handleTrainerClientAction(action, client, payload) {
    if (action === "delete") {
      return deleteClientEverywhereFromAdminPanel(client || getContext().adminSelectedClient);
    }
    const {
      adminClientHistory,
      adminClientMeasurements,
      adminClientNutrition,
      adminSelectedClient,
      auth,
      canManageClientProgram,
      canUseAdminFeatures,
      canUseTrainerFeatures,
      db,
      deleteClientFromAdminPanel,
      getAdminNutritionDaysList,
      plan,
      recordTrainerEvent,
      saveTrainerClientNotificationSettings,
      setAdminClientHistory,
      setAdminClientMeasurements,
      setAdminClientNutrition,
      setAdminClientProgressPhotos,
      setAdminClientStatus,
      setAdminSelectedClient,
      setPlan,
      setUsersList,
      showAppConfirm,
      user
    } = getContext();

    return handleTrainerClientActionWithDeps({
      db,
      auth,
      user,
      plan,
      adminSelectedClient,
      adminClientHistory,
      adminClientMeasurements,
      adminClientNutrition,
      canUseAdminFeatures,
      canUseTrainerFeatures,
      canManageClientProgram,
      showAppConfirm,
      getAdminNutritionDaysList,
      saveTrainerClientNotificationSettings,
      deleteClientFromAdminPanel,
      recordTrainerEvent,
      setAdminClientStatus,
      setAdminSelectedClient,
      setUsersList,
      setPlan,
      setAdminClientHistory,
      setAdminClientMeasurements,
      setAdminClientProgressPhotos,
      setAdminClientNutrition,
      action,
      payload,
      client: client || adminSelectedClient
    });
  }

  function getTrainerNextCreateClientState() {
    const {
      adminCreateClientModalOpen,
      adminCreateUserLoading,
      adminCreateUserStatus,
      adminCreatedCredentials,
      adminNewUserEmail,
      adminNewUserName,
      adminNewUserPassword,
      createUserFromAdminPanel,
      generateAdminPassword,
      setAdminCreateClientModalOpen,
      setAdminCreateUserStatus,
      setAdminCreatedCredentials,
      setAdminNewUserEmail,
      setAdminNewUserName,
      setAdminNewUserPassword
    } = getContext();

    return getTrainerNextCreateClientStateWithDeps({
      adminCreateClientModalOpen,
      adminNewUserName,
      adminNewUserEmail,
      adminNewUserPassword,
      adminCreateUserLoading,
      adminCreateUserStatus,
      adminCreatedCredentials,
      createUserFromAdminPanel,
      generateAdminPassword,
      setAdminCreateClientModalOpen,
      setAdminCreateUserStatus,
      setAdminCreatedCredentials,
      setAdminNewUserEmail,
      setAdminNewUserName,
      setAdminNewUserPassword
    });
  }

  return {
    deleteClientEverywhereFromAdminPanel,
    deleteClientFromAdminPanel,
    downloadTrainerClientExport,
    getTrainerNextCreateClientState,
    handleTrainerClientAction,
    loadUsers,
    mirrorClientForTrainer,
    recordTrainerEvent,
    saveAdminTrainerNote,
    transferClientDataBetweenAccounts,
    updateUserTrainerRole
  };
}

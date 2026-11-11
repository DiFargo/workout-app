/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import AdminWorkspace from "../../../src/components/admin/AdminWorkspace";
import TrainerClientsWorkspaceRoute from "../../../src/features/trainer/TrainerClientsWorkspaceRoute";
import { useModalFocusTrap } from "../../../src/shared/hooks/useModalFocusTrap";
import "../../../src/styles/index.css";
import "../../../src/styles/_variables.css";
import "../../../src/AppCoreTheme.module.css";
import "../../../src/shared/ui/ResponsiveModalLayer.module.css";
import "../../../src/AppCoreClientAppleTheme.css";
import "../../../src/components/trainer/TrainerWorkspaceV2.module.css";

if (!import.meta.env.DEV) {
  throw new Error("Локальная fixture недоступна в Production.");
}

document.documentElement.dataset.trainerVariant = "v2";

const noop = () => {};
const noWrite = async () => false;
const empty = [];
const client = {
  id: "pending-client-fixture",
  name: "Marina",
  role: "client",
  trainerId: "pending-trainer-fixture",
  profile: {},
  firstSetupCompleted: false,
  firstSetupCompletedVersion: 0
};
const summary = {};

function PendingClientCardHarness() {
  useModalFocusTrap();
  const [tab, setTab] = useState("overview");
  const isAdmin = new URLSearchParams(window.location.search).get("viewer") !== "trainer";

  return (
    <AdminWorkspace
      activeSection="users"
      contentLayout="client"
      adminEmail="viewer@example.test"
      adminMeta="Системное управление"
      headerTitle="Карточка клиента"
      subtitle="Данные клиента, его программа и прогресс"
      title="Админка"
      adminName={isAdmin ? "Администратор" : "Тренер"}
      onSectionChange={noop}
      onProfileClick={noop}
      onLogout={noop}
      testId="pending-client-card-fixture"
    >
      <TrainerClientsWorkspaceRoute
        APP_VERSION="local-fixture"
        embedded
        user={{ uid: isAdmin ? "pending-admin-fixture" : "pending-trainer-fixture" }}
        canUseAdminFeatures={() => isAdmin}
        usersList={[client]}
        adminAllUsersList={[client]}
        selectedClient={client}
        selectedProfile={{}}
        selectedSummary={summary}
        selectedClientSnapshot={null}
        selectedLastWorkoutReview={null}
        adminClientPageOpen
        adminClientLoading={false}
        adminClientTab={tab}
        setAdminClientTab={setTab}
        getClientCardSummary={() => summary}
        getClientActivityStatus={() => "unknown"}
        getAdminClientGoalLabel={() => ""}
        telegramProfile={{ avatarUrl: "" }}
        selectedTrainerName={isAdmin ? "Администратор" : "Тренер"}
        getTrainerNextCreateClientState={() => ({ onOpen: noop })}
        plan={{ workouts: empty, archivedWorkouts: empty }}
        sortWorkoutDays={items => items}
        trainerNextWorkspaceHandlers={{}}
        adminTrainingTemplates={empty}
        trainerExerciseLibraryItems={empty}
        adminClientMeasurements={empty}
        adminClientHistory={empty}
        adminClientEvents={empty}
        adminClientProgressPhotos={empty}
        adminClientTasks={empty}
        adminClientTelegramMessages={empty}
        clientNutritionDays={empty}
        selectedEffectiveNutritionGoals={{}}
        trainerNutritionPlanOptions={empty}
        selectedPhotoCompare={empty}
        adminClientStatus=""
        adminTrainerNote=""
        adminTaskComposerOpen={false}
        adminNewTaskDueDate=""
        adminNewTaskTitle=""
        trainerClientSummariesLoading={false}
        trainerSubscriptionNotificationSettings={{}}
        loadAdminTrainingTemplates={async () => empty}
        loadAdminClientOverview={noWrite}
        loadTrainerClientSummaries={noWrite}
        loadTrainerSubscriptionNotificationSettings={noWrite}
        saveTrainerSubscriptionNotificationSettings={noWrite}
        saveTrainerClientNutritionPlan={noWrite}
        saveTrainerClientNotificationSettings={noWrite}
        saveTrainerClientSetupProgress={noWrite}
        saveTrainerClientWorkoutSchedule={noWrite}
        saveWorkoutsToFirebase={noWrite}
        assignSavedProgramToClient={noWrite}
        archiveClientProgramAssignment={noWrite}
        restoreClientProgramAssignment={noWrite}
        renameClientProgramAssignment={noWrite}
        deleteClientProgramAssignment={noWrite}
        handleTrainerClientAction={noWrite}
        sendTrainerClientMessage={noWrite}
        sendAdminTestWorkoutReminder={noWrite}
        createAdminClientTask={noWrite}
        openClientTelegramConnection={noop}
        openTelegramChat={noop}
        openTrainerNextClient={noop}
        navigateTrainerNext={noop}
        refreshPage={noop}
        onCloseClient={noop}
        setAdminClientPageOpen={noop}
        setAdminClientStatus={noop}
        setAdminSelectedTemplateId={noop}
        setAdminNewTaskDueDate={noop}
        setAdminNewTaskTitle={noop}
        setAdminTaskComposerOpen={noop}
        logout={noop}
      />
    </AdminWorkspace>
  );
}

createRoot(document.getElementById("root")).render(<PendingClientCardHarness />);

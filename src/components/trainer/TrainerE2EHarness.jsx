import { useState } from "react";
import TrainerWorkspace from "./TrainerWorkspace";
import * as appConfig from "../../constants/appConfig";

function TrainerE2EHarness() {
  const APP_VERSION = appConfig?.APP_VERSION || "v0";
  const [mode, setMode] = useState("dashboard");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeClientTab, setActiveClientTab] = useState("overview");
  const [activeWorkoutTab, setActiveWorkoutTab] = useState("plan");
  const [selectedProgramId, setSelectedProgramId] = useState("program_tren_plus");
  const [selectedClient, setSelectedClient] = useState({
    id: "client_e2e",
    name: "Germes",
    email: "germes@example.com",
    goalDescription: "Рекомпозиция",
    assignedProgramId: "program_tren_plus",
    assignedProgramName: "tren+",
    assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
    assignedWorkoutCount: 4,
    workoutCalendar: {
      enabled: true,
      scheduledDates: ["2026-06-15", "2026-06-18", "2026-06-22", "2026-06-25"],
      reminderEnabled: true,
      reminderOffsetsHours: [24, 3],
      progressReminderSettings: {
        photoEnabled: true,
        measurementsEnabled: true,
        photoIntervalDays: 14,
        measurementsIntervalDays: 14
      }
    },
    telegram: { connected: true, username: "germes" },
    telegramNotificationsEnabled: true
  });
  const clients = [selectedClient];
  const history = [
    {
      id: "history_1",
      workoutId: "e2e_day_1",
      workoutName: "Тренировка 1",
      date: "2026-06-15T18:00:00.000Z",
      completedAt: "2026-06-15T18:00:00.000Z",
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { name: "Жим ногами", sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 90 }] }
      ]
    }
  ];
  const measurements = [
    { id: "m2", date: "2026-06-16", weight: 88.8, values: { weight: 88.8, belly: 88, chest: 104 } },
    { id: "m1", date: "2026-06-01", weight: 89.5, values: { weight: 89.5, belly: 90, chest: 103 } }
  ];
  const nutritionDays = [
    { date: "2026-06-17", totals: { calories: 2210, protein: 172, fat: 66, carbs: 228 }, foods: [] },
    { date: "2026-06-16", totals: { calories: 2290, protein: 181, fat: 69, carbs: 236 }, foods: [] }
  ];
  const workouts = [
    {
      id: "e2e_day_1",
      name: "Тренировка 1",
      scheduledDate: "2026-06-15",
      assignedProgramId: "program_tren_plus",
      assignedProgramName: "tren+",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e1", name: "Жим ногами", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "90" }, { reps: "12", weight: "90" }] },
        { id: "e2", name: "Тяга нижнего блока", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "35" }] }
      ]
    },
    {
      id: "e2e_day_2",
      name: "Тренировка 2",
      scheduledDate: "2026-06-18",
      assignedProgramId: "program_tren_plus",
      assignedProgramName: "tren+",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e3", name: "Жим лёжа с гантелями", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "20" }] }
      ]
    }
  ];
  const clientSummaries = {
    client_e2e: {
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      assignedWorkoutCount: 4,
      completedWorkoutCount: 1,
      programCompletionPercent: 25,
      workouts7: 1,
      nutritionDays7: 2,
      lastWorkoutAt: "2026-06-15T18:00:00.000Z",
      lastNutritionAt: "2026-06-17T12:00:00.000Z",
      lastMeasurementAt: "2026-06-16",
      workoutDateKeysCurrentWeek: ["2026-06-15"]
    }
  };
  const programTemplates = [
    { id: "program_tren_plus", name: "tren+", workoutsCount: 4 },
    { id: "program_support", name: "Поддержка", workoutsCount: 3 }
  ];
  const nutritionPlanOptions = [
    { id: "maintain", name: "Поддержка", calories: 2400, protein: 160, fat: 75, carbs: 260 },
    { id: "recomp", name: "Рекомпозиция", calories: 2300, protein: 180, fat: 70, carbs: 235 }
  ];

  function navigate(nextSection) {
    if (nextSection === "more") {
      setMode("cabinet");
      setActiveSection("more");
      return;
    }
    setMode(nextSection);
    setActiveSection(nextSection);
  }

  return (
    <TrainerWorkspace
      appVersion={APP_VERSION}
      mode={mode}
      activeSection={mode === "client" ? "clients" : activeSection}
      onNavigate={navigate}
      onRefresh={() => {}}
      trainerName="Beta"
      clients={clients}
      clientSummaries={clientSummaries}
      counts={{ active: 1, attention: 0 }}
      selectedClient={selectedClient}
      selectedProfile={{ goalLabel: "Рекомпозиция", weight: 88.8, height: 180, age: 28 }}
      selectedSummary={clientSummaries.client_e2e}
      activeClientTab={activeClientTab}
      onClientTabChange={(tab) => {
        setActiveClientTab(tab);
        setMode("client");
      }}
      onOpenClient={(client) => {
        setSelectedClient(client);
        setMode("client");
        setActiveSection("clients");
      }}
      onCloseClient={() => {
        setMode("clients");
        setActiveSection("clients");
      }}
      onCreateClient={() => {}}
      createClientState={{
        open: false,
        name: "",
        email: "",
        password: "",
        status: "",
        credentials: null,
        loading: false,
        onClose: () => {},
        onSubmit: () => {},
        onNameChange: () => {},
        onEmailChange: () => {},
        onPasswordChange: () => {},
        onGeneratePassword: () => {}
      }}
      measurements={measurements}
      history={history}
      nutritionDays={nutritionDays}
      nutritionGoals={{ calories: 2300, protein: 180, fat: 70, carbs: 235 }}
      nutritionPlanOptions={nutritionPlanOptions}
      photos={[{ id: "p1", date: "2026-06-01", frontUrl: "" }]}
      tasks={[]}
      trainerNote="Тестовая заметка"
      onGenerateNutritionPlan={() => {}}
      onSaveNutritionPlan={() => true}
      onSaveNotifications={() => true}
      onTestNotification={() => true}
      onConnectTelegram={() => {}}
      onSendMessage={() => true}
      onClientAction={() => true}
      workouts={workouts}
      exerciseLibrary={workouts.flatMap((workout) => workout.exercises)}
      programTemplates={programTemplates}
      selectedProgramId={selectedProgramId}
      onSelectProgram={setSelectedProgramId}
      onAssignProgram={() => true}
      onOpenProgramManager={() => setActiveWorkoutTab("plan")}
      activeWorkoutTab={activeWorkoutTab}
      onWorkoutTabChange={setActiveWorkoutTab}
      onSaveWorkoutSchedule={(dates) => {
        setSelectedClient((current) => ({
          ...current,
          workoutCalendar: {
            ...(current.workoutCalendar || {}),
            scheduledDates: dates,
            monthlyTrainingDates: dates,
            updatedAt: new Date().toISOString()
          }
        }));
        return true;
      }}
      programStatus=""
      onUpdateWorkout={() => {}}
      onUpdateExercise={() => {}}
      onUpdateExerciseSet={() => {}}
      onAddExerciseSet={() => {}}
      onRemoveExerciseSet={() => {}}
      onAddExercise={() => {}}
      onRemoveExercise={() => {}}
      onDuplicateExercise={() => {}}
      onMoveExercise={() => {}}
      onUploadExerciseVideo={() => {}}
      onAddDay={() => {}}
      onDuplicateDay={() => {}}
      onRemoveDay={() => {}}
      onSaveWorkouts={() => {}}
      onLogout={() => {}}
    />
  );
}

export default TrainerE2EHarness;

import { useRef, useState } from "react";
import TrainerWorkspace, { TrainerShell } from "./TrainerWorkspace";
import * as appConfig from "../../constants/appConfig";
import { normalizeTrainerSubscriptionNotificationSettings } from "../../utils/trainerSubscriptionNotificationSettings";

function TrainerE2EHarness({ ProgramManagerView }) {
  const APP_VERSION = appConfig?.APP_VERSION || "v0";
  const [mode, setMode] = useState("dashboard");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeClientTab, setActiveClientTab] = useState("overview");
  const [activeWorkoutTab, setActiveWorkoutTab] = useState("plan");
  const [selectedProgramId, setSelectedProgramId] = useState("program_tren_plus");
  const [programManagerOpen, setProgramManagerOpen] = useState(false);
  const [programLibraryTab, setProgramLibraryTab] = useState("overview");
  const [programCreateChoiceOpen, setProgramCreateChoiceOpen] = useState(false);
  const [programWorkoutId, setProgramWorkoutId] = useState("e2e_day_1");
  const [exerciseProgressReviews, setExerciseProgressReviews] = useState([]);
  const [telegramMessages, setTelegramMessages] = useState([]);
  const [trainerSubscriptionNotificationSettings, setTrainerSubscriptionNotificationSettings] = useState(
    () => normalizeTrainerSubscriptionNotificationSettings()
  );
  const programImportInputRef = useRef(null);
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
      scheduledDates: ["2026-06-15", "2026-06-18", "2026-07-20"],
      plannedWorkouts: [
        { workoutId: "e2e_day_1", order: 1, date: "2026-06-15", status: "completed" },
        { workoutId: "e2e_day_2", order: 2, date: "2026-06-18", status: "missed" },
        { workoutId: "e2e_day_3", order: 3, date: "2026-07-20", status: "planned" }
      ],
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
      clientComment: "Тяжело идёт, немного уменьшал вес относительно программы.",
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { name: "Жим ногами", sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 90 }] }
      ]
    },
    {
      id: "history_2",
      workoutId: "e2e_day_1_repeat",
      workoutName: "Тренировка 1",
      date: "2026-07-07T18:00:00.000Z",
      completedAt: "2026-07-07T18:00:00.000Z",
      clientComment: "Повторы выполнил, но рабочий вес пришлось снизить.",
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { name: "Жим ногами", sets: [{ reps: 12, weight: 70 }, { reps: 12, weight: 70 }] }
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
  const [workouts, setWorkouts] = useState([
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
    },
    {
      id: "e2e_day_3",
      name: "Тренировка 3",
      scheduledDate: "2026-07-20",
      status: "planned",
      assignedProgramId: "program_tren_plus",
      assignedProgramName: "tren+",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e4", name: "Жим ногами", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "70" }, { reps: "12", weight: "70" }] }
      ]
    }
  ]);
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
    if (nextSection === "workouts") {
      setActiveWorkoutTab("plan");
    }
    setMode(nextSection);
    setActiveSection(nextSection);
  }

  if (programManagerOpen && ProgramManagerView) {
    const monthGroups = [{
      id: "month_e2e",
      name: "Месяц 1",
      microcycles: [{
        id: "cycle_e2e",
        name: "Микроцикл 1",
        weeks: [{ id: "week_e2e", name: "Неделя 1", workouts }]
      }]
    }];

    return (
      <TrainerShell activeSection="workouts" onNavigate={navigate} trainerName="Beta">
        <div className="trainerNextPage trainerNextWorkoutPage trainerNextProgramsTab">
          <div className="trainerNextDesktopPageHead">
            <div>
              <h1>{programLibraryTab === "editor" ? "Редактор программы" : "Программы тренировок"}</h1>
              <p>Создание программ и назначение клиентам</p>
            </div>
          </div>
          <header className="trainerNextMobileHeader">
            <div className="trainerNextMobileTitle">{programLibraryTab === "editor" ? "Редактор программы" : "Библиотека программ"}</div>
          </header>
          <div className="trainerNextPageTabs">
            <button type="button" className="active" aria-pressed="true">Программы</button>
            <button type="button">Библиотека упражнений</button>
          </div>
          <ProgramManagerView
            APP_PAGES={{ ADMIN: "admin" }}
            adminExerciseLibrary={workouts.flatMap((workout) => workout.exercises)}
            adminOpenWorkoutId={programWorkoutId}
            adminProgramCopyTarget={null}
            adminProgramCreateChoiceOpen={programCreateChoiceOpen}
            adminProgramImportInputRef={programImportInputRef}
            adminProgramLibraryTab={programLibraryTab}
            adminSelectedExerciseId=""
            adminSelectedTemplateId={selectedProgramId}
            adminTrainingTemplates={programTemplates}
            canUseAdminFeatures={() => false}
            createNewMonthProgramDraft={() => setProgramLibraryTab("editor")}
            deleteSelectedProgramFromLibrary={() => {}}
            getTemplateStats={(template) => ({
              weeksCount: 4,
              workoutsCount: template.workoutsCount || 0,
              blocksCount: 1,
              exercisesCount: workouts.flatMap((workout) => workout.exercises).length
            })}
            importMonthProgramWithAi={async () => {}}
            isTrainerNextWorkspace={() => true}
            loadAdminTrainingTemplates={() => {}}
            monthGroups={monthGroups}
            normalizedMonthProgram={{ id: selectedProgramId, name: "tren+" }}
            openAdminProgramsOverview={() => setProgramLibraryTab("overview")}
            openProgramFromLibrary={() => setProgramLibraryTab("editor")}
            setAdminExerciseSearch={() => {}}
            setAdminOpenWorkoutId={setProgramWorkoutId}
            setAdminProgramCopyTarget={() => {}}
            setAdminProgramCreateChoiceOpen={setProgramCreateChoiceOpen}
            setAdminSelectedExerciseId={() => {}}
            setAdminSelectedTemplateId={setSelectedProgramId}
            setPage={() => {}}
            setTrainerProgramManagerOpen={setProgramManagerOpen}
            updateMonthProgramName={() => {}}
            saveMonthProgramToLibrary={() => {}}
            addMonthWorkout={() => {}}
            updateMonthWorkout={() => {}}
            confirmRemoveMonthWorkout={() => {}}
            duplicateMonthWorkout={() => {}}
            addMonthExercise={() => {}}
            updateMonthExercise={() => {}}
            updateMonthExerciseName={() => {}}
            removeMonthExercise={() => {}}
            duplicateMonthExercise={() => {}}
            moveMonthExercise={() => {}}
            updateMonthExerciseSet={() => {}}
            addMonthExerciseSet={() => {}}
            removeMonthExerciseSet={() => {}}
            uploadMonthExerciseVideo={() => {}}
          />
          <input ref={programImportInputRef} type="file" hidden />
        </div>
      </TrainerShell>
    );
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
      exerciseProgressReviews={exerciseProgressReviews}
      nutritionDays={nutritionDays}
      nutritionGoals={{ calories: 2300, protein: 180, fat: 70, carbs: 235 }}
      nutritionPlanOptions={nutritionPlanOptions}
      photos={[{ id: "p1", date: "2026-06-01", frontUrl: "" }]}
      tasks={[{
        id: "task_e2e",
        title: "Заполнить дневник самочувствия",
        status: "active",
        dueDate: "2026-07-20"
      }]}
      trainerNote="Тестовая заметка"
      onGenerateNutritionPlan={() => {}}
      onSaveNutritionPlan={() => true}
      trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
      onLoadTrainerSubscriptionNotifications={() => Promise.resolve(trainerSubscriptionNotificationSettings)}
      onSaveTrainerSubscriptionNotifications={(settings) => {
        const next = normalizeTrainerSubscriptionNotificationSettings(settings);
        setTrainerSubscriptionNotificationSettings(next);
        return Promise.resolve(next);
      }}
      onSaveNotifications={(settings = {}) => {
        setSelectedClient((current) => settings.subscriptionOnly
          ? {
              ...current,
              subscription: { ...(current.subscription || {}), ...(settings.subscription || {}) }
            }
          : {
              ...current,
              workoutCalendar: {
                ...(current.workoutCalendar || {}),
                scheduledDates: settings.scheduledDates || current.workoutCalendar?.scheduledDates || [],
                reminderEnabled: settings.enabled !== false,
                reminderOffsetsHours: settings.offsets || current.workoutCalendar?.reminderOffsetsHours || []
              }
            });
        return true;
      }}
      onTestNotification={() => true}
      onConnectTelegram={() => {}}
      onSendMessage={(text, _client, replyContext) => {
        if (replyContext?.sourceCommentId) {
          setTelegramMessages((current) => [...current, {
            id: replyContext.replyId || `reply_${Date.now()}`,
            text,
            status: "sent",
            sentAt: new Date().toISOString(),
            sourceCommentId: replyContext.sourceCommentId,
            replyContext
          }]);
        }
        return true;
      }}
      telegramMessages={telegramMessages}
      onClientAction={(action, _client, payload) => {
        if (action === "resolve_client_messages") {
          setExerciseProgressReviews((current) => [{
            id: `message_resolution_${Date.now()}`,
            type: "client_message_resolution",
            title: "Сообщения обработаны без ответа",
            details: JSON.stringify({
              sourceCommentIds: payload.sourceCommentIds || [],
              decision: "handled_without_reply"
            }),
            date: new Date().toISOString()
          }, ...current]);
        }
        if (action === "resolve_workout_review") {
          setExerciseProgressReviews((current) => [{
            id: `workout_review_${Date.now()}`,
            type: "workout_review",
            title: payload.decision === "adjusted" ? "Тренировка скорректирована" : "Корректировка не требуется",
            details: JSON.stringify(payload),
            date: new Date().toISOString()
          }, ...current]);
        }
        return true;
      }}
      onResolveExerciseProgress={(payload) => {
        setExerciseProgressReviews((current) => [{
          id: `review_${Date.now()}`,
          type: "exercise_progress_review",
          title: `Нагрузка проверена: ${payload.exerciseName}`,
          details: JSON.stringify(payload),
          date: new Date().toISOString()
        }, ...current]);
        return true;
      }}
      workouts={workouts}
      exerciseLibrary={workouts.flatMap((workout) => workout.exercises)}
      programTemplates={programTemplates}
      selectedProgramId={selectedProgramId}
      onSelectProgram={setSelectedProgramId}
      onAssignProgram={() => true}
      onOpenProgramManager={() => setProgramManagerOpen(true)}
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
      onSaveExerciseProgressAdjustment={({ workoutId, exerciseId, patch }) => {
        setWorkouts((current) => current.map((workout) => workout.id === workoutId
          ? {
              ...workout,
              exercises: (workout.exercises || []).map((exercise) => exercise.id === exerciseId
                ? { ...exercise, ...patch }
                : exercise)
            }
          : workout));
        return true;
      }}
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
      onSaveWorkouts={() => true}
      onLogout={() => {}}
    />
  );
}

export default TrainerE2EHarness;

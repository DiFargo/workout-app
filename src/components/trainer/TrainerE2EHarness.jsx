import { useRef, useState } from "react";
import TrainerWorkspace, { TrainerShell } from "./TrainerWorkspace";
import * as appConfig from "../../constants/appConfig";
import { normalizeTrainerSubscriptionNotificationSettings } from "../../utils/trainerSubscriptionNotificationSettings";

function TrainerE2EHarness({ ProgramManagerView }) {
  const APP_VERSION = appConfig?.APP_VERSION || "v0";
  const includeProgramAssignmentHistory = new URLSearchParams(window.location.search).get("programAssignments") === "1";
  const includeBasicWorkoutHistory = new URLSearchParams(window.location.search).get("basicHistory") === "1";
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
    role: "client",
    name: "Germes",
    email: "germes@example.com",
    goalDescription: "Рекомпозиция",
    assignedProgramId: "program_tren_plus",
    assignedProgramName: "tren+",
    assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
    assignedWorkoutCount: 4,
    firstSetupCompleted: true,
    trainerSetupChecklist: {
      completedSteps: {
        subscription: true,
        program: true,
        nutrition: true,
        notifications: true
      },
      completedAt: "2026-06-10T10:00:00.000Z"
    },
    workoutCalendar: {
      enabled: true,
      scheduledDates: ["2026-06-15", "2026-06-18", "2026-07-20"],
      plannedWorkouts: [
        { workoutId: "e2e_day_1", order: 1, date: "2026-06-15", status: "completed" },
        { workoutId: "e2e_day_2", order: 2, date: "2026-06-18", status: "missed" },
        { workoutId: "e2e_day_3", order: 3, date: "2026-07-20", status: "planned" },
        ...(includeBasicWorkoutHistory ? [{
          workoutId: "e2e_basic_day_1",
          order: 4,
          date: "2026-06-04",
          status: "completed",
          assignedProgramUpdatedAt: "basic:client-plan"
        }] : [])
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
        { name: "Жим ногами", sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 90 }] },
        { name: "Тяга нижнего блока", sets: [{ reps: 12, weight: 35 }] }
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
    },
    ...(new URLSearchParams(window.location.search).get("completedHistoryVersionMismatch") === "1" ? [{
      id: "history_completed_id_mismatch",
      workoutId: "e2e_day_3",
      workoutName: "Тренировка 3",
      date: "2026-07-08T18:00:00.000Z",
      completedAt: "2026-07-08T18:00:00.000Z",
      // This represents a completion written before an assignment marker was
      // refreshed. The immutable workoutId remains the source of truth.
      assignedProgramUpdatedAt: "previous-assignment",
      exercises: [{ name: "Жим ногами", sets: [{ reps: 12, weight: 70 }] }]
    }] : []),
    ...(includeBasicWorkoutHistory ? [{
      id: "history_basic_1",
      workoutId: "e2e_basic_day_1",
      workoutName: "Базовая тренировка",
      date: "2026-05-20T18:00:00.000Z",
      completedAt: "2026-05-20T18:00:00.000Z",
      source: "basic",
      assignedProgramId: "basic_client_plan",
      assignedProgramUpdatedAt: "basic:client-plan",
      exercises: [{ name: "Приседания", sets: [{ reps: 10, weight: 40 }] }]
    }] : [])
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
      assignedProgramAddedAt: "2026-06-10T10:00:00.000Z",
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
      assignedProgramAddedAt: "2026-06-10T10:00:00.000Z",
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
      assignedProgramAddedAt: "2026-06-10T10:00:00.000Z",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { name: "Жим ногами", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "70" }, { reps: "12", weight: "70" }] }
      ]
    },
    ...(includeProgramAssignmentHistory ? [{
      id: "e2e_future_day_1",
      name: "Будущая тренировка",
      scheduledDate: "2026-08-03",
      status: "planned",
      assignedProgramId: "program_support",
      assignedProgramName: "Поддержка",
      assignedProgramAddedAt: "2026-07-25T10:00:00.000Z",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e_future_1", name: "Тяга верхнего блока", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "30" }] }
      ]
    }] : [])
  ]);
  const archivedWorkouts = [
    {
      id: "e2e_archived_day_1",
      name: "Тренировка 1",
      scheduledDate: "2026-06-08",
      status: "completed",
      assignedProgramId: "program_previous",
      assignedProgramName: "Предыдущая программа",
      assignedProgramAddedAt: "2026-05-01T10:00:00.000Z",
      assignedProgramUpdatedAt: "2026-05-01T10:00:00.000Z",
      exercises: [
        { id: "archive_e1", name: "Разгибание ног", rest: "90 сек", sets: [{ reps: "12", weight: "35" }] }
      ]
    },
    {
      id: "e2e_archived_day_2",
      name: "Тренировка 2",
      scheduledDate: "2026-06-11",
      status: "completed",
      assignedProgramId: "program_previous",
      assignedProgramName: "Предыдущая программа",
      assignedProgramAddedAt: "2026-05-01T10:00:00.000Z",
      assignedProgramUpdatedAt: "2026-05-01T10:00:00.000Z",
      exercises: [
        { id: "archive_e2", name: "Тяга верхнего блока", rest: "90 сек", sets: [{ reps: "12", weight: "30" }] }
      ]
    },
    ...(includeBasicWorkoutHistory ? [{
      id: "e2e_basic_day_1",
      name: "Базовая тренировка",
      scheduledDate: "2026-05-20",
      status: "completed",
      source: "basic",
      assignedProgramId: "basic_client_plan",
      assignedProgramName: "Базовый план клиента",
      assignedProgramAddedAt: "2026-05-10T10:00:00.000Z",
      assignedProgramUpdatedAt: "basic:client-plan",
      exercises: [{ id: "basic_e1", name: "Приседания", rest: "90 сек", sets: [{ reps: "10", weight: "40" }] }]
    }] : [])
  ];
  const clientSummaries = {
    client_e2e: {
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      assignedWorkoutCount: 4,
      completedWorkoutCount: 1,
      programCompletionPercent: 25,
      weeklyProgressScore: 82,
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

  function addHarnessExercise(workoutId, patch = {}) {
    const exercise = {
      id: `e2e_exercise_${Date.now()}`,
      name: "Новое упражнение",
      muscleGroup: "",
      rest: "90 сек",
      requiresWeight: true,
      usesWeight: true,
      sets: [{ reps: "", weight: "" }],
      ...patch
    };

    setWorkouts((current) => current.map((workout) => workout.id === workoutId
      ? { ...workout, exercises: [...(workout.exercises || []), exercise] }
      : workout));

    return exercise;
  }

  function updateHarnessLibraryExercise(sourceExercise, patch) {
    const workoutId = sourceExercise?.librarySource?.workoutId || sourceExercise?.sourceWorkoutId;
    if (!workoutId || !sourceExercise?.id) return false;

    setWorkouts((current) => current.map((workout) => workout.id === workoutId
      ? {
          ...workout,
          exercises: (workout.exercises || []).map((exercise) => exercise.id === sourceExercise.id
            ? { ...exercise, ...patch }
            : exercise)
        }
      : workout));

    return true;
  }

  function removeHarnessLibraryExercise(sourceExercise) {
    const workoutId = sourceExercise?.librarySource?.workoutId || sourceExercise?.sourceWorkoutId;
    if (!workoutId || !sourceExercise?.id) return false;

    setWorkouts((current) => current.map((workout) => workout.id === workoutId
      ? { ...workout, exercises: (workout.exercises || []).filter((exercise) => exercise.id !== sourceExercise.id) }
      : workout));

    return true;
  }

  function removeHarnessExercise(workoutId, exerciseId, exerciseIndex) {
    const hasExerciseId = exerciseId !== undefined && exerciseId !== null && String(exerciseId).trim() !== "";
    const hasExerciseIndex = Number.isInteger(Number(exerciseIndex)) && Number(exerciseIndex) >= 0;
    if (!workoutId || (!hasExerciseId && !hasExerciseIndex)) return false;

    setWorkouts((current) => current.map((workout) => workout.id === workoutId
      ? {
          ...workout,
          exercises: (workout.exercises || []).filter((exercise, index) => (
            hasExerciseId ? exercise.id !== exerciseId : index !== Number(exerciseIndex)
          ))
        }
      : workout));

    return true;
  }

  function removeHarnessDay(workoutId) {
    if (!workoutId) return false;
    setWorkouts((current) => current.filter((workout) => workout.id !== workoutId));
    return true;
  }

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
          {programLibraryTab !== "editor" ? <div className="trainerNextPageTabs">
            <button type="button" className="active" aria-pressed="true">Программы</button>
            <button type="button">Библиотека упражнений</button>
          </div> : null}
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
      onOpenClient={(client, targetTab = "overview") => {
        setSelectedClient(client);
        setActiveClientTab(targetTab || "overview");
        setMode("client");
        setActiveSection("clients");
      }}
      onCloseClient={() => {
        setMode("clients");
        setActiveSection("clients");
      }}
      onCreateClient={() => {}}
      onCreateTask={() => {}}
      createClientState={{
        open: false,
        name: "",
        login: "",
        password: "",
        status: "",
        credentials: null,
        loading: false,
        onClose: () => {},
        onSubmit: () => {},
        onNameChange: () => {},
        onLoginChange: () => {},
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
      onSaveClientSetupProgress={(step, _client, checklist) => ({
        ...checklist,
        completedSteps: {
          ...(checklist?.completedSteps || {}),
          [step]: true
        }
      })}
      onTestNotification={() => true}
      onConnectTelegram={() => {}}
      onOpenTelegramChat={() => {}}
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
      archivedWorkouts={archivedWorkouts}
      exerciseLibrary={workouts.flatMap((workout) => workout.exercises)}
      programTemplates={programTemplates}
      selectedProgramId={selectedProgramId}
      onSelectProgram={setSelectedProgramId}
      onAssignProgram={() => {
        const assignedAt = new Date().toISOString();
        const template = programTemplates.find((item) => item.id === selectedProgramId) || programTemplates[0];
        const assignmentWorkouts = [1, 2, 3].map((day) => ({
          id: `assigned_${Date.now()}_${day}`,
          name: `Тренировка ${day}`,
          status: "planned",
          assignedProgramId: template?.id || "program_tren_plus",
          assignedProgramName: template?.name || "Новая программа",
          assignedProgramAddedAt: assignedAt,
          assignedProgramUpdatedAt: assignedAt,
          exercises: [{
            id: `assigned_exercise_${day}`,
            name: "Жим ногами",
            requiresWeight: true,
            rest: "90 сек",
            sets: [{ reps: "12", weight: "50" }]
          }]
        }));
        setWorkouts((current) => [...current, ...assignmentWorkouts]);
        return {
          assignmentKey: `time:${assignedAt}`,
          assignedAt,
          programId: template?.id || "program_tren_plus"
        };
      }}
      onArchiveProgramAssignment={(assignment) => {
        setWorkouts((current) => current.filter((workout) => (
          workout.assignedProgramAddedAt !== assignment.assignedAt ||
          workout.assignedProgramId !== assignment.programId
        )));
        return true;
      }}
      onDeleteProgramAssignment={(assignment) => {
        setWorkouts((current) => current.filter((workout) => (
          workout.assignedProgramAddedAt !== assignment.assignedAt ||
          workout.assignedProgramId !== assignment.programId
        )));
        return true;
      }}
      onOpenProgramManager={() => setProgramManagerOpen(true)}
      activeWorkoutTab={activeWorkoutTab}
      onWorkoutTabChange={setActiveWorkoutTab}
      onSaveWorkoutSchedule={(dates, assignmentWorkouts = []) => {
        const assignmentWorkoutIds = new Set(assignmentWorkouts.map((workout) => workout.id));
        setSelectedClient((current) => ({
          ...current,
          workoutCalendar: {
            ...(current.workoutCalendar || {}),
            scheduledDates: [...new Set([...(current.workoutCalendar?.scheduledDates || []), ...dates])].sort(),
            monthlyTrainingDates: [...new Set([...(current.workoutCalendar?.monthlyTrainingDates || []), ...dates])].sort(),
            plannedWorkouts: [
              ...(current.workoutCalendar?.plannedWorkouts || []).filter((item) => !assignmentWorkoutIds.has(item.workoutId)),
              ...assignmentWorkouts.map((workout, index) => ({
                workoutId: workout.id,
                order: index + 1,
                date: dates[index],
                status: "planned",
                assignedProgramAddedAt: workout.assignedProgramAddedAt,
                assignedProgramUpdatedAt: workout.assignedProgramUpdatedAt
              }))
            ],
            updatedAt: new Date().toISOString()
          }
        }));
        setWorkouts((current) => current.map((workout) => {
          const index = assignmentWorkouts.findIndex((item) => item.id === workout.id);
          return index >= 0 ? {
            ...workout,
            scheduledDate: dates[index],
            plannedDate: dates[index],
            scheduleOrder: index + 1,
            status: "planned"
          } : workout;
        }));
        return true;
      }}
      programStatus=""
      onUpdateWorkout={(workoutId, patch) => {
        if (!workoutId || !patch || typeof patch !== "object") return false;
        setWorkouts((current) => current.map((workout) => workout.id === workoutId
          ? { ...workout, ...patch }
          : workout));
        return true;
      }}
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
      onAddExercise={addHarnessExercise}
      onUpdateLibraryExercise={updateHarnessLibraryExercise}
      onRemoveLibraryExercise={removeHarnessLibraryExercise}
      onRemoveExercise={removeHarnessExercise}
      onDuplicateExercise={() => {}}
      onMoveExercise={() => {}}
      onUploadExerciseVideo={() => {}}
      onAddDay={() => {}}
      onDuplicateDay={() => {}}
      onRemoveDay={removeHarnessDay}
      onSaveWorkouts={() => true}
      onLogout={() => {}}
    />
  );
}

export default TrainerE2EHarness;

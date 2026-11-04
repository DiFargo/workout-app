import { setTrainerLibraryVariantDeleted, buildTrainerExerciseLibraryItems } from "../../utils/trainerExerciseLibrary.js";
import { createTrainerPlanEditorHandlers } from "../../features/trainer/trainerPlanEditorHandlers.js";
import { getTrainerExerciseSelectionPatch } from "../../features/trainer/trainerWorkoutEditHelpers.js";
import { useRef, useState } from "react";
import TrainerWorkspace, { TrainerShell } from "./TrainerWorkspace";
import * as appConfig from "../../constants/appConfig";
import { normalizeTrainerSubscriptionNotificationSettings } from "../../utils/trainerSubscriptionNotificationSettings";
import { exerciseCardLegacyKey } from "../../../functions/exerciseCards.js";
import { resolveAgendaScheduleInput } from "../../utils/trainerScheduleAgenda.js";
import { renewClientSubscription } from "../../utils/clientSubscription.js";
import TrainerAdminCreateClientModal from "../../features/trainer/TrainerAdminCreateClientModal.jsx";

const duplicateAuditMovements = [
  { id: "seated", name: "Отведение рук с гантелями сидя в наклоне", video: "/e2e-media/seated.mp4" },
  { id: "standing", name: "Отведение рук с гантелями стоя в наклоне", video: "/e2e-media/standing.mp4" },
  { id: "squat", name: "Присед с гантелью", video: "/e2e-media/squat.mp4" }
];

function TrainerE2EHarness({ ProgramManagerView }) {
  const clientActionsAudit = new URLSearchParams(window.location.search).get("clientActionsAudit");
  const [clientActionStatus, setClientActionStatus] = useState("");
  const clientActionAttempts = useRef(0);
  const progressSearchAudit = new URLSearchParams(window.location.search).has("progressSearchAudit");
  const [earlierProgressLoaded, setEarlierProgressLoaded] = useState(false);
  const programVideoAudit = new URLSearchParams(window.location.search).get("programVideoAudit") === "1";
  const programAuditVideo = programVideoAudit ? "/e2e-media/program-video-audit.mp4" : "";
  const cardAudit = new URLSearchParams(window.location.search).has("cardAudit");
  const duplicateAudit = new URLSearchParams(window.location.search).has("libraryDuplicateAudit");
  const [exerciseCards, setExerciseCards] = useState(() => duplicateAudit ? duplicateAuditMovements.map(exercise => ({
    ...exercise, id: `card-${exercise.id}`, ownerUid: "card-trainer", technique: "", revision: 1,
    legacyKeys: [exerciseCardLegacyKey(exercise)], updatedAt: "2026-09-19T07:00:00.000Z", deletedAt: ""
  })) : []);
  const sparsePreview = new URLSearchParams(window.location.search).has("sparsePreview");
  const assignmentPreview = new URLSearchParams(window.location.search).has("assignmentPreview");
  const draftAudit = new URLSearchParams(window.location.search).has("draftAudit");
  const constructorCardsAudit = new URLSearchParams(window.location.search).has("constructorCardsAudit");
  const familiarAudit = new URLSearchParams(window.location.search).get("clientFamiliarAudit");
  const [familiarRetried, setFamiliarRetried] = useState(false);
  const primaryScreensAudit = new URLSearchParams(window.location.search).has("primaryScreensAudit");
  const libraryLoadAudit = new URLSearchParams(window.location.search).get("libraryLoadAudit");
  const [libraryRetryComplete, setLibraryRetryComplete] = useState(false);
  const libraryLoadPhase = libraryRetryComplete ? "ready" : libraryLoadAudit;
  const libraryFixtureHasData = !libraryLoadPhase || ["ready", "refresh", "refresh-error"].includes(libraryLoadPhase);
  const fixtureLibraryState = libraryLoadPhase ? {
    templates: ["error", "refresh-error"].includes(libraryLoadPhase) ? "error" : ["loading", "refresh"].includes(libraryLoadPhase) ? "loading" : "ready",
    cards: ["error", "refresh-error", "cards-error"].includes(libraryLoadPhase) ? "error" : ["loading", "refresh"].includes(libraryLoadPhase) ? "loading" : "ready",
    templatesKnown: libraryFixtureHasData,
    cardsKnown: libraryFixtureHasData
  } : undefined;
  const retryFixtureLibrary = () => setLibraryRetryComplete(true);
  const assignmentScheduleAudit = new URLSearchParams(window.location.search).has("assignmentScheduleAudit");
  const orderRecoveryAudit = new URLSearchParams(window.location.search).has("orderRecoveryAudit");
  const draftSaveAttempts = useRef(0);
  const assignmentAttempts = useRef(0);
  const setupProgressAttempts = useRef(0);
  const notificationSaveAttempts = useRef(0);
  const scheduleSaveAttempts = useRef(0);
  const [summaryRetried, setSummaryRetried] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const inviteFlow = new URLSearchParams(window.location.search).has("inviteFlow");
  const legacyInvite = new URLSearchParams(window.location.search).has("legacyInvite");
  const inviteCreateAttempts = useRef(0);
  const [inviteAttemptCount, setInviteAttemptCount] = useState(0);
  const [inviteName, setInviteName] = useState("");
  const [inviteLogin, setInviteLogin] = useState("");
  const [inviteCredentials, setInviteCredentials] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");
  const [yesterday] = useState(() => new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const APP_VERSION = appConfig?.APP_VERSION || "v0";
  const includeProgramAssignmentHistory = new URLSearchParams(window.location.search).get("programAssignments") === "1";
  const includeBasicWorkoutHistory = new URLSearchParams(window.location.search).get("basicHistory") === "1";
  const [mode, setMode] = useState("dashboard");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeClientTab, setActiveClientTab] = useState("overview");
  const [activeWorkoutTab, setActiveWorkoutTab] = useState("plan");
  const [selectedProgramId, setSelectedProgramId] = useState("program_tren_plus");
  const [programManagerOpen, setProgramManagerOpen] = useState(false);
  const programManagerBaselineRef = useRef(null);
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
    ...(new URLSearchParams(window.location.search).has("scheduleReady") ? { subscription: { startDate: "2026-08-01", endDate: "2026-08-31", purchasedSessions: 3, usedSessions: 0 } } : {}),
    trainerSetupChecklist: {
      completedSteps: {
        program: true,
        schedule: true,
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
    telegramNotificationsEnabled: true,
    ...(sparsePreview ? { name: "Margo", assignedProgramId: "", assignedProgramName: "", assignedProgramUpdatedAt: "", assignedWorkoutCount: 0, firstSetupCompleted: false, trainerSetupChecklist: {}, workoutCalendar: {} } : {}),
    ...(assignmentScheduleAudit ? {
      assignedProgramAddedAt: "2026-09-10T06:31:00.000Z",
      assignedProgramUpdatedAt: "2026-09-10T06:31:00.000Z",
      assignedWorkoutCount: 8,
      workoutCalendar: { plannedWorkouts: [
        ...["2026-08-26", "2026-08-29", "2026-09-01", "2026-09-07"].map((date, index) => ({ workoutId: `old-${index}`, order: index + 1, date, status: "planned" })),
        ...Array.from({ length: 8 }, (_, index) => ({ workoutId: `new-${index}`, order: index + 1, date: `2026-09-${12 + index}`, status: "planned", assignedProgramAddedAt: "2026-09-10T06:31:00.000Z" }))
      ] }
    } : {}),
    ...(orderRecoveryAudit ? {
      assignedProgramId: "program-order-recovery", assignedProgramName: "Проверка порядка",
      assignedProgramAddedAt: "2026-10-17T10:00:00.000Z", assignedProgramUpdatedAt: "2026-10-17T10:00:00.000Z", assignedWorkoutCount: 4,
      workoutCalendar: { plannedWorkouts: Array.from({ length: 4 }, (_, index) => ({
        workoutId: `order-recovery-${index + 1}`, order: index + 1, index,
        assignedProgramAddedAt: "2026-10-17T10:00:00.000Z", status: index < 3 ? "completed" : "planned", date: `2026-10-${20 + index}`
      })) }
    } : {})
  });
  const layoutPreview = new URLSearchParams(window.location.search).get("layoutPreview") === "1";
  const clients = primaryScreensAudit ? [selectedClient,
    { ...selectedClient, id: "primary_new", name: "Новый клиент", assignedProgramId: "", assignedProgramName: "", assignedWorkoutCount: 0, trainerSetupChecklist: {} },
    { ...selectedClient, id: "primary_long", name: "Александра Константинопольская" }
  ] : layoutPreview ? [selectedClient, ...[
    "Анна Константинопольская", "Михаил", "Александра Иванова", "Дмитрий", "Екатерина"
  ].map((name, index) => ({ ...selectedClient, id: `layout_client_${index}`, name }))] : [selectedClient];
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
        { name: "Тяга нижнего блока", sets: [{ reps: 12, weight: 35 }] },
        ...(progressSearchAudit ? [
          { name: "Сгибание ног в тренажёре", sets: [{ reps: 12, weight: 30 }] },
          { name: "Жим лёжа со штангой", sets: [{ reps: 12, weight: 30 }] }
        ] : [])
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
        { name: "Жим ногами", sets: [{ reps: 12, weight: 70 }, { reps: 12, weight: 70 }] },
        ...(progressSearchAudit ? [
          { name: "Сгибание ног в тренажёре", sets: [{ reps: 12, weight: 30 }] },
          { name: "Жим лёжа со штангой", sets: [{ reps: 12, weight: 35 }] }
        ] : [])
      ]
    },
    ...(progressSearchAudit && earlierProgressLoaded ? [
      ["2026-05-05", 50], ["2026-05-19", 60], ["2026-06-01", 65], ["2026-06-10", 85]
    ].map(([date, weight], index) => ({ id: `progress-earlier-${index}`, date: `${date}T18:00:00.000Z`,
      workoutName: "Ранняя тестовая тренировка", exercises: [{ name: "жим ногами", sets: [{ reps: 12, weight }, { reps: 12, weight }] }]
    })) : []),
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
    }] : []),
    ...(new URLSearchParams(window.location.search).get("staleReview") === "1" ? [{
      id: "history_review_current",
      workoutId: "e2e_day_1",
      workoutName: "Тренировка 1",
      completedAt: "2026-07-08T18:00:00.000Z",
      clientComment: "Текущий сигнал: снизил вес на жиме.",
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [{ name: "Жим ногами", sets: [{ reps: 12, weight: 75 }] }]
    }, {
      id: "history_review_archived",
      workoutId: "e2e_archived_day_1",
      workoutName: "Тренировка 1",
      completedAt: "2026-07-09T18:00:00.000Z",
      clientComment: "Устаревший сигнал из архивной программы.",
      assignedProgramId: "program_previous",
      assignedProgramUpdatedAt: "2026-05-01T10:00:00.000Z",
      exercises: [{ name: "Разгибание ног", sets: [{ reps: 12, weight: 35 }] }]
    }, {
      id: "history_review_basic",
      workoutId: "e2e_basic_day_1",
      workoutName: "Базовая тренировка",
      completedAt: "2026-07-09T20:00:00.000Z",
      clientComment: "Сигнал из самостоятельного базового плана.",
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
  const libraryAuditExercises = new URLSearchParams(window.location.search).has("libraryAudit") ? [
    ...(duplicateAudit ? duplicateAuditMovements.flatMap(exercise => [exercise,
      { ...exercise, id: `empty-${exercise.id}`, video: "" },
      ...(new URLSearchParams(window.location.search).has("videoPriorityAudit")
        ? [{ ...exercise, id: `old-${exercise.id}`, video: `/e2e-media/old-${exercise.id}.mp4` }] : [])
    ]) : []),
    { id: "library-press", name: "Жим гантелей лёжа", video: "/e2e-media/press.mp4" },
    { id: "library-front", name: "Подъём гантелей вперёд", video: "/e2e-media/front.mp4" },
    { id: "library-climber", name: "Шаги альпиниста" },
    { id: "library-fly", name: "Свеление рук с гантелями на наклонной скамье" },
    { id: "library-leg", name: "Жим одной ногой" },
    { id: "library-abduct", name: "Разведение ног в тренажере" },
    { id: "library-adduct", name: "Сведение ног в тренажере" },
    { id: "library-side-a", name: "Отведение рук с гантелями", video: "/e2e-media/side-a.mp4" },
    { id: "library-side-b", name: "Разведения гантелей в стороны", video: "/e2e-media/side-b.mp4" },
    { id: "library-custom", name: "Авторское упражнение" }
  ].map((exercise) => ({ ...exercise, sets: [{ reps: "12", weight: "20" }], requiresWeight: true })) : [];
  const [workouts, setWorkouts] = useState(orderRecoveryAudit ? [3, 0, 1, 2].map(index => ({
    id: `order-recovery-${index + 1}`, name: `Тренировка ${index + 1}`, order: index === 3 ? 4 : 33 + index, sortOrder: index === 3 ? 4 : 33 + index,
    status: index < 3 ? "completed" : "planned", assignedProgramId: "program-order-recovery", assignedProgramName: "Проверка порядка",
    assignedProgramAddedAt: "2026-10-17T10:00:00.000Z", assignedProgramUpdatedAt: "2026-10-17T10:00:00.000Z",
    exercises: [{ id: `order-exercise-${index}`, name: "Жим ногами", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "50" }] }]
  })) : assignmentScheduleAudit ? Array.from({ length: 8 }, (_, index) => ({
    id: `new-${index}`, name: `Тренировка ${index + 1}`, status: "planned",
    assignedProgramId: "program_tren_plus", assignedProgramName: "tren+",
    assignedProgramAddedAt: "2026-09-10T06:31:00.000Z", assignedProgramUpdatedAt: "2026-09-10T06:31:00.000Z",
    exercises: [{ id: `press-${index}`, name: "Жим ногами", requiresWeight: true, rest: "90 сек", sets: Array.from({ length: 3 }, () => ({ reps: "12", weight: "110" })) }]
  })) : [
    ...(libraryAuditExercises.length ? [{ id: "library-audit", name: "Библиотека", exercises: libraryAuditExercises }] : []),
    {
      id: "e2e_day_1",
      name: "Тренировка 1",
      scheduledDate: "2026-06-15",
      assignedProgramId: "program_tren_plus",
      assignedProgramName: "tren+",
      assignedProgramAddedAt: "2026-06-10T10:00:00.000Z",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e1", name: "Жим ногами", video: programAuditVideo, requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "90" }, { reps: "12", weight: "90" }] },
        { id: "e2", name: "Тяга нижнего блока", video: programAuditVideo, requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "35" }] }
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
        { id: "e3", name: new URLSearchParams(window.location.search).has("mixedSets") ? "Жим лёжа с гантелями на наклонной скамье с медленным опусканием и паузой" : "Жим лёжа с гантелями", video: programAuditVideo, requiresWeight: true, rest: "90 сек", sets: new URLSearchParams(window.location.search).has("mixedSets") ? [{ reps: "12", weight: "20" }, { reps: "10", weight: "25" }, { reps: "8", weight: "30" }] : [{ reps: "12", weight: "20" }] }
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
        { name: "Жим ногами", video: programAuditVideo, requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "70" }, { reps: "12", weight: "70" }] }
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
  const [archivedWorkouts, setArchivedWorkouts] = useState([
    ...(new URLSearchParams(window.location.search).get("emptyHistoricalProgram") === "1" ? [{
      id: "e2e_old_empty", name: "Тренировка 1", status: "planned",
      assignedProgramId: "old_empty", assignedProgramName: "Старая пустая программа",
      assignedProgramAddedAt: "2026-04-01T10:00:00.000Z", assignedProgramUpdatedAt: "2026-04-01T10:00:00.000Z",
      assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active",
      exercises: [{ id: "old_empty_ex", name: "Приседания", sets: [{ reps: "12", weight: "40" }] }]
    }] : []),
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
  ]);
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
  if (layoutPreview) {
    clients.slice(1).forEach(client => { clientSummaries[client.id] = { ...clientSummaries.client_e2e }; });
  }
  if (primaryScreensAudit) {
    const today = new Date().toISOString();
    clientSummaries.client_e2e.lastNutritionAt = today;
    clientSummaries.client_e2e.recentEvents = [{ id: "primary_event", type: "nutrition", date: today }];
    clientSummaries.primary_new = { assignedProgramId: "", assignedWorkoutCount: 0, weeklyProgressScore: null, nutritionDays7: null, sources: {} };
    clientSummaries.primary_long = { ...clientSummaries.client_e2e, weeklyProgressScore: 0 };
  }
  const primaryActionCenter = primaryScreensAudit ? {
    items: clients.map(client => ({ client, clientId: client.id, clientName: client.name, summary: clientSummaries[client.id] })),
    priorityItems: [
      { client: clients[1], clientId: clients[1].id, summary: clientSummaries.primary_new, status: { id: "noProgram" } },
      { client: clients[2], clientId: clients[2].id, summary: clientSummaries.primary_long, attention: { type: "subscription", reason: "Осталась 1 тренировка. Проверьте дальнейший план и согласуйте с клиентом продление абонемента." } }
    ]
  } : null;
  const programTemplates = assignmentPreview ? [
    { id: "program_tren_plus", name: "Черновик программы", lifecycleStatus: "draft" },
    { id: "program_archived", name: "Архивная программа", lifecycleStatus: "archived" },
    { id: "program_ready", name: "Готовая программа", lifecycleStatus: "ready", workouts: [{ id: "ready_day", name: "День 1", exercises: [
      { id: "weighted", name: "Жим ногами", requiresWeight: true, sets: [{ reps: "12", weight: "50" }] },
      { id: "unset", name: "Разгибание рук на верхнем блоке", requiresWeight: true, sets: [{ reps: "12", weight: "" }] },
      { id: "bodyweight", name: "Скручивания", requiresWeight: false, sets: [{ reps: "12", weight: "" }] }
    ] }] }
  ] : [
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
    if (new URLSearchParams(window.location.search).has("librarySaveConflict")) {
      throw new Error("Упражнение изменено в другом окне. Обновите библиотеку перед сохранением.");
    }
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

  function removeHarnessLibraryExercise(sourceExercise, { restore = false } = {}) {
    const workoutId = sourceExercise?.librarySource?.workoutId || sourceExercise?.sourceWorkoutId;
    if (!workoutId || !sourceExercise?.id) return false;

    if (new URLSearchParams(window.location.search).has("libraryDeleteFail")) return false;
    setWorkouts((current) => setTrainerLibraryVariantDeleted({ workouts: current }, sourceExercise, restore ? "" : new Date().toISOString()).workouts);

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
    if (nextSection === "library") {
      setProgramManagerOpen(false);
      setActiveWorkoutTab("library");
      setMode("workouts");
      setActiveSection("library");
      return;
    }
    setProgramManagerOpen(false);
    if (nextSection === "more") {
      setMode("cabinet");
      setActiveSection("more");
      return;
    }
    if (nextSection === "workouts") {
      setActiveWorkoutTab("plan");
      programManagerBaselineRef.current = structuredClone(workouts);
      setProgramManagerOpen(Boolean(ProgramManagerView));
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
               <h1>{programLibraryTab === "editor" ? "Редактор шаблона" : "Шаблоны программ"}</h1>
                <p>Общая основа для персональных планов клиентов</p>
            </div>
          </div>
          <header className="trainerNextMobileHeader">
              <h1 className="trainerNextMobileTitle">{programLibraryTab === "editor" ? "Редактор шаблона" : "Шаблоны программ"}</h1>
          </header>
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
            adminTrainingTemplates={libraryFixtureHasData ? programTemplates : []}
            trainerLibraryLoadState={fixtureLibraryState}
            onRetryLibrary={retryFixtureLibrary}
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
            normalizedMonthProgram={{ id: selectedProgramId, ownerUid: "fixture-trainer", name: "tren+", months: monthGroups }}
            refreshCurrentMonthProgram={() => { if (programManagerBaselineRef.current) setWorkouts(structuredClone(programManagerBaselineRef.current)); return true; }}
            openAdminProgramsOverview={() => setProgramLibraryTab("overview")}
            openTrainerExerciseLibrary={() => navigate("library")}
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
            saveMonthProgramToLibrary={() => { programManagerBaselineRef.current = structuredClone(workouts); return true; }}
            addMonthWorkout={() => { if (constructorCardsAudit) setWorkouts(current => [...current, { id: `cards-day-${Date.now()}`, name: `Тренировка ${current.length + 1}`, exercises: [] }]); }}
            updateMonthWorkout={(_block, _week, workoutId, patch) => { if (constructorCardsAudit) setWorkouts(current => current.map(workout => workout.id === workoutId ? { ...workout, ...patch } : workout)); }}
            confirmRemoveMonthWorkout={() => {}}
            duplicateMonthWorkout={(_block, _week, workoutId) => { if (constructorCardsAudit) setWorkouts(current => {
              const source = current.find(workout => workout.id === workoutId);
              if (!source) return current;
              return [...current, { ...structuredClone(source), id: `cards-copy-${Date.now()}`, name: `${source.name} — копия` }];
            }); }}
            addMonthExercise={(_block, _week, workoutId, source) => source ? addHarnessExercise(workoutId, getTrainerExerciseSelectionPatch(source)) : false}
            updateMonthExercise={(_block, _week, workoutId, exerciseId, patch) => setWorkouts(current => current.map(workout => workout.id === workoutId
              ? { ...workout, exercises: workout.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, ...patch } : exercise) } : workout))}
            updateMonthExerciseName={() => {}}
            removeMonthExercise={(_block, _week, workoutId, exerciseId) => { if (constructorCardsAudit) setWorkouts(current => current.map(workout => workout.id === workoutId ? { ...workout, exercises: workout.exercises.filter(exercise => exercise.id !== exerciseId) } : workout)); }}
            duplicateMonthExercise={(_block, _week, workoutId, exerciseId) => { if (constructorCardsAudit) setWorkouts(current => current.map(workout => {
              if (workout.id !== workoutId) return workout;
              const source = workout.exercises.find(exercise => exercise.id === exerciseId);
              return source ? { ...workout, exercises: [...workout.exercises, { ...structuredClone(source), id: `cards-exercise-copy-${Date.now()}` }] } : workout;
            })); }}
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

  const cardTemplate = { id: "card-template", ownerUid: "card-trainer", workouts };
  const cardHandlers = createTrainerPlanEditorHandlers({ trainerExerciseCards: exerciseCards, setTrainerExerciseCards: setExerciseCards,
    adminTrainingTemplates: [cardTemplate], setAdminTrainingTemplates() {}, auth: { currentUser: { uid: "card-trainer" } },
    canManageTrainingTemplate: template => template.ownerUid === "card-trainer", setAdminClientStatus() {},
    cardRequest: async body => {
      const response = await fetch("/api/trainer-exercise-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    }
  });
  function openHarnessInvite() {
    setInviteName("");
    setInviteLogin("");
    setInviteCredentials(null);
    setInviteStatus("");
    inviteCreateAttempts.current = 0;
    setInviteAttemptCount(0);
    setCreateClientOpen(true);
  }

  async function createHarnessInvite(event, username) {
    event?.preventDefault?.();
    if (!inviteFlow) return false;
    inviteCreateAttempts.current += 1;
    setInviteAttemptCount(inviteCreateAttempts.current);
    setInviteLoading(true);
    setInviteStatus("");
    await new Promise(done => window.setTimeout(done, 150));
    setInviteLoading(false);
    if (new URLSearchParams(window.location.search).has("inviteFailure") && inviteCreateAttempts.current === 1) {
      setInviteStatus("Не удалось создать приглашение. Повтори попытку.");
      return false;
    }
    const credentials = {
      name: inviteName,
      login: new URLSearchParams(window.location.search).has("existingInvite") ? "" : inviteLogin || "fixture.fit",
      existingAccount: new URLSearchParams(window.location.search).has("existingInvite"),
      telegramUsername: username.replace(/^@/, "").toLowerCase(),
      botStartUrl: "https://t.me/zmena_teleg_bot?start=invite_fixture",
      shareUrl: "https://example.invalid/fixture-invite"
    };
    setInviteCredentials(credentials);
    return credentials;
  }

  return (
    <>
    {inviteFlow ? <output id="trainer-e2e-meta" hidden data-invite-create-attempts={inviteAttemptCount} /> : null}
    {cardAudit ? <output hidden data-testid="card-prescription-snapshot">{JSON.stringify(cardTemplate)}</output> : null}
    {duplicateAudit ? <output hidden data-testid="card-library-snapshot">{JSON.stringify(exerciseCards)}</output> : null}
    <TrainerWorkspace
      appVersion={APP_VERSION}
      mode={mode}
      activeSection={mode === "client" ? "clients" : activeSection}
      onNavigate={navigate}
      onRefresh={() => { if (familiarAudit) setFamiliarRetried(true); }}
      trainerName="Beta"
      clients={clients}
      summariesLoading={new URLSearchParams(window.location.search).get("syncPreview") === "1"}
      onRetrySummary={() => setSummaryRetried(true)}
      clientSummaries={new URLSearchParams(window.location.search).has("partialSummary") && !summaryRetried ? { ...clientSummaries, client_e2e: { ...clientSummaries.client_e2e, trainerSummaryState: "partial", trainerSummaryReady: false, failedSources: ["history", "measurements"], sources: { history: { state: "error" }, measurements: { state: "error" } }, workouts7: null, lastWorkoutAt: null, completedWorkoutCount: null, nutritionDays7: null } } : clientSummaries}
      actionCenter={primaryActionCenter}
      counts={{ active: 1, attention: primaryScreensAudit ? 2 : 0 }}
      selectedClient={progressSearchAudit ? { ...selectedClient, trainerHistoryHasMore: !earlierProgressLoaded } : familiarAudit === "error" ? { ...selectedClient, trainerNutritionLoadError: !familiarRetried } : selectedClient}
      onLoadMoreHistory={progressSearchAudit ? async () => { setEarlierProgressLoaded(true); return true; } : undefined}
      selectedProfile={{
        goalLabel: "Рекомпозиция",
        goal: "recomp",
        weight: 88.8,
        targetWeight: 85,
        height: 180,
        age: 28,
        sex: "male",
        activity: "medium",
        trainingDays: ["mon", "wed", "fri"]
      }}
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
      onCreateClient={openHarnessInvite}
      onCreateTask={() => {}}
      createClientState={{
        open: createClientOpen && !legacyInvite,
        name: inviteName,
        login: inviteLogin,
        password: "",
        status: inviteStatus,
        credentials: inviteCredentials,
        loading: inviteLoading,
        onClose: () => setCreateClientOpen(false),
        onSubmit: createHarnessInvite,
        onNameChange: setInviteName,
        onLoginChange: setInviteLogin,
        onPasswordChange: () => {},
        onGeneratePassword: () => {}
      }}
      measurements={familiarAudit ? [{id:"quick-weight", date:"2026-06-17", measurementType:"weight_checkin", weight:88.6, values:{weight:88.6}}, ...measurements] : sparsePreview ? [{id:"one", date:yesterday, weight:66, values:{weight:66}}] : measurements}
      history={sparsePreview ? [] : history}
      exerciseProgressReviews={exerciseProgressReviews}
      nutritionDays={familiarAudit === "empty" ? [] : sparsePreview ? [{date:yesterday, totals:{calories:605,protein:65,fat:15,carbs:56}}] : nutritionDays}
      nutritionGoals={{ calories: 2300, protein: 180, fat: 70, carbs: 235 }}
      nutritionPlanOptions={nutritionPlanOptions}
      photos={sparsePreview ? [] : new URLSearchParams(window.location.search).has("photoCompare") ? [{ id: "p2", date: "2026-06-16", frontUrl: "" }, { id: "p1", date: "2026-06-01", frontUrl: "" }] : [{ id: "p1", date: "2026-06-01", frontUrl: "" }]}
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
      onSaveNotifications={async (settings = {}) => {
        notificationSaveAttempts.current += 1;
        document.documentElement.dataset.notificationSaveAttempts = String(notificationSaveAttempts.current);
        if (new URLSearchParams(window.location.search).has("notificationSaveFailure") && notificationSaveAttempts.current === 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
          return false;
        }
        setSelectedClient((current) => settings.subscriptionOnly
          ? {
              ...current,
              subscription: settings.renewSubscription ? renewClientSubscription(current.subscription || {}, settings.subscription || {}) : { ...(current.subscription || {}), ...(settings.subscription || {}) }
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
      onSaveClientSetupProgress={(step, _client, checklist) => {
        setupProgressAttempts.current += 1;
        document.documentElement.dataset.setupProgressAttempts = String(setupProgressAttempts.current);
        if (new URLSearchParams(window.location.search).has("setupProgressFailure") && setupProgressAttempts.current === 1) return false;
        return { ...checklist, completedSteps: { ...(checklist?.completedSteps || {}), [step]: true } };
      }}
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
        if (clientActionsAudit && ["mark_test", "mark_real", "archive", "restore", "export_excel", "export_pdf", "delete"].includes(action)) {
          clientActionAttempts.current += 1;
          document.documentElement.dataset.clientActionAttempts = String(clientActionAttempts.current);
          if (clientActionsAudit === "cancel") return false;
          return new Promise(resolve => setTimeout(() => {
            if (clientActionsAudit === "failure") {
              setClientActionStatus("Не удалось выполнить действие клиента. Проверьте подключение и повторите попытку.");
              resolve(false);
            } else resolve(true);
          }, 900));
        }
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
      workouts={sparsePreview ? [] : workouts}
      archivedWorkouts={sparsePreview ? [] : archivedWorkouts}
      exerciseLibrary={libraryFixtureHasData ? cardAudit ? buildTrainerExerciseLibraryItems({}, [cardTemplate], { cards: exerciseCards, includeDeleted: true }) : workouts.flatMap((workout) => workout.exercises.map((exercise) => ({ ...exercise, librarySource: { type: "plan", workoutId: workout.id } }))) : []}
      trainerLibraryLoadState={fixtureLibraryState}
      onRetryLibrary={retryFixtureLibrary}
      programTemplates={programTemplates}
      selectedProgramId={selectedProgramId}
      onSelectProgram={setSelectedProgramId}
      onAssignProgram={() => {
        if (assignmentPreview) throw Object.assign(new Error("template-changed"), { assignmentMessage: "Сначала подготовьте программу к назначению." });
        assignmentAttempts.current += 1;
        document.documentElement.dataset.assignmentAttempts = String(assignmentAttempts.current);
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
        setWorkouts((current) => current.map((workout) => workout.assignedProgramAddedAt === assignment.assignedAt && workout.assignedProgramId === assignment.programId
          ? { ...workout, assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived" } : workout));
        setArchivedWorkouts((current) => current.map((workout) => workout.assignedProgramAddedAt === assignment.assignedAt && workout.assignedProgramId === assignment.programId
          ? { ...workout, assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived" } : workout));
        if (assignment.status === "current") setSelectedClient((current) => ({ ...current, assignedProgramId: "", assignedProgramName: "", assignedWorkoutCount: 0, assignedProgramLifecycleStatus: "archived" }));
        return true;
      }}
      onRestoreProgramAssignment={(assignment) => {
        setWorkouts((current) => current.map((workout) => workout.assignedProgramAddedAt === assignment.assignedAt && workout.assignedProgramId === assignment.programId
          ? { ...workout, assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active", assignedProgramArchivedAt: "" } : workout));
        return true;
      }}
      onDeleteProgramAssignment={(assignment) => {
        setWorkouts((current) => current.filter((workout) => (
          workout.assignedProgramAddedAt !== assignment.assignedAt ||
          workout.assignedProgramId !== assignment.programId
        )));
        setArchivedWorkouts((current) => current.filter((workout) => (
          workout.assignedProgramAddedAt !== assignment.assignedAt || workout.assignedProgramId !== assignment.programId
        )));
        return true;
      }}
      onOpenProgramManager={() => setProgramManagerOpen(true)}
      activeWorkoutTab={activeWorkoutTab}
      onWorkoutTabChange={setActiveWorkoutTab}
      onSaveWorkoutSchedule={(input, assignmentWorkouts = []) => {
        scheduleSaveAttempts.current += 1;
        if (new URLSearchParams(window.location.search).has("scheduleSaveFailure") && scheduleSaveAttempts.current === 1) return false;
        const keyed = !Array.isArray(input) ? resolveAgendaScheduleInput(input, assignmentWorkouts, selectedClient.workoutCalendar?.plannedWorkouts || []) : null;
        if (keyed && !keyed.ok) return false;
        const dates = keyed ? keyed.cleanDates : input;
        const scheduleWorkouts = keyed ? keyed.workouts : assignmentWorkouts;
        const assignmentWorkoutIds = new Set(assignmentWorkouts.map((workout) => workout.id));
        setSelectedClient((current) => ({
          ...current,
          workoutCalendar: {
            ...(current.workoutCalendar || {}),
            ...(input.trainingDays ? { trainingDays: [...input.trainingDays] } : {}),
            scheduledDates: [...new Set([...(current.workoutCalendar?.scheduledDates || []), ...dates])].sort(),
            monthlyTrainingDates: [...new Set([...(current.workoutCalendar?.monthlyTrainingDates || []), ...dates])].sort(),
            plannedWorkouts: [
              ...(current.workoutCalendar?.plannedWorkouts || []).filter((item) => !assignmentWorkoutIds.has(item.workoutId)),
              ...(keyed ? keyed.plannedWorkouts : scheduleWorkouts.map((workout, index) => ({
                workoutId: workout.id,
                order: index + 1,
                date: dates[index],
                status: "planned",
                assignedProgramAddedAt: workout.assignedProgramAddedAt,
                assignedProgramUpdatedAt: workout.assignedProgramUpdatedAt
              })))
            ],
            updatedAt: new Date().toISOString()
          }
        }));
        setWorkouts((current) => current.map((workout) => {
          const index = scheduleWorkouts.findIndex((item) => item.id === workout.id);
          const preserved = keyed?.plannedWorkouts[index];
          return index >= 0 ? {
            ...workout,
            scheduledDate: dates[index],
            plannedDate: dates[index],
            scheduleOrder: index + 1,
            status: preserved?.status || "planned",
            movedToDate: preserved?.movedToDate || workout.movedToDate || ""
          } : workout;
        }));
        return true;
      }}
      programStatus={clientActionStatus}
      onUpdateWorkout={(workoutId, patch) => {
        if (!workoutId || !patch || typeof patch !== "object") return false;
        setWorkouts((current) => current.map((workout) => workout.id === workoutId
          ? { ...workout, ...patch }
          : workout));
        return true;
      }}
      onUpdateExercise={(workoutId, exerciseId, patch) => {
        setWorkouts((current) => current.map((workout) => workout.id === workoutId
          ? { ...workout, exercises: (workout.exercises || []).map((exercise) => exercise.id === exerciseId ? { ...exercise, ...patch } : exercise) }
          : workout));
      }}
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
      onUpdateLibraryExercise={cardAudit ? cardHandlers.updateTrainerLibraryExercise : updateHarnessLibraryExercise}
      onRemoveLibraryExercise={cardAudit ? cardHandlers.removeTrainerLibraryExercise : removeHarnessLibraryExercise}
      onCreateLibraryExercise={cardAudit ? cardHandlers.createTrainerLibraryExercise : undefined}
      onRemoveExercise={removeHarnessExercise}
      onDuplicateExercise={() => {}}
      onMoveExercise={() => {}}
      onUploadExerciseVideo={() => {}}
      onUploadLibraryExerciseVideo={async (_exercise, file) => {
        const response = await fetch("/e2e-library-upload", { method: "POST", body: file });
        if (!response.ok) return false;
        return (await response.json()).url;
      }}
      onAddDay={() => {}}
      onDuplicateDay={() => {}}
      onRemoveDay={removeHarnessDay}
      onSaveWorkouts={async (nextPlan, options = {}) => {
        draftSaveAttempts.current += 1;
        document.documentElement.dataset.draftSaveAttempts = String(draftSaveAttempts.current);
        if (draftAudit && new URLSearchParams(window.location.search).has("saveFailure") && draftSaveAttempts.current === 1) throw new Error("Synthetic save failure");
        if (!nextPlan?.workouts) return false;
        const ids = new Set(options.editorDraft?.baseline.workouts.map((workout) => workout.id) || []);
        setWorkouts((current) => [...current.filter((workout) => !ids.has(workout.id)), ...nextPlan.workouts]);
        return { plan: nextPlan };
      }}
      onLogout={() => {}}
    />
    {legacyInvite && createClientOpen ? <TrainerAdminCreateClientModal
      adminCreateUserLoading={inviteLoading}
      adminCreateUserStatus={inviteStatus}
      adminCreatedCredentials={inviteCredentials}
      adminNewUserEmail={inviteLogin}
      adminNewUserName={inviteName}
      createUserFromAdminPanel={createHarnessInvite}
      setAdminCreateClientModalOpen={setCreateClientOpen}
      setAdminNewUserEmail={setInviteLogin}
      setAdminNewUserName={setInviteName}
    /> : null}
    </>
  );
}

export default TrainerE2EHarness;

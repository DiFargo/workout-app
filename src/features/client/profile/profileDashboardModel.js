import { isWorkoutPlanForMode } from "../../../utils/workoutPlanMode.js";
import { getWorkoutScheduleCalendarForWorkouts } from "../../../utils/workoutSchedule.js";
import { limitUserDisplayName } from "../../../utils/userDisplayName.js";
import { getClientReminderSettings } from "../../../utils/clientReminderSettings.js";
import { getProfileBodyMeasurementCheckInState, getProfileProgressPhotoCheckInState } from "./profileDashboardTasks.js";
import { getProfileOverviewMeasurements } from "../../../utils/profileOverviewMeasurements.js";
import { getClientWorkoutCompletionHistory } from "../../../utils/clientWorkoutEvidence.js";
import { isBodyMeasurementRecord } from "../../../utils/bodyMeasurementRecords.js";
import { getDashboardEmptyWorkoutAction } from "./profileDashboardPresentation.js";
import { getProfileCalendarDraft, mergeProfileCalendarDraft } from "./profileCalendarDraft.js";
import { resolveTrainerAssignmentWorkoutOrder } from "../../../utils/trainerAssignmentWorkoutOrder.js";
import { runTransaction } from "firebase/firestore";

export function getTimeOfDayGreeting(date = new Date()) {
  const hour = date instanceof Date && Number.isFinite(date.getTime())
    ? date.getHours()
    : new Date().getHours();

  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

function normalizeDashboardDateKeys(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((dateKey) => typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
  )].sort();
}

function getRussianDayLabel(days) {
  const lastTwoDigits = days % 100;
  const lastDigit = days % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "дней";
  if (lastDigit === 1) return "день";
  if (lastDigit >= 2 && lastDigit <= 4) return "дня";
  return "дней";
}

const WEIGHT_CHECK_IN_INTERVAL_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getProfileWorkoutStatusDateKey(slot) {
  // A suggested future move is not the date that was missed.
  if (slot?.isMissed) return slot.plannedDate || "";
  return slot?.shiftedDate || slot?.plannedDate || "";
}

function getCalendarDayTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 0;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getProfileWeightCheckInState(measurements = [], {
  now = new Date(),
  intervalDays = WEIGHT_CHECK_IN_INTERVAL_DAYS
} = {}) {
  const safeIntervalDays = Math.max(1, Math.round(Number(intervalDays) || WEIGHT_CHECK_IN_INTERVAL_DAYS));
  const weightedMeasurements = (Array.isArray(measurements) ? measurements : [])
    .map((measurement) => {
      const weight = Number(measurement?.weight);
      const timestamp = getCalendarDayTimestamp(
        measurement?.date || measurement?.createdAt || measurement?.savedAt || ""
      );

      return Number.isFinite(weight) && weight > 0 && timestamp
        ? { measurement, timestamp }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.timestamp - left.timestamp);

  const latest = weightedMeasurements[0] || null;
  const todayTimestamp = getCalendarDayTimestamp(now);

  if (!latest) {
    return {
      isDue: true,
      isFirst: true,
      isOverdue: false,
      intervalDays: safeIntervalDays,
      latestMeasurement: null,
      latestTimestamp: 0,
      nextDueTimestamp: todayTimestamp
    };
  }

  const nextDueTimestamp = latest.timestamp + safeIntervalDays * DAY_IN_MS;
  const daysPastDue = Math.floor((todayTimestamp - nextDueTimestamp) / DAY_IN_MS);

  return {
    isDue: todayTimestamp >= nextDueTimestamp,
    isFirst: false,
    isOverdue: daysPastDue > 0,
    daysPastDue: Math.max(0, daysPastDue),
    intervalDays: safeIntervalDays,
    latestMeasurement: latest.measurement,
    latestTimestamp: latest.timestamp,
    nextDueTimestamp
  };
}

export function getProfileMeasurementTrendPeriodLabel(currentTimestamp, previousTimestamp) {
  if (!Number.isFinite(currentTimestamp) || !Number.isFinite(previousTimestamp)) {
    return "с прошлого замера";
  }

  const intervalMs = Math.abs(currentTimestamp - previousTimestamp);
  const days = Math.round(intervalMs / (24 * 60 * 60 * 1000));

  if (days < 1) return "с прошлого замера";
  return `за ${days} ${getRussianDayLabel(days)}`;
}

export function getProfileDashboardScheduleDates(savedDates = [], workouts = [], sortWorkoutDays = (items) => items) {
  const normalizedSavedDates = normalizeDashboardDateKeys(savedDates);
  if (normalizedSavedDates.length) return normalizedSavedDates;

  const orderedWorkouts = sortWorkoutDays(Array.isArray(workouts) ? workouts : []);
  return normalizeDashboardDateKeys(
    orderedWorkouts.map((workout) => workout?.scheduledDate || workout?.plannedDate || "")
  );
}

export function buildProfileDashboardModel(ctx) {
  const {
    AI_NUTRITION_WEEK_DAYS,
    APP_PAGES,
    WORKOUT_CALENDAR_STORAGE_KEY,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    aiNutritionSavedPlan,
    auth,
    buildAiNutritionMonthlyPlan,
    buildPlannedWorkoutSlots,
    buildProgressInsight,
    buildWorkoutScheduleCalendarEntries,
    clientProgressPhotos,
    clientTrainerTasks,
    db,
    doc,
    formatProfileMeasurementDate,
    formatProfileProgressPhotoDate,
    formatProfileWorkoutDate,
    formatProfileWorkoutDateKey,
    getActiveTrainerTasksCount,
    getAiNutritionCurrentWeek,
    getAiNutritionDayMacros,
    getAiNutritionGoalLabel,
    getAiNutritionTrainingDays,
    getClientNutritionDisplayPlan,
    getNutritionDayTotals,
    getProfileNextTrainingText,
    getProgramHistoryItems,
    getTimestampValue,
    history: fullHistory,
    makeEmptyNutritionDay,
    nutrition,
    nutritionHistoryReady = true,
    nutritionCalendarDays,
    nutritionDateKey,
    nutritionKeyToDate,
    page,
    plan,
    profileAccount,
    profileActiveTab,
    profileMeasurements,
    profileMeasurementSnapshot,
    profileProgressPhotoCompareIds,
    profileProgressPhotoCompareView,
    profileProgressPhotoFiles,
    profileWorkoutCalendarData,
    profileWorkoutCalendarBaselineRef,
    profileWorkoutCalendarDate,
    profileWorkoutCalendarDraftDates,
    profileWorkoutCalendarEditing,
    profileWorkoutCalendarMonth,
    profileWorkoutCalendarSaving,
    profileWorkoutHistoryProgramScope,
    safeWriteUserJsonStorage,
    setProfileWorkoutCalendarData,
    setProfileWorkoutCalendarDate,
    setProfileWorkoutCalendarDraftDates,
    setProfileWorkoutCalendarEditing,
    setProfileWorkoutCalendarMonth,
    setProfileWorkoutCalendarSaving,
    setProfileWorkoutCalendarStatus,
    setProfileWorkoutScheduledDates,
    shiftProfileWorkoutMonthKey,
    sortWorkoutDays,
    telegramProfile,
    user,
    workoutModePreference
  } = ctx;

    const isMainDashboard = page === APP_PAGES.MAIN;
    const history = isMainDashboard ? getClientWorkoutCompletionHistory(plan, fullHistory) : fullHistory;
    const overviewMeasurements = getProfileOverviewMeasurements(profileMeasurementSnapshot, profileMeasurements);
    const visibleProfileTab = isMainDashboard
      ? "cabinet"
      : (profileActiveTab === "nutrition" || profileActiveTab === "progress" ? "cabinet" : profileActiveTab);
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
    const activeProfile = {
      ...(aiNutritionProfile || {}),
      ...aiNutritionProfileDraft
    };
    const bodyMeasurements = overviewMeasurements.filter(isBodyMeasurementRecord);
    const latestProfileMeasurement = bodyMeasurements.length
      ? bodyMeasurements[0]
      : null;
    const latestClientProgressPhoto = Array.isArray(clientProgressPhotos) && clientProgressPhotos.length
      ? clientProgressPhotos[0]
      : null;
    const progressReminderSettings = getClientReminderSettings(profileWorkoutCalendarData);
    const measurementsCheckIn = {
      ...getProfileBodyMeasurementCheckInState(overviewMeasurements, {
        intervalDays: progressReminderSettings.measurementsIntervalDays
      }),
      enabled: progressReminderSettings.measurementsEnabled,
      ready: !isMainDashboard || (profileMeasurementSnapshot?.kind === "measurements" &&
        profileMeasurementSnapshot.coverage?.measurements === "complete")
    };
    const progressPhotoCheckInState = getProfileProgressPhotoCheckInState(clientProgressPhotos, {
      intervalDays: progressReminderSettings.photoIntervalDays
    });
    const progressPhotoCheckIn = {
      ...progressPhotoCheckInState,
      enabled: progressReminderSettings.photoEnabled,
      latestDateText: progressPhotoCheckInState.latestPhoto
        ? formatProfileProgressPhotoDate(progressPhotoCheckInState.latestPhoto)
        : ""
    };
    const previousClientProgressPhoto = Array.isArray(clientProgressPhotos) && clientProgressPhotos.length > 1
      ? clientProgressPhotos[1]
      : null;
    const selectedClientProgressPhotoBefore = clientProgressPhotos.find(
      (photo) => photo.id === profileProgressPhotoCompareIds[0]
    ) || previousClientProgressPhoto;
    const selectedClientProgressPhotoAfter = clientProgressPhotos.find(
      (photo) => photo.id === profileProgressPhotoCompareIds[1]
    ) || latestClientProgressPhoto;
    const progressPhotoCompareViews = [
      { id: "front", label: "Спереди", urlKey: "frontUrl" },
      { id: "side", label: "Сбоку", urlKey: "sideUrl" },
      { id: "back", label: "Со спины", urlKey: "backUrl" }
    ];
    const activeProgressPhotoCompareView = progressPhotoCompareViews.find(
      (view) => view.id === profileProgressPhotoCompareView
    ) || progressPhotoCompareViews[0];
    const formatClientProgressPhotoDate = formatProfileProgressPhotoDate;
    const profileProgressPhotoSetComplete = ["front", "side", "back"].every(
      (view) => Boolean(profileProgressPhotoFiles[view])
    );
    const profileWorkoutHistoryItems = getProgramHistoryItems(history, profileWorkoutHistoryProgramScope);
    const trainingDaysText = getAiNutritionTrainingDays(activeProfile).length
      ? AI_NUTRITION_WEEK_DAYS
          .filter((day) => getAiNutritionTrainingDays(activeProfile).includes(day.id))
          .map((day) => day.short)
          .join(", ")
      : "не выбраны";
    const liveNutritionPreviewPlan = nutritionHistoryReady ? buildAiNutritionMonthlyPlan(nutrition, activeProfile, fullHistory, null) : null;
    const activePlan = getClientNutritionDisplayPlan(
      {
        aiNutritionPlan: aiNutritionSavedPlan,
        aiNutritionProfile: activeProfile,
        profile: activeProfile,
        nutritionPlan: nutrition.nutritionPlan
      },
      nutrition,
      nutrition.goals
    ) || liveNutritionPreviewPlan || aiNutritionSavedPlan || (nutritionHistoryReady && aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, fullHistory) : null);
    const activeWeek = activePlan?.weeks?.[getAiNutritionCurrentWeek(activePlan) - 1] || activePlan?.weeks?.[0];
    const activePlanProfile = activePlan?.profile || activeProfile;
    const activeGoalLabel = activePlan?.goalLabel || getAiNutritionGoalLabel(activePlanProfile?.goal || "recomp");
    const profileMacros = getAiNutritionDayMacros(activeWeek || nutrition.goals, activePlanProfile);
    const profileNutritionDraftProfile = {
      ...activeProfile,
      ...aiNutritionProfileDraft,
      trainingDays: getAiNutritionTrainingDays(aiNutritionProfileDraft)
    };
    const profileNutritionDraftPlan = nutritionHistoryReady ? buildAiNutritionMonthlyPlan(nutrition, profileNutritionDraftProfile, fullHistory, null) : null;
    const profileNutritionDraftWeek = profileNutritionDraftPlan?.weeks?.[0] || profileNutritionDraftPlan?.start || nutrition.goals;
    const profileNutritionDraftMacros = getAiNutritionDayMacros(profileNutritionDraftWeek, profileNutritionDraftProfile);
    const trainerNotificationCount = getActiveTrainerTasksCount(clientTrainerTasks);
    const [workoutCalendarYear, workoutCalendarMonthIndex] = profileWorkoutCalendarMonth
      .split("-")
      .map(Number);
    const workoutCalendarMonthDate = new Date(
      workoutCalendarYear,
      Math.max(0, (workoutCalendarMonthIndex || 1) - 1),
      1
    );
    const workoutCalendarStartOffset = (workoutCalendarMonthDate.getDay() + 6) % 7;
    const workoutCalendarGridStart = new Date(
      workoutCalendarMonthDate.getFullYear(),
      workoutCalendarMonthDate.getMonth(),
      1 - workoutCalendarStartOffset
    );
    const workoutCalendarHistoryByDate = history.reduce((result, item) => {
      const timestamp = getTimestampValue(item?.date);
      if (!timestamp) return result;
      const key = formatProfileWorkoutDateKey(new Date(timestamp));
      result[key] = [...(result[key] || []), item];
      return result;
    }, {});
    const selectedWorkoutMode = workoutModePreference?.mode === "basic" ? "basic" : "individual";
    const selectedModePlan = isWorkoutPlanForMode(plan, selectedWorkoutMode)
      ? plan
      : { workouts: [] };
    const profileCalendarWorkouts = resolveTrainerAssignmentWorkoutOrder(
      sortWorkoutDays(selectedModePlan.workouts || []), profileWorkoutCalendarData
    );
    const isTrainerManagedWorkoutSchedule = selectedWorkoutMode === "individual" && (
      Boolean(selectedModePlan?.assignedProgramId || selectedModePlan?.assignedProgramUpdatedAt) ||
      profileCalendarWorkouts.some((workout) => (
        workout?.assignedProgramId ||
        workout?.assignedProgramUpdatedAt ||
        workout?.assignedProgramAddedAt ||
        workout?.programAssignmentId
      ))
    );
    const canEditProfileWorkoutSchedule = !isTrainerManagedWorkoutSchedule;
    const scopedProfileCalendar = getWorkoutScheduleCalendarForWorkouts(
      profileWorkoutCalendarData,
      profileCalendarWorkouts
    );
    const dashboardScheduledDates = getProfileDashboardScheduleDates(
      scopedProfileCalendar.scheduledDates,
      profileCalendarWorkouts,
      sortWorkoutDays
    );
    const profileCalendarSource = {
      ...scopedProfileCalendar,
      scheduledDates: dashboardScheduledDates,
      monthlyTrainingDates: dashboardScheduledDates
    };
    const currentProfileWorkoutSlots = buildPlannedWorkoutSlots({
      workouts: profileCalendarWorkouts,
      calendar: profileCalendarSource,
      history
    });
    const editingBaseline = profileWorkoutCalendarEditing && profileWorkoutCalendarBaselineRef?.current?.uid === auth.currentUser?.uid
      ? profileWorkoutCalendarBaselineRef.current : null;
    const profileWorkoutSlots = editingBaseline?.slots || currentProfileWorkoutSlots;
    const profileCalendarDraft = getProfileCalendarDraft(profileWorkoutSlots);
    const profileWorkoutEditableDates = profileCalendarDraft.dates;
    const profileWorkoutCompletedCount = profileCalendarDraft.completedCount;
    const profileWorkoutScheduleRequiredCount = profileCalendarDraft.requiredCount;
    const profileWorkoutScheduleLockedDates = normalizeDashboardDateKeys(
      profileWorkoutSlots
        .filter((slot) => slot?.isCompleted)
        .map((slot) => slot?.completedDate || slot?.plannedDate || "")
    );
    const nextWorkoutSlot = profileWorkoutSlots.find((slot) => !slot.isCompleted) || profileWorkoutSlots[0] || null;
    const nextWorkoutSource = profileCalendarWorkouts.find((workout) => (
      String(workout?.id || "") === String(nextWorkoutSlot?.workoutId || "")
    )) || profileCalendarWorkouts[nextWorkoutSlot?.index ?? 0] || null;
    const nextWorkoutDateKey = getProfileWorkoutStatusDateKey(nextWorkoutSlot);
    const nextWorkoutDate = nextWorkoutDateKey
      ? new Date(`${nextWorkoutDateKey}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
      : "Дата уточняется";
    const nextWorkoutTitle = nextWorkoutSource?.name || nextWorkoutSlot?.workoutName || "Тренировка по плану";
    const nextWorkoutExerciseCount = Array.isArray(nextWorkoutSource?.exercises)
      ? nextWorkoutSource.exercises.length
      : 0;
    const hasWorkoutPlan = profileCalendarWorkouts.length > 0;
    const hasPlanInAnotherMode = !hasWorkoutPlan && Array.isArray(plan?.workouts) && plan.workouts.length > 0;
    const hasPendingWorkout = profileWorkoutSlots.some((slot) => !slot.isCompleted);
    const homeWorkoutAction = !hasWorkoutPlan
      ? {
          eyebrow: "ТРЕНИРОВКИ",
          exerciseCount: 0,
          ...getDashboardEmptyWorkoutAction(selectedWorkoutMode, hasPlanInAnotherMode)
        }
      : !hasPendingWorkout
        ? {
            state: "complete",
            eyebrow: "ТРЕНИРОВКИ",
            title: "План выполнен",
            dateText: "Все тренировки текущего плана завершены",
            exerciseCount: 0,
            actionLabel: "Открыть тренировки"
          }
        : {
            state: "ready",
            isToday: Boolean(nextWorkoutDateKey && nextWorkoutDateKey === formatProfileWorkoutDateKey(new Date())),
            scheduleStatus: nextWorkoutSlot?.isMissed
              ? "missed"
              : !nextWorkoutDateKey
                ? "unscheduled"
                : nextWorkoutDateKey === formatProfileWorkoutDateKey(new Date())
                  ? "today"
                  : "upcoming",
            eyebrow: nextWorkoutSlot?.isMissed ? "ТРЕНИРОВКА ПЕРЕНЕСЕНА" : "СЛЕДУЮЩАЯ ТРЕНИРОВКА",
            title: nextWorkoutTitle,
            positionText: `${Math.max(0, profileCalendarWorkouts.indexOf(nextWorkoutSource)) + 1} из ${profileCalendarWorkouts.length}`,
            dateText: nextWorkoutDate,
            exerciseCount: nextWorkoutExerciseCount,
            actionLabel: "Открыть тренировку"
          };
    const profileWorkoutCalendarEntries = buildWorkoutScheduleCalendarEntries(profileWorkoutSlots);
    const profileWorkoutEntriesByDate = profileWorkoutCalendarEntries.reduce((result, entry) => {
      if (!result[entry.date]) result[entry.date] = [];
      result[entry.date].push(entry);
      return result;
    }, {});
    const profileWorkoutDraftEntriesByDate = getProfileCalendarDraft(profileWorkoutSlots, profileWorkoutCalendarDraftDates).entries.reduce((result, entry) => {
      result[entry.date] = [...(result[entry.date] || []), entry];
      return result;
    }, {});
    const profileWorkoutVisibleEntriesByDate = profileWorkoutCalendarEditing
      ? profileWorkoutDraftEntriesByDate
      : profileWorkoutEntriesByDate;
    const workoutCalendarDays = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        workoutCalendarGridStart.getFullYear(),
        workoutCalendarGridStart.getMonth(),
        workoutCalendarGridStart.getDate() + index
      );
      const key = formatProfileWorkoutDateKey(date);
      return {
        date,
        key,
        isCurrentMonth: date.getMonth() === workoutCalendarMonthDate.getMonth(),
        isToday: key === formatProfileWorkoutDateKey(new Date()),
        isScheduled: (
          profileWorkoutCalendarEditing
            ? profileWorkoutCalendarDraftDates
            : dashboardScheduledDates
        ).includes(key),
        isScheduleLocked: profileWorkoutScheduleLockedDates.includes(key),
        scheduleEntries: profileWorkoutVisibleEntriesByDate[key] || [],
        workouts: workoutCalendarHistoryByDate[key] || []
      };
    });
    const selectedWorkoutCalendarItems = workoutCalendarHistoryByDate[profileWorkoutCalendarDate] || [];
    const shiftProfileWorkoutCalendarMonth = (direction) => {
      const nextMonthKey = shiftProfileWorkoutMonthKey(profileWorkoutCalendarMonth, direction);
      setProfileWorkoutCalendarMonth(nextMonthKey);
      setProfileWorkoutCalendarDate(`${nextMonthKey}-01`);
    };
    const toggleProfileWorkoutScheduledDate = (dateKey) => {
      setProfileWorkoutCalendarDraftDates((current) => (
        current.includes(dateKey)
          ? current.filter((item) => item !== dateKey)
          : [...current, dateKey].sort()
      ));
      setProfileWorkoutCalendarStatus("");
    };
    const saveProfileWorkoutCalendar = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || profileWorkoutCalendarSaving) return;

      const scheduledDates = normalizeDashboardDateKeys(profileWorkoutCalendarDraftDates);

      if (scheduledDates.length !== profileWorkoutScheduleRequiredCount) {
        setProfileWorkoutCalendarStatus("Выберите по одной дате для каждого оставшегося занятия.");
        return false;
      }

      setProfileWorkoutCalendarSaving(true);
      setProfileWorkoutCalendarStatus("");

      try {
        const userRef = doc(db, "users", uid);
        const nowIso = new Date().toISOString();
        const nextCalendar = await runTransaction(db, async transaction => {
          const snapshot = await transaction.get(userRef);
          if (!snapshot.exists()) throw new Error("calendar/stale-assignment");
          const currentCalendar = snapshot.data().workoutCalendar || {};
          const next = {
            ...mergeProfileCalendarDraft(currentCalendar, editingBaseline?.calendar || profileWorkoutCalendarData, profileWorkoutSlots, scheduledDates),
            scheduleUpdatedBy: "client", clientScheduleUpdatedAt: nowIso,
            clientScheduleRequiresReview: isTrainerManagedWorkoutSchedule, updatedAt: nowIso
          };
          transaction.update(userRef, { workoutCalendar: next, updatedAt: nowIso });
          return next;
        });

        setProfileWorkoutScheduledDates(nextCalendar.scheduledDates);
        setProfileWorkoutCalendarDraftDates(scheduledDates);
        setProfileWorkoutCalendarData(nextCalendar);
        safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, uid, nextCalendar);
        setProfileWorkoutCalendarEditing(false);
        setProfileWorkoutCalendarStatus(
          isTrainerManagedWorkoutSchedule
            ? "Расписание сохранено. Тренер увидит изменения."
            : "Тренировочные дни сохранены."
        );
      } catch (error) {
        console.error("Workout calendar save failed:", error);
        setProfileWorkoutCalendarStatus(error.message === "calendar/stale-assignment"
          ? "Тренер изменил одно из оставшихся занятий или оно уже выполнено. Выбранные даты не удалены. Проверьте актуальное расписание перед повторной настройкой."
          : "Не получилось сохранить дни. Проверь соединение.");
      } finally {
        setProfileWorkoutCalendarSaving(false);
      }
    };

    const profileAiNutritionPlan = activePlan;
    const profileAiNutritionWeekNumber = getAiNutritionCurrentWeek(profileAiNutritionPlan);
    const profileAiNutritionWeek = profileAiNutritionPlan?.weeks?.[profileAiNutritionWeekNumber - 1] || profileAiNutritionPlan?.weeks?.[0];
    const profileAiNutritionActiveProfile = profileAiNutritionPlan?.profile || activeProfile;
    const profileNutritionCalendarDays = nutritionCalendarDays;
    const profileNutritionMonthDays = profileNutritionCalendarDays
      .slice(-7)
      .some((day) => day.isCurrentMonth)
        ? profileNutritionCalendarDays
        : profileNutritionCalendarDays.slice(0, -7);
    const profileNutritionSelectedDate = nutritionKeyToDate(nutritionDateKey);
    const profileNutritionSelectedDayIndex = profileNutritionMonthDays.findIndex(
      (day) => day.key === nutritionDateKey
    );
    const profileNutritionTodayIndex = profileNutritionMonthDays.findIndex((day) => day.isToday);
    const profileNutritionWeekAnchorIndex = profileNutritionSelectedDayIndex >= 0
      ? profileNutritionSelectedDayIndex
      : Math.max(0, profileNutritionTodayIndex);
    const profileNutritionWeekStartIndex = Math.floor(profileNutritionWeekAnchorIndex / 7) * 7;
    const profileNutritionWeekDays = profileNutritionMonthDays.slice(
      profileNutritionWeekStartIndex,
      profileNutritionWeekStartIndex + 7
    );
    const profileNutritionWeekLabel = profileNutritionWeekDays.length
      ? `${profileNutritionWeekDays[0].date.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short"
        })} – ${profileNutritionWeekDays[6].date.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })}`
      : profileNutritionSelectedDate.toLocaleDateString("ru-RU");
    const profileNutritionSelectedDay = nutrition.days?.[nutritionDateKey] || makeEmptyNutritionDay();
    const profileNutritionSelectedTotals = getNutritionDayTotals(profileNutritionSelectedDay);
    const lastWorkoutDate = formatProfileWorkoutDate(lastWorkout?.date);
    const nextTrainingText = getProfileNextTrainingText(
      activeProfile,
      user,
      dashboardScheduledDates
    );
    const currentGoalId = activeProfile?.goal || "recomp";
    const progressTone = currentGoalId === "mass"
      ? "Набираем массу аккуратно"
      : currentGoalId === "cut" || currentGoalId === "dry"
        ? "Снижаем вес без потери мышц"
        : currentGoalId === "maintain"
          ? "Держим форму стабильно"
          : "Рекомпозиция идёт по плану";
    const greetingName = limitUserDisplayName(
      profileAccount.displayName || telegramProfile.displayName || auth.currentUser?.email?.split("@")?.[0] || "спортсмен"
    );
    const profileAvatarUrl = profileAccount.avatarUrl || telegramProfile.avatarUrl || auth.currentUser?.photoURL || "";
    const profileStreak = Math.min(30, Math.max(0, totalWorkouts));
    const mainProfileWeight = Number(activeProfile?.weight);
    const savedMainMeasurementSeries = overviewMeasurements
      .slice(0, 7)
      .reverse()
      .map((measurement) => {
        const weight = Number(String(measurement?.weight ?? measurement?.values?.weight ?? "").replace(",", "."));
        const dateLabel = formatProfileMeasurementDate(measurement)
          .split(".")
          .slice(0, 2)
          .join(".");
        const timestamp = new Date(
          measurement?.date || measurement?.createdAt || measurement?.savedAt || ""
        ).getTime();
        return Number.isFinite(weight) && weight > 0
          ? {
              weight,
              dateLabel,
              timestamp: Number.isFinite(timestamp) ? timestamp : 0
            }
          : null;
      })
      .filter(Boolean);
    const mainMeasurementSeries = savedMainMeasurementSeries.length
      ? savedMainMeasurementSeries
      : Number.isFinite(mainProfileWeight) && mainProfileWeight > 0
        ? [{ weight: mainProfileWeight, dateLabel: "Сейчас" }]
        : [];
    const latestSavedWeight = overviewMeasurements.map(item => Number(String(item?.weight ?? item?.values?.weight ?? "").replace(",", ".")))
      .find(weight => Number.isFinite(weight) && weight > 0);
    const mainLatestWeight = latestSavedWeight || mainMeasurementSeries.at(-1)?.weight ||
      (Number.isFinite(mainProfileWeight) && mainProfileWeight > 0 ? mainProfileWeight : 0);
    const mainPreviousWeight = mainMeasurementSeries.at(-2)?.weight || 0;
    const mainWeightTrendPeriod = getProfileMeasurementTrendPeriodLabel(
      mainMeasurementSeries.at(-1)?.timestamp,
      mainMeasurementSeries.at(-2)?.timestamp
    );
    const mainWeightComparisonAvailable = Boolean(mainLatestWeight && mainPreviousWeight);
    const mainWeightChange = mainWeightComparisonAvailable
      ? mainLatestWeight - mainPreviousWeight
      : 0;
    const weightCheckInState = getProfileWeightCheckInState(overviewMeasurements, {
      intervalDays: progressReminderSettings.weightIntervalDays
    });
    const weightCheckInLatestDateText = weightCheckInState.latestMeasurement
      ? formatProfileMeasurementDate(weightCheckInState.latestMeasurement)
      : "";
    const weightCheckInNextDateText = weightCheckInState.nextDueTimestamp
      ? new Date(weightCheckInState.nextDueTimestamp).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long"
        })
      : "";
    const weightCheckIn = {
      ...weightCheckInState,
      enabled: progressReminderSettings.weightEnabled,
      latestDateText: weightCheckInLatestDateText,
      nextDueDateText: weightCheckInNextDateText,
      cabinetText: weightCheckInState.isDue
        ? (weightCheckInState.isFirst ? "Добавьте первый вес" : "Пора взвеситься")
        : `Следующее взвешивание ${weightCheckInNextDateText}`
    };
    const progressInsight = nutritionHistoryReady ? buildProgressInsight({
      history: fullHistory,
      measurements: (Array.isArray(profileMeasurements) ? profileMeasurements : []).filter(item => item?.measurementType !== "weight_checkin"),
      nutrition,
      calorieGoal: Number(profileMacros.calories || nutrition.goals.calories),
      proteinGoal: Number(profileMacros.protein || nutrition.goals.protein),
      scheduledDates: dashboardScheduledDates,
      goal: currentGoalId
    }) : null;
  return {
    isMainDashboard,
    visibleProfileTab,
    totalWorkouts,
    lastWorkout,
    activeProfile,
    latestProfileMeasurement,
    latestClientProgressPhoto,
    progressPhotoCheckIn,
    measurementsCheckIn,
    previousClientProgressPhoto,
    selectedClientProgressPhotoBefore,
    selectedClientProgressPhotoAfter,
    progressPhotoCompareViews,
    activeProgressPhotoCompareView,
    formatClientProgressPhotoDate,
    profileProgressPhotoSetComplete,
    profileWorkoutHistoryItems,
    trainingDaysText,
    liveNutritionPreviewPlan,
    activePlan,
    activeWeek,
    activePlanProfile,
    activeGoalLabel,
    profileMacros,
    profileNutritionDraftProfile,
    profileNutritionDraftPlan,
    profileNutritionDraftWeek,
    profileNutritionDraftMacros,
    trainerNotificationCount,
    workoutCalendarYear,
    workoutCalendarMonthIndex,
    workoutCalendarMonthDate,
    workoutCalendarStartOffset,
    workoutCalendarGridStart,
    workoutCalendarHistoryByDate,
    profileCalendarWorkouts,
    profileCalendarSource,
    profileCalendarScheduledDates: dashboardScheduledDates,
    profileWorkoutEditableDates,
    profileWorkoutCompletedCount,
    canEditProfileWorkoutSchedule,
    isTrainerManagedWorkoutSchedule,
    profileWorkoutScheduleRequiredCount,
    profileWorkoutScheduleLockedDates,
    profileWorkoutSlots,
    nextWorkoutDate,
    nextWorkoutTitle,
    nextWorkoutExerciseCount,
    homeWorkoutAction,
    profileWorkoutCalendarEntries,
    profileWorkoutEntriesByDate,
    profileWorkoutDraftEntriesByDate,
    profileWorkoutVisibleEntriesByDate,
    workoutCalendarDays,
    selectedWorkoutCalendarItems,
    shiftProfileWorkoutCalendarMonth,
    toggleProfileWorkoutScheduledDate,
    saveProfileWorkoutCalendar,
    profileAiNutritionPlan,
    profileAiNutritionWeekNumber,
    profileAiNutritionWeek,
    profileAiNutritionActiveProfile,
    profileNutritionCalendarDays,
    profileNutritionMonthDays,
    profileNutritionSelectedDate,
    profileNutritionSelectedDayIndex,
    profileNutritionTodayIndex,
    profileNutritionWeekAnchorIndex,
    profileNutritionWeekStartIndex,
    profileNutritionWeekDays,
    profileNutritionWeekLabel,
    profileNutritionSelectedDay,
    profileNutritionSelectedTotals,
    lastWorkoutDate,
    nextTrainingText,
    currentGoalId,
    progressTone,
    greetingName,
    profileAvatarUrl,
    profileStreak,
    mainProfileWeight,
    savedMainMeasurementSeries,
    hasSavedWeightMeasurement: savedMainMeasurementSeries.length > 0,
    mainMeasurementSeries,
    mainLatestWeight,
    mainPreviousWeight,
    mainWeightChange,
    mainWeightComparisonAvailable,
    mainWeightTrendPeriod,
    weightCheckIn,
    progressInsight
  };
}

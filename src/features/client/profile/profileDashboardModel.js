import { isWorkoutPlanForMode } from "../../../utils/workoutPlanMode.js";
import { getWorkoutScheduleCalendarForWorkouts } from "../../../utils/workoutSchedule.js";
import { limitUserDisplayName } from "../../../utils/userDisplayName.js";

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
    buildWorkoutScheduleDraft,
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
    getDoc,
    getNutritionDayTotals,
    getProfileNextTrainingText,
    getProgramHistoryItems,
    getTimestampValue,
    history,
    makeEmptyNutritionDay,
    nutrition,
    nutritionCalendarDays,
    nutritionDateKey,
    nutritionKeyToDate,
    page,
    plan,
    profileAccount,
    profileActiveTab,
    profileMeasurements,
    profileProgressPhotoCompareIds,
    profileProgressPhotoCompareView,
    profileProgressPhotoFiles,
    profileWorkoutCalendarData,
    profileWorkoutCalendarDate,
    profileWorkoutCalendarDraftDates,
    profileWorkoutCalendarEditing,
    profileWorkoutCalendarMonth,
    profileWorkoutCalendarSaving,
    profileWorkoutHistoryProgramScope,
    safeWriteUserJsonStorage,
    setDoc,
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
    const visibleProfileTab = isMainDashboard
      ? "cabinet"
      : (profileActiveTab === "nutrition" || profileActiveTab === "progress" ? "cabinet" : profileActiveTab);
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
    const activeProfile = {
      ...(aiNutritionProfile || {}),
      ...aiNutritionProfileDraft
    };
    const bodyMeasurements = (Array.isArray(profileMeasurements) ? profileMeasurements : [])
      .filter((measurement) => measurement?.measurementType !== "weight_checkin");
    const latestProfileMeasurement = bodyMeasurements.length
      ? bodyMeasurements[0]
      : null;
    const latestClientProgressPhoto = Array.isArray(clientProgressPhotos) && clientProgressPhotos.length
      ? clientProgressPhotos[0]
      : null;
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
    const liveNutritionPreviewPlan = buildAiNutritionMonthlyPlan(nutrition, activeProfile, history, null);
    const activePlan = getClientNutritionDisplayPlan(
      {
        aiNutritionPlan: aiNutritionSavedPlan,
        aiNutritionProfile: activeProfile,
        profile: activeProfile,
        nutritionPlan: nutrition.nutritionPlan
      },
      nutrition,
      nutrition.goals
    ) || liveNutritionPreviewPlan || aiNutritionSavedPlan || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
    const activeWeek = activePlan?.weeks?.[getAiNutritionCurrentWeek(activePlan) - 1] || activePlan?.weeks?.[0];
    const activePlanProfile = activePlan?.profile || activeProfile;
    const activeGoalLabel = activePlan?.goalLabel || getAiNutritionGoalLabel(activePlanProfile?.goal || "recomp");
    const profileMacros = getAiNutritionDayMacros(activeWeek || nutrition.goals, activePlanProfile);
    const profileNutritionDraftProfile = {
      ...activeProfile,
      ...aiNutritionProfileDraft,
      trainingDays: getAiNutritionTrainingDays(aiNutritionProfileDraft)
    };
    const profileNutritionDraftPlan = buildAiNutritionMonthlyPlan(nutrition, profileNutritionDraftProfile, history, null);
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
    const profileCalendarWorkouts = sortWorkoutDays(selectedModePlan.workouts || []);
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
    const profileWorkoutSlots = buildPlannedWorkoutSlots({
      workouts: profileCalendarWorkouts,
      calendar: profileCalendarSource,
      history
    });
    const nextWorkoutSlot = profileWorkoutSlots.find((slot) => !slot.isCompleted) || profileWorkoutSlots[0] || null;
    const nextWorkoutSource = profileCalendarWorkouts.find((workout) => (
      String(workout?.id || "") === String(nextWorkoutSlot?.workoutId || "")
    )) || profileCalendarWorkouts[nextWorkoutSlot?.index ?? 0] || null;
    const nextWorkoutDateKey = nextWorkoutSlot?.shiftedDate || nextWorkoutSlot?.plannedDate || "";
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
    const homeWorkoutAction = !hasWorkoutPlan && hasPlanInAnotherMode
      ? {
          state: "choose",
          eyebrow: "ТРЕНИРОВКИ",
          title: "Выберите режим тренировок",
          dateText: "У вас уже есть план — выберите, как его открыть",
          exerciseCount: 0,
          actionLabel: "Выбрать режим"
        }
      : !hasWorkoutPlan
      ? {
          state: "create",
          eyebrow: "ТРЕНИРОВКИ",
          title: "Создайте первый план",
          dateText: "Выберите формат — приложение подготовит стартовую программу",
          exerciseCount: 0,
          actionLabel: "Перейти к тренировке"
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
            eyebrow: nextWorkoutSlot?.isMissed ? "ТРЕНИРОВКА ПЕРЕНЕСЕНА" : "СЛЕДУЮЩАЯ ТРЕНИРОВКА",
            title: nextWorkoutTitle,
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
    const profileWorkoutDraftEntriesByDate = profileWorkoutCalendarDraftDates.reduce((result, date, index) => {
      result[date] = profileWorkoutEntriesByDate[date]?.length
        ? profileWorkoutEntriesByDate[date]
        : [{ date, order: index + 1, status: "planned", title: `Тренировка №${index + 1}` }];
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
      if (!uid || profileWorkoutCalendarSaving || !canEditProfileWorkoutSchedule) return;

      setProfileWorkoutCalendarSaving(true);
      setProfileWorkoutCalendarStatus("");

      try {
        const userRef = doc(db, "users", uid);
        const userSnapshot = await getDoc(userRef);
        const currentCalendar = userSnapshot.exists()
          ? userSnapshot.data()?.workoutCalendar || {}
          : {};
        const scheduledDates = [...new Set(profileWorkoutCalendarDraftDates)].sort();
        const plannedWorkouts = buildWorkoutScheduleDraft(scheduledDates, profileCalendarWorkouts);
        const nextCalendar = {
          ...currentCalendar,
          scheduledDates,
          monthlyTrainingDates: scheduledDates,
          plannedWorkouts,
          updatedAt: new Date().toISOString()
        };

        await setDoc(userRef, {
          workoutCalendar: nextCalendar,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setProfileWorkoutScheduledDates(scheduledDates);
        setProfileWorkoutCalendarDraftDates(scheduledDates);
        setProfileWorkoutCalendarData(nextCalendar);
        safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, uid, nextCalendar);
        setProfileWorkoutCalendarEditing(false);
        setProfileWorkoutCalendarStatus("Тренировочные дни сохранены.");
      } catch (error) {
        console.error("Workout calendar save failed:", error);
        setProfileWorkoutCalendarStatus("Не получилось сохранить дни. Проверь соединение.");
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
    const savedMainMeasurementSeries = (Array.isArray(profileMeasurements) ? profileMeasurements : [])
      .slice(0, 7)
      .reverse()
      .map((measurement) => {
        const weight = Number(measurement?.weight);
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
    const mainLatestWeight = mainMeasurementSeries.at(-1)?.weight ||
      (Number.isFinite(mainProfileWeight) && mainProfileWeight > 0 ? mainProfileWeight : 0);
    const mainPreviousWeight = mainMeasurementSeries.at(-2)?.weight || 0;
    const mainWeightTrendPeriod = getProfileMeasurementTrendPeriodLabel(
      mainMeasurementSeries.at(-1)?.timestamp,
      mainMeasurementSeries.at(-2)?.timestamp
    );
    const mainWeightChange = mainLatestWeight && mainPreviousWeight
      ? mainLatestWeight - mainPreviousWeight
      : 0;
    const weightCheckInState = getProfileWeightCheckInState(profileMeasurements);
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
      latestDateText: weightCheckInLatestDateText,
      nextDueDateText: weightCheckInNextDateText,
      cabinetText: weightCheckInState.isDue
        ? (weightCheckInState.isFirst ? "Добавьте первый вес" : "Пора взвеситься")
        : `Следующее взвешивание ${weightCheckInNextDateText}`
    };
    const progressInsight = buildProgressInsight({
      history,
      measurements: profileMeasurements,
      nutrition,
      calorieGoal: Number(profileMacros.calories || nutrition.goals.calories),
      proteinGoal: Number(profileMacros.protein || nutrition.goals.protein),
      scheduledDates: dashboardScheduledDates,
      goal: currentGoalId
    });
  return {
    isMainDashboard,
    visibleProfileTab,
    totalWorkouts,
    lastWorkout,
    activeProfile,
    latestProfileMeasurement,
    latestClientProgressPhoto,
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
    canEditProfileWorkoutSchedule,
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
    mainWeightTrendPeriod,
    weightCheckIn,
    progressInsight
  };
}

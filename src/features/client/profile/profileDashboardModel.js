function normalizeDashboardDateKeys(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((dateKey) => typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
  )].sort();
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
    profileWorkoutScheduledDates,
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
    user
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
    const latestProfileMeasurement = Array.isArray(profileMeasurements) && profileMeasurements.length
      ? profileMeasurements[0]
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
    const profileCalendarWorkouts = sortWorkoutDays(plan.workouts || []);
    const dashboardScheduledDates = getProfileDashboardScheduleDates(
      profileWorkoutScheduledDates,
      profileCalendarWorkouts,
      sortWorkoutDays
    );
    const profileCalendarSource = {
      ...(profileWorkoutCalendarData || {}),
      scheduledDates: dashboardScheduledDates,
      monthlyTrainingDates: dashboardScheduledDates
    };
    const profileWorkoutSlots = buildPlannedWorkoutSlots({
      workouts: profileCalendarWorkouts,
      calendar: profileCalendarSource,
      history
    });
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
            : profileWorkoutScheduledDates
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
      if (!uid || profileWorkoutCalendarSaving) return;

      setProfileWorkoutCalendarSaving(true);
      setProfileWorkoutCalendarStatus("");

      try {
        const userRef = doc(db, "users", uid);
        const userSnapshot = await getDoc(userRef);
        const currentCalendar = userSnapshot.exists()
          ? userSnapshot.data()?.workoutCalendar || {}
          : {};
        const scheduledDates = [...new Set(profileWorkoutCalendarDraftDates)].sort();
        const plannedWorkouts = buildWorkoutScheduleDraft(scheduledDates, sortWorkoutDays(plan.workouts || []));
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
    const greetingName = profileAccount.displayName || telegramProfile.displayName || auth.currentUser?.email?.split("@")?.[0] || "спортсмен";
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
        return Number.isFinite(weight) && weight > 0 ? { weight, dateLabel } : null;
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
    const mainWeightChange = mainLatestWeight && mainPreviousWeight
      ? mainLatestWeight - mainPreviousWeight
      : 0;
    const progressInsight = buildProgressInsight({
      history,
      measurements: profileMeasurements,
      nutrition,
      calorieGoal: Number(profileMacros.calories || nutrition.goals.calories),
      proteinGoal: Number(profileMacros.protein || nutrition.goals.protein),
      scheduledDates: dashboardScheduledDates,
      goal: currentGoalId
    });
    const aiCoachStatuses = progressInsight.statuses;


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
    profileWorkoutSlots,
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
    mainMeasurementSeries,
    mainLatestWeight,
    mainPreviousWeight,
    mainWeightChange,
    progressInsight,
    aiCoachStatuses
  };
}

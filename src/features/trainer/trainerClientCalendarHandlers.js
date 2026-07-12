import { doc, setDoc, writeBatch } from "firebase/firestore";

import { buildWorkoutScheduleDraftWithExistingStatuses } from "../../utils/workoutSchedule";
import { sortWorkoutDays } from "../../utils/workoutPlanNormalization";
import { normalizeAdminProgressReminderInterval } from "../../utils/adminClientCalendar";
import { getClientTelegramProfile } from "../../utils/clientTelegramProfile";
import { fetchAuthorized } from "../../utils/apiClient";
import { getTrainerActionErrorStatus } from "../../utils/trainerActionStatus";
import { validateTrainerWorkoutScheduleDates } from "../../utils/trainerProgramValidation";

const STATUS_SELECT_CLIENT = "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_CALENDAR_SAVING = "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e \u043a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c...";
const STATUS_CALENDAR_SAVED = "\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c \u0438 Telegram-\u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b.";
const STATUS_CALENDAR_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c.";
const STATUS_TEST_SENDING = "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u044e \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0435 Telegram-\u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435...";
const STATUS_TEST_SENT = "\u0422\u0435\u0441\u0442\u043e\u0432\u043e\u0435 Telegram-\u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e.";
const STATUS_TEST_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0435 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435.";
const STATUS_PROGRAM_REQUIRED = "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043d\u0430\u0437\u043d\u0430\u0447\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a.";
const STATUS_SCHEDULE_SAVING = "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435...";
const STATUS_SCHEDULE_SAVED = "\u0420\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e.";
const STATUS_SCHEDULE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a.";
const STATUS_SELECT_OFFSET = "\u0412\u044b\u0431\u0435\u0440\u0438 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u0438\u043d \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f.";
const STATUS_NOTIFICATIONS_SAVING = "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f...";
const STATUS_NOTIFICATIONS_SAVED = "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b.";
const STATUS_NOTIFICATIONS_OFF = "Telegram-\u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u044b.";
const STATUS_NOTIFICATIONS_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439.";
const STATUS_OPEN_BOT = "\u041e\u0442\u043a\u0440\u043e\u0439 \u0431\u043e\u0442\u0430 \u043d\u0430 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u043f\u0440\u0438\u0432\u044f\u0436\u0438 \u0435\u0433\u043e \u0430\u043a\u043a\u0430\u0443\u043d\u0442.";

function getCleanScheduleDates(dates) {
  return [...new Set((Array.isArray(dates) ? dates : [])
    .map((date) => String(date || "").trim())
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

function getReminderOffsets(offsets) {
  return [...new Set(
    (Array.isArray(offsets) ? offsets : [])
      .map(Number)
      .filter((hours) => [24, 12, 3, 1].includes(hours))
  )].sort((a, b) => b - a);
}

export function createTrainerClientCalendarHandlers({
  db,
  auth,
  TELEGRAM_BOT_USERNAME,
  adminSelectedClient,
  usersList,
  selectedUserId,
  plan,
  adminCalendarDraft,
  setAdminCalendarDraft,
  setAdminCalendarSaving,
  setAdminCalendarTesting,
  setAdminClientStatus,
  setAdminSelectedClient,
  setUsersList,
  setPlan,
  recordTrainerEvent
}) {
  function toggleAdminCalendarDay(dayId) {
    setAdminCalendarDraft((prev) => {
      const current = Array.isArray(prev.trainingDays) ? prev.trainingDays : [];
      const exists = current.includes(dayId);
      const nextTrainingDays = exists ? current.filter((item) => item !== dayId) : [...current, dayId];
      const nextDaySettings = { ...(prev.daySettings || {}) };

      if (!exists && !nextDaySettings[dayId]) {
        nextDaySettings[dayId] = {
          workoutTime: prev.workoutTime || "13:00",
          reminderTime: "19:00",
          hourReminderEnabled: prev.hourReminderEnabled === true
        };
      }

      return {
        ...prev,
        trainingDays: nextTrainingDays,
        daySettings: nextDaySettings
      };
    });
  }

  function updateAdminCalendarDaySetting(dayId, field, value) {
    setAdminCalendarDraft((prev) => ({
      ...prev,
      daySettings: {
        ...(prev.daySettings || {}),
        [dayId]: {
          workoutTime: prev.workoutTime || "13:00",
          reminderTime: "19:00",
          hourReminderEnabled: prev.hourReminderEnabled === true,
          ...((prev.daySettings || {})[dayId] || {}),
          [field]: value
        }
      }
    }));
  }

  async function saveAdminClientCalendar(client = adminSelectedClient) {
    if (!client?.id) return;

    setAdminCalendarSaving(true);
    setAdminClientStatus(STATUS_CALENDAR_SAVING);

    let previousClient = null;

    try {
      const trainingDays = Array.isArray(adminCalendarDraft.trainingDays) ? adminCalendarDraft.trainingDays : [];
      const nextCalendar = {
        enabled: adminCalendarDraft.enabled !== false,
        reminderEnabled: adminCalendarDraft.reminderEnabled !== false,
        reminderOffsetsHours: Array.isArray(adminCalendarDraft.reminderOffsetsHours) && adminCalendarDraft.reminderOffsetsHours.length
          ? adminCalendarDraft.reminderOffsetsHours
          : [24],
        reminderTime: adminCalendarDraft.reminderTime || "19:00",
        workoutTime: adminCalendarDraft.workoutTime || "13:00",
        hourReminderEnabled: adminCalendarDraft.hourReminderEnabled === true,
        trainingDays,
        daySettings: Object.fromEntries(trainingDays.map((dayId) => [
          dayId,
          {
            workoutTime: adminCalendarDraft.daySettings?.[dayId]?.workoutTime || adminCalendarDraft.workoutTime || "13:00",
            reminderTime: "19:00",
            reminderBefore: adminCalendarDraft.daySettings?.[dayId]?.reminderBefore || adminCalendarDraft.daySettings?.[dayId]?.reminderTime || "1 \u0434\u0435\u043d\u044c",
            hourReminderEnabled: adminCalendarDraft.daySettings?.[dayId]?.hourReminderEnabled === true
          }
        ])),
        updatedAt: new Date().toISOString()
      };

      const patch = {
        workoutCalendar: nextCalendar,
        trainingDays: nextCalendar.trainingDays,
        workoutTime: nextCalendar.workoutTime,
        telegramNotificationsEnabled: nextCalendar.reminderEnabled
      };

      setAdminSelectedClient((prev) => {
        if (prev?.id === client.id) previousClient = prev;
        return prev?.id === client.id ? { ...prev, ...patch } : prev;
      });
      setUsersList((prev) => prev.map((item) => item.id === client.id ? { ...item, ...patch } : item));

      await setDoc(doc(db, "users", client.id), {
        workoutCalendar: nextCalendar,
        trainingDays: nextCalendar.trainingDays,
        workoutTime: nextCalendar.workoutTime,
        telegramNotificationsEnabled: nextCalendar.reminderEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setAdminClientStatus(STATUS_CALENDAR_SAVED);
    } catch (error) {
      console.error("Client calendar save failed:", error);
      setAdminSelectedClient((prev) => prev?.id === client.id && previousClient ? previousClient : prev);
      setUsersList((prev) => prev.map((item) => item.id === client.id && previousClient ? previousClient : item));
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_CALENDAR_FAILED));
    } finally {
      setAdminCalendarSaving(false);
    }
  }

  async function sendAdminTestWorkoutReminder(client = adminSelectedClient) {
    if (!client?.id) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return;
    }

    setAdminCalendarTesting(true);
    setAdminClientStatus(STATUS_TEST_SENDING);

    try {
      const response = await fetchAuthorized("/api/telegram/test-workout-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId: client.id
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Test reminder failed");
      }

      setAdminClientStatus(STATUS_TEST_SENT);
    } catch (error) {
      console.error("Telegram test reminder failed:", error);
      setAdminClientStatus(STATUS_TEST_FAILED);
    } finally {
      setAdminCalendarTesting(false);
    }
  }

  async function saveTrainerClientWorkoutSchedule(dates = [], client = adminSelectedClient) {
    const targetClient = client?.id ? client : (adminSelectedClient?.id ? adminSelectedClient : usersList.find((item) => item.id === selectedUserId));
    const clientId = targetClient?.id || selectedUserId;
    const workouts = sortWorkoutDays(plan.workouts || []);

    if (!clientId) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return false;
    }

    if (!workouts.length) {
      setAdminClientStatus(STATUS_PROGRAM_REQUIRED);
      return false;
    }

    const scheduleValidation = validateTrainerWorkoutScheduleDates(dates, workouts.length);
    const cleanDates = scheduleValidation.cleanDates;

    if (!scheduleValidation.ok) {
      setAdminClientStatus(scheduleValidation.message);
      return false;
    }

    const nowIso = new Date().toISOString();
    const currentCalendar = targetClient?.workoutCalendar || {};
    const plannedWorkouts = buildWorkoutScheduleDraftWithExistingStatuses(
      cleanDates,
      workouts,
      currentCalendar.plannedWorkouts || []
    );
    const assignmentInfo = {
      assignedProgramId: targetClient?.assignedProgramId || workouts[0]?.assignedProgramId || plan.assignedProgramId || "",
      assignedProgramName: targetClient?.assignedProgramName || workouts[0]?.assignedProgramName || plan.assignedProgramName || "",
      assignedProgramUpdatedAt: targetClient?.assignedProgramUpdatedAt || workouts[0]?.assignedProgramUpdatedAt || plan.assignedProgramUpdatedAt || ""
    };
    const nextCalendar = {
      ...currentCalendar,
      enabled: currentCalendar.enabled !== false,
      scheduledDates: cleanDates,
      monthlyTrainingDates: cleanDates,
      plannedWorkouts,
      ...assignmentInfo,
      updatedAt: nowIso,
      updatedBy: auth.currentUser?.uid || ""
    };
    const nextWorkouts = workouts.map((workout, index) => ({
      ...workout,
      scheduledDate: cleanDates[index],
      plannedDate: cleanDates[index],
      scheduleOrder: index + 1,
      status: plannedWorkouts[index]?.status || workout.status || "planned",
      movedToDate: plannedWorkouts[index]?.movedToDate || workout.movedToDate || "",
      statusUpdatedAt: plannedWorkouts[index]?.statusUpdatedAt || workout.statusUpdatedAt || "",
      ...assignmentInfo
    }));
    const batch = writeBatch(db);
    setAdminClientStatus(STATUS_SCHEDULE_SAVING);

    nextWorkouts.forEach((workout, index) => {
      if (!workout.id) return;
      batch.set(doc(db, "users", clientId, "workouts", workout.id), {
        scheduledDate: cleanDates[index],
        plannedDate: cleanDates[index],
        scheduleOrder: index + 1,
        status: workout.status || "planned",
        movedToDate: workout.movedToDate || "",
        statusUpdatedAt: workout.statusUpdatedAt || "",
        ...assignmentInfo
      }, { merge: true });
    });
    batch.set(doc(db, "users", clientId), {
      workoutCalendar: nextCalendar,
      ...assignmentInfo,
      trainingDays: currentCalendar.trainingDays || targetClient?.trainingDays || [],
      workoutTime: currentCalendar.workoutTime || targetClient?.workoutTime || "",
      updatedAt: nowIso
    }, { merge: true });

    try {
      await batch.commit();
      const patch = { workoutCalendar: nextCalendar };
      setPlan((current) => ({
        ...current,
        workouts: sortWorkoutDays(nextWorkouts)
      }));
      setAdminSelectedClient((prev) => prev?.id === clientId ? { ...prev, ...patch } : prev);
      setUsersList((prev) => prev.map((item) => item.id === clientId ? { ...item, ...patch } : item));
      setAdminCalendarDraft((prev) => ({
        ...prev,
        scheduledDates: cleanDates,
        monthlyTrainingDates: cleanDates
      }));
      setAdminClientStatus(STATUS_SCHEDULE_SAVED);
      recordTrainerEvent(clientId, "program", "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a", `${cleanDates.length} \u0434\u0430\u0442`);
      return true;
    } catch (error) {
      console.error("Workout schedule save failed:", error);
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_SCHEDULE_FAILED));
      return false;
    }
  }

  async function saveTrainerClientNotificationSettings(settings = {}, client = adminSelectedClient) {
    if (!client?.id) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return false;
    }

    const offsets = getReminderOffsets(settings.offsets);

    if (!offsets.length) {
      setAdminClientStatus(STATUS_SELECT_OFFSET);
      return false;
    }

    const currentCalendar = client.workoutCalendar || {};
    const currentTelegram = getClientTelegramProfile(client);
    const enabled = settings.enabled !== false;
    const updatedAt = new Date().toISOString();
    const photoIntervalDays = normalizeAdminProgressReminderInterval(settings.progressPhotoIntervalDays);
    const measurementsIntervalDays = normalizeAdminProgressReminderInterval(settings.measurementsIntervalDays);
    const progressReminderSettings = {
      ...(currentCalendar.progressReminderSettings || client.progressReminderSettings || {}),
      photoEnabled: settings.progressPhotoEnabled === true,
      measurementsEnabled: settings.measurementsEnabled === true,
      intervalDays: 14,
      photoIntervalDays,
      measurementsIntervalDays,
      updatedAt
    };
    const scheduledDates = Array.isArray(settings.scheduledDates)
      ? getCleanScheduleDates(settings.scheduledDates)
      : Array.isArray(currentCalendar.scheduledDates)
        ? currentCalendar.scheduledDates
        : Array.isArray(currentCalendar.monthlyTrainingDates)
          ? currentCalendar.monthlyTrainingDates
          : [];
    const nextCalendar = {
      ...currentCalendar,
      enabled: currentCalendar.enabled !== false,
      reminderEnabled: enabled,
      reminderOffsetsHours: offsets,
      progressReminderSettings,
      progressPhotoReminderEnabled: progressReminderSettings.photoEnabled,
      measurementsReminderEnabled: progressReminderSettings.measurementsEnabled,
      progressReminderIntervalDays: progressReminderSettings.intervalDays,
      progressPhotoReminderIntervalDays: photoIntervalDays,
      measurementsReminderIntervalDays: measurementsIntervalDays,
      scheduledDates,
      monthlyTrainingDates: scheduledDates,
      updatedAt
    };
    const nextTelegram = {
      ...currentTelegram,
      notificationsEnabled: enabled
    };

    const patch = {
      workoutCalendar: nextCalendar,
      telegram: nextTelegram,
      telegramNotificationsEnabled: enabled
    };
    let previousClient = null;
    setAdminSelectedClient((prev) => {
      if (prev?.id === client.id) previousClient = prev;
      return prev?.id === client.id ? { ...prev, ...patch } : prev;
    });
    setUsersList((prev) => prev.map((item) => item.id === client.id ? { ...item, ...patch } : item));
    setAdminCalendarDraft((prev) => ({
      ...prev,
      reminderEnabled: enabled,
      reminderOffsetsHours: offsets,
      progressReminderSettings,
      scheduledDates,
      monthlyTrainingDates: scheduledDates
    }));
    setAdminClientStatus(STATUS_NOTIFICATIONS_SAVING);

    try {
      await setDoc(doc(db, "users", client.id), {
        workoutCalendar: nextCalendar,
        telegram: nextTelegram,
        telegramNotificationsEnabled: enabled,
        updatedAt
      }, { merge: true });
      setAdminClientStatus(enabled ? STATUS_NOTIFICATIONS_SAVED : STATUS_NOTIFICATIONS_OFF);
      return true;
    } catch (error) {
      console.error("Telegram reminders save failed:", error);
      setAdminSelectedClient((prev) => prev?.id === client.id && previousClient ? previousClient : prev);
      setUsersList((prev) => prev.map((item) => item.id === client.id && previousClient ? previousClient : item));
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_NOTIFICATIONS_FAILED));
      return false;
    }
  }

  function openClientTelegramConnection() {
    window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}`, "_blank", "noopener,noreferrer");
    setAdminClientStatus(STATUS_OPEN_BOT);
  }

  return {
    toggleAdminCalendarDay,
    updateAdminCalendarDaySetting,
    saveAdminClientCalendar,
    sendAdminTestWorkoutReminder,
    saveTrainerClientWorkoutSchedule,
    saveTrainerClientNotificationSettings,
    openClientTelegramConnection
  };
}

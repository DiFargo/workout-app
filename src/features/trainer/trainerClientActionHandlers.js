import { collection, doc, getDocs, setDoc, writeBatch, query, orderBy, documentId, startAfter, limit } from "firebase/firestore";

import { createClientResourceId } from "../../domain/clientInsights.js";
import { isNutritionDayStorageEnabled } from "../../utils/nutritionDayStorageConfig.js";
import {
  buildTrainerClientExportRows,
  trainerExportRowsToCsv,
  buildTrainerClientPrintDocument
} from "../../utils/trainerClientExport.js";

export async function deleteClientFromTrainerPanelWithDeps({
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
  options = {}
}) {
  if (!canUseTrainerFeatures()) {
    setAdminClientStatus("Удалять клиентов может только админ или тренер.");
    return;
  }

  if (!client?.id) return;

  if (!canUseAdminFeatures() && !canManageClientProgram(client)) {
    setAdminClientStatus("Можно удалить только своего клиента.");
    return;
  }

  if (!options.skipConfirm) {
    const confirmed = await showAppConfirm(`Удалить клиента ${client.email || client.name || client.id} из базы приложения? Аккаунт Firebase Auth может остаться активным.`);
    if (!confirmed) return;
  }

  try {
    const removeTrainerLinkOnly = !canUseAdminFeatures() && client.trainerLinkOnly;

    if (!options.remoteDeleted) {
      const batch = writeBatch(db);

      if (!removeTrainerLinkOnly) {
        batch.delete(doc(db, "users", client.id));
      }

      if (!canUseAdminFeatures()) {
        const trainerUid = auth.currentUser?.uid || user?.uid || "";
        if (trainerUid) {
          batch.delete(
            doc(db, "users", trainerUid, "trainerClients", client.trainerLinkDocId || client.id)
          );
        }
      }

      await batch.commit();
    }

    if (selectedUserId === client.id || options.remoteDeleted) {
      setSelectedUserId(null);
      setAdminSelectedClient(null);
      setAdminClientHistory([]);
      setAdminClientNutrition(null);
      setAdminClientPageOpen(false);
      setTrainerNextSection?.("clients");
    }

    try {
      await loadUsers();
    } catch (error) {
      if (!options.remoteDeleted) throw error;
      console.warn("Клиент удалён, но список не удалось обновить автоматически:", error);
    }
    setAdminClientStatus(
      removeTrainerLinkOnly
        ? "Устаревшая карточка клиента удалена из списка тренера."
        : "Клиент удалён из базы приложения."
    );
  } catch (error) {
    console.error("Ошибка удаления клиента:", error);
    setAdminClientStatus("Не получилось удалить клиента.");
  }
}

export async function downloadTrainerClientExportWithDeps({
  db,
  adminClientHistory,
  adminClientMeasurements,
  getAdminNutritionDaysList,
  adminClientNutrition,
  setAdminClientStatus,
  client,
  format = "excel"
}) {
  if (!client?.id) return false;
  let history = adminClientHistory || [];
  let historyComplete = false;
  if (db) {
    try {
      history = [];
      let cursor = null;
      const pageSize = 250;
      const maxRecords = 5000;
      while (history.length < maxRecords) {
        const constraints = [orderBy(documentId()), limit(pageSize)];
        if (cursor) constraints.push(startAfter(cursor));
        const page = await getDocs(query(collection(db, "users", client.id, "history"), ...constraints));
        history.push(...page.docs.map(item => ({ ...item.data(), id: item.id })));
        if (page.docs.length < pageSize) { historyComplete = true; break; }
        cursor = page.docs.at(-1);
      }
    } catch (error) {
      console.error("Trainer export history load failed:", error);
      setAdminClientStatus("Экспорт отменён: не удалось загрузить историю тренировок. Повторите попытку.");
      return false;
    }
  }
  const exportNotice = `${historyComplete ? "История тренировок загружена полностью" : "Неполная история тренировок (только загруженный диапазон, максимум 5000)"}: ${history.length} записей. Замеры и питание — загруженные данные, полнота не подтверждена.`;
  const nutritionDays = getAdminNutritionDaysList(adminClientNutrition);
  const rows = buildTrainerClientExportRows(history, adminClientMeasurements, nutritionDays);
  rows.splice(1, 0, ["export_scope", "", exportNotice, "", "", "", "", "", ""]);

  if (format === "pdf") {
    if (typeof window.BroadcastChannel !== "function") {
      setAdminClientStatus("Не удалось подготовить PDF-отчёт в этом браузере. Доступен CSV-экспорт.");
      return false;
    }
    let url;
    let channel;
    try {
      const channelName = `trainer-report-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      channel = new window.BroadcastChannel(channelName);
      url = URL.createObjectURL(new Blob([buildTrainerClientPrintDocument(client.name || client.email || client.id, rows, channelName)], { type: "text/html;charset=utf-8" }));
      setAdminClientStatus("Подготавливаем PDF-отчёт…");
      return await new Promise(resolve => {
        let finished = false;
        const finish = success => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          // Keep the Blob alive while the new document and print UI use it.
          if (!success) channel.close();
          setTimeout(() => { channel.close(); URL.revokeObjectURL(url); }, 60000);
          setAdminClientStatus(success
            ? `PDF-отчёт открыт в новом окне для сохранения через печать. ${exportNotice}`
            : "Не удалось подтвердить открытие PDF-отчёта. Проверьте блокировку всплывающих окон и повторите.");
          resolve(success);
        };
        const timeout = setTimeout(() => finish(false), 10000);
        channel.onmessage = event => {
          if (event.data?.type === "ready") finish(true);
          else if (event.data?.type === "print-error") {
            if (finished) setAdminClientStatus("Отчёт открыт, но печать не запустилась. В новом окне можно открыть печать вручную.");
            else finish(false);
          }
        };
        // With noopener a successful open returns null too. Do not treat that
        // value as success or try to write into a nonexistent WindowProxy.
        try { window.open(url, "_blank", "noopener,noreferrer"); }
        catch { finish(false); }
      });
    } catch {
      channel?.close();
      if (url) URL.revokeObjectURL(url);
      setAdminClientStatus("Не получилось подготовить PDF-отчёт. Попробуйте ещё раз.");
      return false;
    }
  }

  const csv = trainerExportRowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${client.email || client.name || "client"}-trainer-export.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setAdminClientStatus(`Excel-экспорт клиента подготовлен в CSV. ${exportNotice}`);
  return true;
}

async function deleteClientSubcollection(db, clientId, collectionName) {
  const snapshot = await getDocs(collection(db, "users", clientId, collectionName));
  const batch = writeBatch(db);
  snapshot.forEach((item) => batch.delete(item.ref));
  await batch.commit();
}

export async function handleTrainerClientActionWithDeps({
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
  client = adminSelectedClient
}) {
  if (!client?.id) {
    setAdminClientStatus("Сначала выбери клиента.");
    return false;
  }

  if (!canUseTrainerFeatures() || (!canUseAdminFeatures() && !canManageClientProgram(client))) {
    setAdminClientStatus("Нет прав на управление этим клиентом.");
    return false;
  }

  try {
    if (action === "grant_basic_access" || action === "revoke_basic_access") {
      if (!canUseAdminFeatures() || (client.role && client.role !== "client")) {
        setAdminClientStatus("Только администратор может менять доступ клиента к базовым тренировкам.");
        return false;
      }
      const allowed = action === "grant_basic_access";
      const confirmed = await showAppConfirm(allowed
        ? "Разрешить клиенту базовые тренировки «Сейчас» и «На месяц»? Индивидуальная программа не изменится."
        : "Отключить базовые тренировки? История и индивидуальная программа сохранятся.");
      if (!confirmed) return false;
      const patch = { basicWorkoutAccess: allowed, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, "users", client.id), patch, { merge: true });
      setUsersList(items => items.map(item => item.id === client.id ? { ...item, ...patch } : item));
      setAdminSelectedClient(item => item?.id === client.id ? { ...item, ...patch } : item);
      setAdminClientStatus(allowed ? "Доступ к базовым тренировкам открыт." : "Доступ к базовым тренировкам отключён. История сохранена.");
      return true;
    }
    if (action === "mark_test" || action === "mark_real") {
      const patch = { isTest: action === "mark_test", updatedAt: new Date().toISOString() };
      await setDoc(doc(db, "users", client.id), patch, { merge: true });
      setUsersList((items) => items.map((item) => item.id === client.id ? { ...item, ...patch } : item));
      setAdminSelectedClient((item) => item?.id === client.id ? { ...item, ...patch } : item);
      setAdminClientStatus(patch.isTest ? "Тестовый клиент исключён из общей статистики." : "Клиент снова учитывается в статистике.");
      return true;
    }
    if (action === "resolve_client_messages") {
      const rawSourceCommentIds = Array.isArray(payload?.sourceCommentIds)
        ? payload.sourceCommentIds
        : [payload?.sourceCommentId];
      const sourceCommentIds = [...new Set(
        rawSourceCommentIds
          .map((sourceCommentId) => String(sourceCommentId || "").trim())
          .filter(Boolean)
      )];

      if (!sourceCommentIds.length) {
        setAdminClientStatus("Не удалось определить сообщения для обработки.");
        return false;
      }

      const event = await recordTrainerEvent(
        client.id,
        "client_message_resolution",
        sourceCommentIds.length === 1
          ? "Сообщение обработано без ответа"
          : `Сообщения обработаны без ответа: ${sourceCommentIds.length}`,
        JSON.stringify({
          sourceCommentIds,
          decision: "handled_without_reply"
        })
      );

      if (!event) {
        setAdminClientStatus("Не удалось отметить сообщения обработанными.");
        return false;
      }

      setAdminClientStatus(
        sourceCommentIds.length === 1
          ? "Сообщение отмечено обработанным."
          : `Сообщения отмечены обработанными: ${sourceCommentIds.length}.`
      );
      return event;
    }

    if (action === "resolve_exercise_progress") {
      const reviewKey = String(payload?.reviewKey || "").trim();
      const exerciseName = String(payload?.exerciseName || "").trim();
      const decision = payload?.decision === "adjusted" ? "adjusted" : "accepted";
      if (!reviewKey || !exerciseName) {
        setAdminClientStatus("Не удалось определить сигнал прогресса.");
        return false;
      }

      const details = JSON.stringify({
        reviewKey,
        decision,
        exerciseName,
        previousDate: payload?.previousDate || "",
        currentDate: payload?.currentDate || "",
        workoutId: payload?.workoutId || "",
        exerciseId: payload?.exerciseId || ""
      });
      const event = await recordTrainerEvent(
        client.id,
        "exercise_progress_review",
        decision === "adjusted"
          ? `Нагрузка скорректирована: ${exerciseName}`
          : `Нагрузка проверена: ${exerciseName}`,
        details
      );
      if (!event) {
        setAdminClientStatus("Не удалось сохранить решение по нагрузке.");
        return false;
      }
      setAdminClientStatus(decision === "adjusted"
        ? "Нагрузка скорректирована, сигнал закрыт."
        : "Нагрузка подтверждена, сигнал закрыт.");
      return event;
    }

    if (action === "resolve_workout_review") {
      const reviewKey = String(payload?.reviewKey || "").trim();
      const workoutName = String(payload?.workoutName || "").trim();
      const decision = payload?.decision === "adjusted" ? "adjusted" : "accepted";
      if (!reviewKey || !workoutName) {
        setAdminClientStatus("Не удалось определить разбор тренировки.");
        return false;
      }

      const details = JSON.stringify({
        reviewKey,
        decision,
        workoutName,
        historyId: payload?.historyId || "",
        sourceWorkoutId: payload?.sourceWorkoutId || "",
        plannedWorkoutId: payload?.plannedWorkoutId || "",
        targetWorkoutId: payload?.targetWorkoutId || "",
        workoutDate: payload?.workoutDate || ""
      });
      const event = await recordTrainerEvent(
        client.id,
        "workout_review",
        decision === "adjusted"
          ? `Следующая тренировка скорректирована после: ${workoutName}`
          : `Разбор тренировки подтверждён: ${workoutName}`,
        details
      );
      if (!event) {
        setAdminClientStatus("Не удалось сохранить решение по тренировке.");
        return false;
      }
      setAdminClientStatus(decision === "adjusted"
        ? "Корректировка сохранена, сигнал закрыт."
        : "Корректировка не требуется, сигнал закрыт.");
      return event;
    }

    if (action === "archive" || action === "restore") {
      const archived = action === "archive";
      const confirmed = await showAppConfirm(
        archived
          ? `Архивировать клиента ${client.name || client.email || client.id}? Доступ клиента будет отключён, а карточка исчезнет из активного списка. История и программа сохранятся. Клиента можно будет восстановить из архива.`
          : `Восстановить клиента ${client.name || client.email || client.id} в активном списке?`
      );
      if (!confirmed) return false;
      const patch = {
        archived,
        active: !archived,
        archivedAt: archived ? new Date().toISOString() : "",
        restoredAt: archived ? "" : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", client.id), patch, { merge: true });
      setAdminSelectedClient((prev) => prev?.id === client.id ? { ...prev, ...patch } : prev);
      setUsersList((prev) => prev.map((item) => item.id === client.id ? { ...item, ...patch } : item));
      await recordTrainerEvent(client.id, "client", archived ? "Клиент архивирован" : "Клиент восстановлен");
      setAdminClientStatus(archived ? "Клиент архивирован." : "Клиент восстановлен.");
      return true;
    }

    if (action === "disable_notifications" || action === "enable_notifications") {
      const notificationsEnabled = action === "enable_notifications";
      const currentCalendar = client.workoutCalendar || {};
      const currentProgressReminders = currentCalendar.progressReminderSettings || client.progressReminderSettings || {};
      const saved = await saveTrainerClientNotificationSettings({
        enabled: notificationsEnabled,
        offsets: currentCalendar.reminderOffsetsHours || [24],
        scheduledDates: currentCalendar.scheduledDates || currentCalendar.monthlyTrainingDates || [],
        progressPhotoEnabled: currentProgressReminders.photoEnabled === true || client.progressPhotoReminderEnabled === true,
        measurementsEnabled: currentProgressReminders.measurementsEnabled === true || client.measurementsReminderEnabled === true,
        progressPhotoIntervalDays: currentProgressReminders.photoIntervalDays || client.progressPhotoReminderIntervalDays,
        measurementsIntervalDays: currentProgressReminders.measurementsIntervalDays || client.measurementsReminderIntervalDays
      }, client);
      if (!saved) return false;
      await recordTrainerEvent(
        client.id,
        "notifications",
        notificationsEnabled ? "Напоминания включены" : "Напоминания отключены"
      );
      return true;
    }

    if (action === "export_excel" || action === "export_pdf") {
      const exported = await downloadTrainerClientExportWithDeps({
        db,
        adminClientHistory,
        adminClientMeasurements,
        getAdminNutritionDaysList,
        adminClientNutrition,
        setAdminClientStatus,
        client,
        format: action === "export_pdf" ? "pdf" : "excel"
      });
      if (!exported) return false;
      await recordTrainerEvent(client.id, "export", action === "export_pdf" ? "Экспорт PDF" : "Экспорт Excel");
      return true;
    }

    if (action === "delete") {
      await deleteClientFromAdminPanel(client);
      return true;
    }

    if (action === "reset_progress") {
      if (!(await showAppConfirm("Сбросить прогресс клиента? Профиль, программа и план питания сохранятся."))) return false;
      if (isNutritionDayStorageEnabled()) await (await import("../../utils/nutritionDayClient.js")).clearNutritionProgress(client.id);
      await Promise.all([
        deleteClientSubcollection(db, client.id, "history"),
        deleteClientSubcollection(db, client.id, "measurements"),
        deleteClientSubcollection(db, client.id, "progressPhotos"),
        deleteClientSubcollection(db, client.id, "nutritionDays"),
        isNutritionDayStorageEnabled() ? Promise.resolve() : setDoc(doc(db, "users", client.id, "nutrition", "state"), {
          days: {},
          updatedAt: new Date().toISOString()
        }, { merge: true }),
        isNutritionDayStorageEnabled() ? Promise.resolve() : setDoc(doc(db, "users", client.id), {
          nutritionState: {
            ...(client.nutritionState || {}),
            days: {},
            updatedAt: new Date().toISOString()
          }
        }, { merge: true })
      ]);
      const nextWorkouts = (plan.workouts || []).map((workout) => ({
        ...workout,
        status: "planned",
        movedToDate: "",
        statusUpdatedAt: new Date().toISOString()
      }));
      const workoutResetBatch = writeBatch(db);
      let workoutResetWrites = 0;
      nextWorkouts.forEach((workout, index) => {
        if (!workout.id) return;
        workoutResetBatch.set(doc(db, "users", client.id, "workouts", workout.id), {
          ...workout,
          order: index + 1,
          sortOrder: index + 1
        }, { merge: true });
        workoutResetWrites += 1;
      });
      if (workoutResetWrites) await workoutResetBatch.commit();
      setPlan((current) => ({ ...current, workouts: nextWorkouts }));
      setAdminClientHistory([]);
      setAdminClientMeasurements([]);
      setAdminClientProgressPhotos([]);
      setAdminClientNutrition((current) => current ? { ...current, days: {} } : current);
      await recordTrainerEvent(client.id, "reset", "Прогресс клиента сброшен");
      setAdminClientStatus("Прогресс сброшен. Программа и план питания сохранены.");
      return true;
    }

    if (action === "duplicate") {
      const newClientRef = doc(collection(db, "users"));
      const copyId = newClientRef.id;
      const copy = {
        role: "client",
        name: `${client.name || client.email || "Клиент"} копия`,
        email: client.email ? `copy-${Date.now()}-${client.email}` : "",
        profile: client.profile || {},
        aiNutritionProfile: client.aiNutritionProfile || client.profile || {},
        nutritionGoals: client.nutritionGoals || {},
        nutritionPlan: client.nutritionPlan || null,
        workoutCalendar: client.workoutCalendar || {},
        telegramNotificationsEnabled: client.telegramNotificationsEnabled !== false,
        assignedProgramId: client.assignedProgramId || "",
        assignedProgramName: client.assignedProgramName || "",
        assignedWorkoutCount: client.assignedWorkoutCount || (plan.workouts || []).length,
        trainerId: client.trainerId || auth.currentUser?.uid || "",
        assignedTrainerId: client.assignedTrainerId || client.trainerId || auth.currentUser?.uid || "",
        trainerEmail: client.trainerEmail || auth.currentUser?.email || user?.email || "",
        createdAt: new Date().toISOString(),
        createdByUid: auth.currentUser?.uid || ""
      };
      await setDoc(newClientRef, { ...copy, uid: copyId, id: copyId });
      const batch = writeBatch(db);
      (plan.workouts || []).forEach((workout, index) => {
        batch.set(doc(db, "users", copyId, "workouts", workout.id || createClientResourceId("workout")), {
          ...workout,
          order: index + 1,
          status: "planned",
          movedToDate: ""
        });
      });
      await batch.commit();
      setUsersList((prev) => [{ id: copyId, ...copy }, ...prev]);
      await recordTrainerEvent(client.id, "client", "Клиент дублирован", copy.name);
      setAdminClientStatus("Клиент дублирован без истории и прогресса.");
      return true;
    }
  } catch (error) {
    console.error("Trainer client action failed:", error);
    setAdminClientStatus("Не получилось выполнить действие клиента.");
    return false;
  }

  return false;
}

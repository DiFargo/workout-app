import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

async function copyAdminSubcollection(db, sourceUid, targetUid, collectionName) {
  const snapshot = await getDocs(collection(db, "users", sourceUid, collectionName));

  for (const sourceDoc of snapshot.docs) {
    await setDoc(
      doc(db, "users", targetUid, collectionName, sourceDoc.id),
      {
        ...sourceDoc.data(),
        migratedFrom: sourceUid,
        migratedAt: new Date().toISOString()
      },
      { merge: true }
    );
  }

  return snapshot.size;
}

export async function deleteClientEverywhereFromAdminPanelWithDeps({
  canUseAdminFeatures,
  showAppConfirm,
  fetchAuthorized,
  deleteClientFromAdminPanel,
  setAdminClientStatus,
  client
}) {
  if (!client?.id) return;

  if (!canUseAdminFeatures()) {
    setAdminClientStatus("Полное удаление клиента доступно только администратору.");
    return false;
  }

  if (["admin", "trainer"].includes(client.role || "client")) {
    setAdminClientStatus("На этом экране можно удалять только аккаунты клиентов.");
    return false;
  }

  const confirmed = await showAppConfirm(`Полностью удалить клиента ${client.email || client.name || client.id}? Будет попытка удалить Auth через Cloud Function и профиль из Firestore.`);
  if (!confirmed) return;

  try {
    const response = await fetchAuthorized("/api/admin/deleteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: client.id })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      const responseError = new Error(payload.error || "Cloud Function deleteUser недоступна");
      responseError.status = response.status;
      throw responseError;
    }

    await deleteClientFromAdminPanel(client, { skipConfirm: true, remoteDeleted: true });
    setAdminClientStatus("Клиент удалён из Firebase Auth и Firestore.");
    return true;
  } catch (error) {
    console.error("Полное удаление Auth недоступно:", error);
    setAdminClientStatus(
      error?.status === 429 || /Too many requests/i.test(error?.message || "")
        ? "Слишком много удалений подряд. Подождите минуту и повторите попытку."
        : "Не получилось завершить удаление. Обновите список клиентов и повторите попытку."
    );
    return false;
  }
}

export async function transferClientDataBetweenAccountsWithDeps({
  db,
  adminTransferFromUid,
  adminTransferToUid,
  adminAllUsersList,
  usersList,
  canUseAdminFeatures,
  showAppConfirm,
  loadUsers,
  loadAdminClientOverview,
  setAdminTransferLoading,
  setAdminTransferStatus,
  fromUidOverride = null,
  toUidOverride = null
}) {
  if (!canUseAdminFeatures?.()) {
    setAdminTransferStatus("Перенос может делать только админ.");
    return false;
  }

  const transferFromUid = fromUidOverride || adminTransferFromUid;
  const transferToUid = toUidOverride || adminTransferToUid;

  if (!transferFromUid || !transferToUid) {
    setAdminTransferStatus("Выбери источник и клиента-получателя.");
    return;
  }

  if (transferFromUid === transferToUid) {
    setAdminTransferStatus("Источник и получатель не должны совпадать.");
    return;
  }

  const sourceUser = adminAllUsersList.find((item) => item.id === transferFromUid);
  const targetUser = usersList.find((item) => item.id === transferToUid);

  const confirmed = await showAppConfirm(
    `Перенести программу, историю тренировок и питание с ${sourceUser?.email || transferFromUid} на ${targetUser?.email || transferToUid}? Идентификация, роль и Telegram получателя сохранятся. Замеры, фото, nutritionDays, задачи, оплаты и подписки не переносятся. Повтор после ошибки обновит те же документы.`
  );

  if (!confirmed) return;

  setAdminTransferLoading(true);
  setAdminTransferStatus("Переношу данные...");

  try {
    const [sourceSnap, targetSnap] = await Promise.all([
      getDoc(doc(db, "users", transferFromUid)),
      getDoc(doc(db, "users", transferToUid))
    ]);

    if (!sourceSnap.exists()) {
      setAdminTransferStatus("Источник не найден в Firestore.");
      return false;
    }

    const sourceData = sourceSnap.data() || {};
    const targetData = targetSnap.exists() ? targetSnap.data() || {} : {};
    if (!targetSnap.exists() || (targetData.role || "client") !== "client") {
      setAdminTransferStatus("Получателем может быть только существующий аккаунт клиента. Роль и идентификация не изменены.");
      return false;
    }
    // Explicit domain content only: never copy source identity, Telegram,
    // roles, trainer ownership, access flags, subscriptions or admin metadata.
    const contentFields = ["assignedProgramId", "assignedProgramName", "assignedProgramAt", "assignedProgramAddedAt",
      "assignedProgramUpdatedAt", "assignedWorkoutCount", "assignedProgramLifecycleStatus", "assignedProgramVisibility",
      "workoutCalendar", "nutritionState", "nutritionPlan", "nutritionGoals"];
    const safeSourceData = Object.fromEntries(contentFields.filter(key => Object.hasOwn(sourceData, key)).map(key => [key, sourceData[key]]));

    const copied = {
      workouts: await copyAdminSubcollection(db, transferFromUid, transferToUid, "workouts"),
      history: await copyAdminSubcollection(db, transferFromUid, transferToUid, "history"),
      nutrition: await copyAdminSubcollection(db, transferFromUid, transferToUid, "nutrition")
    };

    // Publish the root content only after the three declared collection types
    // have copied. Retrying uses the same IDs rather than duplicating records.
    await setDoc(doc(db, "users", transferToUid), { ...safeSourceData, updatedAt: new Date().toISOString() }, { merge: true });

    await loadUsers();

    const freshTarget = {
      ...(targetUser || {}),
      id: transferToUid,
      email: targetData.email || targetUser?.email || ""
    };

    await loadAdminClientOverview?.(freshTarget);

    setAdminTransferStatus(
      `Готово: тренировки ${copied.workouts}, история ${copied.history}, питание ${copied.nutrition}. Идентификация и роль получателя сохранены. Замеры, фото, nutritionDays, задачи, оплаты и подписки не переносились.`
    );
    return true;
  } catch (error) {
    console.error("Ошибка переноса данных:", error);
    setAdminTransferStatus("Перенос не завершён: часть документов могла сохраниться. Проверь выбранные аккаунты и повтори перенос с тем же источником; те же ID будут обновлены, не продублированы. Идентификация и роль получателя не изменялись.");
    return false;
  } finally {
    setAdminTransferLoading(false);
  }
}

export async function updateUserTrainerRoleWithDeps({
  db,
  canUseAdminFeatures,
  setUsersList,
  setAdminAllUsersList,
  setAdminSelectedClient,
  setAdminClientStatus,
  targetUser,
  makeTrainer = true
}) {
  if (!canUseAdminFeatures() || !targetUser?.id) {
    setAdminClientStatus("Только админ может назначать роль тренера.");
    return false;
  }

  const nextRole = makeTrainer ? "trainer" : "client";

  try {
    await setDoc(doc(db, "users", targetUser.id), {
      role: nextRole,
      trainerRoleUpdatedAt: new Date().toISOString()
    }, { merge: true });

    setUsersList((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, role: nextRole } : item));
    setAdminAllUsersList((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, role: nextRole } : item));
    setAdminSelectedClient((prev) => prev?.id === targetUser.id ? { ...prev, role: nextRole } : prev);
    setAdminClientStatus(makeTrainer ? "Роль тренера назначена." : "Роль тренера снята.");
    return true;
  } catch (error) {
    console.error("Trainer role update error:", error);
    setAdminClientStatus("Не удалось изменить роль тренера. Проверь права Firestore.");
    return false;
  }
}

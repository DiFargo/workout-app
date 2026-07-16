import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

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
  db,
  canUseAdminFeatures,
  canManageClientProgram,
  showAppConfirm,
  fetchAuthorized,
  deleteClientFromAdminPanel,
  loadUsers,
  setAdminClientStatus,
  client
}) {
  if (!client?.id) return;

  if (!canUseAdminFeatures()) {
    if (!canManageClientProgram(client)) {
      setAdminClientStatus("Можно удалить только своего клиента.");
      return;
    }

    const confirmed = await showAppConfirm(`Удалить клиента ${client.email || client.name || client.id} из базы приложения? Аккаунт Firebase Auth останется активным.`);
    if (!confirmed) return;

    await deleteClientFromAdminPanel(client, { skipConfirm: true });
    return;
  }

  const confirmed = await showAppConfirm(`Полностью удалить клиента ${client.email || client.name || client.id}? Будет попытка удалить Auth через Cloud Function и профиль из Firestore.`);
  if (!confirmed) return;

  try {
    const response = await fetchAuthorized("/api/admin/deleteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: client.id })
    });

    if (!response.ok) {
      throw new Error("Cloud Function deleteUser недоступна");
    }

    await deleteDoc(doc(db, "users", client.id));
    setAdminClientStatus("Клиент удалён из Firebase Auth и Firestore.");
    await loadUsers();
  } catch (error) {
    console.error("Полное удаление Auth недоступно:", error);
    await deleteClientFromAdminPanel(client);
    setAdminClientStatus("Auth-удаление требует Cloud Function. Профиль Firestore удалён, Auth мог остаться.");
  }
}

export async function transferClientDataBetweenAccountsWithDeps({
  db,
  auth,
  adminEmail,
  adminTransferFromUid,
  adminTransferToUid,
  adminAllUsersList,
  usersList,
  canUseTrainerFeatures,
  showAppConfirm,
  loadUsers,
  loadAdminClientOverview,
  setAdminTransferLoading,
  setAdminTransferStatus,
  fromUidOverride = null,
  toUidOverride = null
}) {
  if (!canUseTrainerFeatures()) {
    setAdminTransferStatus("Перенос может делать только админ.");
    return;
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
    `Перенести данные с ${sourceUser?.email || transferFromUid} на ${targetUser?.email || adminTransferToUid}? Данные получателя будут дополнены/обновлены.`
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
      setAdminTransferLoading(false);
      return;
    }

    const sourceData = sourceSnap.data() || {};
    const targetData = targetSnap.exists() ? targetSnap.data() || {} : {};
    const safeSourceData = { ...sourceData };
    delete safeSourceData.role;
    delete safeSourceData.createdBy;
    delete safeSourceData.createdAt;
    delete safeSourceData.email;

    await setDoc(doc(db, "users", transferToUid), {
      ...safeSourceData,
      email: targetData.email || targetUser?.email || "",
      name: targetData.name || targetUser?.name || safeSourceData.name || "",
      role: "client",
      migratedFromUid: transferFromUid,
      migratedFromEmail: sourceData.email || sourceUser?.email || "",
      migratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    const copied = {
      workouts: await copyAdminSubcollection(db, transferFromUid, transferToUid, "workouts"),
      history: await copyAdminSubcollection(db, transferFromUid, transferToUid, "history"),
      nutrition: await copyAdminSubcollection(db, transferFromUid, transferToUid, "nutrition")
    };

    if (transferFromUid === auth.currentUser?.uid) {
      await setDoc(doc(db, "users", transferFromUid), {
        role: "admin",
        email: auth.currentUser?.email || adminEmail,
        adminOnly: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    await loadUsers();

    const freshTarget = {
      ...(targetUser || {}),
      id: transferToUid,
      email: targetData.email || targetUser?.email || ""
    };

    await loadAdminClientOverview(freshTarget);

    setAdminTransferStatus(
      `Готово: тренировки ${copied.workouts}, история ${copied.history}, питание ${copied.nutrition}. Получатель остался client.`
    );
  } catch (error) {
    console.error("Ошибка переноса данных:", error);
    setAdminTransferStatus("Не получилось перенести данные. Проверь Firestore rules и выбранные аккаунты.");
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
    return;
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
  } catch (error) {
    console.error("Trainer role update error:", error);
    setAdminClientStatus("Не удалось изменить роль тренера. Проверь права Firestore.");
  }
}

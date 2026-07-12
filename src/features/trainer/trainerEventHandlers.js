import { doc, setDoc } from "firebase/firestore";

import { createClientResourceId } from "../../domain/clientInsights";

export async function saveAdminTrainerNoteWithDeps({
  db,
  auth,
  adminSelectedClient,
  adminTrainerNote,
  recordTrainerEvent,
  setAdminClientStatus
}) {
  if (!adminSelectedClient?.id) {
    setAdminClientStatus("Сначала выбери клиента.");
    return;
  }

  try {
    const noteOwnerUid = auth.currentUser?.uid || "";
    await setDoc(doc(db, "trainerNotes", `${noteOwnerUid}_${adminSelectedClient.id}`), {
      ownerUid: noteOwnerUid,
      clientId: adminSelectedClient.id,
      text: adminTrainerNote,
      updatedAt: new Date().toISOString(),
      updatedByUid: noteOwnerUid
    }, { merge: true });
    setAdminClientStatus("Заметка тренера сохранена.");
    recordTrainerEvent(adminSelectedClient.id, "note", "Обновлена заметка тренера");
  } catch (error) {
    console.error("Ошибка сохранения заметки:", error);
    setAdminClientStatus("Не получилось сохранить заметку.");
  }
}

export async function recordTrainerEventWithDeps({
  db,
  auth,
  currentUserRole,
  setAdminClientEvents,
  clientId,
  type,
  title,
  details = ""
}) {
  if (!clientId || !title) return null;

  const eventId = createClientResourceId("event");
  const event = {
    type,
    title,
    details,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdByUid: auth.currentUser?.uid || "",
    createdByRole: currentUserRole || "trainer"
  };

  try {
    await setDoc(doc(db, "users", clientId, "trainerEvents", eventId), event);
    setAdminClientEvents((current) => [{ id: eventId, ...event }, ...current]);
    return { id: eventId, ...event };
  } catch (error) {
    console.warn("Trainer event save failed:", error);
    return null;
  }
}

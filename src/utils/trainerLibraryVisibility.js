import { doc, runTransaction } from "firebase/firestore";
import { buildTrainerExerciseLibraryItems, setTrainerLibraryVariantDeleted } from "./trainerExerciseLibrary.js";
import { exerciseLibraryVariantKey } from "../../functions/exerciseLibraryIdentity.js";

export async function persistTrainerLibraryVisibility({ db, templates, exercise, uid, canManage, restore = false,
  transactionRunner = runTransaction, documentRef = doc }) {
  const source = templates.find((template) => template.id === exercise?.librarySource?.templateId);
  if (!uid || !source?.ownerUid || !canManage?.(source)) throw new Error("Тренер может удалять только свои упражнения из библиотеки.");
  const key = exerciseLibraryVariantKey(exercise);
  const containsVariant = (template) => buildTrainerExerciseLibraryItems({}, [template], { includeDeleted: true })
    .some((item) => exerciseLibraryVariantKey(item) === key);
  const candidates = templates.filter((template) => template.ownerUid === source.ownerUid && canManage(template) && containsVariant(template));
  if (!candidates.some((template) => template.id === source.id)) throw new Error("Упражнение уже изменено. Обновите библиотеку.");
  const now = new Date().toISOString();
  return transactionRunner(db, async (transaction) => {
    const snapshots = await Promise.all(candidates.map((template) => transaction.get(documentRef(db, "trainingTemplates", template.id))));
    const updates = snapshots.map((snapshot) => {
      if (!snapshot.exists()) throw new Error("Программа изменилась. Обновите библиотеку.");
      const current = { ...snapshot.data(), id: snapshot.id };
      if (current.ownerUid !== source.ownerUid || !canManage(current)) throw new Error("Нет доступа к изменению упражнения.");
      if (current.id === source.id && !containsVariant(current)) throw new Error("Упражнение уже изменено. Обновите библиотеку.");
      if (!containsVariant(current)) return null;
      return { ...setTrainerLibraryVariantDeleted(current, exercise, restore ? "" : now), updatedByUid: uid, updatedAt: now };
    }).filter(Boolean);
    for (const template of updates) transaction.set(documentRef(db, "trainingTemplates", template.id), template, { merge: true });
    return updates;
  });
}

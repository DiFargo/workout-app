import { doc, runTransaction } from "firebase/firestore";
import { exerciseLibraryVariantKey } from "../../functions/exerciseLibraryIdentity.js";

const editableFields = new Set(["name", "muscleGroup", "focus", "rest", "requiresWeight", "usesWeight", "sets", "video", "videoUrl", "videoURL", "videoPoster", "videoThumbnail", "videoAutoFilledFrom", "videoUpdatedAt", "notes", "description"]);
const same = (a, b) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");

export function patchLibraryExercise(current, original, patch) {
  const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => editableFields.has(key) && !same(value, original[key])));
  let matched = false;
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
      key === "exercises" && Array.isArray(child) ? child.map((entry) => {
        if (entry.id !== original.id || exerciseLibraryVariantKey(entry) !== exerciseLibraryVariantKey(original)) return entry;
        if (entry.libraryDeletedAt) throw new Error("Упражнение уже удалено. Обновите библиотеку.");
        matched = true;
        for (const [field, proposed] of Object.entries(changes)) {
          if (!same(entry[field], original[field]) && !same(entry[field], proposed)) throw new Error("Упражнение изменено в другом окне. Обновите библиотеку перед сохранением.");
        }
        return { ...entry, ...changes };
      }) : visit(child)
    ]));
  }
  const result = visit(current);
  if (!matched) throw new Error("Упражнение уже изменено. Обновите библиотеку.");
  return result;
}

export function persistTrainerTemplateEdit({ db, templateId, uid, canManage, mutate, transactionRunner = runTransaction, documentRef = doc }) {
  if (!uid || !templateId) throw new Error("Не удалось определить владельца упражнения.");
  const ref = documentRef(db, "trainingTemplates", templateId);
  return transactionRunner(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Программа больше недоступна.");
    const current = { ...snapshot.data(), id: snapshot.id };
    if (!current.ownerUid || !canManage?.(current)) throw new Error("Можно редактировать только свою библиотеку.");
    const next = { ...mutate(current), updatedByUid: uid, updatedAt: new Date().toISOString() };
    transaction.set(ref, next, { merge: true });
    return next;
  });
}

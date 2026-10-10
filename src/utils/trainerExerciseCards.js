import { fetchAuthorizedWithTimeout } from "./apiClient.js";
import { exerciseCardLegacyKey, exerciseCardMetadata, mapTemplateExerciseCards } from "../../functions/exerciseCards.js";

export async function requestTrainerExerciseCards(body, request = fetchAuthorizedWithTimeout) {
  const response = await request("/api/trainer-exercise-cards", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }, 15000);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || "Не удалось сохранить карточку. Попробуйте ещё раз."), { status: response.status });
  return result;
}

export function exerciseCardMutation(exercise, action, patch) {
  const source = exercise.librarySource || {};
  return { action: source.isNew && action === "save" ? "create" : action,
    ...(source.type === "card" ? (source.isNew ? { creationId: exercise.id, ownerUid: source.ownerUid } : { cardId: exercise.exerciseCardId || exercise.id, revision: exercise.revision })
      : { templateId: source.templateId, exerciseId: exercise.id, legacyKey: exerciseCardLegacyKey(exercise) }),
    ...(["save", "create"].includes(action) ? { patch: exerciseCardMetadata({ ...exercise, ...patch }) } : {}) };
}

export function exerciseCardLibraryItem(card) {
  return { ...card, exerciseCardId: card.id, exerciseCardOwnerUid: card.ownerUid,
    libraryDeletedAt: card.deletedAt || "", librarySource: { type: "card", ownerUid: card.ownerUid } };
}

export async function refreshTemplateExerciseCards(template) {
  const { cards = [] } = await requestTrainerExerciseCards({ action: "list" });
  return mapTemplateExerciseCards(template, cards);
}

import { createHash, randomUUID } from "node:crypto";
import { exerciseCardLegacyKey, exerciseCardMetadata, exerciseCardPresentationIdentity } from "./exerciseCards.js";
import { isValidExerciseVideoCrop } from "./exerciseVideoCrop.js";
import { isValidExerciseVideoPosterTime, normalizeExerciseVideoPosterTime } from "./exerciseVideoPoster.js";
import { resolveProtectedExerciseVideoSource } from "./protectedExerciseVideo.js";

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const identifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");
const fields = new Set(["name", "video", "technique", "muscleGroup", "videoPoster", "videoThumbnail", "videoCrop", "videoPosterTime"]);
function validateMetadata(patch = {}, bucketName) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).some((key) => !fields.has(key))) {
    fail(400, "В карточке можно менять только название, видео, технику и группу мышц. Нагрузка настраивается в программе.");
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === "videoPosterTime") {
      if (!isValidExerciseVideoPosterTime(value)) fail(400, "Проверьте кадр превью: время от 0 до 86400 секунд.");
      continue;
    }
    if (key === "videoCrop") {
      if (!isValidExerciseVideoCrop(value)) fail(400, "Проверьте область кадра: положение от 0 до 1, масштаб от 1 до 3.");
      continue;
    }
    const limit = key === "technique" ? 12000 : key === "name" ? 200 : 4000;
    if (typeof value !== "string" || value.length > limit) fail(400, "Проверьте длину полей карточки упражнения.");
    if (key === "video" && /^gs:\/\//i.test(value)) {
      try { resolveProtectedExerciseVideoSource(value, bucketName); }
      catch { fail(400, "Укажите видео из разрешённого хранилища приложения."); }
    } else if (["video", "videoPoster", "videoThumbnail"].includes(key) && value && !/^https:\/\//i.test(value) && !/^\/(?!\/)/.test(value)) fail(400, "Укажите безопасный адрес видео или изображения.");
  }
  if (Object.hasOwn(patch, "name") && !patch.name.trim()) fail(400, "Укажите название упражнения.");
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key,
    key === "videoPosterTime" ? normalizeExerciseVideoPosterTime(value) : key === "videoCrop" ? value : value.trim()]));
}

function allExercises(value) {
  if (Array.isArray(value)) return value.flatMap(allExercises);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => key === "exercises" && Array.isArray(child) ? child : allExercises(child));
}

// Server-only collection. Clients receive metadata only for their current
// trainer through clientExerciseMedia; trainers cannot choose another owner.
export async function manageTrainerExerciseCards({ db, context, body = {}, now = () => new Date().toISOString(), bucketName }) {
  if (!context?.uid) fail(401, "Войдите в аккаунт.");
  const admin = context.token?.admin === true;
  if (!admin && context.role !== "trainer") fail(403, "Библиотека доступна только тренеру.");
  const action = body.action || "list";
  const cardsRef = db.collection("trainerExerciseCards");
  if (action === "list") {
    const query = admin ? cardsRef : cardsRef.where("ownerUid", "==", context.uid);
    const snapshot = await query.get();
    return { cards: snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) };
  }
  if (!["save", "create", "delete", "restore"].includes(action)) fail(400, "Неизвестное действие.");
  const patch = ["save", "create"].includes(action) ? validateMetadata(body.patch, bucketName) : {};
  if (action === "create" && !patch.name) fail(400, "Укажите название упражнения.");
  let legacyRef = null;
  if (!body.cardId && action !== "create") {
    if (!identifier(body.templateId) || !identifier(body.exerciseId) || typeof body.legacyKey !== "string" || body.legacyKey.length > 18000) fail(400, "Обновите библиотеку и откройте упражнение заново.");
    legacyRef = db.collection("trainingTemplates").doc(body.templateId);
  }
  if (body.cardId && !identifier(body.cardId)) fail(400, "Некорректная карточка упражнения.");
  const createId = action === "create" ? (identifier(body.creationId) ? body.creationId : randomUUID()) : "";
  return db.runTransaction(async (transaction) => {
    let source = null;
    let ownerUid = context.uid;
    let legacyKey = "";
    if (legacyRef) {
      const snapshot = await transaction.get(legacyRef);
      if (!snapshot.exists) fail(404, "Исходная программа недоступна.");
      const template = snapshot.data();
      ownerUid = template.ownerUid;
      if (!identifier(ownerUid) || (!admin && ownerUid !== context.uid)) fail(403, "Нет доступа к этой библиотеке.");
      source = allExercises(template).find((exercise) => exercise.id === body.exerciseId && exerciseCardLegacyKey(exercise) === body.legacyKey);
      if (!source) fail(409, "Упражнение изменилось. Обновите библиотеку перед сохранением.");
      if (source.libraryDeletedAt && action === "save") fail(409, "Сначала восстановите упражнение из удалённых.");
      legacyKey = exerciseCardLegacyKey(source);
    }
    if (action === "create" && body.ownerUid) {
      if (!identifier(body.ownerUid) || (!admin && body.ownerUid !== context.uid)) fail(403, "Нет доступа к этой библиотеке.");
      ownerUid = body.ownerUid;
    }
    const id = body.cardId || createId || createHash("sha256").update(JSON.stringify([ownerUid, legacyKey])).digest("hex");
    const ref = cardsRef.doc(id);
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? { ...snapshot.data(), id } : null;
    if (current && !admin && current.ownerUid !== context.uid) fail(403, "Нет доступа к этой библиотеке.");
    if (body.cardId && !current) fail(404, "Карточка больше недоступна. Обновите библиотеку.");
    // Compare revisions, including the initial legacy migration. A concurrent
    // save must not silently overwrite a card created from another template.
    if (current && current.revision !== body.revision) {
      if (action === "create" && current.createdByUid === context.uid && JSON.stringify(exerciseCardMetadata(current)) === JSON.stringify(exerciseCardMetadata(patch))) return { card: current };
      fail(409, "Карточка изменена в другом окне. Обновите библиотеку перед сохранением.");
    }
    if (current?.deletedAt && action === "save") fail(409, "Сначала восстановите упражнение из удалённых.");
    const timestamp = now();
    const base = current || { id, ownerUid, ...exerciseCardPresentationIdentity(source || {}), ...exerciseCardMetadata(source || patch), legacyKeys: legacyKey ? [legacyKey] : [],
      createdAt: timestamp, createdByUid: context.uid, deletedAt: source?.libraryDeletedAt || "" };
    const card = { ...base, ...patch, revision: (current?.revision || 0) + 1, updatedAt: timestamp, updatedByUid: context.uid,
      previousNames: [...new Set([...(base.previousNames || []), base.name].filter(Boolean))],
      deletedAt: action === "delete" ? timestamp : action === "restore" ? "" : base.deletedAt };
    card.videoUpdatedAt = Object.hasOwn(patch, "video") && patch.video !== base.video
      ? timestamp : base.videoUpdatedAt || source?.videoUpdatedAt || base.updatedAt || base.createdAt || timestamp;
    if (!card.video || (Object.hasOwn(patch, "video") && patch.video !== base.video && !Object.hasOwn(patch, "videoCrop"))) card.videoCrop = null;
    if (!card.video || (Object.hasOwn(patch, "video") && patch.video !== base.video && !Object.hasOwn(patch, "videoPosterTime"))) card.videoPosterTime = null;
    transaction.set(ref, card);
    return { card };
  });
}

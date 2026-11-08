const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const validPath = path => typeof path === "string" && /^users\/[A-Za-z0-9_-]{1,128}\/feedback\/[A-Za-z0-9_-]{1,128}$/.test(path);
const text = (value, max = 1200) => typeof value === "string" ? value.slice(0, max) : "";

export function feedbackAttachments(data, path) {
  const [, uid, , id] = path.split("/");
  return (Array.isArray(data.attachments) ? data.attachments : data.attachment ? [data.attachment] : []).slice(0, 5)
    .filter(item => item && typeof item.path === "string" && item.path.startsWith(`feedback/${uid}/${id}/`) &&
      item.path.slice(`feedback/${uid}/${id}/`.length).length > 0 && !item.path.slice(`feedback/${uid}/${id}/`.length).includes("/"))
    .map(item => ({ name: text(item.name, 160), path: item.path, size: Number(item.size) || 0, type: text(item.type, 80) }));
}

export async function manageAdminFeedback({ db, storage, bucket, context, body = {} }) {
  if (context?.role !== "admin" || context?.token?.admin !== true) fail(403, "Доступ только для администратора.");
  const action = body.action || "list";
  if (action === "list") {
    let query = db.collectionGroup("feedback").orderBy("createdAt", "desc").limit(51);
    if (body.cursor) {
      if (!validPath(body.cursor)) fail(400, "Некорректная страница обращений.");
      const cursor = await db.doc(body.cursor).get();
      if (!cursor.exists) fail(409, "Список изменился. Обновите обращения.");
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, 50);
    return { ok: true, items: docs.filter(doc => validPath(doc.ref.path)).map(doc => {
      const data = doc.data();
      return { path: doc.ref.path, type: text(data.type, 30), message: text(data.message), contact: text(data.contact, 120),
        displayName: text(data.displayName, 160), email: text(data.email, 160), createdAt: text(data.createdAt, 40),
        status: data.status === "processed" ? "processed" : "new", appVersion: text(data.appVersion, 30),
        attachments: feedbackAttachments(data, doc.ref.path) };
    }), nextCursor: snapshot.docs.length > 50 ? docs.at(-1)?.ref.path || "" : "" };
  }
  if (!validPath(body.path)) fail(400, "Некорректное обращение.");
  const ref = db.doc(body.path);
  const snapshot = await ref.get();
  if (!snapshot.exists) fail(404, "Обращение не найдено.");
  if (action === "status") {
    if (!["new", "processed"].includes(body.status)) fail(400, "Некорректный статус.");
    await ref.update({ status: body.status, processedBy: context.uid, statusUpdatedAt: new Date().toISOString() });
    return { ok: true };
  }
  if (action === "attachment") {
    const attachment = feedbackAttachments(snapshot.data(), body.path).find(item => item.path === body.attachmentPath);
    if (!attachment) fail(403, "Вложение не относится к этому обращению.");
    const file = storage.bucket(bucket).file(attachment.path);
    const [metadata] = await file.getMetadata();
    if (!(Number(metadata.size) > 0 && Number(metadata.size) < 25 * 1024 * 1024) ||
      !/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime)|application\/pdf|text\/plain)$/.test(metadata.contentType || "")) fail(403, "Недопустимый файл.");
    const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 5 * 60000,
      responseDisposition: "attachment" });
    return { ok: true, url };
  }
  fail(400, "Неизвестное действие.");
}

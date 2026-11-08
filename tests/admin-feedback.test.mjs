import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { manageAdminFeedback, feedbackAttachments } from "../functions/adminFeedback.js";
import { feedbackFileType, validateFeedbackFiles, mergeFeedbackFiles } from "../src/utils/feedbackAttachments.js";
const path = "users/client/feedback/report";
const attachment = { name: "proof.txt", path: "feedback/client/report/proof.txt", size: 4, type: "text/plain" };
const context = { uid: "admin", role: "admin", token: { admin: true } };

test("вложения: несколько файлов, дедупликация, тип LOG и ограничения", () => {
  const file = { name: "debug.log", size: 12, lastModified: 1 };
  assert.equal(feedbackFileType(file), "text/plain");
  assert.equal(mergeFeedbackFiles([file], [file, { ...file, name: "other.txt" }]).length, 2);
  assert.equal(validateFeedbackFiles([file]), "");
  assert.match(validateFeedbackFiles(Array(6).fill(file)), /до 5/);
  assert.match(validateFeedbackFiles([{ ...file, size: 25 * 1024 * 1024 }]), /меньше 25/);
  assert.match(validateFeedbackFiles([{ ...file, size: 0 }]), /непустым/);
  assert.match(validateFeedbackFiles([{ ...file, name: "script.html" }]), /Подойдут/);
  assert.match(validateFeedbackFiles(Array(3).fill({ ...file, size: 20 * 1024 * 1024 })), /50 МБ/);
});
test("старые одиночные вложения поддерживаются, чужие пути исключаются", () => {
  assert.deepEqual(feedbackAttachments({ attachment }, path), [attachment]);
  assert.deepEqual(feedbackAttachments({ attachments: [{ ...attachment, path: "feedback/other/report/proof.txt" }] }, path), []);
});
test("клиент и тренер не могут читать или изменять обращения", async () => {
  for (const role of ["client", "trainer", undefined]) for (const action of ["list", "status", "attachment"]) {
    await assert.rejects(manageAdminFeedback({ context: { role, token: {} }, body: { action } }), { status: 403 });
  }
});
test("список ограничен 50 записями и возвращает курсор; сообщения не исполняются", async () => {
  const docs = Array.from({ length: 51 }, (_, i) => ({ ref: { path: `users/client/feedback/r${i}` }, data: () => ({ message: "<script>test</script>", attachments: [attachment], createdAt: "2026-11-05T10:00:00Z", status: "new" }) }));
  const calls = [];
  const query = { orderBy(...args) { calls.push(args); return this; }, limit(n) { assert.equal(n, 51); return this; }, async get() { return { docs }; } };
  const result = await manageAdminFeedback({ db: { collectionGroup(name) { assert.equal(name, "feedback"); return query; } }, context });
  assert.equal(result.items.length, 50);
  assert.equal(result.nextCursor, "users/client/feedback/r49");
  assert.deepEqual(calls, [["createdAt", "desc"]]);
  assert.equal(result.items[0].message, "<script>test</script>");
});
test("администратор меняет только статус, скачивает только файл этого обращения", async () => {
  let updated, signed;
  const db = { doc: () => ({ get: async () => ({ exists: true, data: () => ({ attachment }) }), update: async value => { updated = value; } }) };
  await manageAdminFeedback({ db, context, body: { action: "status", path, status: "processed" } });
  assert.equal(updated.status, "processed"); assert.equal(updated.processedBy, "admin");
  const storage = { bucket: () => ({ file: object => { assert.equal(object, attachment.path); return {
    getMetadata: async () => [{ size: "4", contentType: "text/plain" }], getSignedUrl: async options => { signed = options; return ["https://storage.googleapis.com/test"]; }
  }; } }) };
  await manageAdminFeedback({ db, storage, bucket: "test", context, body: { action: "attachment", path, attachmentPath: attachment.path } });
  assert.equal(signed.action, "read"); assert.equal(signed.responseDisposition, "attachment");
  assert.ok(signed.expires <= Date.now() + 300000);
  await assert.rejects(manageAdminFeedback({ db, context, body: { action: "attachment", path, attachmentPath: "feedback/other/report/file" } }), { status: 403 });
  await assert.rejects(manageAdminFeedback({ db, context, body: { action: "status", path: "users/client/history/report", status: "processed" } }), { status: 400 });
});
test("endpoint сохраняет AppCheck, актуальную роль, ключ администратора и rate limit", () => {
  const source = readFileSync("functions/index.js", "utf8").split("export const adminFeedback = onRequest(")[1].split("export const exerciseVideoAccess")[0];
  assert.match(source, /requireActiveMember\(req\)/); assert.match(source, /assertAdminContext\(context\)/); assert.match(source, /enforceRateLimit/);
});

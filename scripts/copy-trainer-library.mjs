import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { resolveProtectedExerciseVideoSource } from "../functions/protectedExerciseVideo.js";
import { mapTemplateExerciseCards } from "../functions/exerciseCards.js";
import { planExercisePreviewCopies, copyExercisePreviewAssets } from "./lib/exercise-preview-copy.mjs";

const project = "tren-85720";
const sourceEmail = "zahar.rusenko2000@gmail.com";
const targetEmail = "kriptonit27@invite.tren-85720.app";
const require = createRequire(import.meta.url);
const cli = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { getGlobalDefaultAccount } = require(resolve(cli, "auth.js"));
const { requireAuth } = require(resolve(cli, "requireAuth.js"));
const { Client } = require(resolve(cli, "apiv2.js"));
const account = getGlobalDefaultAccount();
if (!account) throw new Error("Firebase CLI sign-in required");
await requireAuth({ ...account, project }, true);
const firestore = new Client({ urlPrefix: "https://firestore.googleapis.com" });
const identity = new Client({ urlPrefix: "https://identitytoolkit.googleapis.com" });
const root = `/v1/projects/${project}/databases/(default)/documents`;
function decode(value) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if ("nullValue" in value) return null;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  return value.stringValue ?? value.timestampValue ?? value.referenceValue;
}
const data = doc => Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decode(value)]));
async function query(collectionId, field, value) {
  const response = await firestore.post(`${root}:runQuery`, { structuredQuery: {
    from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } }
  } });
  return response.body.filter(row => row.document).map(row => row.document);
}
const users = await Promise.all([sourceEmail, targetEmail].map(async email => {
  let matches = await query("users", "email", email);
  if (!matches.length) {
    const lookup = await identity.post(`/v1/projects/${project}/accounts:lookup`, { email: [email] });
    const identities = lookup.body.users || [];
    console.log(JSON.stringify({ email, authMatches: identities.length }));
    if (identities.length === 1) {
      const response = await firestore.get(`${root}/users/${identities[0].localId}`, { resolveOnHTTPError: true });
      if (response.status === 200) matches = [response.body];
      else console.log(JSON.stringify({ email, profileStatus: response.status }));
    }
    if (!matches.length) {
      const login = email.split("@")[0];
      const candidates = await Promise.all(["login", "username", "emailLowercase"].map(field => query("users", field, field === "emailLowercase" ? email : login)));
      const unique = [...new Map(candidates.flat().map(doc => [doc.name, doc])).values()];
      console.log(JSON.stringify({ email, possibleProfiles: unique.map(doc => { const value = data(doc); return { uid: doc.name.split("/").at(-1), role: value.role, email: value.email, login: value.login, username: value.username }; }) }));
    }
  }
  if (matches.length !== 1) throw new Error(`Expected one profile for ${email}, found ${matches.length}`);
  const doc = matches[0];
  const profile = data(doc);
  if (profile.role !== "trainer") throw new Error(`${email} is not a trainer`);
  return { uid: doc.name.split("/").at(-1), email, profile };
}));
const [source, target] = users;
if (source.uid === target.uid) throw new Error("Source equals destination");
const [sourceCards, sourceTemplates, targetCards, targetTemplates] = await Promise.all([
  query("trainerExerciseCards", "ownerUid", source.uid), query("trainingTemplates", "ownerUid", source.uid),
  query("trainerExerciseCards", "ownerUid", target.uid), query("trainingTemplates", "ownerUid", target.uid)
]);
console.log(JSON.stringify({ profiles: users.map(({ uid, email, profile }) => ({ uid, email, role: profile.role, isTest: profile.isTest, testAccount: profile.testAccount })),
  sourceCards: sourceCards.length, deletedCards: sourceCards.filter(doc => data(doc).deletedAt).length,
  targetCards: targetCards.length, targetTemplates: targetTemplates.length,
  cardFields: [...new Set(sourceCards.flatMap(doc => Object.keys(doc.fields)))],
  templates: sourceTemplates.map(doc => { const value = data(doc); return { id: doc.name.split("/").at(-1), name: value.name, status: value.status, programStatus: value.programStatus, fields: Object.keys(value), workouts: value.workouts?.length }; })
}, null, 2));
const videos = new Map();
const otherMedia = new Map();
function inspect(value) {
  if (Array.isArray(value)) return value.forEach(inspect);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && child && ["video", "videoUrl", "videoURL"].includes(key)) {
      try { const media = resolveProtectedExerciseVideoSource(child); videos.set(media.objectPath, media); }
      catch { throw new Error(`Unsupported video source in ${key}`); }
    } else if (typeof child === "string" && child && ["videoPoster", "videoThumbnail"].includes(key)) otherMedia.set(child, key);
    else if (typeof child === "object") inspect(child);
  }
}
sourceCards.concat(sourceTemplates).forEach(doc => inspect(data(doc)));
console.log(JSON.stringify({ videos: videos.size, videoPrefixes: [...new Set([...videos.keys()].map(path => path.split("/").slice(0, 2).join("/")))], otherMedia: [...otherMedia].map(([url, field]) => ({ field, kind: url.startsWith("data:") ? "data" : url.startsWith("/") ? "local" : new URL(url).hostname })), targetPrograms: targetTemplates.map(doc => ({ id: doc.name.split("/").at(-1), name: data(doc).name })) }, null, 2));
if (otherMedia.size) throw new Error("Non-video media needs explicit copy handling before applying");
const apply = process.argv.includes("--apply");
const storage = new Client({ urlPrefix: "https://storage.googleapis.com" });
const bucket = `${project}.firebasestorage.app`;
const allObjects = new Map();
for (const prefix of [`exercise-videos/${source.uid}/`, `template-exercise-videos/${source.uid}/`]) {
  let pageToken;
  do {
    const response = await storage.get(`/storage/v1/b/${bucket}/o`, { queryParams: { prefix, ...(pageToken ? { pageToken } : {}) } });
    for (const object of response.body.items || []) if (String(object.contentType).startsWith("video/")) allObjects.set(object.name, object);
    pageToken = response.body.nextPageToken;
  } while (pageToken);
}
for (const path of videos.keys()) {
  if (!allObjects.has(path)) {
    const response = await storage.get(`/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`);
    allObjects.set(path, response.body);
  }
}
const mediaMap = new Map([...allObjects].map(([path]) => [path, path.replace(`/${source.uid}/`, `/${target.uid}/`)]));
for (const [oldPath, newPath] of mediaMap) if (oldPath === newPath || !newPath.includes(`/${target.uid}/`)) throw new Error("Unsafe destination media path");
const hash = value => createHash("sha256").update(value).digest("hex");
const idMap = new Map([[source.uid, target.uid]]);
const newId = (type, id) => `trainer_copy_${type}_${hash(`${source.uid}:${target.uid}:${id}`).slice(0,32)}`;
for (const doc of sourceCards) idMap.set(doc.name.split("/").at(-1), newId("card", doc.name.split("/").at(-1)));
for (const doc of sourceTemplates) idMap.set(doc.name.split("/").at(-1), newId("program", doc.name.split("/").at(-1)));
function collectIds(value) {
  if (Array.isArray(value)) return value.forEach(collectIds);
  if (!value || typeof value !== "object") return;
  if (typeof value.id === "string" && value.id && !idMap.has(value.id)) idMap.set(value.id, newId("item", value.id));
  Object.values(value).forEach(collectIds);
}
sourceCards.concat(sourceTemplates).forEach(doc => collectIds(data(doc)));
function rewrite(value) {
  if (typeof value === "string") {
    if (idMap.has(value)) return idMap.get(value);
    if (value === source.email) return target.email;
    if (value.startsWith("[")) { try { return JSON.stringify(rewrite(JSON.parse(value))); } catch { /* normal text */ } }
    if (/^(gs:|https:|\/videos\/)/.test(value)) {
      try { const path = resolveProtectedExerciseVideoSource(value).objectPath; if (mediaMap.has(path)) return `gs://${bucket}/${mediaMap.get(path)}`; } catch { /* not a video */ }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]));
}
const now = new Date().toISOString();
const sourceCardValues = sourceCards.map(doc => ({ ...data(doc), id: doc.name.split("/").at(-1) }));
const copies = sourceCards.concat(sourceTemplates).map(doc => {
  const collection = doc.name.split("/").at(-2);
  const sourceId = doc.name.split("/").at(-1);
  const original = data(doc);
  const value = rewrite(collection === "trainingTemplates" ? mapTemplateExerciseCards(original, sourceCardValues, source.uid) : original);
  value.id = idMap.get(sourceId);
  value.ownerUid = target.uid;
  value.createdByUid = target.uid;
  value.updatedByUid = target.uid;
  value.createdAt = now;
  value.updatedAt = now;
  value.copiedFrom = { ownerUid: source.uid, collection, documentId: sourceId, operation: "trainer-library-copy-v1" };
  if (collection === "trainingTemplates") {
    Object.assign(value, { ownerRole: "trainer", createdByEmail: target.email, createdBy: target.email,
      assignedClientIds: [], lastAssignedAt: "", lastAssignedByUid: "", lifecycleStatus: "ready", programStatus: "ready", visibility: "trainer_library", archivedAt: "", publishedAt: now });
  }
  return { name: `${root.slice(4)}/${collection}/${value.id}`, value, sourceDoc: doc };
});
const existing = new Map(targetCards.concat(targetTemplates).map(doc => [doc.name, doc]));
const pending = copies.filter(copy => {
  if (!existing.has(copy.name)) return true;
  const previous = data(existing.get(copy.name));
  if (!isDeepStrictEqual(previous.copiedFrom, copy.value.copiedFrom)) throw new Error("Destination ID collision");
  return false;
});
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", videosToCopyOrVerify: allObjects.size, bytes: [...allObjects.values()].reduce((sum, object) => sum + Number(object.size), 0), cardsToCreate: pending.filter(copy => copy.name.includes("/trainerExerciseCards/")).length, programsToCreate: pending.filter(copy => copy.name.includes("/trainingTemplates/")).length, existingCopiesPreserved: copies.length - pending.length }, null, 2));
if (!apply) process.exit(0);
for (const [path, object] of allObjects) {
  const destination = mediaMap.get(path);
  const destinationPath = `/storage/v1/b/${bucket}/o/${encodeURIComponent(destination)}`;
  let result = await storage.get(destinationPath, { resolveOnHTTPError: true });
  if (result.status === 404) {
    const metadata = { ...(object.metadata || {}) };
    delete metadata.firebaseStorageDownloadTokens;
    await storage.post(`/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}/copyTo/b/${bucket}/o/${encodeURIComponent(destination)}`, {
      contentType: object.contentType, cacheControl: "private, no-store, max-age=0", contentDisposition: "inline", metadata
    }, { queryParams: { ifGenerationMatch: 0, ifSourceGenerationMatch: object.generation }, retries: 0 });
    result = await storage.get(destinationPath);
  }
  if (result.status !== 200 || result.body.md5Hash !== object.md5Hash || result.body.size !== object.size || result.body.metadata?.firebaseStorageDownloadTokens) throw new Error("Copied video verification failed");
}
const previewJobs = planExercisePreviewCopies(sourceCards.concat(sourceTemplates).map(data), mediaMap, bucket);
const previewResult = await copyExercisePreviewAssets(previewJobs, { storage, bucket, apply: true });
console.log(JSON.stringify({ previews: previewResult }));
if (previewResult.sourceMissing) throw new Error("Source previews missing; prepare them before publishing copied library documents");
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).map(([key, child]) => [key, encode(child)])) } };
}
if (pending.length) {
  const writes = [
    ...sourceCards.concat(sourceTemplates).map(doc => ({ verify: doc.name, currentDocument: { updateTime: doc.updateTime } })),
    ...pending.map(copy => ({ update: { name: copy.name, fields: encode(copy.value).mapValue.fields }, currentDocument: { exists: false } }))
  ];
  if (writes.length > 450) throw new Error("Copy exceeds one atomic commit; no document writes performed");
  await firestore.post(`${root}:commit`, { writes });
}
for (const copy of copies) {
  const response = await firestore.get(`/v1/${copy.name}`);
  const saved = data(response.body);
  if (saved.ownerUid !== target.uid || !isDeepStrictEqual(saved.copiedFrom, copy.value.copiedFrom)) throw new Error("Copied document verification failed");
  if (pending.includes(copy) && !isDeepStrictEqual(saved, copy.value)) throw new Error("Document contents differ");
}
for (const doc of sourceCards.concat(sourceTemplates)) {
  const response = await firestore.get(`/v1/${doc.name}`);
  if (response.body.updateTime !== doc.updateTime) throw new Error("Source changed during copy; review required");
}
for (const doc of targetTemplates.concat(targetCards)) {
  const response = await firestore.get(`/v1/${doc.name}`);
  if (response.body.updateTime !== doc.updateTime) throw new Error("Pre-existing target document changed; review required");
}
console.log(JSON.stringify({ verified: true, copiedDocuments: pending.length, copiedOrVerifiedVideos: allObjects.size, sourceUnchanged: true, existingTargetLibraryUnchanged: true, clientRecordsWritten: 0 }, null, 2));

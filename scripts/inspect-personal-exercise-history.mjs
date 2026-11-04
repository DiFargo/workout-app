// Explicit owner lookup and read-only history inspection. No credentials or
// raw personal documents are written to disk or printed.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const PROJECT = "tren-85720";
const PREFIX = `/v1/projects/${PROJECT}/databases/(default)/documents`;
export const decodeFirestoreValue = value => value?.stringValue ?? value?.timestampValue ?? value?.booleanValue
  ?? (value?.integerValue !== undefined ? Number(value.integerValue) : value?.doubleValue)
  ?? (value?.arrayValue ? (value.arrayValue.values || []).map(decodeFirestoreValue)
    : value?.mapValue ? decodeFirestoreFields(value.mapValue.fields) : null);
export const decodeFirestoreFields = fields => Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
const safe = condition => {if (!condition) throw new Error("personal-history/inspection-rejected");};
const skippedLogs = {reqBody: true, resBody: true};

export async function createPersonalHistoryReader() {
  const require = createRequire(import.meta.url);
  const cli = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); safe(account);
  await require(resolve(cli, "requireAuth.js")).requireAuth({...account, project: PROJECT}, true);
  const {Client} = require(resolve(cli, "apiv2.js"));
  const client = new Client({urlPrefix: "https://firestore.googleapis.com"});
  return {
    async findOwner(email) {
      safe(typeof email === "string" && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
      const fields = ["email", "name", "displayName", "username", "login", "nickname", "role", "assignedProgramId",
        "assignedProgramName", "assignedProgramUpdatedAt", "assignedProgramAt", "assignedTrainerId", "trainerId", "coachId"];
      const response = await client.post(`${PREFIX}:runQuery`, {structuredQuery: {
        select: {fields: fields.map(fieldPath => ({fieldPath}))}, from: [{collectionId: "users"}],
        where: {fieldFilter: {field: {fieldPath: "email"}, op: "EQUAL", value: {stringValue: email.trim().toLowerCase()}}}, limit: 2
      }}, {skipLog: skippedLogs});
      const documents = response.body.filter(item => item.document).map(item => item.document);
      safe(documents.length === 1);
      const owner = documents[0], profile = decodeFirestoreFields(owner.fields), uid = owner.name.split("/").at(-1);
      safe(profile.email?.toLowerCase() === email.trim().toLowerCase() && uid && !uid.includes("/") && uid.length <= 128);
      return {uid, profile, document: owner};
    },
    async listOwned(uid, collection) {
      safe(typeof uid === "string" && uid.length <= 128 && !uid.includes("/") && ["history", "workouts"].includes(collection));
      const rows = []; let pageToken = "";
      do {
        const response = await client.get(`${PREFIX}/users/${encodeURIComponent(uid)}/${collection}`, {
          queryParams: {pageSize: 200, ...(pageToken ? {pageToken} : {})}, skipLog: skippedLogs
        });
        rows.push(...(response.body.documents || []));pageToken = response.body.nextPageToken || "";
        safe(rows.length <= 1000);
      } while (pageToken);
      return rows;
    }
  };
}

export async function inspectPersonalExerciseHistory(email, reader) {
  const service = reader || await createPersonalHistoryReader();
  const owner = await service.findOwner(email);
  const [history, workouts] = await Promise.all([service.listOwned(owner.uid, "history"), service.listOwned(owner.uid, "workouts")]);
  return {...owner, history, workouts};
}

const fingerprint = value => value ? createHash("sha256").update(String(value)).digest("hex").slice(0, 12) : "";
export function summarizePersonalHistory(inspection, focus = "ног") {
  const collect = documents => {
    const groups = new Map();
    for (const document of documents) {
      const row = decodeFirestoreFields(document.fields);
      for (const field of ["exercises", "actualExercises", "completedExercises", "exerciseResults", "results"]) {
        for (const exercise of Array.isArray(row[field]) ? row[field] : []) {
          const name = exercise.name || exercise.title || exercise.exerciseName || "";
          if (!name.toLowerCase().includes(focus.toLowerCase())) continue;
          const card = exercise.exerciseCardId || "", local = exercise.id || exercise.exerciseId || "";
          const video = exercise.video || exercise.videoUrl || exercise.videoURL || "";
          const key = JSON.stringify([name, card, local, video]);
          if (!groups.has(key)) groups.set(key, {name, idFingerprint: fingerprint(local), cardFingerprint: fingerprint(card),
            hasCardOwner: Boolean(exercise.exerciseCardOwnerUid), videoFingerprint: fingerprint(video),
            hasLibrary: Boolean(exercise.libraryExerciseId || exercise.basicExerciseId || exercise.catalogueId), count: 0, dates: [], fields: new Set()});
          const group = groups.get(key);group.count++;group.fields.add(field);if (row.date) group.dates.push(row.date);
        }
      }
    }
    return [...groups.values()].map(({dates, fields, ...group}) => ({...group, firstDate: dates.sort()[0] || "", lastDate: dates.at(-1) || "", fields: [...fields]}));
  };
  const dates = inspection.history.map(document => decodeFirestoreValue(document.fields?.date)).filter(Boolean).sort();
  return {accountMatched: true, role: inspection.profile.role, historyDocuments: inspection.history.length,
    historyFirstDate: dates[0], historyLastDate: dates.at(-1), workoutDocuments: inspection.workouts.length,
    current: collect(inspection.workouts), historical: collect(inspection.history), writes: 0, privateDocumentsPersisted: false};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = new Map(process.argv.slice(2).map(arg => {const at = arg.indexOf("=");return [arg.slice(0, at), arg.slice(at + 1)];}));
    assert.ok([...args.keys()].every(key => ["--email", "--focus"].includes(key)));
    console.log(JSON.stringify(summarizePersonalHistory(await inspectPersonalExerciseHistory(args.get("--email")), args.get("--focus") || "ног"), null, 2));
  } catch {console.error("Персональная read-only проверка не выполнена; данные и учётные реквизиты не выводились. Записей не сделано.");process.exitCode = 1;}
}

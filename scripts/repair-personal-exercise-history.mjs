// One-owner data maintenance, dry-run by default. No account, token, full
// document, result set, or backup is persisted to the repository or disk.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {isDeepStrictEqual} from "node:util";
import {inspectPersonalExerciseHistory, decodeFirestoreFields} from "./inspect-personal-exercise-history.mjs";
import {buildPersonalExerciseHistoryRepair, assertPersonalRepairPreservesResults, summarizePersonalRepair} from "./lib/personalExerciseHistoryRepair.mjs";
import {selectRecentWorkoutExerciseHistory} from "../src/utils/workoutExerciseHistory.js";
import {getExerciseActualProgress} from "../src/utils/exerciseProgress.js";

const PROJECT = "tren-85720";
const fail = code => {throw new Error(`personal-history/${code}`);};
const check = (condition, code) => {if (!condition) fail(code);};
const same = isDeepStrictEqual;

export function parsePersonalRepairArgs(argv) {
  const flags = new Set(["--apply", "--include-exact-names"]), values = new Set(["--email", "--confirm-email", "--expected-documents", "--expected-links", "--alias-from", "--alias-to"]);
  const result = {};
  for (const arg of argv) {
    const at = arg.indexOf("="), key = at < 0 ? arg : arg.slice(0, at);
    check(!Object.hasOwn(result, key), "duplicate-option");
    check(flags.has(key) ? at < 0 : values.has(key) && at > 0, "unknown-option");
    result[key] = flags.has(key) ? true : arg.slice(at + 1);
  }
  const email = String(result["--email"] || "").trim().toLowerCase();
  check(email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "email-required");
  const aliases = result["--alias-from"] || result["--alias-to"]
    ? [{from: result["--alias-from"], to: result["--alias-to"]}] : [];
  check(aliases.every(alias => typeof alias.from === "string" && alias.from.trim() && typeof alias.to === "string" && alias.to.trim()), "incomplete-alias");
  const apply = result["--apply"] === true;
  if (apply) {
    check(result["--confirm-email"]?.trim().toLowerCase() === email, "owner-confirmation-required");
    check(["--expected-documents", "--expected-links"].every(key => /^\d+$/.test(result[key] || "")), "expected-counts-required");
  }
  return {email, aliases, apply, confirmedEmail: String(result["--confirm-email"] || "").trim().toLowerCase(), includeExactNames: result["--include-exact-names"] === true,
    expectedDocuments: Number(result["--expected-documents"]), expectedLinks: Number(result["--expected-links"])};
}

async function commitPlan(plan) {
  const require = createRequire(import.meta.url), cli = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();check(account, "operator-unavailable");
  await require(resolve(cli, "requireAuth.js")).requireAuth({...account, project: PROJECT}, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken();check(typeof token === "string" && token, "operator-unavailable");
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: "POST", headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({writes: [...plan.verify, ...plan.writes]}), signal: AbortSignal.timeout(30000)
  });
  // No retry after an unknown commit outcome. A subsequent dry-run can verify
  // idempotence without risking a second write against new data.
  check(response.ok, response.status === 409 || response.status === 400 ? "precondition-or-commit-rejected" : "commit-unavailable");
  const result = await response.json();
  check(result.writeResults?.length === plan.verify.length + plan.writes.length, "unverified-commit-response");
}

function decodedRows(documents) {
  return documents.map(document => ({id: document.name.split("/").at(-1), ...decodeFirestoreFields(document.fields)}))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function progressSummary(before, after, plan) {
  const version = before.profile.assignedProgramUpdatedAt || before.profile.assignedProgramAt;
  const targets = before.workouts.map(document => decodeFirestoreFields(document.fields))
    .filter(workout => (workout.assignedProgramUpdatedAt || workout.assignmentVersion) === version).flatMap(workout => workout.exercises || []);
  const count = (rows, exercise) => Array.from({length: Math.ceil(rows.length / 20)}, (_, page) =>
    selectRecentWorkoutExerciseHistory(rows.slice(page * 20, page * 20 + 20), exercise).entries).flat();
  const oldRows = decodedRows(before.history), newRows = decodedRows(after.history);
  const linkedNames = new Set(plan.linked.map(item => item.targetName));
  for (const exercise of targets.filter(target => !linkedNames.has(target.name))) {
    check(same(count(oldRows, exercise), count(newRows, exercise)), "unrelated-client-progress-changed");
    check(same(getExerciseActualProgress(oldRows, exercise).sessions, getExerciseActualProgress(newRows, exercise).sessions), "unrelated-trainer-progress-changed");
  }
  return [...linkedNames].map(name => {
    const exercise = targets.find(target => target.name === name);check(exercise, "missing-verified-target");
    const oldEntries = count(oldRows, exercise), newEntries = count(newRows, exercise);
    check(newEntries.length >= oldEntries.length, "client-progress-lost");
    const previous = new Map(oldEntries.map(entry => [entry.id, entry]));
    for (const entry of newEntries) if (previous.has(entry.id)) check(same(entry, previous.get(entry.id)), "previous-client-result-changed");
    const oldTrainer = getExerciseActualProgress(oldRows, exercise), newTrainer = getExerciseActualProgress(newRows, exercise);
    check(newTrainer.sessions.length >= oldTrainer.sessions.length, "trainer-progress-lost");
    const remaining = newTrainer.sessions.slice();
    for (const session of oldTrainer.sessions) {
      const index = remaining.findIndex(candidate => same(candidate, session));
      check(index >= 0, "previous-trainer-result-changed");remaining.splice(index, 1);
    }
    return {name, clientBefore: oldEntries.length, clientAfter: newEntries.length,
      firstClientDateAfter: newEntries.at(-1)?.date || "", trainerBefore: oldTrainer.sessions.length, trainerAfter: newTrainer.sessions.length};
  });
}

export async function runPersonalExerciseRepair(options, dependencies = {}) {
  check(typeof options.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(options.email), "email-required");
  if (options.apply) check(options.confirmedEmail === options.email && Number.isInteger(options.expectedDocuments)
    && Number.isInteger(options.expectedLinks), "apply-confirmation-required");
  const inspect = dependencies.inspect || inspectPersonalExerciseHistory;
  const before = await inspect(options.email);
  const input = {project: PROJECT, uid: before.uid, profileDocument: before.document, workoutDocuments: before.workouts,
    historyDocuments: before.history, aliases: options.aliases, includeExactNames: options.includeExactNames};
  const plan = buildPersonalExerciseHistoryRepair(input), summary = summarizePersonalRepair(plan);
  const modeled = new Map(plan.changes.map(change => [change.documentName, {...change.original, fields: {...change.original.fields, ...change.updates}}]));
  const expected = {...before, history: before.history.map(document => modeled.get(document.name) || document)};
  const report = {mode: options.apply ? "Применение персональной ссылочной metadata" : "План без записи",
    ...summary, progress: progressSummary(before, expected, plan), historyDocuments: before.history.length,
    privateDocumentsPersisted: false, authenticationChanged: false, globalLibraryChanged: false, applicationRuntimeChanged: false, writesApplied: 0};
  if (!options.apply) return report;
  check(plan.changes.length === options.expectedDocuments && plan.linked.length === options.expectedLinks, "plan-counts-changed");
  if (!plan.writes.length) return {...report, verified: true};
  await (dependencies.commit || commitPlan)(plan);
  const after = await inspect(options.email);
  check(after.uid === before.uid, "owner-changed");
  check(after.document.name === before.document.name && after.document.updateTime === before.document.updateTime, "verification-target-changed");
  const currentWorkouts = new Map(after.workouts.map(document => [document.name, document.updateTime]));
  check(currentWorkouts.size === before.workouts.length && before.workouts.every(document => currentWorkouts.get(document.name) === document.updateTime), "verification-target-changed");
  const current = new Map(after.history.map(document => [document.name, document]));
  check(current.size === before.history.length, "history-count-changed");
  for (const original of before.history) {
    const updated = current.get(original.name), change = plan.changes.find(item => item.documentName === original.name);
    check(updated, "history-document-missing");
    if (change) assertPersonalRepairPreservesResults(original, updated, change.repairs);
    else check(same(original.fields, updated.fields), "unrelated-history-changed");
  }
  const repeated = buildPersonalExerciseHistoryRepair({...input, profileDocument: after.document, workoutDocuments: after.workouts, historyDocuments: after.history});
  check(repeated.writes.length === 0, "repair-not-idempotent");
  return {...report, progress: progressSummary(before, after, plan), writesApplied: plan.writes.length, verified: true, repeatedWrites: repeated.writes.length};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await runPersonalExerciseRepair(parsePersonalRepairArgs(process.argv.slice(2))), null, 2));}
  catch (error) {assert.ok(error);console.error(/^personal-history\/[a-z-]+$/.test(error.message) ? error.message
    : "Персональная операция не завершена; реквизиты и документы не выведены. При неизвестном результате сначала нужна read-only перепроверка.");process.exitCode = 1;}
}

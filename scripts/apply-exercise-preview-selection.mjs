import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { accountToken, readCatalog, inventory } from "./exercise-preview-batch.mjs";
import { planLegacyPreviewWrites } from "./plan-legacy-exercise-preview-selection.mjs";

const directory = resolve("output/playwright/exercise-preview-selection-2026-10-25");
const project = "tren-85720";
const base = `projects/${project}/databases/(default)`;
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export function planPreviewWrites(frozen, current, candidates, decisions, now) {
  const currentInventory = inventory(current);
  const changes = [], skipped = [];
  for (const entry of frozen.entries.filter(entry => entry.status === "needs_selection" && entry.type !== "legacy")) {
    assert.ok(["card", "basic"].includes(entry.type), "Legacy video migration requires a separately reviewed path");
    const candidate = candidates.find(candidate => candidate.videos.includes(entry.videoLabel));
    assert.ok(candidate && !candidate.error, `No decoded candidates for ${entry.videoLabel}`);
    assert.equal(canonical(candidate.crop ?? null), canonical(entry.crop ?? null), `Unreviewed crop for ${entry.videoLabel}`);
    const decision = decisions[candidate.label];
    if (decision?.skip === true) {
      skipped.push({ type: entry.type, id: entry.id, name: entry.name, reason: decision.reason || "unsuitable_source" }); continue;
    }
    assert.ok(decision && Number.isInteger(decision.choice) && decision.choice >= 1 && decision.choice <= 6 && decision.reason, `Missing visual review: ${candidate.label}`);
    const time = candidate.times[decision.choice - 1];
    assert.ok(Number.isFinite(time) && time >= 0 && time < candidate.duration && time <= 86400);
    const freshEntry = currentInventory.entries.find(item => item.type === entry.type && item.id === entry.id);
    if (!freshEntry || freshEntry.updateTime !== entry.updateTime || freshEntry.videoRef !== entry.videoRef || canonical(freshEntry.crop) !== canonical(entry.crop) || freshEntry.status !== "needs_selection") {
      skipped.push({ type: entry.type, id: entry.id, name: entry.name, reason: "changed_since_review" }); continue;
    }
    const collection = entry.type === "card" ? "trainerExerciseCards" : "basicExerciseOverrides";
    const document = current[collection].find(doc => doc.id === entry.id);
    if (entry.type === "card" && !document.videoUpdatedAt && !document.updatedAt && !document.createdAt) {
      skipped.push({ type: entry.type, id: entry.id, name: entry.name, reason: "missing_media_priority_anchor" }); continue;
    }
    const patch = { videoPosterTime: time };
    if (entry.type === "card") Object.assign(patch, { revision: (document.revision || 0) + 1,
      updatedAt: now, updatedByUid: "system-preview-selection",
      videoUpdatedAt: document.videoUpdatedAt || document.updatedAt || document.createdAt || now });
    const fields = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key,
      typeof value === "number" ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value } : { stringValue: value }]));
    changes.push({ type: entry.type, id: entry.id, name: entry.name, label: candidate.label,
      choice: decision.choice, reason: decision.reason, time,
      before: Object.fromEntries(Object.keys(patch).map(key => [key, { present: Object.hasOwn(document, key), value: document[key] ?? null }])),
      write: { update: { name: document._document, fields }, updateMask: { fieldPaths: Object.keys(patch) }, currentDocument: { updateTime: document._updateTime } } });
  }
  return { project, preparedAt: now, changes, skipped };
}

export function assertPreviewTransactionReads(plan, rows) {
  assert.ok(Array.isArray(rows), "Expected bounded transaction read results");
  for (const expected of plan.verifications || []) {
    assert.ok(expected.name.startsWith(`${base}/documents/trainingTemplates/`));
    const result = rows.find(row => row.found?.name === expected.name);
    assert.equal(result?.found?.updateTime, expected.updateTime, "Source template changed; no commit is permitted");
  }
  for (const change of plan.changes.filter(change => change.type === "legacy_card")) {
    assert.ok(change.write.update.name.startsWith(`${base}/documents/trainerExerciseCards/`));
    assert.ok(rows.some(row => row.missing === change.write.update.name), "New shared card already exists; no overwrite is permitted");
  }
}

async function transactionRequest(token, method, body) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${base}/documents:${method}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  assert.equal(response.status, 200, `Preview transaction ${method} failed: HTTP ${response.status}; do not retry stale writes`);
  return response.json();
}

async function beginGuardedTransaction(token, plan) {
  if (!plan.verifications.length) return null;
  const { transaction } = await transactionRequest(token, "beginTransaction", {});
  assert.ok(typeof transaction === "string" && transaction.length > 0);
  try {
    const documents = [...new Set([...plan.verifications.map(item => item.name),
      ...plan.changes.filter(change => change.type === "legacy_card").map(change => change.write.update.name)])];
    assert.ok(documents.length <= 4, "Only two reviewed legacy sources and their new cards may be read");
    const rows = await transactionRequest(token, "batchGet", { documents, transaction });
    assertPreviewTransactionReads(plan, rows);
    return transaction;
  } catch (error) {
    await transactionRequest(token, "rollback", { transaction }).catch(() => {});
    throw error;
  }
}

if (process.argv.includes("--plan") || process.argv.includes("--apply")) {
  const apply = process.argv.includes("--apply");
  if (apply) assert.ok(process.argv.includes("--project=tren-85720"), "Exact production project approval is required");
  if (apply) {
    for (const file of ["apply-intent.json", "commit-receipt.json", "applied.json"]) {
      const exists = await access(resolve(directory, file)).then(() => true, () => false);
      assert.ok(!exists, "An earlier apply intent or result exists; reconcile read-only before any new attempt");
    }
  }
  const [frozen, candidates, decisions] = await Promise.all(["inventory.json", "candidates.json", "decisions.json"].map(file => readFile(resolve(directory, file), "utf8").then(JSON.parse)));
  const token = await accountToken();
  const before = await readCatalog(token);
  const now = new Date().toISOString();
  const plan = planPreviewWrites(frozen, before, candidates, decisions, now);
  const legacy = await planLegacyPreviewWrites(frozen, before, candidates, decisions, now);
  plan.changes.push(...legacy.changes); plan.skipped.push(...legacy.skipped); plan.verifications = legacy.verifications;
  await writeFile(resolve(directory, apply ? "apply-intent.json" : "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  if (apply && plan.changes.length) {
    assert.ok(plan.changes.length <= 200, "Bounded library-only batch");
    const transaction = await beginGuardedTransaction(token, plan);
    let commit;
    try {
      commit = await transactionRequest(token, "commit", { writes: plan.changes.map(change => change.write), ...(transaction ? { transaction } : {}) });
    } catch (error) {
      await writeFile(resolve(directory, "apply-outcome-unverified.json"), JSON.stringify({ project,
        recordedAt: new Date().toISOString(), verificationRequired: true, automaticRetryForbidden: true,
        message: "Сверить состояние с apply-intent.json перед продолжением; сетевой сбой не доказывает отсутствие записи." }, null, 2) + "\n");
      throw error;
    }
    await writeFile(resolve(directory, "commit-receipt.json"), JSON.stringify({ project, commitTime: commit.commitTime,
      writes: plan.changes.map((change, index) => ({ type: change.type, id: change.id, updateTime: commit.writeResults?.[index]?.updateTime })),
      verificationPending: true }, null, 2) + "\n");
    const after = await readCatalog(token);
    for (const change of plan.changes.filter(change => change.type === "legacy_card")) {
      const saved = after.trainerExerciseCards.find(doc => doc.id === change.id);
      assert.ok(saved, "Created legacy card missing after commit; reconcile instead of retrying");
      const fields = Object.fromEntries(Object.entries(saved).filter(([key]) => !["_document", "_updateTime"].includes(key)));
      assert.equal(canonical(fields), canonical(change.expectedCard), "Created card differs from reviewed metadata");
    }
    const concurrentNonTargetChanges = [];
    for (const collection of Object.keys(before)) {
      for (const original of before[collection]) {
        const saved = after[collection].find(doc => doc.id === original.id);
        const change = plan.changes.find(change => change.write.update.name === original._document);
        if (!change) {
          if (canonical(saved) !== canonical(original)) concurrentNonTargetChanges.push({ collection, id: original.id });
          continue;
        }
        assert.ok(saved, "Target document missing after commit; reconcile instead of retrying");
        const allowed = new Set(["_updateTime", ...(change?.write.updateMask.fieldPaths || [])]);
        const without = object => Object.fromEntries(Object.entries(object).filter(([key]) => !allowed.has(key)));
        assert.equal(canonical(without(saved)), canonical(without(original)), "Non-preview data changed during verification");
        assert.equal(saved.videoPosterTime, change.time);
        if (change.type === "card") assert.equal(saved.revision, (original.revision || 0) + 1);
      }
    }
    const result = { ...plan, commitTime: commit.commitTime, verifiedAt: new Date().toISOString(), unchangedNonPreviewFields: true,
      concurrentNonTargetChanges, untouchedCollections: ["trainingTemplates", "users", "history"], userDataRead: false };
    await writeFile(resolve(directory, "applied.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ applied: plan.changes.length, skipped: plan.skipped.length, commitTime: commit.commitTime, verified: true }));
  } else console.log(JSON.stringify({ dryRun: !apply, planned: plan.changes.length, skipped: plan.skipped.length }));
}

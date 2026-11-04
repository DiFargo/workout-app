import { auth } from "../firebase.js";
import { fetchAuthorizedWithTimeout } from "./apiClient.js";
import { captureAuthSession } from "./authSession.js";
import { mergeNutritionStates } from "./nutritionStateMerge.js";
import { mergeNutritionDay } from "./nutritionSyncModel.js";
import { safeReadUserJsonStorage, safeWriteUserJsonStorage } from "./userScopedStorage.js";
import { nutritionStateFingerprint } from "./nutritionSyncRevision.js";

const MUTATIONS_KEY = "workout_nutrition_day_mutations_v2";
const LEGACY_QUEUE_KEY = "workout_nutrition_failed_sync_v1";
export { configureNutritionDayStorage, isNutritionDayStorageEnabled } from "./nutritionDayStorageConfig.js";
const error = code => Object.assign(new Error(code), { code });

export function createNutritionDayClient({ auth: activeAuth, request, readStorage = safeReadUserJsonStorage,
  writeStorage = safeWriteUserJsonStorage, makeId = () => crypto.randomUUID().replaceAll("-", ""), onPendingChange = () => {} }) {
  let session = null;
  const resources = new Map();
  const pending = new Map();
  const conflicts = new Set();
  const observed = new Map();
  const preparations = new Map();
  function isManifestCurrent(uid, incoming) {
    current();
    const known = observed.get(uid) || resources.get(uid)?.manifest;
    if (!known) return true;
    return incoming.writerEpoch > known.writerEpoch || incoming.writerEpoch === known.writerEpoch
      && incoming.generation === known.generation && incoming.revision >= known.revision;
  }
  function current() {
    if (!session?.isCurrent()) { session = captureAuthSession(activeAuth); resources.clear(); pending.clear(); conflicts.clear(); observed.clear(); preparations.clear(); }
    if (!session.isCurrent()) throw error("nutrition/auth-required");
    return session;
  }
  async function call(body) {
    const captured = current();
    let result;
    try { result = await request(body); }
    catch (failure) {
      if (!captured.isCurrent()) throw error("nutrition/session-changed");
      if (["nutrition/generation-changed", "nutrition/upgrade-required"].includes(failure.code)) {
        conflicts.add(body.uid);
        onPendingChange({ uid: body.uid, status: "rebase-required" });
        throw Object.assign(error("nutrition/rebase-required"), { cause: failure, originalCode: failure.code });
      }
      throw failure;
    }
    if (!captured.isCurrent()) throw error("nutrition/session-changed");
    return result;
  }
  async function replayEnvelope(uid, envelope, state = {}) {
    let resultState = state;
    let reconciled = false;
    for (const chunk of envelope.chunks) {
      const result = await call({ action: "commit", uid, protocolVersion: 2, generation: envelope.generation,
        writerEpoch: envelope.writerEpoch, ...chunk });
      if (!isManifestCurrent(uid, result.manifest)) throw error("nutrition/stale-read");
      observed.set(uid, result.manifest);
      if (!reconciled && result.duplicate && (result.manifest.generation !== envelope.generation || result.manifest.writerEpoch !== envelope.writerEpoch)) {
        const known = resources.get(uid);
        resultState = known?.manifest.generation === result.manifest.generation && known?.manifest.writerEpoch === result.manifest.writerEpoch ? known.state : {};
        reconciled = true;
      }
      resultState = mergeNutritionStates(resultState, result.state);
      resources.set(uid, { ...resources.get(uid), manifest: result.manifest });
    }
    return resultState;
  }
  async function prepare(uid = activeAuth.currentUser?.uid, { force = false } = {}) {
    const captured = current();
    if (uid !== captured.uid) return null;
    if (!force && preparations.has(uid)) return preparations.get(uid);
    const operation = call({ action: "prepare", uid }).then(result => {
      if (result.manifest && isManifestCurrent(uid, result.manifest)) observed.set(uid, result.manifest);
      return result;
    });
    preparations.set(uid, operation);
    return operation;
  }
  async function read(uid = activeAuth.currentUser?.uid, { mode = "full", dayKeys = [], force = false } = {}) {
    current();
    const key = JSON.stringify([uid, mode, dayKeys]);
    if (!force && pending.has(key)) return pending.get(key);
    const operation = (async () => {
      try { await prepare(uid); }
      catch (failure) {
        if ([401, 403].includes(failure.status) || ["nutrition/session-changed", "nutrition/auth-required", "nutrition/forbidden"].includes(failure.code)) throw failure;
        // A lost prepare response may already have completed cutover. Only the
        // authenticated read endpoint may decide the authoritative source.
      }
      let cursor = "", state = {}, first = null;
      const loaded = [], missing = [];
      do {
        const result = await call({ action: "read", uid, mode, dayKeys, ...(cursor ? { cursor } : {}) });
        if (!isManifestCurrent(uid, result.manifest)) throw error("nutrition/stale-read");
        observed.set(uid, result.manifest);
        if (!first) first = result;
        else if (first.manifest.generation !== result.manifest.generation || first.manifest.revision !== result.manifest.revision) {
          throw error("nutrition/read-revision-changed");
        }
        state = mergeNutritionStates(state, result.state);
        loaded.push(...result.coverage.loadedDayKeys); missing.push(...result.coverage.missingDayKeys);
        cursor = result.coverage.nextCursor || "";
      } while (mode === "full" && cursor);
      if (!isManifestCurrent(uid, first.manifest)) throw error("nutrition/stale-read");
      const result = { manifest: first.manifest, state: { ...state, __uid: uid },
        coverage: { complete: first.coverage.complete || mode === "full", loadedDayKeys: [...new Set(loaded)],
          missingDayKeys: [...new Set(missing)], nextCursor: cursor || null } };
      const previous = resources.get(uid);
      resources.set(uid, { ...result, state: !result.coverage.complete && previous?.manifest.generation === result.manifest.generation
        && previous?.manifest.writerEpoch === result.manifest.writerEpoch
        ? mergeNutritionStates(previous.state, result.state) : result.state });
      if (listPending(uid).some(item => item.status === "rebase-required")) onPendingChange({ uid, status: "rebase-required" });
      return result;
    })();
    pending.set(key, operation);
    try { return await operation; } finally { if (pending.get(key) === operation) pending.delete(key); }
  }
  async function save(uid, snapshot, { planOnly = false, userPatch = {} } = {}) {
    const captured = current();
    const mutationKey = `${MUTATIONS_KEY}:${uid}`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nutritionStateFingerprint({ snapshot, userPatch })));
    if (!captured.isCurrent()) throw error("nutrition/session-changed");
    const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    const operationKey = `save:${uid}:${fingerprint}`;
    if (pending.has(operationKey)) return pending.get(operationKey);
    const operation = (async () => {
      let stored = readStorage(mutationKey, captured.uid, {});
      // Preserve all envelopes, including an older snapshot in flight.
      // A reload/upgrade resumes the same IDs; only exact successful envelopes
      // are removed. Epoch conflicts are left for explicit conflict resolution.
      let envelope = Object.values(stored).find(item => item.fingerprint === fingerprint);
      for (const prior of Object.values(stored)) {
        if (prior.id === envelope?.id) continue;
        const replayed = await replayEnvelope(uid, prior, resources.get(uid)?.state || {});
        resources.set(uid, { ...resources.get(uid), state: replayed });
        const remaining = { ...readStorage(mutationKey, captured.uid, {}) };
        delete remaining[prior.id];
        if (!writeStorage(mutationKey, captured.uid, remaining)) throw error("nutrition/pending-storage-failed");
      }
      if (!envelope) {
        const resource = resources.get(uid) || await read(uid, { mode: "days", dayKeys: [] });
        const keys = planOnly ? [] : Object.keys(snapshot.days || {}).filter(key =>
          nutritionStateFingerprint(mergeNutritionDay({}, snapshot.days[key]))
            !== nutritionStateFingerprint(resource.state.days?.[key] ? mergeNutritionDay({}, resource.state.days[key]) : null)).sort();
        const groups = keys.length ? Array.from({ length: Math.ceil(keys.length / 50) }, (_, index) => keys.slice(index * 50, index * 50 + 50)) : [[]];
        const meta = Object.fromEntries(Object.entries(snapshot).filter(([key]) => !["days", "__uid", "__nutritionStorage"].includes(key)));
        const metadata = planOnly ? Object.fromEntries(Object.entries(meta).filter(([key]) => ["goals", "nutritionPlan", "aiNutritionPlan", "updatedAt"].includes(key))) : meta;
        const sourceScope = snapshot.__nutritionStorage || (!planOnly && keys.length && resource.manifest.sourceOfTruth === "days"
          || !planOnly && keys.length && resource.manifest.resetAt ? { generation: "legacy", writerEpoch: 0 } : resource.manifest);
        envelope = { id: makeId(), fingerprint, generation: sourceScope.generation, writerEpoch: sourceScope.writerEpoch,
          chunks: groups.map(keys => ({ mutationId: makeId(), dayKeys: keys, userPatch, snapshot: { ...metadata,
            days: Object.fromEntries(keys.map(key => [key, snapshot.days[key]])) } })) };
        stored = { ...readStorage(mutationKey, captured.uid, {}), [envelope.id]: envelope };
        if (!captured.isCurrent()) throw error("nutrition/session-changed");
        if (!writeStorage(mutationKey, captured.uid, stored)) throw error("nutrition/pending-storage-failed");
        onPendingChange({ uid, status: "pending" });
      }
      let resultState = mergeNutritionStates(resources.get(uid)?.state || {}, snapshot);
      resultState = await replayEnvelope(uid, envelope, resultState);
      const remaining = { ...readStorage(mutationKey, captured.uid, {}) };
      delete remaining[envelope.id];
      if (!writeStorage(mutationKey, captured.uid, remaining)) throw error("nutrition/pending-storage-failed");
      const manifest = resources.get(uid).manifest;
      resultState = { ...resultState, __nutritionStorage: { generation: manifest.generation, writerEpoch: manifest.writerEpoch } };
      resources.set(uid, { ...resources.get(uid), state: resultState });
      onPendingChange({ uid, status: "changed" });
      return { ...resultState, __uid: uid };
    })();
    pending.set(operationKey, operation);
    try { return await operation; } finally { if (pending.get(operationKey) === operation) pending.delete(operationKey); }
  }
  async function clear(uid) {
    const captured = current(), key = `${MUTATIONS_KEY}:clear:${uid}`;
    let envelope = readStorage(key, captured.uid, null);
    if (!envelope) {
      const resource = await read(uid, { mode: "days", dayKeys: [] });
      envelope = { action: "clear", uid, protocolVersion: 2, mutationId: makeId(),
        generation: resource.manifest.generation, writerEpoch: resource.manifest.writerEpoch };
      if (!writeStorage(key, captured.uid, envelope)) throw error("nutrition/pending-storage-failed");
    }
    const result = await call(envelope);
    if (!isManifestCurrent(uid, result.manifest)) throw error("nutrition/stale-read");
    observed.set(uid, result.manifest);
    if (!writeStorage(key, captured.uid, null)) throw error("nutrition/pending-storage-failed");
    resources.delete(uid);
    return result;
  }
  function listPending(uid = activeAuth.currentUser?.uid) {
    const captured = current();
    return Object.values(readStorage(`${MUTATIONS_KEY}:${uid}`, captured.uid, {})).map(envelope => ({
      id: envelope.id, generation: envelope.generation, writerEpoch: envelope.writerEpoch,
      dayKeys: [...new Set(envelope.chunks.flatMap(chunk => chunk.dayKeys))],
      status: conflicts.has(uid) || resources.get(uid)?.manifest && (envelope.generation !== resources.get(uid).manifest.generation
        || envelope.writerEpoch !== resources.get(uid).manifest.writerEpoch) ? "rebase-required" : "pending"
    }));
  }
  async function rebase(uid, { confirmed = false } = {}) {
    if (!confirmed) throw error("nutrition/rebase-confirmation-required");
    const captured = current(), key = `${MUTATIONS_KEY}:${uid}`;
    const resource = await read(uid, { mode: "full", force: true });
    const originals = readStorage(key, captured.uid, {});
    const legacyQueue = captured.uid === uid ? readStorage(LEGACY_QUEUE_KEY, uid, null) : null;
    if (!Object.keys(originals).length && !legacyQueue?.nutrition) return { count: 0 };
    const archiveKey = `${MUTATIONS_KEY}:rebase-backups:${uid}`;
    const archive = readStorage(archiveKey, captured.uid, []);
    if (!writeStorage(archiveKey, captured.uid, [...archive, { createdAt: new Date().toISOString(), originals, legacyQueue }])) throw error("nutrition/pending-storage-failed");
    const rebased = Object.fromEntries(Object.values(originals).map(envelope => [envelope.id, { ...envelope,
      generation: resource.manifest.generation, writerEpoch: resource.manifest.writerEpoch,
      chunks: envelope.chunks.map(chunk => ({ ...chunk, mutationId: makeId() })) }]));
    if (!writeStorage(key, captured.uid, rebased)) throw error("nutrition/pending-storage-failed");
    if (legacyQueue?.nutrition && !writeStorage(LEGACY_QUEUE_KEY, uid, { ...legacyQueue, nutrition: { ...legacyQueue.nutrition,
      __nutritionStorage: { generation: resource.manifest.generation, writerEpoch: resource.manifest.writerEpoch } } })) throw error("nutrition/pending-storage-failed");
    conflicts.delete(uid);
    onPendingChange({ uid, status: "rebased" });
    return { count: Object.keys(rebased).length, manifest: resource.manifest };
  }
  return { read, save, clear, listPending, rebase, isManifestCurrent, prepare };
}

const service = createNutritionDayClient({ auth, onPendingChange: detail => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("nutrition-storage-pending", { detail }));
}, request: async body => {
  const response = await fetchAuthorizedWithTimeout("/api/nutrition/storage", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }, 30000);
  const result = await response.json();
  if (!response.ok) throw Object.assign(error(result.error || "nutrition/storage-failed"), { status: response.status });
  return result;
} });
export const readNutritionState = (...args) => service.read(...args);
export const saveNutritionDaySnapshot = (...args) => service.save(...args);
export const clearNutritionProgress = (...args) => service.clear(...args);
export const listPendingNutritionDayMutations = (...args) => service.listPending(...args);
export const rebasePendingNutritionDayMutations = (...args) => service.rebase(...args);
export const isNutritionManifestCurrent = (...args) => service.isManifestCurrent(...args);
export const prepareNutritionDayStorage = (...args) => service.prepare(...args);

import { createHash } from "node:crypto";
import { mergeNutritionStates } from "./nutritionMergeModel.js";

export const NUTRITION_STORAGE_PROTOCOL = 2;
const MAX_DOCUMENT_BYTES = 750 * 1024;
const META_FIELDS = new Set(["goals", "nutritionPlan", "aiNutritionPlan", "favorites", "recent", "favoriteChanges", "deletedMyFoods", "updatedAt"]);
const PLAN_FIELDS = new Set(["goals", "nutritionPlan", "aiNutritionPlan", "updatedAt"]);
const USER_PLAN_FIELDS = new Set(["nutritionGoals", "nutritionPlan", "nutritionPlanUpdatedAt", "aiNutritionPlan", "updatedAt"]);
const USER_OWNER_FIELDS = new Set([...USER_PLAN_FIELDS, "name", "profile", "aiNutritionProfile", "measurementWeightUpdatedAt", "firstSetupCompleted", "firstSetupCompletedVersion", "firstSetupCompletedAt"]);
const AI_PLAN_FIELDS = new Set(["id", "version", "createdAt", "calorieAnchor", "personalMaintenance", "personalBmr", "activityLabel", "profile", "goalLabel", "start", "weeks", "baseline", "frequentFoods", "workoutsCount", "weightTrend", "warnings", "comment"]);
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash("sha256").update(canonical(value)).digest("hex");
const data = snap => snap.exists ? snap.data() : {};
function assertBudget(value) {
  if (Buffer.byteLength(JSON.stringify(value)) >= MAX_DOCUMENT_BYTES) fail(413, "nutrition/document-too-large");
}
function dayKeys(value = [], maximum = 100) {
  if (!Array.isArray(value) || value.length > maximum) fail(400, "nutrition/invalid-day-keys");
  const result = [...new Set(value)];
  if (result.some(key => typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)
    || !Number.isFinite(Date.parse(`${key}T00:00:00Z`)) || new Date(`${key}T00:00:00Z`).toISOString().slice(0, 10) !== key)) {
    fail(400, "nutrition/invalid-day-key");
  }
  return result.sort();
}
function metadata(state = {}, writable = false) {
  return Object.fromEntries(Object.entries(state).filter(([key]) => writable ? META_FIELDS.has(key)
    : !["days", "myFoods", "__uid", "__nutritionStorage"].includes(key)));
}
function validTrainerAiPlan(plan) {
  const week = value => value && typeof value === "object" && !Array.isArray(value)
    && Number.isInteger(value.week) && value.week >= 1 && value.week <= 4
    && ["calories", "protein", "fat", "carbs"].every(key => typeof value[key] === "number" && Number.isFinite(value[key])
      && value[key] >= (key === "calories" ? Number.MIN_VALUE : 0) && value[key] <= ({ calories: 20000, protein: 3000, fat: 3000, carbs: 5000 })[key]);
  return plan && typeof plan === "object" && !Array.isArray(plan) && Object.keys(plan).every(key => AI_PLAN_FIELDS.has(key))
    && typeof plan.id === "string" && plan.id.length > 0 && plan.id.length <= 120 && plan.version === 1
    && typeof plan.createdAt === "string" && plan.profile && typeof plan.profile === "object" && !Array.isArray(plan.profile)
    && week(plan.start) && Array.isArray(plan.weeks) && plan.weeks.length === 4 && plan.weeks.every(week);
}
function canonicalUserPatch(patch, user, merged) {
  const next = { ...patch };
  if (patch.profile && Date.parse(patch.profile.updatedAt || 0) < Date.parse(user.profile?.updatedAt || 0)) {
    for (const key of ["name", "profile", "aiNutritionProfile", "measurementWeightUpdatedAt"]) delete next[key];
  }
  if (Object.hasOwn(patch, "nutritionGoals")) next.nutritionGoals = merged.goals;
  if (Object.hasOwn(patch, "nutritionPlan")) next.nutritionPlan = merged.nutritionPlan;
  if (Object.hasOwn(patch, "aiNutritionPlan")) next.aiNutritionPlan = merged.aiNutritionPlan;
  if (Object.hasOwn(patch, "nutritionPlanUpdatedAt")) next.nutritionPlanUpdatedAt = merged.nutritionPlan?.updatedAt || patch.nutritionPlanUpdatedAt;
  if (Date.parse(user.updatedAt || 0) > Date.parse(next.updatedAt || 0)) next.updatedAt = user.updatedAt;
  return next;
}
const initialManifest = () => ({ schemaVersion: 2, sourceOfTruth: "legacy", generation: "legacy", writerEpoch: 0, revision: 0 });
const validateUid = uid => { if (typeof uid !== "string" || !uid || uid.includes("/")) fail(400, "nutrition/invalid-uid"); };

// HTTP authentication/App Check belong to the caller. authorize is mandatory
// for cross-user access and returns 'read', 'plan', or 'admin' permissions.
// No client-controlled flag can authorize cutover or broad trainer writes.
export function createNutritionDayStorage({ db, authorize = async () => false, canCutover = async () => false,
  validateTransactionAccess = async () => true,
  makeGeneration = () => `g_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` } = {}) {
  const refs = uid => ({ manifest: db.doc(`users/${uid}/nutrition/manifest`), legacy: db.doc(`users/${uid}/nutrition/state`),
    personal: db.doc(`users/${uid}/nutrition/myFoods`), generations: db.collection(`users/${uid}/nutritionGenerations`) });
  async function access(actorUid, uid, action) {
    validateUid(actorUid); validateUid(uid);
    if (actorUid === uid) return "owner";
    const permission = await authorize({ actorUid, uid, action });
    if (!permission) fail(403, "nutrition/forbidden");
    if (action !== "read" && !["plan", "admin"].includes(permission)) fail(403, "nutrition/forbidden");
    if (["migrate", "cutover", "clear"].includes(action) && permission !== "admin") fail(403, "nutrition/forbidden");
    return permission;
  }
  async function read({ actorUid, uid = actorUid, mode = "days", dayKeys: requested = [], cursor = "", limit = 100 }) {
    const permission = await access(actorUid, uid, "read");
    const keys = dayKeys(requested);
    if (!["days", "full"].includes(mode)) fail(400, "nutrition/invalid-read-mode");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, "nutrition/invalid-page-size");
    if (cursor) dayKeys([cursor]);
    const r = refs(uid);
    return db.runTransaction(async tx => {
      if (await validateTransactionAccess({ tx, actorUid, uid, action: "read", permission }) !== true) fail(403, "nutrition/forbidden");
      const manifest = { ...initialManifest(), ...data(await tx.get(r.manifest)) };
      const personal = data(await tx.get(r.personal));
      if (manifest.sourceOfTruth === "legacy") {
        const state = { ...mergeNutritionStates({}, data(await tx.get(r.legacy)), personal.myFoods, personal.deletedMyFoods), __uid: uid };
        return { manifest, state, coverage: { complete: true, loadedDayKeys: Object.keys(state.days), missingDayKeys: [], nextCursor: null } };
      }
      const generation = r.generations.doc(manifest.generation);
      const generationData = data(await tx.get(generation));
      if (!generationData.metadata) fail(409, "nutrition/generation-incomplete");
      let documents;
      let nextCursor = null;
      if (mode === "full") {
        let query = generation.collection("days").orderBy("__name__").limit(limit + 1);
        if (cursor) query = query.startAfter(cursor);
        const page = await tx.get(query);
        documents = page.docs.slice(0, limit);
        if (page.docs.length > limit) nextCursor = documents.at(-1).id;
      } else {
        documents = await Promise.all(keys.map(key => tx.get(generation.collection("days").doc(key))));
      }
      const days = Object.fromEntries(documents.filter(snap => snap.exists).map(snap => [snap.id, snap.data().day]));
      return { manifest, state: { ...mergeNutritionStates({}, { ...generationData.metadata, days }, personal.myFoods, personal.deletedMyFoods), __uid: uid },
        coverage: { complete: mode === "full" && !cursor && !nextCursor, loadedDayKeys: Object.keys(days),
          missingDayKeys: mode === "days" ? keys.filter(key => !Object.hasOwn(days, key)) : [], nextCursor } };
    });
  }
  async function commit({ actorUid, uid = actorUid, protocolVersion, mutationId, generation, writerEpoch, snapshot = {}, userPatch = {}, dayKeys: requested = [] }) {
    const permission = await access(actorUid, uid, "commit");
    if (protocolVersion !== 2) fail(426, "nutrition/upgrade-required");
    if (typeof mutationId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(mutationId)) fail(400, "nutrition/invalid-mutation-id");
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) fail(400, "nutrition/invalid-snapshot");
    const keys = dayKeys(requested, 50);
    if (Object.keys(snapshot.days || {}).some(key => !keys.includes(key)) || keys.some(key => !snapshot.days?.[key])) fail(400, "nutrition/partial-day-keys-mismatch");
    const patch = metadata(snapshot, true);
    const allowedUserFields = permission === "owner" ? USER_OWNER_FIELDS : USER_PLAN_FIELDS;
    if (!userPatch || typeof userPatch !== "object" || Array.isArray(userPatch)
      || Object.keys(userPatch).some(key => !allowedUserFields.has(key))) fail(403, "nutrition/invalid-user-patch");
    assertBudget(userPatch);
    if (permission === "plan" && [snapshot, userPatch].some(value => Object.hasOwn(value, "aiNutritionPlan") && !validTrainerAiPlan(value.aiNutritionPlan))) fail(400, "nutrition/invalid-ai-plan");
    if (permission === "plan" && (keys.length || snapshot.myFoods || Object.keys(patch).some(key => !PLAN_FIELDS.has(key)))) fail(403, "nutrition/plan-patch-only");
    const r = refs(uid), receipt = db.doc(`users/${uid}/nutritionMutationReceipts/${mutationId}`);
    const payloadHash = hash({ snapshot, keys, userPatch });
    return db.runTransaction(async tx => {
      if (await validateTransactionAccess({ tx, actorUid, uid, action: "commit", permission }) !== true) fail(403, "nutrition/forbidden");
      const manifest = { ...initialManifest(), ...data(await tx.get(r.manifest)) };
      const prior = data(await tx.get(receipt));
      if (prior.action) fail(409, "nutrition/mutation-id-reused");
      if (prior.payloadHash && prior.payloadHash !== payloadHash) fail(409, "nutrition/mutation-id-reused");
      if (prior.payloadHash && (manifest.resetEpoch !== undefined ? (prior.writerEpoch ?? -1) < manifest.resetEpoch
        : manifest.resetAt && Date.parse(prior.createdAt) <= Date.parse(manifest.resetAt))) fail(409, "nutrition/generation-changed");
      if ((manifest.sourceOfTruth === "days" || manifest.writerEpoch > 0) && !prior.payloadHash
        && (generation !== manifest.generation || writerEpoch !== manifest.writerEpoch)) fail(409, "nutrition/generation-changed");
      const personal = data(await tx.get(r.personal));
      const user = Object.keys(userPatch).length ? data(await tx.get(db.doc(`users/${uid}`))) : {};
      const gen = r.generations.doc(manifest.generation);
      const storedGeneration = manifest.sourceOfTruth === "days" ? data(await tx.get(gen)) : null;
      if (storedGeneration && !storedGeneration.metadata) fail(409, "nutrition/generation-incomplete");
      const stored = manifest.sourceOfTruth === "legacy" ? data(await tx.get(r.legacy)) : storedGeneration.metadata;
      const storedDays = manifest.sourceOfTruth === "days"
        ? Object.fromEntries(await Promise.all(keys.map(async key => [key, data(await tx.get(gen.collection("days").doc(key))).day]))) : stored.days || {};
      for (const key of Object.keys(storedDays)) if (!storedDays[key]) delete storedDays[key];
      const merged = { ...mergeNutritionStates(prior.payloadHash ? {} : { ...patch, days: snapshot.days || {}, ...(snapshot.myFoods ? { myFoods: snapshot.myFoods } : {}) },
        { ...stored, days: storedDays }, personal.myFoods, personal.deletedMyFoods), __uid: uid };
      if (!prior.payloadHash) {
        const revision = manifest.revision + 1;
        const nextPersonal = { ...personal, myFoods: merged.myFoods, deletedMyFoods: merged.deletedMyFoods, ownerUid: uid, updatedAt: merged.updatedAt || "" };
        assertBudget(nextPersonal);
        if (manifest.sourceOfTruth === "legacy") {
          const legacy = { ...merged }; delete legacy.myFoods; assertBudget(legacy); tx.set(r.legacy, legacy);
        } else {
          const nextMetadata = metadata(merged); assertBudget(nextMetadata);
          tx.set(gen, { metadata: nextMetadata }, { merge: true });
          for (const key of keys) {
            const day = { dayKey: key, revision, day: merged.days[key] }; assertBudget(day);
            tx.set(gen.collection("days").doc(key), day);
          }
        }
        tx.set(r.personal, nextPersonal);
        if (Object.keys(userPatch).length) tx.set(db.doc(`users/${uid}`), canonicalUserPatch(userPatch, user, merged), { merge: true });
        tx.set(r.manifest, { ...manifest, revision });
        tx.set(receipt, { payloadHash, generation: manifest.generation, writerEpoch: manifest.writerEpoch, committedRevision: revision, createdAt: new Date().toISOString() });
        return { manifest: { ...manifest, revision }, state: merged, committedRevision: revision, mutationId, duplicate: false };
      }
      return { manifest, state: merged, committedRevision: prior.committedRevision, mutationId, duplicate: true };
    });
  }
  async function migrate({ actorUid, uid = actorUid }) {
    const permission = await access(actorUid, uid, "migrate");
    const r = refs(uid), candidate = makeGeneration();
    if (!/^[a-zA-Z0-9_-]+$/.test(candidate)) fail(500, "nutrition/invalid-generation");
    return db.runTransaction(async tx => {
      if (await validateTransactionAccess({ tx, actorUid, uid, action: "migrate", permission }) !== true) fail(403, "nutrition/forbidden");
      const manifest = { ...initialManifest(), ...data(await tx.get(r.manifest)) };
      if (manifest.sourceOfTruth === "days") return manifest;
      const personal = data(await tx.get(r.personal));
      const state = mergeNutritionStates({}, data(await tx.get(r.legacy)), personal.myFoods, personal.deletedMyFoods);
      const legacyHash = hash(state);
      const previous = manifest.migration;
      const migration = previous?.legacyHash === legacyHash ? previous : { generation: candidate, legacyHash, cursor: "", complete: false };
      const keys = dayKeys(Object.keys(state.days), Number.MAX_SAFE_INTEGER).filter(key => key > migration.cursor);
      const batch = keys.slice(0, 100), gen = r.generations.doc(migration.generation);
      const nextMetadata = metadata(state); assertBudget(nextMetadata);
      for (const key of batch) { const envelope = { dayKey: key, revision: 0, day: state.days[key] }; assertBudget(envelope); tx.set(gen.collection("days").doc(key), envelope); }
      tx.set(gen, { metadata: nextMetadata, legacyHash });
      const next = { ...manifest, migration: { ...migration, cursor: batch.at(-1) || migration.cursor, complete: keys.length <= 100 } };
      tx.set(r.manifest, next);
      return next;
    });
  }
  async function cutover({ actorUid, uid = actorUid }) {
    const permission = await access(actorUid, uid, "cutover");
    if (!await canCutover({ actorUid, uid })) fail(409, "nutrition/writer-fence-not-ready");
    const r = refs(uid);
    return db.runTransaction(async tx => {
      if (await validateTransactionAccess({ tx, actorUid, uid, action: "cutover", permission }) !== true) fail(403, "nutrition/forbidden");
      const manifest = { ...initialManifest(), ...data(await tx.get(r.manifest)) };
      if (manifest.sourceOfTruth === "days") return manifest;
      const personal = data(await tx.get(r.personal));
      const state = mergeNutritionStates({}, data(await tx.get(r.legacy)), personal.myFoods, personal.deletedMyFoods);
      if (!manifest.migration?.complete || manifest.migration.legacyHash !== hash(state)) fail(409, "nutrition/migration-stale");
      const next = { ...manifest, sourceOfTruth: "days", generation: manifest.migration.generation,
        writerEpoch: manifest.writerEpoch + 1, revision: manifest.revision + 1 };
      tx.set(r.manifest, next);
      return next;
    });
  }
  async function clear({ actorUid, uid = actorUid, protocolVersion, mutationId, writerEpoch, generation }) {
    const permission = await access(actorUid, uid, "clear");
    if (protocolVersion !== 2 || typeof mutationId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(mutationId)) fail(400, "nutrition/invalid-clear");
    const r = refs(uid), nextGeneration = makeGeneration();
    const receipt = db.doc(`users/${uid}/nutritionMutationReceipts/${mutationId}`);
    return db.runTransaction(async tx => {
      if (await validateTransactionAccess({ tx, actorUid, uid, action: "clear", permission }) !== true) fail(403, "nutrition/forbidden");
      const manifest = { ...initialManifest(), ...data(await tx.get(r.manifest)) };
      const prior = data(await tx.get(receipt));
      if (prior.action && prior.action !== "clear") fail(409, "nutrition/mutation-id-reused");
      if (prior.action === "clear") return { manifest, duplicate: true };
      if (generation !== manifest.generation || writerEpoch !== manifest.writerEpoch) fail(409, "nutrition/generation-changed");
      const state = manifest.sourceOfTruth === "legacy" ? data(await tx.get(r.legacy))
        : data(await tx.get(r.generations.doc(manifest.generation))).metadata;
      if (!state) fail(409, "nutrition/generation-incomplete");
      const updatedAt = new Date().toISOString();
      let next = { ...manifest, revision: manifest.revision + 1, writerEpoch: manifest.writerEpoch + 1, resetEpoch: manifest.writerEpoch + 1, resetAt: updatedAt };
      // Reset is an explicit generation boundary. Old pending envelopes remain
      // on the device and are rejected, never silently acknowledged/rebased.
      if (manifest.sourceOfTruth === "legacy") {
        tx.set(r.legacy, { ...state, days: {}, updatedAt });
        next = { ...next, migration: null };
      } else {
        tx.set(r.generations.doc(nextGeneration), { metadata: { ...metadata(state), updatedAt } });
        next = { ...next, generation: nextGeneration };
      }
      tx.set(r.manifest, next);
      tx.set(receipt, { action: "clear", committedRevision: next.revision, createdAt: updatedAt });
      tx.set(db.doc(`users/${uid}`), { nutritionState: { ...metadata(state), days: {}, updatedAt } }, { merge: true });
      return { manifest: next, duplicate: false };
    });
  }
  async function prepare({ actorUid, uid = actorUid }) {
    validateUid(actorUid); validateUid(uid);
    if (uid !== actorUid) fail(403, "nutrition/prepare-owner-only");
    if (!await canCutover({ actorUid, uid })) {
      const r = refs(uid);
      const manifest = await db.runTransaction(async tx => {
        if (await validateTransactionAccess({ tx, actorUid, uid, action: "read", permission: "owner" }) !== true) fail(403, "nutrition/forbidden");
        return { ...initialManifest(), ...data(await tx.get(r.manifest)) };
      });
      return { prepared: manifest.sourceOfTruth === "days", reason: "compatibility", manifest };
    }
    let manifest;
    for (let page = 0; page < 5; page++) {
      manifest = await migrate({ actorUid, uid });
      if (manifest.sourceOfTruth === "days") return { prepared: true, reason: null, manifest };
      if (manifest.migration?.complete) {
        try { return { prepared: true, reason: null, manifest: await cutover({ actorUid, uid }) }; }
        catch (failure) {
          if (!["nutrition/migration-stale", "nutrition/writer-fence-not-ready"].includes(failure.code)) throw failure;
          return { prepared: false, reason: "stale", manifest };
        }
      }
    }
    return { prepared: false, reason: "more-pages", manifest };
  }
  const actions = { read, commit, migrate, cutover, clear, prepare };
  async function handle(actorUid, body = {}) {
    if (!Object.hasOwn(actions, body.action)) fail(400, "nutrition/unknown-action");
    return actions[body.action]({ ...body, actorUid });
  }
  return { ...actions, handle };
}

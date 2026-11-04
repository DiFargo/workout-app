import assert from "node:assert/strict";
import test from "node:test";
import { createNutritionDayStorage } from "../functions/nutritionDayStorage.js";
import { mergeNutritionStates, stampNutritionDayChange } from "../functions/nutritionMergeModel.js";

function memoryDb() {
  const values = new Map(); let writes = 0;
  const ref = (path, query = null) => ({ path, query, id: path.split("/").at(-1), doc: id => ref(`${path}/${id}`),
    collection: name => ref(`${path}/${name}`), orderBy: () => ref(path, { ...query }),
    limit: count => ref(path, { ...query, count }), startAfter: cursor => ref(path, { ...query, cursor }) });
  const snap = r => ({ id: r.id, exists: values.has(r.path), data: () => structuredClone(values.get(r.path)) });
  return { values, get writes() { return writes; }, doc: ref, collection: ref,
    async runTransaction(callback) {
      const pending = []; let wrote = false;
      const result = await callback({ get: async r => {
        assert.equal(wrote, false, "Firestore: чтения должны предшествовать записям");
        if (!r.query) return snap(r);
        const paths = [...values.keys()].filter(path => path.startsWith(`${r.path}/`) && path.split("/").length === r.path.split("/").length + 1)
          .sort().filter(path => path.split("/").at(-1) > (r.query.cursor || "")).slice(0, r.query.count);
        return { docs: paths.map(path => snap(ref(path))) };
      }, set: (r, value, options) => { wrote = true; pending.push([r.path, value, options]); } });
      for (const [path, value, options] of pending) { values.set(path, structuredClone(options?.merge ? { ...values.get(path), ...value } : value)); writes++; }
      return result;
    } };
}
const at = "2026-10-25T10:00:00Z", dayKey = "2026-10-25";
const day = () => ({ updatedAt: at, foods: [{ id: "portion", calories: 100, updatedAt: at }], water: 1000 });
const commit = (snapshot, extra = {}) => ({ actorUid: "owner", uid: "owner", protocolVersion: 2, mutationId: "mutation_0001",
  generation: "legacy", writerEpoch: 0, dayKeys: Object.keys(snapshot.days || {}), snapshot, ...extra });
function fixture(options = {}) {
  const db = memoryDb(); let generation = 0;
  db.values.set("users/owner/nutrition/state", { ...mergeNutritionStates({}, { updatedAt: at, days: { [dayKey]: day() } }), __uid: "owner" });
  const service = createNutritionDayStorage({ db, makeGeneration: () => `gen_${++generation}`, ...options });
  return { db, service };
}

test("legacy compatibility: merge удалений, idempotent receipt и атомарный profile patch", async () => {
  const { db, service } = fixture();
  const nextAt = "2026-10-25T10:01:00Z";
  const changed = stampNutritionDayChange(day(), { ...day(), foods: [], water: 2200 }, nextAt);
  const request = commit({ updatedAt: nextAt, days: { [dayKey]: changed } }, { userPatch: { name: "Тест" } });
  const saved = await service.commit(request); const writes = db.writes;
  assert.equal(saved.state.days[dayKey].foods.length, 0);
  assert.ok(saved.state.days[dayKey].deletedFoods.portion);
  assert.equal(db.values.get("users/owner").name, "Тест");
  assert.equal((await service.commit(request)).duplicate, true);
  assert.equal(db.writes, writes);
  await assert.rejects(service.commit({ ...request, snapshot: { ...request.snapshot, updatedAt: "2026-10-25T10:02:00Z" } }), { code: "nutrition/mutation-id-reused" });
});

test("365 synthetic дней: bounded backfill, запрет stale cutover и selected-day coverage", async () => {
  const { db, service } = fixture({ canCutover: async () => true });
  const days = Object.fromEntries(Array.from({ length: 365 }, (_, index) => [new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10), day()]));
  db.values.set("users/owner/nutrition/state", { ...mergeNutritionStates({}, { days, updatedAt: at }), __uid: "owner" });
  for (let page = 0; page < 4; page++) {
    const before = db.writes, manifest = await service.migrate({ actorUid: "owner" });
    assert.ok(db.writes - before <= 102); assert.equal(manifest.migration.complete, page === 3);
  }
  db.values.get("users/owner/nutrition/state").updatedAt = "2026-10-25T10:01:00Z";
  await assert.rejects(service.cutover({ actorUid: "owner" }), { code: "nutrition/migration-stale" });
  for (let page = 0; page < 4; page++) await service.migrate({ actorUid: "owner" });
  const manifest = await service.cutover({ actorUid: "owner" });
  assert.equal(manifest.sourceOfTruth, "days"); assert.equal(manifest.writerEpoch, 1);
  const selected = await service.read({ actorUid: "owner", dayKeys: ["2025-01-01", "2026-10-25"] });
  assert.equal(selected.coverage.complete, false); assert.deepEqual(Object.keys(selected.state.days), ["2025-01-01"]);
  assert.deepEqual(selected.coverage.missingDayKeys, ["2026-10-25"]);
  let cursor = "", count = 0;
  do { const result = await service.read({ actorUid: "owner", mode: "full", cursor }); count += Object.keys(result.state.days).length; cursor = result.coverage.nextCursor; } while (cursor);
  assert.equal(count, 365);
  await assert.rejects(service.commit(commit({ days: { [dayKey]: day() } })), { code: "nutrition/generation-changed" });
});

test("days writer сохраняет unloaded дни, trainer только plan, чужой пользователь закрыт", async () => {
  const { db, service } = fixture({ authorize: async ({ actorUid }) => actorUid === "trainer" ? "plan" : false, canCutover: async () => true });
  await service.migrate({ actorUid: "owner" }); const manifest = await service.cutover({ actorUid: "owner" });
  await service.commit(commit({ goals: { calories: 2000 }, updatedAt: "2026-10-25T11:00:00Z" }, {
    actorUid: "trainer", generation: manifest.generation, writerEpoch: manifest.writerEpoch,
    userPatch: { nutritionGoals: { calories: 2000 } } }));
  assert.equal((await service.read({ actorUid: "owner", dayKeys: [dayKey] })).state.days[dayKey].water, 1000);
  await assert.rejects(service.commit(commit({ days: { [dayKey]: day() } }, { actorUid: "trainer", mutationId: "mutation_0002" })), { code: "nutrition/plan-patch-only" });
  await assert.rejects(service.read({ actorUid: "stranger", uid: "owner" }), { code: "nutrition/forbidden" });
  await assert.rejects(service.commit(commit({ aiNutritionPlan: { version: 1 } }, { actorUid: "trainer", mutationId: "mutation_0003" })), { code: "nutrition/invalid-ai-plan" });
  await assert.rejects(service.commit(commit({ goals: { calories: 2000 } }, { actorUid: "trainer", mutationId: "mutation_0004", userPatch: { role: "admin" } })), { code: "nutrition/invalid-user-patch" });
  assert.equal(db.values.get("users/owner").nutritionGoals.calories, 2000);
});

test("cutover требует server fence; reset сохраняет конфликт старой pending revision", async () => {
  const { service } = fixture();
  await service.migrate({ actorUid: "owner" });
  await assert.rejects(service.cutover({ actorUid: "owner" }), { code: "nutrition/writer-fence-not-ready" });
  await service.clear({ actorUid: "owner", protocolVersion: 2, mutationId: "clear_00001", generation: "legacy", writerEpoch: 0 });
  assert.deepEqual((await service.read({ actorUid: "owner", mode: "full" })).state.days, {});
  await assert.rejects(service.commit(commit({ days: { [dayKey]: day() } })), { code: "nutrition/generation-changed" });
});

test("partial не становится full replacement; invalid/oversized запрос не оставляет ни одного write", async () => {
  const { db, service } = fixture(); const before = db.writes;
  await assert.rejects(service.commit(commit({ days: { [dayKey]: day() } }, { dayKeys: [] })), { code: "nutrition/partial-day-keys-mismatch" });
  await assert.rejects(service.commit(commit({ days: {}, aiNutritionPlan: { text: "x".repeat(800 * 1024) } })), { code: "nutrition/document-too-large" });
  await assert.rejects(service.read({ actorUid: "owner", dayKeys: ["2026-02-30"] }), { code: "nutrition/invalid-day-key" });
  assert.equal(db.writes, before);
});

test("старый receipt после cutover подтверждается без reapply, после reset остаётся конфликтом", async () => {
  const { db, service } = fixture({ canCutover: async () => true });
  const original = commit({ updatedAt: at, days: { [dayKey]: day() } });
  await service.commit(original); await service.migrate({ actorUid: "owner" });
  const manifest = await service.cutover({ actorUid: "owner" });
  const later = stampNutritionDayChange(day(), { ...day(), foods: [], water: 2300 }, "2026-10-26T00:00:00Z");
  await service.commit(commit({ updatedAt: later.updatedAt, days: { [dayKey]: later } }, { mutationId: "mutation_0002", generation: manifest.generation, writerEpoch: manifest.writerEpoch }));
  const writes = db.writes, duplicate = await service.commit(original);
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.state.days[dayKey].water, 2300);
  assert.equal(duplicate.state.days[dayKey].foods.length, 0); assert.equal(db.writes, writes);
  await service.clear({ actorUid: "owner", protocolVersion: 2, mutationId: "clear_00001", generation: manifest.generation, writerEpoch: manifest.writerEpoch });
  await assert.rejects(service.commit(original), { code: "nutrition/generation-changed" });
});

test("transaction access повторно проверяет отозванное назначение до любых nutrition writes", async () => {
  let checked = false;
  const { db, service } = fixture({ authorize: async () => "plan", validateTransactionAccess: async ({ tx, actorUid, uid, action, permission }) => {
    checked = true; assert.equal(actorUid, "trainer"); assert.equal(uid, "owner"); assert.equal(action, "commit"); assert.equal(permission, "plan");
    return (await tx.get(db.doc("users/owner"))).data()?.assignedTrainerId === actorUid;
  } });
  db.values.set("users/owner", { assignedTrainerId: "different-trainer" });
  const writes = db.writes;
  await assert.rejects(service.commit(commit({ goals: { calories: 2000 } }, { actorUid: "trainer" })), { code: "nutrition/forbidden" });
  assert.equal(checked, true); assert.equal(db.writes, writes);
});

test("owner prepare: flag false не пишет; 501 дней требуют двух bounded RPC, чужой prepare запрещён", async () => {
  const compat = fixture(); const untouched = compat.db.writes;
  assert.equal((await compat.service.prepare({ actorUid: "owner" })).reason, "compatibility");
  assert.equal(compat.db.writes, untouched);
  await assert.rejects(compat.service.prepare({ actorUid: "trainer", uid: "owner" }), { code: "nutrition/prepare-owner-only" });
  const { db, service } = fixture({ canCutover: async () => true });
  const days = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), day()]));
  db.values.set("users/owner/nutrition/state", { ...mergeNutritionStates({}, { updatedAt: at, days }), __uid: "owner" });
  const before = db.writes;
  const first = await service.prepare({ actorUid: "owner" });
  assert.equal(first.prepared, false); assert.equal(first.reason, "more-pages");
  assert.ok(db.writes - before <= 510); assert.equal(first.manifest.sourceOfTruth, "legacy");
  const second = await service.prepare({ actorUid: "owner" });
  assert.equal(second.prepared, true); assert.equal(second.manifest.sourceOfTruth, "days");
});

test("prepare source race оставляет legacy, а access revocation не подавляется", async () => {
  let calls = 0; let dbRef;
  const f = fixture({ canCutover: async () => {
    if (++calls === 2) dbRef.values.get("users/owner/nutrition/state").updatedAt = "2026-10-26T11:00:00Z";
    return true;
  } });
  dbRef = f.db;
  const result = await f.service.prepare({ actorUid: "owner" });
  assert.equal(result.prepared, false); assert.equal(result.reason, "stale"); assert.equal(result.manifest.sourceOfTruth, "legacy");
  const denied = fixture({ canCutover: async () => true, validateTransactionAccess: async () => false });
  await assert.rejects(denied.service.prepare({ actorUid: "owner" }), { code: "nutrition/forbidden" });
  assert.equal(denied.db.writes, 0);
});

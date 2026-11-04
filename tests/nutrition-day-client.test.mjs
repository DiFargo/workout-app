import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
const auth = { currentUser: { uid: "owner" } };
const cleanup = installRuntimeImports({ "/src/firebase.js": { auth, db: {} },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: async () => { throw new Error("network disabled in unit test"); } } });
after(cleanup);
const { createNutritionDayClient } = await import("../src/utils/nutritionDayClient.js");
const { advanceAuthSession } = await import("../src/utils/authSession.js");
const { mergeNutritionStates } = await import("../functions/nutritionMergeModel.js");
beforeEach(() => { auth.currentUser = { uid: "owner" }; advanceAuthSession(auth); });
const manifest = { sourceOfTruth: "days", generation: "gen_1", writerEpoch: 1, revision: 1 };
const snapshot = { updatedAt: "2026-10-25T10:00:00Z", __nutritionStorage: { generation: "gen_1", writerEpoch: 1 }, days: { "2026-10-25": { water: 2000 } } };
function fixture(request, storage = new Map()) {
  let id = 0;
  return { storage, client: createNutritionDayClient({ auth,
    request: body => body.action === "prepare" ? Promise.resolve({ prepared: false }) : request(body), makeId: () => `mutation_${++id}`,
    readStorage: (key, uid, fallback) => structuredClone(storage.get(`${key}:${uid}`) ?? fallback),
    writeStorage: (key, uid, value) => { storage.set(`${key}:${uid}`, structuredClone(value)); return true; } }) };
}
const readResult = (state = {}, coverage = {}) => ({ manifest, state: mergeNutritionStates({}, state),
  coverage: { complete: false, loadedDayKeys: [], missingDayKeys: [], nextCursor: null, ...coverage } });

test("потерянный ответ сохраняет durable IDs через reload; повтор не создаёт новую mutation", async () => {
  const ids = []; let fail = true;
  const request = async body => {
    if (body.action === "read") return readResult();
    ids.push(body.mutationId); if (fail) throw new Error("lost response");
    return { manifest, state: body.snapshot };
  };
  const first = fixture(request);
  await assert.rejects(first.client.save("owner", snapshot), /lost response/);
  assert.equal(Object.values(first.storage.values().next().value).length, 1);
  fail = false;
  const reload = fixture(request, first.storage);
  await reload.client.save("owner", snapshot);
  assert.equal(ids[0], ids[1]);
  assert.deepEqual(first.storage.values().next().value, {});
});

test("full-demand собирает все страницы; смена revision не выдаётся за complete", async () => {
  let changed = false;
  const { client } = fixture(async body => body.cursor
    ? { ...readResult({ days: { "2026-10-24": { water: 1000 } } }, { loadedDayKeys: ["2026-10-24"] }), manifest: { ...manifest, revision: changed ? 2 : 1 } }
    : readResult(snapshot, { loadedDayKeys: ["2026-10-25"], nextCursor: "2026-10-25" }));
  const full = await client.read("owner", { mode: "full" });
  assert.equal(full.coverage.complete, true); assert.equal(Object.keys(full.state.days).length, 2);
  changed = true;
  await assert.rejects(client.read("owner", { mode: "full" }), { code: "nutrition/read-revision-changed" });
});

test("частичный read не удаляет незагруженные дни; unchanged дни не отправляются повторно", async () => {
  let commits = 0; const sent = [];
  const { client } = fixture(async body => {
    if (body.action === "read") return readResult(snapshot, { loadedDayKeys: ["2026-10-25"] });
    commits++; sent.push(body.dayKeys); return { manifest, state: body.snapshot };
  });
  await client.read("owner", { mode: "days", dayKeys: ["2026-10-25"] });
  await client.save("owner", snapshot);
  assert.deepEqual(sent[0], []);
  const changed = { ...snapshot, days: { ...snapshot.days, "2026-10-24": { water: 1500 } } };
  await client.save("owner", changed);
  assert.deepEqual(sent[1], ["2026-10-24"]);
  assert.equal(commits, 2);
});

test("epoch conflict и смена auth не очищают pending; ошибка хранения запрещает cloud commit", async () => {
  const f = fixture(async body => {
    if (body.action === "read") return readResult();
    throw Object.assign(new Error("conflict"), { code: "nutrition/generation-changed" });
  });
  await assert.rejects(f.client.save("owner", snapshot), { code: "nutrition/rebase-required" });
  assert.equal(Object.values(f.storage.values().next().value).length, 1);
  let committed = false;
  const client = createNutritionDayClient({ auth, request: async body => { if (body.action === "prepare") return {}; if (body.action === "read") return readResult(); committed = true; },
    readStorage: (_key, _uid, fallback) => fallback, writeStorage: () => false, makeId: () => "mutation_00001" });
  await assert.rejects(client.save("owner", snapshot), { code: "nutrition/pending-storage-failed" });
  assert.equal(committed, false);
  let release;
  const slow = fixture(() => new Promise(resolve => { release = resolve; }));
  const reading = slow.client.read("owner");
  await new Promise(resolve => setImmediate(resolve));
  auth.currentUser = { uid: "other" };
  release(readResult());
  await assert.rejects(reading, { code: "nutrition/session-changed" });
});

test("upgrade full snapshot из 101 дня сохраняется bounded chunks, pending не исчезает при частичном сбое", async () => {
  const large = { ...snapshot, days: Object.fromEntries(Array.from({ length: 101 }, (_, index) =>
    [new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10), { foods: [], water: index }])) };
  const sent = []; let fail = true;
  const f = fixture(async body => {
    if (body.action === "read") return readResult();
    sent.push(body);
    if (sent.length === 2 && fail) throw new Error("offline mid-upgrade");
    return { manifest, state: body.snapshot };
  });
  await assert.rejects(f.client.save("owner", large), /offline mid-upgrade/);
  const envelope = Object.values(f.storage.values().next().value)[0];
  assert.equal(envelope.fingerprint.length, 64);
  assert.deepEqual(envelope.chunks.map(chunk => chunk.dayKeys.length), [50, 50, 1]);
  fail = false;
  await f.client.save("owner", large);
  assert.equal(sent[0].mutationId, sent[2].mutationId);
  assert.equal(sent[1].mutationId, sent[3].mutationId);
  assert.ok(sent.every(body => body.dayKeys.length <= 50));
  assert.deepEqual(f.storage.values().next().value, {});
});

test("clear повторяет тот же durable receipt после потерянного ответа", async () => {
  const ids = []; let fail = true;
  const f = fixture(async body => {
    if (body.action === "read") return readResult();
    ids.push(body.mutationId); if (fail) throw new Error("lost clear response");
    return { manifest };
  });
  await assert.rejects(f.client.clear("owner"), /lost clear response/);
  fail = false;
  await f.client.clear("owner");
  assert.equal(ids[0], ids[1]);
  assert.equal(f.storage.values().next().value, null);
});

test("новый fingerprint сначала завершает старый envelope, а rebase требует consent и сохраняет originals", async () => {
  let offline = true, conflict = false; const calls = [];
  const f = fixture(async body => {
    if (body.action === "read") return { ...readResult(), manifest: { ...manifest, writerEpoch: conflict ? 2 : 1 } };
    calls.push(body);
    if (offline) throw new Error("offline");
    if (conflict && body.writerEpoch === 1) throw Object.assign(new Error("old epoch"), { code: "nutrition/generation-changed" });
    return { manifest: { ...manifest, writerEpoch: conflict ? 2 : 1 }, state: body.snapshot };
  });
  await assert.rejects(f.client.save("owner", snapshot), /offline/);
  offline = false;
  const newer = { ...snapshot, updatedAt: "2026-10-25T11:00:00Z", days: { "2026-10-25": { water: 2300 } } };
  await f.client.save("owner", newer);
  assert.equal(calls[0].mutationId, calls[1].mutationId);
  assert.notEqual(calls[1].mutationId, calls[2].mutationId);
  assert.equal(f.client.listPending("owner").length, 0);
  offline = true;
  await assert.rejects(f.client.save("owner", snapshot), /offline/);
  offline = false; conflict = true;
  await assert.rejects(f.client.save("owner", newer), { code: "nutrition/rebase-required" });
  await assert.rejects(f.client.rebase("owner"), { code: "nutrition/rebase-confirmation-required" });
  const beforeId = calls.at(-1).mutationId;
  assert.equal((await f.client.rebase("owner", { confirmed: true })).count, 1);
  const backups = [...f.storage.entries()].find(([key]) => key.includes("rebase-backups"))[1];
  assert.equal(Object.values(backups[0].originals)[0].chunks[0].mutationId, beforeId);
  await f.client.save("owner", { ...newer, __nutritionStorage: { generation: manifest.generation, writerEpoch: 2 } });
  assert.equal(f.client.listPending("owner").length, 0);
});

test("UID monotonic barrier отклоняет поздний старый read другого диапазона", async () => {
  let release;
  const f = fixture(body => body.mode === "days" ? new Promise(resolve => { release = resolve; })
    : Promise.resolve({ ...readResult(), manifest: { ...manifest, writerEpoch: 2, revision: 2 } }));
  const slow = f.client.read("owner", { mode: "days", dayKeys: ["2026-10-25"] });
  await f.client.read("owner", { mode: "full", force: true });
  release(readResult());
  await assert.rejects(slow, { code: "nutrition/stale-read" });
  assert.equal(f.client.isManifestCurrent("owner", { ...manifest, writerEpoch: 2, revision: 2 }), true);
  assert.equal(f.client.isManifestCurrent("owner", manifest), false);
});

test("unscoped legacy pending после reset не получает новый epoch молча", async () => {
  const f = fixture(async body => {
    if (body.action === "read") return { ...readResult(), manifest: { ...manifest, sourceOfTruth: "legacy", generation: "legacy", resetAt: "2026-10-26T00:00:00Z" } };
    assert.equal(body.writerEpoch, 0); assert.equal(body.generation, "legacy");
    throw Object.assign(new Error("old writer"), { code: "nutrition/generation-changed" });
  });
  const legacy = { ...snapshot }; delete legacy.__nutritionStorage;
  await assert.rejects(f.client.save("owner", legacy), { code: "nutrition/rebase-required" });
  assert.equal(f.client.listPending("owner")[0].status, "rebase-required");
});

test("cross-generation duplicate ack не подмешивает старый snapshot в новую canonical state", async () => {
  let fail = true;
  const f = fixture(async body => {
    if (body.action === "read") return readResult();
    if (fail) throw new Error("lost response");
    return { manifest: { ...manifest, generation: "gen_2", writerEpoch: 2, revision: 5 }, duplicate: true,
      state: { updatedAt: "2026-10-26T00:00:00Z", days: {} } };
  });
  await assert.rejects(f.client.save("owner", snapshot), /lost response/);
  fail = false;
  const result = await f.client.save("owner", snapshot);
  assert.deepEqual(result.days, {});
  assert.equal(result.__nutritionStorage.writerEpoch, 2);
});

test("clear продвигает UID barrier раньше ответа старого параллельного read", async () => {
  let release;
  const f = fixture(async body => {
    if (body.action === "clear") return { manifest: { ...manifest, writerEpoch: 2, revision: 2 } };
    if (body.mode === "days" && body.dayKeys.length) return new Promise(resolve => { release = resolve; });
    return readResult();
  });
  await f.client.read("owner", { mode: "full" });
  const slow = f.client.read("owner", { mode: "days", dayKeys: ["2026-10-25"] });
  await f.client.clear("owner");
  release(readResult());
  await assert.rejects(slow, { code: "nutrition/stale-read" });
  assert.equal(f.client.isManifestCurrent("owner", manifest), false);
});

test("prepare singleflight один раз на auth session; отказ auth не маскируется compatibility read", async () => {
  let prepared = 0, reads = 0, denied = false;
  const client = createNutritionDayClient({ auth, request: async body => {
    if (body.action === "prepare") {
      prepared++; if (denied) throw Object.assign(new Error("forbidden"), { status: 403 });
      return { prepared: false, reason: "compatibility", manifest };
    }
    reads++; return readResult();
  } });
  await Promise.all([client.read("owner", { mode: "full" }), client.read("owner", { mode: "days", dayKeys: [] })]);
  await client.read("owner", { mode: "full" });
  assert.equal(prepared, 1); assert.equal(reads, 3);
  advanceAuthSession(auth); denied = true;
  await assert.rejects(client.read("owner"), { status: 403 });
  assert.equal(prepared, 2); assert.equal(reads, 3);
});

test("lost prepare response продолжает только authoritative read API, без legacy SDK fallback", async () => {
  const actions = [];
  const client = createNutritionDayClient({ auth, request: async body => {
    actions.push(body.action);
    if (body.action === "prepare") throw new Error("lost prepare response");
    return readResult();
  } });
  await client.read("owner"); await client.read("owner");
  assert.deepEqual(actions, ["prepare", "read", "read"]);
});

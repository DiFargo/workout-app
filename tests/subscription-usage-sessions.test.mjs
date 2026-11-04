import assert from "node:assert/strict";
import test from "node:test";
import { adjustSubscriptionUsageForHistoryEventWithLedger as adjust } from "../functions/subscriptionUsageLedger.js";

const CUTOVER = "2026-10-18T12:00:00.000Z";
const timestamp = iso => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });

function fixture({ periodMode = "sessions", historyCycle, usedSessions = 2,
  createdAt = "2026-10-18T12:01:00.000Z", boundary = "2026-10-18T10:00:00.000Z", baselineCycleId = "" } = {}) {
  const subscription = {
    ...(periodMode ? { periodMode } : {}), cycleId: "cycle-fixture",
    ...(boundary ? { cycleStartedAt: boundary } : {}),
    purchasedSessions: 12, usedSessions, remainingSessions: 12 - usedSessions,
    startDate: "2099-01-01", endDate: "2099-01-31", history: [{ type: "renewal", previousRemainingSessions: 1 }]
  };
  const history = { date: "2026-10-17", ...(historyCycle ? { subscriptionCycleId: historyCycle } : {}) };
  const userRef = { path: "users/client-fixture", id: "client-fixture" };
  const historyRef = { path: `${userRef.path}/history/history-fixture`, id: "history-fixture" };
  const documents = new Map([[userRef.path, { subscription: structuredClone(subscription) }], [historyRef.path, structuredClone(history)]]);
  const createTime = timestamp(createdAt), writes = [];
  const db = {
    collection: name => ({ doc: id => ({ path: `${name}/${id}`, id }) }),
    runTransaction: async callback => {
      const staged = [];
      const result = await callback({
        get: async ref => ({ exists: documents.has(ref.path),
          data: () => structuredClone(documents.get(ref.path)),
          createTime: ref.path === historyRef.path ? createTime : undefined }),
        set: (ref, data, options) => staged.push({ path: ref.path, data: structuredClone(data), options })
      });
      for (const write of staged) {
        const previous = documents.get(write.path) || {};
        documents.set(write.path, write.options?.merge
          ? { ...previous, ...write.data, ...(write.data.subscription
            ? { subscription: { ...previous.subscription, ...write.data.subscription } } : {}) }
          : write.data);
        writes.push(write);
      }
      return result;
    }
  };
  const event = { id: "immutable-create-event", time: createdAt,
    params: { uid: userRef.id, historyId: historyRef.id },
    data: { id: historyRef.id, ref: historyRef, createTime, data: () => structuredClone(history) } };
  const deps = { db, FieldValue: { serverTimestamp: () => "synthetic-server-timestamp" },
    getResourceDateKey: value => String(value || "").slice(0, 10), cutoverTimestamp: CUTOVER, baselineCycleId };
  return { subscription, history, event, writes, documents, userRef, historyRef,
    saved: () => documents.get(userRef.path).subscription,
    invoke: (delta, occurrence = event, extra = {}) => adjust({ ...deps, ...extra, event: occurrence, delta }),
    remove: (deletedAt = "2026-10-18T13:00:00.000Z") => {
      documents.delete(historyRef.path);
      return { ...event, id: "immutable-delete-event", time: deletedAt };
    } };
}

test("sessions ledger charges once despite a stale future legacy start date and preserves subscription terms", async () => {
  const f = fixture(), historyBefore = structuredClone(f.history);
  await f.invoke(1);
  await f.invoke(1, { ...f.event, id: "duplicate-delivery" });
  const saved = f.saved();
  assert.equal(saved.usedSessions, 3);
  assert.equal(saved.remainingSessions, 9);
  for (const key of ["purchasedSessions", "periodMode", "cycleId", "startDate", "endDate"])
    assert.equal(saved[key], f.subscription[key], key);
  assert.deepEqual(saved.history, f.subscription.history);
  assert.deepEqual(f.documents.get(f.historyRef.path), historyBefore, "server ledger never overwrites owner history");
  assert.equal(f.writes.filter(write => write.path === f.userRef.path).length, 1);
  assert.equal(f.writes.filter(write => write.path.startsWith("subscriptionUsageLedger/")).length, 1);
});

test("legacy calendar accounting without a mode still ignores workouts before its start date", async () => {
  const f = fixture({ periodMode: null });
  assert.equal((await f.invoke(1)).appliedDelta, 0);
  assert.equal(f.saved().usedSessions, 2);
  assert.equal(f.writes.some(write => write.path === f.userRef.path), false);
  assert.equal(f.writes.length, 1, "non-charge is durably recorded to prevent replay into another cycle");
});

test("a post-cutover client-supplied current-cycle tag cannot bypass the one ledger charge", async () => {
  const f = fixture({ historyCycle: "cycle-fixture" });
  assert.equal((await f.invoke(1)).appliedDelta, 1);
  assert.equal((await f.invoke(1)).appliedDelta, 0);
  assert.equal(f.saved().usedSessions, 3);
});

test("pre-cutover tagged deletion refunds its frozen current-cycle baseline exactly once", async () => {
  const f = fixture({ historyCycle: "cycle-fixture", createdAt: "2026-10-18T11:00:00.000Z" });
  const deletion = f.remove();
  assert.equal((await f.invoke(-1, deletion)).appliedDelta, -1);
  assert.equal((await f.invoke(-1, deletion)).appliedDelta, 0);
  assert.equal(f.saved().usedSessions, 1);
  assert.equal(f.saved().remainingSessions, 11);
  assert.equal(f.saved().cycleId, f.subscription.cycleId);
  assert.deepEqual(f.saved().history, f.subscription.history);
  assert.equal(f.writes.filter(write => write.path === f.userRef.path).length, 1);
});

for (const historyCycle of ["previous-cycle", undefined]) {
  test(`legacy deletion outside current baseline does not refund (${historyCycle || "untagged"})`, async () => {
    const f = fixture({ historyCycle, createdAt: "2026-10-18T11:00:00.000Z" });
    const deletion = f.remove();
    assert.equal((await f.invoke(-1, deletion)).appliedDelta, 0);
    assert.equal(f.saved().usedSessions, 2);
    assert.equal(f.writes.some(write => write.path === f.userRef.path), false);
  });
}

test("current-cycle baseline deletion never makes usage negative or changes purchased balance", async () => {
  const f = fixture({ historyCycle: "cycle-fixture", usedSessions: 0, createdAt: "2026-10-18T11:00:00.000Z" });
  await f.invoke(-1, f.remove());
  assert.equal(f.saved().usedSessions, 0);
  assert.equal(f.saved().remainingSessions, 12);
  assert.equal(f.saved().purchasedSessions, 12);
});

test("existing named cycles without a trusted boundary fail closed instead of guessing from cutover", async () => {
  const f = fixture({ boundary: null });
  await assert.rejects(f.invoke(1), /cycleStartedAt\/lastRenewedAt/);
  assert.equal(f.writes.length, 0);
  assert.equal(f.saved().usedSessions, 2);
  f.documents.get(f.userRef.path).subscription.cycleStartedAt = "2026-10-18T10:00:00.000Z";
  assert.equal((await f.invoke(1)).appliedDelta, 1, "same immutable event is recoverable after authoritative repair");
  assert.equal((await f.invoke(1)).appliedDelta, 0);
});

test("pre-cutover create retry is grandfathered without recounting after rollout", async () => {
  for (const historyCycle of ["cycle-fixture", undefined]) {
    const f = fixture({ historyCycle, createdAt: "2026-10-18T11:00:00.000Z" });
    await f.invoke(1);
    await f.invoke(1, { ...f.event, time: "2026-10-19T12:00:00.000Z" });
    assert.equal(f.saved().usedSessions, 2);
    assert.equal(f.writes.some(write => write.path === f.userRef.path), false);
  }
});

test("pre-cutover deletion occurrence cannot be reinterpreted as a fresh refund by a late delivery", async () => {
  const f = fixture({ historyCycle: "cycle-fixture", createdAt: "2026-10-18T11:00:00.000Z" });
  const deletion = f.remove("2026-10-18T11:30:00.000Z");
  await f.invoke(-1, deletion);
  await f.invoke(-1, { ...deletion, id: "late-retry" });
  await f.invoke(1);
  assert.equal(f.saved().usedSessions, 2);
  assert.equal(f.writes.some(write => write.path === f.userRef.path), false);
});

test("cutover comparison uses immutable generation at the exact configured boundary", async () => {
  const f = fixture({ createdAt: CUTOVER, historyCycle: "cycle-fixture" });
  assert.equal((await f.invoke(1)).appliedDelta, 1);
  assert.equal(f.saved().usedSessions, 3);
  assert.equal((await f.invoke(-1, f.remove())).appliedDelta, -1);
  assert.equal(f.saved().usedSessions, 2);
});

test("registered initial cycle can activate ledger without inventing or writing its historical start", async () => {
  const f = fixture({ boundary: null, baselineCycleId: "cycle-fixture" });
  assert.equal((await f.invoke(1)).appliedDelta, 1);
  assert.equal((await f.invoke(1)).appliedDelta, 0);
  assert.equal(f.saved().usedSessions, 3);
  assert.equal(f.saved().cycleStartedAt, undefined);
  assert.equal(f.saved().lastRenewedAt, undefined);
  await f.invoke(-1, f.remove());
  assert.equal(f.saved().usedSessions, 2);
});

test("initial cycle exception is exact and never admits a later renamed cycle without boundary", async () => {
  const wrong = fixture({ boundary: null, baselineCycleId: "other-cycle" });
  await assert.rejects(wrong.invoke(1), /cycleStartedAt/);
  assert.equal(wrong.writes.length, 0);
  const renewed = fixture({ boundary: null, baselineCycleId: "cycle-fixture" });
  renewed.documents.get(renewed.userRef.path).subscription.cycleId = "new-named-cycle";
  await assert.rejects(renewed.invoke(1), /cycleStartedAt/);
  assert.equal(renewed.writes.length, 0);
});

test("registered initial cycle still grandfathers all pre-cutover generations without a new charge", async () => {
  for (const historyCycle of ["cycle-fixture", undefined]) {
    const f = fixture({ boundary: null, baselineCycleId: "cycle-fixture", createdAt: "2026-10-18T11:00:00.000Z", historyCycle });
    await f.invoke(1);
    await f.invoke(1);
    assert.equal(f.saved().usedSessions, 2);
    assert.equal((await f.invoke(-1, f.remove())).appliedDelta, historyCycle ? -1 : 0);
    assert.equal((await f.invoke(-1, f.remove())).appliedDelta, 0);
  }
});

test("ledger production config read is transactional and rejects unready or moved activation state", async () => {
  const f = fixture();
  const accountingConfigRef = { path: "serverConfig/subscriptionAccounting" };
  const valid = { schemaVersion: 1, baselineReady: true, paused: false, cutoverTimestamp: CUTOVER };
  for (const patch of [{ paused: true }, { baselineReady: false }, { schemaVersion: 2 },
    { cutoverTimestamp: "2026-10-18T11:00:00.000Z" }, { baselineCycleIds: { "client-fixture": "unexpected" } }]) {
    f.documents.set(accountingConfigRef.path, { ...valid, ...patch });
    await assert.rejects(f.invoke(1, f.event, { accountingConfigRef }), /config changed or paused/);
    assert.equal(f.writes.length, 0);
  }
  f.documents.set(accountingConfigRef.path, valid);
  assert.equal((await f.invoke(1, f.event, { accountingConfigRef })).appliedDelta, 1);
  assert.equal((await f.invoke(1, f.event, { accountingConfigRef })).appliedDelta, 0);
  assert.equal(f.saved().usedSessions, 3);
});

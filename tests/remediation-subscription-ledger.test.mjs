import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { adjustSubscriptionUsageForHistoryEventWithLedger as adjust } from "../functions/subscriptionUsageLedger.js";

const cutoverTimestamp = "2026-10-18T12:00:00.000Z";
const timestamp = (iso, nanoseconds = 0) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds });
const clone = value => structuredClone(value);
function fixture({ cycleId = "cycle-A", lastRenewedAt = "2026-10-18T10:00:00.000Z", usedSessions = 2, retry = false } = {}) {
  const userPath = "users/client";
  const documents = new Map([[userPath, { subscription: { cycleId, lastRenewedAt, periodMode: "sessions", purchasedSessions: 12, usedSessions, remainingSessions: 12 - usedSessions, startDate: "2099-01-01", history: [{ previousRemainingSessions: 1 }] } }]]);
  const generations = new Map(); const writes = []; let serial = Promise.resolve();
  const ref = path => ({ path, id: path.split("/").at(-1) });
  const read = reference => ({ exists: documents.has(reference.path), data: () => clone(documents.get(reference.path)), createTime: generations.get(reference.path) });
  const commit = staged => staged.forEach(({ reference, data, options }) => {
    const previous = documents.get(reference.path) || {};
    const value = options?.merge ? { ...previous, ...clone(data), ...(data.subscription ? { subscription: { ...previous.subscription, ...clone(data.subscription) } } : {}) } : clone(data);
    documents.set(reference.path, value); writes.push({ path: reference.path, data: clone(data) });
  });
  const db = {
    collection: name => ({ doc: id => ref(`${name}/${id}`) }),
    runTransaction: callback => {
      const run = async () => {
        const invoke = async () => {
          const staged = []; let wrote = false;
          const result = await callback({
            get: async reference => { assert.equal(wrote, false, "Admin transactions read before writing"); return read(reference); },
            set: (reference, data, options) => { wrote = true; staged.push({ reference, data, options }); }
          });
          return { result, staged };
        };
        if (retry) await invoke(); // Discard a first optimistic attempt.
        const attempt = await invoke(); commit(attempt.staged); return attempt.result;
      };
      const result = serial.then(run); serial = result.catch(() => {}); return result;
    }
  };
  const deps = { db, FieldValue: { serverTimestamp: () => "server-time" }, getResourceDateKey: value => String(value || "").slice(0, 10), cutoverTimestamp };
  function createEvent({ historyId = "history", created = "2026-10-18T12:01:00.000Z", nanos = 123, data = {}, live = true, id = "event-create" } = {}) {
    const historyRef = ref(`${userPath}/history/${historyId}`); const createTime = timestamp(created, nanos);
    const history = { date: "2026-10-18", ...data };
    if (live) { documents.set(historyRef.path, clone(history)); generations.set(historyRef.path, clone(createTime)); }
    return { id, time: created, params: { uid: "client", historyId }, data: { id: historyId, ref: historyRef, createTime, data: () => clone(history) } };
  }
  const removeLive = (event, deletedAt = "2026-10-18T14:00:00.000Z") => { documents.delete(event.data.ref.path); generations.delete(event.data.ref.path); event.time = deletedAt; };
  return { documents, generations, writes, deps, createEvent, removeLive, invoke: (event, delta) => adjust({ ...deps, event, delta }), subscription: () => documents.get(userPath).subscription };
}

test("create deliveries and transaction callback retries charge exactly once without mutating history", async () => {
  const f = fixture({ retry: true }); const event = f.createEvent(); const before = clone(f.documents.get(event.data.ref.path));
  await Promise.all([f.invoke(event, 1), f.invoke({ ...event, id: "duplicate-delivery" }, 1)]);
  assert.equal(f.subscription().usedSessions, 3);
  assert.equal(f.subscription().remainingSessions, 9);
  assert.deepEqual(f.documents.get(event.data.ref.path), before);
  assert.equal(f.writes.filter(write => write.path === "users/client").length, 1);
});

test("accepts real installed Admin SDK Timestamp and FieldValue dependencies without network", async () => {
  const require = createRequire(new URL("../functions/package.json", import.meta.url));
  const { Timestamp, FieldValue } = require("firebase-admin/firestore");
  const f = fixture(); const event = f.createEvent();
  event.data.createTime = new Timestamp(event.data.createTime.seconds, event.data.createTime.nanoseconds);
  f.generations.set(event.data.ref.path, event.data.createTime);
  await adjust({ ...f.deps, FieldValue, event, delta: 1 });
  assert.equal(f.subscription().usedSessions, 3);
});

test("repeated deletion reverses only its one current-cycle ledger charge", async () => {
  const f = fixture(); const event = f.createEvent(); await f.invoke(event, 1); f.removeLive(event);
  await Promise.all([f.invoke({ ...event, id: "delete-1" }, -1), f.invoke({ ...event, id: "delete-2" }, -1)]);
  assert.equal(f.subscription().usedSessions, 2); assert.equal(f.subscription().remainingSessions, 10);
  assert.deepEqual(f.subscription().history, [{ previousRemainingSessions: 1 }]);
});

test("delete-before-create leaves a terminal tombstone, ignores forged future marker, never increases balance", async () => {
  const f = fixture(); const event = f.createEvent({ data: { subscriptionCycleId: "cycle-A" } }); f.removeLive(event);
  await f.invoke(event, -1); await f.invoke(event, 1); await f.invoke(event, -1);
  assert.equal(f.subscription().usedSessions, 2);
  assert.equal(f.writes.filter(write => write.path === "users/client").length, 0);
});

test("post-cutover owner marker never bypasses a charge", async () => {
  const f = fixture(); const event = f.createEvent({ data: { subscriptionCycleId: "cycle-A", subscriptionUsageApplied: true } });
  await f.invoke(event, 1); assert.equal(f.subscription().usedSessions, 3);
});

test("renewal separates cycles: deleting old charge does not subtract from renewed balance", async () => {
  const f = fixture(); const event = f.createEvent(); await f.invoke(event, 1);
  f.documents.get("users/client").subscription = { ...f.subscription(), cycleId: "cycle-B", lastRenewedAt: "2026-10-18T13:00:00.000Z", usedSessions: 0, remainingSessions: 12 };
  f.removeLive(event); await f.invoke(event, -1);
  assert.equal(f.subscription().usedSessions, 0); assert.equal(f.subscription().cycleId, "cycle-B");
  const next = f.createEvent({ historyId: "new", created: "2026-10-18T13:01:00.000Z" });
  await f.invoke(next, 1); assert.equal(f.subscription().usedSessions, 1);
});

test("delayed create from before renewal is not charged into a new cycle", async () => {
  const f = fixture({ cycleId: "cycle-B", lastRenewedAt: "2026-10-18T13:00:00.000Z" });
  await f.invoke(f.createEvent({ data: { subscriptionCycleId: "cycle-B" } }), 1);
  assert.equal(f.subscription().usedSessions, 2);
});

test("same history ID recreation has independent nanosecond generation; old deletion cannot erase or refund new generation", async () => {
  const f = fixture(); const old = f.createEvent({ nanos: 1 }); await f.invoke(old, 1); f.removeLive(old); await f.invoke(old, -1);
  const current = f.createEvent({ nanos: 2, data: { name: "new generation" } }); await f.invoke(current, 1);
  await f.invoke(old, -1); await f.invoke(old, 1);
  assert.equal(f.subscription().usedSessions, 3);
  assert.equal(f.documents.get(current.data.ref.path).name, "new generation");
  assert.equal([...f.documents.keys()].filter(path => path.startsWith("subscriptionUsageLedger/")).length, 2);
  assert.equal(f.writes.some(write => write.path === current.data.ref.path), false);
});

test("an old unprocessed create sees recreation and cannot count the disappeared generation", async () => {
  const f = fixture(); const old = f.createEvent({ nanos: 1 }); const current = f.createEvent({ nanos: 2 });
  await f.invoke(old, 1); await f.invoke(current, 1); await f.invoke(old, -1);
  assert.equal(f.subscription().usedSessions, 3);
});

test("legacy baseline marker seeds ledger without a second charge, then refunds deletion at most once", async () => {
  const f = fixture(); const event = f.createEvent({ created: "2026-10-18T11:00:00.000Z", data: { subscriptionCycleId: "cycle-A" } });
  await f.invoke(event, 1); await f.invoke(event, 1); assert.equal(f.subscription().usedSessions, 2);
  f.removeLive(event); await f.invoke(event, -1); await f.invoke(event, -1);
  assert.equal(f.subscription().usedSessions, 1);
});

test("legacy deletion arriving before migration seeding reverses baseline once; late create does not recount", async () => {
  const f = fixture(); const event = f.createEvent({ created: "2026-10-18T11:00:00.000Z", data: { subscriptionCycleId: "cycle-A" } });
  f.removeLive(event); await f.invoke(event, -1); await f.invoke(event, 1); await f.invoke(event, -1);
  assert.equal(f.subscription().usedSessions, 1);
});

test("replayed pre-cutover legacy deletion is already in baseline and cannot refund again", async () => {
  const f = fixture(); const event = f.createEvent({ created: "2026-10-18T11:00:00.000Z", data: { subscriptionCycleId: "cycle-A" } });
  f.removeLive(event, "2026-10-18T11:30:00.000Z");
  await f.invoke(event, -1); await f.invoke(event, 1); await f.invoke(event, -1);
  assert.equal(f.subscription().usedSessions, 2);
  assert.equal(f.writes.filter(write => write.path === "users/client").length, 0);
});

test("legacy deletion without immutable occurrence time fails closed instead of guessing baseline ownership", async () => {
  const f = fixture(); const event = f.createEvent({ created: "2026-10-18T11:00:00.000Z", data: { subscriptionCycleId: "cycle-A" } });
  delete event.time;
  await assert.rejects(f.invoke(event, -1), /CloudEvent time/);
  assert.equal(f.writes.length, 0);
});

test("legacy unmarked data and old-cycle markers never recount into current balances", async () => {
  const f = fixture();
  for (const marker of [undefined, "old-cycle"]) {
    const event = f.createEvent({ historyId: marker || "unmarked", created: "2026-10-18T11:00:00.000Z", data: { ...(marker ? { subscriptionCycleId: marker } : {}) } });
    await f.invoke(event, 1); f.removeLive(event); await f.invoke(event, -1);
  }
  assert.equal(f.subscription().usedSessions, 2);
});

test("missing snapshot generation, fixed cutover, named cycle boundary or mismatched ref fail closed", async () => {
  const f = fixture(); const event = f.createEvent();
  await assert.rejects(f.invoke({ ...event, data: { ...event.data, createTime: undefined } }, 1), /createTime/);
  await assert.rejects(adjust({ ...f.deps, cutoverTimestamp: "", event, delta: 1 }), /cutoverTimestamp/);
  await assert.rejects(f.invoke({ ...event, params: { ...event.params, historyId: "other" } }, 1), /mismatch/);
  delete f.documents.get("users/client").subscription.lastRenewedAt;
  await assert.rejects(f.invoke(event, 1), /cycleStartedAt/);
  assert.equal(f.writes.length, 0);
});

test("sessions mode preserves legacy future-date semantics; calendar mode rejects before-period workouts", async () => {
  const f = fixture(); const event = f.createEvent(); await f.invoke(event, 1); assert.equal(f.subscription().usedSessions, 3);
  const other = fixture(); other.documents.get("users/client").subscription.periodMode = "dates";
  await other.invoke(other.createEvent(), 1); assert.equal(other.subscription().usedSessions, 2);
});

test("refund clamps at zero and generated cycle IDs supply a boundary fallback", async () => {
  const f = fixture({ cycleId: `cycle_${Date.parse("2026-10-18T10:00:00.000Z")}`, lastRenewedAt: "", usedSessions: 0 });
  const event = f.createEvent({ created: "2026-10-18T11:00:00.000Z", data: { subscriptionCycleId: f.subscription().cycleId } });
  f.removeLive(event); await f.invoke(event, -1); assert.equal(f.subscription().usedSessions, 0);
  const current = f.createEvent(); await f.invoke(current, 1); assert.equal(f.subscription().usedSessions, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import * as readState from "../src/utils/trainerSummaryReadState.js";
import { captureAuthSession } from "../src/utils/authSession.js";
import { runSessionResource } from "../src/utils/sessionResource.js";
import { scheduleTrainerSummaryRead, TRAINER_INITIAL_SUMMARY_PAGE_SIZE } from "../src/features/trainer/trainerSummaryReadScheduler.js";

async function fixture({ deadline = 12000, delay = 0 } = {}) {
  let summaries = {}, loading = false, calls = [], reads = 0, firstUsefulAt;
  const started = performance.now();
  const faults = new Map();
  const clients = (count) => Array.from({ length: count }, (_, index) => ({ id: `u${index}`, assignedProgramId: "p", assignedProgramUpdatedAt: "v1", updatedAt: "initial", workoutCalendar: { plannedWorkouts: [] } }));
  const docs = (count) => ({ size: count, docs: Array.from({ length: count }, (_, index) => ({ id: String(index), data: () => ({ date: new Date(Date.now() - index * 86400000).toISOString(), status: "planned" }) })) });
  const read = async (target, document = false) => {
    const id = target.path.split("/")[1], source = target.path.split("/")[2];
    calls.push(`${id}/${source}`);
    if (faults.has(`${id}/${source}`)) return faults.get(`${id}/${source}`)();
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (document) { reads++; return { exists: () => true, data: () => ({ days: [] }) }; }
    const annual = { history: 156, measurements: 365, workouts: 8, trainerTasks: 10 }[source];
    const cap = target.constraints.find((item) => item.type === "limit")?.count;
    assert.ok(cap, `Unbounded ${source} read`);
    const size = Math.min(annual, cap); reads += size;
    return docs(size);
  };
  const context = { ...readState, captureAuthSession, runSessionResource, scheduleTrainerSummaryRead, TRAINER_INITIAL_SUMMARY_PAGE_SIZE,
    isNutritionDayStorageEnabled: () => false, WeakMap, Map, Set, Object, Array, Number, String, Boolean, Date, JSON, Promise, console,
    TRAINER_SUMMARY_BATCH_TIMEOUT_MS: deadline, MAX_TRAINER_SUMMARY_CONCURRENCY: 4,
    collection: (_db, ...parts) => ({ path: parts.join("/") }), doc: (_db, ...parts) => ({ path: parts.join("/") }),
    query: (target, ...constraints) => ({ ...target, constraints }), limit: (count) => ({ type: "limit", count }), orderBy: (field, direction) => ({ type: "order", field, direction }), where: (...args) => ({ type: "where", args }),
    getDocs: (target) => read(target), getDoc: (target) => read(target, true),
    getTrainerClientFastSummary: (client, previous = {}) => ({ clientId: client.id, ...previous }), canLoadTrainerClientDeepSummary: () => true,
    getTrainerSortedHistory: (items) => items, getTrainerSortedMeasurements: (items) => items,
    getTrainerSettledCollectionItems: (result) => result.status === "fulfilled" ? result.value.docs.map((item) => ({ ...item.data(), id: item.id })) : [],
    getTrainerSettledDocumentData: (result) => result.status === "fulfilled" ? result.value.data() : null,
    getTrainerSummaryReadFailures: () => ({ names: [], reasons: [] }),
    getTrainerNutritionSummary: () => ({ nutritionDays7: 5 }),
    getTrainerAssignmentProgress: () => ({ assignedWorkoutCount: 8, completedWorkoutCount: 2 }), getClientEffectiveNutritionGoals: () => ({}), buildProgressInsight: () => ({ score: 80 }),
    getTrainerWorkoutActivitySummary: (items) => ({ lastWorkoutAt: items[0]?.date || "", workouts7: items.length ? 3 : 0 }),
    getTrainerLastMeasurementAt: (items) => items[0]?.date, getClientPlateauInfo: () => ({}), getClientPaymentAttention: () => ({}),
    getSubscriptionStatus: () => ({}), getSubscriptionAttentionLabel: () => "", getActiveTrainerTasksCount: (items) => items.length,
    getTrainerWorkoutFeedbackAttention: () => null, getTrainerProgramEndingAttention: () => null, buildTrainerClientRecentEvents: () => [], getTrainerProgramCompletionPercent: () => 25,
    getTrainerSummaryPeriodBounds: () => ({ weekStart: Date.now() - 7 * 86400000, sevenDayStart: Date.now() - 7 * 86400000, thirtyDayStart: Date.now() - 30 * 86400000 }) };
  const source = await readFile(new URL("../src/features/trainer/trainerClientSummaryLoader.js", import.meta.url), "utf8");
  vm.runInNewContext(source.replace(/import\s[\s\S]*?from\s+"[^"]+";\r?\n/g, "").replace(/export /g, ""), context);
  const loader = context.createTrainerClientSummaryLoader({ db: {}, auth: { currentUser: { uid: "trainer" } }, trainerClientSummaryRequestRef: { current: 0 },
    setTrainerClientSummaries: (update) => { summaries = typeof update === "function" ? update(summaries) : update; if (firstUsefulAt === undefined && Object.keys(summaries).length) firstUsefulAt = performance.now() - started; },
    setTrainerClientSummariesLoading: (value) => { loading = value; } });
  return { load: loader.loadTrainerClientSummaries, clients, faults, state: () => ({ summaries, loading, calls: [...calls], reads, firstUsefulAt }) };
}

test("partial sources retain last successful values and retry only failed reads", async () => {
  const f = await fixture(); const clients = f.clients(2);
  await f.load(clients);
  assert.equal(f.state().summaries.u0.workouts7, 3);
  clients[0].updatedAt = "changed";
  f.faults.set("u0/history", () => Promise.reject(Error("offline")));
  await f.load(clients);
  let state = f.state();
  assert.equal(state.summaries.u0.trainerSummaryState, "partial");
  assert.equal(state.summaries.u0.sources.history.state, "stale");
  assert.equal(state.summaries.u0.workouts7, 3);
  const callCount = state.calls.length;
  f.faults.delete("u0/history");
  await f.load(clients, { retryClientIds: ["u0"] });
  state = f.state();
  assert.deepEqual(state.calls.slice(callCount), ["u0/history"]);
  assert.equal(state.summaries.u0.trainerSummaryState, "fresh");
  assert.equal(state.loading, false);
});

test("first failed read leaves unknown values instead of false zero activity", async () => {
  const f = await fixture();
  f.faults.set("u0/history", () => Promise.reject(Error("offline")));
  f.faults.set("u0/measurements", () => Promise.reject(Error("offline")));
  f.faults.set("u0/trainerTasks", () => Promise.reject(Error("offline")));
  const loading = f.load(f.clients(1));
  await Promise.resolve();
  assert.equal(f.state().summaries.u0.workouts7, null);
  await loading;
  const summary = f.state().summaries.u0;
  assert.equal(summary.workouts7, null);
  assert.equal(summary.lastMeasurementAt, null);
  assert.equal(summary.activeTrainerTasksCount, null);
  assert.equal(summary.trainerSummaryState, "partial");
  assert.equal(summary.sources.history.state, "error");
});

test("deadline settles a large batch and late responses cannot overwrite retry results", async () => {
  const f = await fixture({ deadline: 60 }); const clients = f.clients(50); const late = [];
  for (const client of clients) f.faults.set(`${client.id}/history`, () => new Promise((resolve) => late.push(resolve)));
  const start = performance.now(); await f.load(clients);
  assert.ok(performance.now() - start < 1000);
  assert.equal(f.state().loading, false);
  assert.equal(Object.keys(f.state().summaries).length, 50);
  assert.ok(Object.values(f.state().summaries).every((summary) => summary.trainerSummarySettled));
  f.faults.clear(); const retry = f.load(clients.slice(0, 1));
  // A UI deadline does not release real I/O slots. Let the abandoned SDK
  // promises settle, then the newer request may enter the shared scheduler.
  late.forEach((resolve) => resolve({ size: 0, docs: [] }));
  await retry;
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(f.state().summaries.u0.workouts7, 3);
  assert.equal(f.state().summaries.u0.trainerSummaryState, "fresh");
});

test("5 / 50 / 200 clients with annual history stay within read and latency budgets", async () => {
  const results = [];
  for (const count of [5, 50, 200]) {
    const f = await fixture({ delay: 2 }); const clients = f.clients(count); const start = performance.now();
    await f.load(clients);
    const state = f.state();
    assert.equal(Object.keys(state.summaries).length, count);
    assert.ok(Object.values(state.summaries).every((summary) => summary.trainerSummaryReady));
    assert.ok(Object.values(state.summaries).every((summary) => summary.completedWorkoutCount === null), "Capped history must not be presented as an all-time total");
    assert.ok(state.reads <= count * 92);
    assert.ok(state.firstUsefulAt < 1000);
    assert.ok(performance.now() - start < 4000);
    await f.load(clients);
    assert.equal(f.state().reads, state.reads, "Unchanged sources must not be reread within cache TTL");
    results.push({ clients: count, annualDocumentBaseline: count * 541, documentsRead: state.reads, firstUsefulMs: Math.round(state.firstUsefulAt), completionMs: Math.round(performance.now() - start), unchangedRefreshReads: 0 });
  }
  await writeFile(new URL("../artifacts/trainer-summary-benchmark.json", import.meta.url), JSON.stringify({ simulatedSourceLatencyMs: 2, results }, null, 2));
});

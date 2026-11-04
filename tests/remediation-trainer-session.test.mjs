import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

const noop = () => {};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const item = (id, data = {}) => ({ id, data: () => data });
const collectionSnapshot = (docs = []) => ({ docs, size: docs.length, forEach: callback => docs.forEach(callback) });
const documentSnapshot = (id = "client", data = {}) => ({ id, exists: () => true, data: () => data });
let readDocs, readDoc;
const cleanup = installRuntimeImports({
  "firebase/firestore": {
    collection: (_db, ...parts) => ({ path: parts.join("/") }), doc: (_db, ...parts) => ({ path: parts.join("/") }),
    query: (ref, ...constraints) => ({ ...ref, constraints }), where: (...args) => ({ where: args }),
    orderBy: noop, limit: size => ({ limit: size }), startAfter: cursor => ({ cursor }),
    getDocs: (...args) => readDocs(...args), getDoc: (...args) => readDoc(...args), setDoc: noop, writeBatch: noop
  },
  "/src/utils/clientExerciseMedia.js": { loadClientExerciseMedia: async () => [], withClientExerciseMedia: workout => workout },
  "/src/utils/trainerExerciseCards.js": { requestTrainerExerciseCards: async () => ({ cards: [] }) }
});
after(cleanup);
const { loadTrainerUsersWithDeps } = await import("../src/features/trainer/trainerUserLoadHandlers.js");
const { createTrainerClientOverviewLoader } = await import("../src/features/trainer/trainerClientOverviewLoader.js");
const { createTrainerClientSummaryLoader } = await import("../src/features/trainer/trainerClientSummaryLoader.js");
const { createTrainerProgramTemplateHandlers } = await import("../src/features/trainer/trainerProgramTemplateHandlers.js");
beforeEach(() => {
  readDocs = async () => collectionSnapshot();
  readDoc = async ref => ref.path.split("/").length === 2 ? documentSnapshot(ref.path.split("/")[1], { role: "client" }) : { exists: () => false, data: () => undefined };
});
const authFixture = () => { const auth = { currentUser: { uid: "trainer", email: "trainer@example.test" } }; advanceAuthSession(auth); return auth; };

test("TR13 actual users loader drops pending success and failure across same-object same-UID auth epochs", async () => {
  for (const fails of [false, true]) {
    const auth = authFixture(); const gate = deferred(); const published = [];
    readDocs = () => gate.promise;
    const setter = value => published.push(value);
    const pending = loadTrainerUsersWithDeps({ db: {}, auth, canUseTrainerFeatures: () => true, canUseAdminFeatures: () => true,
      setTrainerClientSummariesLoading: setter, setAdminAllUsersList: setter, setUsersList: setter, setSelectedUserId: setter,
      setAdminSelectedClient: setter, setAdminClientStatus: setter, loadTrainerClientSummaries: setter });
    await new Promise(resolve => setImmediate(resolve));
    published.length = 0;
    advanceAuthSession(auth, auth.currentUser);
    if (fails) gate.reject(new Error("old-session-error")); else gate.resolve(collectionSnapshot([item("old-client", { role: "client" })]));
    await pending; assert.deepEqual(published, []);
  }
});

function overviewFixture(auth, published) {
  let history = [];
  const setter = value => published.push(value);
  const setHistory = value => { history = typeof value === "function" ? value(history) : value; published.push(["history", history]); };
  const names = ["setSelectedUserId", "setAdminSelectedClient", "setAdminClientTab", "setPage", "setAdminClientPageOpen", "setAdminUsersSelectedTab", "setAdminClientLoading", "setAdminClientStatus", "setAdminClientTasks", "setAdminClientProgressPhotos", "setAdminClientEvents", "setAdminClientPayment", "setAdminPhotoCompareOpen", "setAdminTaskComposerOpen", "setAdminProgramControlOpen", "setUsersList", "setAdminAllUsersList", "setAdminSelectedHistoryIds", "setAdminClientNutrition", "setAdminClientMeasurements", "setAdminPaymentDraft", "setAdminPhotoCompareIds", "setAdminTrainerNote", "setAdminCalendarDraft", "setPlan"];
  const deps = Object.fromEntries(names.map(name => [name, setter]));
  const loader = createTrainerClientOverviewLoader({ ...deps, db: {}, auth, setAdminClientHistory: setHistory, mirrorClientForTrainer: async () => published.push("mirror"), loadAdminTrainingTemplates: async () => published.push("templates") });
  return { ...loader, history: () => history };
}

test("TR13 overview pending profile response cannot publish after same UID logs in again", async () => {
  const auth = authFixture(); const gate = deferred(); const published = [];
  readDoc = () => gate.promise;
  const f = overviewFixture(auth, published); const pending = f.loadAdminClientOverview({ id: "client" });
  published.length = 0; advanceAuthSession(auth, auth.currentUser);
  gate.resolve(documentSnapshot("client", { name: "private old profile" }));
  await pending; assert.deepEqual(published, []);
});

test("TR13 pending history page is invalid across an auth epoch and new session can reload same client", async () => {
  const auth = authFixture(); const published = []; const gate = deferred();
  readDocs = async ref => ref.path.endsWith("/history") ? collectionSnapshot(Array.from({ length: 80 }, (_, index) => item(String(index), { date: "2026-10-18" }))) : collectionSnapshot();
  const f = overviewFixture(auth, published); await f.loadAdminClientOverview({ id: "client" });
  readDocs = () => gate.promise;
  const pending = f.loadAdminClientOverview({ id: "client" }, { historyPage: true });
  published.length = 0; advanceAuthSession(auth, auth.currentUser);
  gate.resolve(collectionSnapshot([item("old-private-history", { date: "2026-01-01" })]));
  assert.equal(await pending, false); assert.deepEqual(published, []);
  readDocs = async () => collectionSnapshot(); await f.loadAdminClientOverview({ id: "client" });
  assert.deepEqual(f.history(), []);
});

function summaryFixture(auth, published, { deferUpdates = false } = {}) {
  let summaries = {}; const updaters = [];
  const loader = createTrainerClientSummaryLoader({ db: {}, auth, trainerClientSummaryRequestRef: { current: 0 },
    setTrainerClientSummaries: value => { if (deferUpdates && typeof value === "function") { updaters.push(value); return; } summaries = typeof value === "function" ? value(summaries) : value; published.push(summaries); },
    setTrainerClientSummariesLoading: value => published.push(["loading", value]) });
  return { ...loader, summaries: () => summaries, updaters };
}
const summaryClient = { id: "client", role: "client", assignedProgramId: "program", assignedProgramUpdatedAt: "v1", workoutCalendar: {} };

test("TR13 pending deep summary publication and loading completion are ignored after same-UID relogin", async () => {
  const auth = authFixture(); const gate = deferred(); const published = [];
  readDocs = () => gate.promise; readDoc = () => gate.promise;
  const f = summaryFixture(auth, published); const pending = f.loadTrainerClientSummaries([summaryClient]);
  published.length = 0; advanceAuthSession(auth, auth.currentUser);
  gate.resolve({ ...collectionSnapshot(), exists: () => false, data: () => undefined });
  await pending; assert.deepEqual(published, []);
});

test("TR13 delayed React updater cannot merge old-session summary into the next session", async () => {
  const auth = authFixture(); const gate = deferred(); const f = summaryFixture(auth, [], { deferUpdates: true });
  readDocs = () => gate.promise; readDoc = () => gate.promise;
  const pending = f.loadTrainerClientSummaries([summaryClient]);
  advanceAuthSession(auth, auth.currentUser);
  const nextSessionState = { next: { private: "current" } };
  for (const update of f.updaters) assert.equal(update(nextSessionState), nextSessionState);
  gate.resolve({ ...collectionSnapshot(), exists: () => false, data: () => undefined }); await pending;
});

test("TR13 deep summary cache is namespaced to auth epoch rather than UID/client ID", async () => {
  const auth = authFixture(); let reads = 0;
  readDocs = async ref => { reads++; return ref.path.endsWith("/history") ? collectionSnapshot([item("old", { date: "2026-10-17", workoutId: "old-day" })]) : collectionSnapshot(); };
  readDoc = async () => { reads++; return { exists: () => false, data: () => undefined }; };
  const f = summaryFixture(auth, []); await f.loadTrainerClientSummaries([summaryClient]);
  const firstReads = reads;
  await f.loadTrainerClientSummaries([summaryClient]); assert.equal(reads, firstReads);
  advanceAuthSession(auth, auth.currentUser);
  await f.loadTrainerClientSummaries([summaryClient]); assert.ok(reads > firstReads, "new epoch must reread every source instead of reusing old account cache");
});

test("TR13 template loader also ignores old-session response/error publication", async () => {
  const auth = authFixture(); const gate = deferred(); const published = [];
  readDocs = () => gate.promise;
  const handlers = createTrainerProgramTemplateHandlers({ db: {}, auth, canUseAdminFeatures: () => true,
    setAdminClientStatus: value => published.push(value), setTrainerExerciseCards: value => published.push(value),
    setAdminTrainingTemplates: value => published.push(value), setAdminSelectedTemplateId: value => published.push(value) });
  const pending = handlers.loadAdminTrainingTemplates(); advanceAuthSession(auth, auth.currentUser);
  gate.resolve(collectionSnapshot([item("old-template", { name: "Private" })])); await pending;
  assert.deepEqual(published, []);
});

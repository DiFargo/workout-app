import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { scheduleTrainerSummaryRead, MAX_TRAINER_SUMMARY_SOURCE_READS } from "../src/features/trainer/trainerSummaryReadScheduler.js";
import { configureNutritionDayStorage } from "../src/utils/nutritionDayStorageConfig.js";

const noop = () => {};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const item = (id, data = {}) => ({ id, data: () => data });
const snapshot = (docs = []) => ({ docs, size: docs.length, forEach: fn => docs.forEach(fn) });
const missing = () => ({ exists: () => false, data: () => undefined });
const authFixture = () => { const auth = { currentUser: { uid: "trainer", email: "trainer@example.test" } }; advanceAuthSession(auth); return auth; };
let readDoc, readDocs, readCards, readNutrition;
const cleanup = installRuntimeImports({
  "/src/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": {
    collection: (_db, ...parts) => ({ path: parts.join("/") }), doc: (_db, ...parts) => ({ path: parts.join("/") }),
    query: (ref, ...constraints) => ({ ...ref, constraints }), where: (...args) => ({ where: args }),
    orderBy: noop, limit: value => ({ limit: value }), startAfter: noop,
    getDoc: ref => readDoc(ref), getDocs: ref => readDocs(ref), setDoc: noop, writeBatch: noop
  },
  "/src/utils/clientExerciseMedia.js": { loadClientExerciseMedia: async () => [], withClientExerciseMedia: workout => workout },
  "/src/utils/trainerExerciseCards.js": { requestTrainerExerciseCards: args => readCards(args) },
  "/src/utils/nutritionDayClient.js": { readNutritionState: (...args) => readNutrition(...args) }
});
after(cleanup);
const { createTrainerClientSummaryLoader } = await import("../src/features/trainer/trainerClientSummaryLoader.js");
const { loadTrainerUsersWithDeps } = await import("../src/features/trainer/trainerUserLoadHandlers.js");
const { createTrainerClientOverviewLoader } = await import("../src/features/trainer/trainerClientOverviewLoader.js");
const { createTrainerProgramTemplateHandlers } = await import("../src/features/trainer/trainerProgramTemplateHandlers.js");
beforeEach(() => { configureNutritionDayStorage({ enabled: false }); readDoc = async () => missing(); readDocs = async () => snapshot(); readCards = async () => ({ cards: [] }); });

test("summary initial stage keeps all 100 clients but reads only first 20, never trainer rows; demand loads the requested row", async () => {
  const auth = authFixture(); let reads = 0; let summaries = {};
  readDoc = async () => { reads++; return missing(); };
  readDocs = async () => { reads++; return snapshot(); };
  const clients = Array.from({ length: 100 }, (_, index) => ({ id: `client-${index}`, role: "client" }));
  const loader = createTrainerClientSummaryLoader({ db: {}, auth, trainerClientSummaryRequestRef: { current: 0 },
    setTrainerClientSummaries: value => { summaries = typeof value === "function" ? value(summaries) : value; },
    setTrainerClientSummariesLoading: noop });
  const rows = [...clients, { id: "trainer-row", role: "trainer" }];
  await Promise.all([loader.loadTrainerClientSummaries(rows, { initialOnly: true }), loader.loadTrainerClientSummaries(rows, { initialOnly: true })]);
  assert.equal(reads, 20 * 6, "concurrent identical batches must not double source reads");
  assert.equal(Object.keys(summaries).length, 100);
  assert.equal(summaries["trainer-row"], undefined);
  assert.equal(Object.values(summaries).filter(value => value.trainerSummaryState === "deferred").length, 80);
  await loader.loadTrainerClientSummaries(rows, { retryClientIds: ["client-99"] });
  assert.equal(reads, 21 * 6);
  assert.notEqual(summaries["client-99"].trainerSummaryState, "deferred");
  assert.equal(summaries["client-98"].trainerSummaryState, "deferred");
  assert.equal(summaries["client-0"].trainerSummaryState, "fresh");
});

test("actual source scheduler holds all slots despite abandoned waiters and skips superseded queued work", async () => {
  const auth = authFixture(); const gate = deferred(); let active = 0; let peak = 0; let started = 0;
  const jobs = Array.from({ length: MAX_TRAINER_SUMMARY_SOURCE_READS }, () => scheduleTrainerSummaryRead(auth, async () => {
    started++; active++; peak = Math.max(peak, active); await gate.promise; active--; return "done";
  }, () => true));
  await tick();
  // A UI timeout/superseded waiter does not settle the underlying SDK promises.
  assert.equal(await Promise.race([jobs[0], Promise.resolve("ui-timeout")]), "ui-timeout");
  let current = true;
  const queued = scheduleTrainerSummaryRead(auth, async () => { started++; return "unexpected"; }, () => current);
  const queuedResult = queued.catch(error => error.code);
  await tick();
  assert.equal(started, MAX_TRAINER_SUMMARY_SOURCE_READS);
  current = false;
  gate.resolve(); await Promise.all(jobs);
  assert.equal(await queuedResult, "summary/superseded");
  assert.equal(peak, MAX_TRAINER_SUMMARY_SOURCE_READS);
  assert.equal(started, MAX_TRAINER_SUMMARY_SOURCE_READS);
});

test("concurrent admin directory loads keep every user and schedule one first-page summary batch", async () => {
  const auth = authFixture(); const gate = deferred(); let reads = 0; let users; const summaryCalls = [];
  readDocs = () => { reads++; return gate.promise; };
  const deps = { db: {}, auth, adminEmail: "admin@example.test", canUseAdminFeatures: () => true, canUseTrainerFeatures: () => true,
    setTrainerClientSummariesLoading: noop, setAdminAllUsersList: noop, setAdminClientStatus: noop,
    setAdminSelectedClient: noop, setSelectedUserId: noop, setUsersList: value => { users = value; },
    loadTrainerClientSummaries: (...args) => summaryCalls.push(args) };
  const a = loadTrainerUsersWithDeps(deps), b = loadTrainerUsersWithDeps(deps);
  await tick(); assert.equal(reads, 1);
  gate.resolve(snapshot(Array.from({ length: 100 }, (_, index) => item(`client-${index}`, { role: "client" }))));
  await Promise.all([a, b]);
  assert.equal(users.length, 100);
  assert.equal(summaryCalls.length, 1);
  assert.deepEqual(summaryCalls[0][1], { initialOnly: true });
});

test("directory actions retain canonical document IDs despite legacy id fields in admin, trainer and linked records", async () => {
  for (const mode of ["admin", "trainer", "linked"]) {
    const auth = authFixture();
    let users = [], selected;
    const data = { id: "stale-other-account", role: "client", trainerId: "trainer", name: "Клиент" };
    readDocs = async ref => ref.path === "users/trainer/trainerClients"
      ? snapshot(mode === "linked" ? [item("canonical-client", {})] : [])
      : snapshot(mode !== "linked" ? [item("canonical-client", data)] : []);
    readDoc = async () => ({ ...item("canonical-client", data), exists: () => true });
    await loadTrainerUsersWithDeps({ db: {}, auth, adminEmail: "admin@example.test",
      canUseAdminFeatures: () => mode === "admin", canUseTrainerFeatures: () => true,
      setTrainerClientSummariesLoading: noop, setAdminClientStatus: noop,
      setAdminAllUsersList: value => { users = value; }, setUsersList: noop,
      setAdminSelectedClient: value => { selected = value; }, setSelectedUserId: noop,
      loadTrainerClientSummaries: noop });
    assert.deepEqual(users.map(user => user.id), ["canonical-client"], mode);
    assert.equal(selected.id, "canonical-client", mode);
  }
});

test("overview launches independent detail reads together, retains the full editor aggregate and has no library barrier", async () => {
  const auth = authFixture(); const gate = deferred(); const paths = []; let plan; let libraries = 0;
  readDoc = ref => {
    paths.push(ref.path);
    if (ref.path === "users/client") return Promise.resolve({ id: "client", exists: () => true, data: () => ({ role: "client" }) });
    return gate.promise.then(() => missing());
  };
  readDocs = ref => {
    paths.push(ref.path);
    return gate.promise.then(() => snapshot(ref.path.endsWith("/workouts")
      ? Array.from({ length: 105 }, (_, index) => item(`workout-${index}`, { name: "Day", exercises: [] })) : []));
  };
  const names = ["setSelectedUserId", "setAdminSelectedClient", "setAdminClientTab", "setPage", "setAdminClientPageOpen", "setAdminUsersSelectedTab", "setAdminClientLoading", "setAdminClientStatus", "setAdminClientTasks", "setAdminClientProgressPhotos", "setAdminClientEvents", "setAdminClientPayment", "setAdminPhotoCompareOpen", "setAdminTaskComposerOpen", "setAdminProgramControlOpen", "setUsersList", "setAdminAllUsersList", "setAdminClientHistory", "setAdminSelectedHistoryIds", "setAdminClientNutrition", "setAdminClientMeasurements", "setAdminPaymentDraft", "setAdminPhotoCompareIds", "setAdminTrainerNote", "setAdminCalendarDraft"];
  const loader = createTrainerClientOverviewLoader({ ...Object.fromEntries(names.map(name => [name, noop])), db: {}, auth,
    setPlan: value => { plan = value; }, mirrorClientForTrainer: async () => {},
    loadAdminTrainingTemplates: async () => { libraries++; await new Promise(() => {}); } });
  const a = loader.loadAdminClientOverview({ id: "client" }), b = loader.loadAdminClientOverview({ id: "client" });
  await tick();
  assert.equal(paths.length, 10, "profile plus every independent detail read must have started before any detail settles");
  gate.resolve(); await Promise.all([a, b]);
  assert.equal(libraries, 0);
  assert.equal(plan.workouts.length + plan.archivedWorkouts.length, 105, "editor data is not silently capped");
});

test("templates and cards start together and concurrent library consumers join the same request", async () => {
  const auth = authFixture(); const templates = deferred(), cards = deferred(); let reads = 0, cardReads = 0;
  readDocs = () => { reads++; return templates.promise; };
  readCards = () => { cardReads++; return cards.promise; };
  const handler = createTrainerProgramTemplateHandlers({ db: {}, auth, canUseAdminFeatures: () => true,
    setAdminClientStatus: noop, setTrainerExerciseCards: noop, setAdminTrainingTemplates: noop, setAdminSelectedTemplateId: noop });
  const a = handler.loadAdminTrainingTemplates(), b = handler.loadAdminTrainingTemplates();
  await tick(); assert.equal(reads, 1); assert.equal(cardReads, 1);
  templates.resolve(snapshot()); cards.resolve({ cards: [] }); await Promise.all([a, b]);
});

function libraryStateFixture({ auth = authFixture(), templates = [], cards = [], selectedId = "" } = {}) {
  const values = { state: null, templates, cards, selectedId };
  const publications = { state: 0, templates: 0, cards: 0, selectedId: 0 };
  const setter = key => update => {
    values[key] = typeof update === "function" ? update(values[key]) : update;
    publications[key]++;
  };
  const handler = createTrainerProgramTemplateHandlers({ db: {}, auth, canUseAdminFeatures: () => true,
    trainerExerciseCards: cards,
    setTrainerLibraryLoadState: setter("state"),
    setAdminTrainingTemplates: setter("templates"),
    setTrainerExerciseCards: setter("cards"),
    setAdminSelectedTemplateId: setter("selectedId"),
    setAdminClientStatus: noop });
  return { auth, values, publications, ...handler };
}

test("library readiness does not claim an empty result while either source is still pending", async () => {
  for (const firstSource of ["templates", "cards"]) {
    const templates = deferred(), cards = deferred();
    readDocs = () => templates.promise;
    readCards = () => cards.promise;
    const fixture = libraryStateFixture();
    const request = fixture.loadAdminTrainingTemplates();
    await tick();
    assert.equal(fixture.values.state.templates, "loading");
    assert.equal(fixture.values.state.cards, "loading");
    assert.equal(fixture.values.state.templatesKnown, false);
    assert.equal(fixture.values.state.cardsKnown, false);
    assert.equal(fixture.values.state.session.isCurrent(), true);

    if (firstSource === "templates") templates.resolve(snapshot());
    else cards.resolve({ cards: [] });
    await tick();
    const pendingSource = firstSource === "templates" ? "cards" : "templates";
    assert.equal(fixture.values.state[pendingSource], "loading");
    assert.equal(fixture.values.state[`${pendingSource}Known`], false);

    if (firstSource === "templates") cards.resolve({ cards: [] });
    else templates.resolve(snapshot());
    await request;
    assert.equal(fixture.values.state.templates, "ready");
    assert.equal(fixture.values.state.cards, "ready");
    assert.equal(fixture.values.state.templatesKnown, true);
    assert.equal(fixture.values.state.cardsKnown, true);
    assert.deepEqual(fixture.values.templates, []);
    assert.deepEqual(fixture.values.cards, []);
  }
});

test("failed library refresh preserves known data and selection, and an empty successful retry is authoritative", async () => {
  const cachedTemplates = [{ id: "cached-template", name: "Сохранённый шаблон", workouts: [] }];
  const cachedCards = [{ id: "cached-card", ownerUid: "trainer", name: "Тяга" }];
  let templateReads = 0, cardReads = 0;
  readDocs = async () => { templateReads++; return snapshot(cachedTemplates.map(({ id, ...data }) => item(id, data))); };
  readCards = async () => { cardReads++; return { cards: cachedCards }; };
  const fixture = libraryStateFixture({ templates: cachedTemplates, cards: cachedCards, selectedId: "cached-template" });
  await fixture.loadAdminTrainingTemplates();
  const successfulTemplates = fixture.values.templates;
  const successfulCards = fixture.values.cards;
  const templates = deferred(), cards = deferred();
  readDocs = () => { templateReads++; return templates.promise; };
  readCards = () => { cardReads++; return cards.promise; };
  const originalWarn = console.warn, originalError = console.error;
  console.warn = noop; console.error = noop;
  try {
    const refresh = fixture.loadAdminTrainingTemplates();
    await tick();
    assert.equal(fixture.values.state.templates, "loading");
    assert.equal(fixture.values.state.cards, "loading");
    assert.equal(fixture.values.state.templatesKnown, true);
    assert.equal(fixture.values.state.cardsKnown, true);
    assert.deepEqual(fixture.values.templates, successfulTemplates);
    assert.deepEqual(fixture.values.cards, successfulCards);
    templates.reject(new Error("Offline templates"));
    cards.reject(new Error("Offline cards"));
    await refresh;
    assert.equal(fixture.values.state.templates, "error");
    assert.equal(fixture.values.state.cards, "error");
    assert.equal(fixture.values.state.templatesKnown, true);
    assert.equal(fixture.values.state.cardsKnown, true);
    assert.deepEqual(fixture.values.templates, successfulTemplates);
    assert.deepEqual(fixture.values.cards, successfulCards);
    assert.equal(fixture.values.selectedId, "cached-template");
    readDocs = async () => { templateReads++; return snapshot(); };
    readCards = async () => { cardReads++; return { cards: [] }; };
    await fixture.loadAdminTrainingTemplates();
  } finally { console.warn = originalWarn; console.error = originalError; }
  assert.equal(templateReads, 3);
  assert.equal(cardReads, 3);
  assert.equal(fixture.values.state.templates, "ready");
  assert.equal(fixture.values.state.cards, "ready");
  assert.equal(fixture.values.state.templatesKnown, true);
  assert.equal(fixture.values.state.cardsKnown, true);
  assert.deepEqual(fixture.values.templates, []);
  assert.deepEqual(fixture.values.cards, []);
  assert.equal(fixture.values.selectedId, "");
});

test("card refresh failure retains saved cards and uses them to map a successful template response", async () => {
  const cachedCards = [{ id: "shared-card", ownerUid: "trainer", name: "Тяга с опорой", video: "cached-demo.mp4", videoPosterTime: 1 }];
  readDocs = async () => snapshot();
  readCards = async () => ({ cards: cachedCards });
  const fixture = libraryStateFixture({ cards: cachedCards });
  await fixture.loadAdminTrainingTemplates();
  const sets = [{ reps: 12, weight: 35 }];
  readDocs = async () => snapshot([item("new-template", { ownerUid: "trainer", name: "Новый шаблон", workouts: [{ id: "day", exercises: [
    { id: "exercise", name: "Старое имя", exerciseCardId: "shared-card", exerciseCardOwnerUid: "trainer", sets }
  ] }] })]);
  readCards = async () => { throw new Error("Cards unavailable"); };
  const originalWarn = console.warn; console.warn = noop;
  try { await fixture.loadAdminTrainingTemplates(); }
  finally { console.warn = originalWarn; }
  assert.equal(fixture.values.state.templates, "ready");
  assert.equal(fixture.values.state.cards, "error");
  assert.equal(fixture.values.state.templatesKnown, true);
  assert.equal(fixture.values.state.cardsKnown, true);
  assert.deepEqual(fixture.values.cards, cachedCards);
  const exercise = fixture.values.templates[0].workouts[0].exercises[0];
  assert.equal(exercise.name, "Тяга с опорой");
  assert.equal(exercise.video, "cached-demo.mp4");
  assert.deepEqual(exercise.sets, sets);
});

test("a failed initial template response stays unknown while successful exercise cards become ready", async () => {
  const cards = [{ id: "card", ownerUid: "trainer", name: "Сгибание ног" }];
  readDocs = async () => { throw new Error("Templates unavailable"); };
  readCards = async () => ({ cards });
  const fixture = libraryStateFixture();
  const originalError = console.error; console.error = noop;
  try { await fixture.loadAdminTrainingTemplates(); }
  finally { console.error = originalError; }
  assert.equal(fixture.values.state.templates, "error");
  assert.equal(fixture.values.state.templatesKnown, false);
  assert.equal(fixture.values.state.cards, "ready");
  assert.equal(fixture.values.state.cardsKnown, true);
  assert.deepEqual(fixture.values.templates, []);
  assert.deepEqual(fixture.values.cards, cards);
});

test("same-account re-login resets library knowledge and late previous-session responses cannot publish", async () => {
  const fixture = libraryStateFixture();
  await fixture.loadAdminTrainingTemplates();
  assert.equal(fixture.values.state.templatesKnown, true);
  const oldTemplates = deferred(), oldCards = deferred();
  readDocs = () => oldTemplates.promise;
  readCards = () => oldCards.promise;
  const oldRequest = fixture.loadAdminTrainingTemplates();
  await tick();
  advanceAuthSession(fixture.auth, fixture.auth.currentUser);
  const currentTemplates = deferred(), currentCards = deferred();
  readDocs = () => currentTemplates.promise;
  readCards = () => currentCards.promise;
  const currentRequest = fixture.loadAdminTrainingTemplates();
  await tick();
  assert.equal(fixture.values.state.templates, "loading");
  assert.equal(fixture.values.state.cards, "loading");
  assert.equal(fixture.values.state.templatesKnown, false);
  assert.equal(fixture.values.state.cardsKnown, false);
  assert.equal(fixture.values.state.session.isCurrent(), true);
  currentTemplates.resolve(snapshot([item("current", { name: "Текущая сессия" })]));
  currentCards.resolve({ cards: [{ id: "current-card", ownerUid: "trainer", name: "Текущее упражнение" }] });
  await currentRequest;
  const currentState = fixture.values.state;
  const currentData = structuredClone({ templates: fixture.values.templates, cards: fixture.values.cards });
  const publications = { ...fixture.publications };
  oldTemplates.resolve(snapshot([item("old", { name: "Предыдущая сессия" })]));
  oldCards.resolve({ cards: [{ id: "old-card", ownerUid: "trainer", name: "Прежнее упражнение" }] });
  await oldRequest;
  assert.equal(fixture.values.state, currentState);
  assert.equal(fixture.values.state.session.isCurrent(), true);
  assert.deepEqual({ templates: fixture.values.templates, cards: fixture.values.cards }, currentData);
  assert.deepEqual(fixture.publications, publications);
});

const nutritionResult = uid => ({ state: { __uid: uid, days: {}, goals: { calories: 1900 } },
  coverage: { complete: true, missingDayKeys: [], nextCursor: null } });

test("enabled day storage replaces the summary legacy read and its old cache, preserving the source scheduler budget", async () => {
  const auth = authFixture(); let summaries = {}, legacyReads = 0, apiReads = 0, active = 0, peak = 0;
  const gate = deferred();
  readDoc = async ref => { if (ref.path.endsWith("nutrition/state")) legacyReads++; return missing(); };
  const loader = createTrainerClientSummaryLoader({ db: {}, auth, trainerClientSummaryRequestRef: { current: 0 },
    setTrainerClientSummaries: value => { summaries = typeof value === "function" ? value(summaries) : value; },
    setTrainerClientSummariesLoading: noop });
  const clients = Array.from({ length: 10 }, (_, index) => ({ id: `client-${index}`, role: "client" }));
  await loader.loadTrainerClientSummaries(clients);
  assert.equal(legacyReads, 10);
  configureNutritionDayStorage({ enabled: true });
  readNutrition = async (uid, options) => {
    assert.deepEqual(options, { mode: "full" }); apiReads++; active++; peak = Math.max(peak, active);
    await gate.promise; active--; return nutritionResult(uid);
  };
  const loading = loader.loadTrainerClientSummaries(clients);
  await tick(); assert.ok(apiReads > 0); assert.ok(peak <= 6);
  gate.resolve(); await loading;
  assert.equal(apiReads, 10); assert.equal(legacyReads, 10);
  assert.equal(summaries["client-0"].sources.nutrition.state, "fresh");
});

test("incomplete day storage response is an explicit summary source error, not frozen legacy or authoritative zero", async () => {
  configureNutritionDayStorage({ enabled: true });
  readNutrition = async uid => ({ ...nutritionResult(uid), coverage: { complete: false } });
  readDoc = async ref => { assert.ok(!ref.path.endsWith("nutrition/state")); return missing(); };
  let summaries = {};
  const loader = createTrainerClientSummaryLoader({ db: {}, auth: authFixture(), trainerClientSummaryRequestRef: { current: 0 },
    setTrainerClientSummaries: value => { summaries = typeof value === "function" ? value(summaries) : value; },
    setTrainerClientSummariesLoading: noop });
  const originalWarn = console.warn; console.warn = noop;
  try { await loader.loadTrainerClientSummaries([{ id: "client", role: "client", nutritionState: { days: { stale: {} } } }]); }
  finally { console.warn = originalWarn; }
  assert.equal(summaries.client.sources.nutrition.state, "error");
  assert.equal(summaries.client.sources.nutrition.code, "nutrition/incomplete-read");
  assert.equal(summaries.client.nutritionDays7, null);
  assert.equal(summaries.client.trainerSummaryReady, false);
});

test("failed refresh preserves same-source stale values but switching to day storage cannot reuse legacy nutrition", async () => {
  let summaries = {}, fail = false, legacyReads = 0;
  const client = { id: "client", role: "client", updatedAt: "initial" };
  readDocs = async ref => { if (fail && ref.path.endsWith("history")) throw new Error("Offline history"); return snapshot(); };
  readDoc = async ref => {
    if (ref.path.endsWith("nutrition/state")) { legacyReads++; if (fail) throw new Error("Offline legacy"); }
    return missing();
  };
  const loader = createTrainerClientSummaryLoader({ db: {}, auth: authFixture(), trainerClientSummaryRequestRef: { current: 0 },
    setTrainerClientSummaries: value => { summaries = typeof value === "function" ? value(summaries) : value; },
    setTrainerClientSummariesLoading: noop });
  await loader.loadTrainerClientSummaries([client]);
  const originalWarn = console.warn; console.warn = noop;
  try {
    fail = true; client.updatedAt = "changed";
    await loader.loadTrainerClientSummaries([client]);
    assert.equal(summaries.client.sources.history.state, "stale");
    assert.equal(summaries.client.sources.nutrition.state, "stale");
    configureNutritionDayStorage({ enabled: true });
    readNutrition = async () => { throw new Error("Offline API"); };
    await loader.loadTrainerClientSummaries([client]);
    assert.equal(summaries.client.sources.history.state, "stale");
    assert.equal(summaries.client.sources.nutrition.state, "error");
    assert.equal(legacyReads, 2);
  } finally { console.warn = originalWarn; }
});

test("overview uses the complete day API and never mirrors an API failure as an empty or legacy diary", async () => {
  configureNutritionDayStorage({ enabled: true });
  const calls = []; let nutrition, selected, status, mirrors = 0;
  const names = ["setSelectedUserId", "setAdminClientTab", "setPage", "setAdminClientPageOpen", "setAdminUsersSelectedTab", "setAdminClientLoading", "setAdminClientTasks", "setAdminClientProgressPhotos", "setAdminClientEvents", "setAdminClientPayment", "setAdminPhotoCompareOpen", "setAdminTaskComposerOpen", "setAdminProgramControlOpen", "setUsersList", "setAdminAllUsersList", "setAdminClientHistory", "setAdminSelectedHistoryIds", "setAdminClientMeasurements", "setAdminPaymentDraft", "setAdminPhotoCompareIds", "setAdminTrainerNote", "setAdminCalendarDraft"];
  readDoc = async ref => { assert.ok(!ref.path.endsWith("nutrition/state")); return ref.path === "users/client"
    ? { id: "client", exists: () => true, data: () => ({ role: "client" }) } : missing(); };
  readNutrition = async (uid, options) => { calls.push([uid, options]); return nutritionResult(uid); };
  const loader = createTrainerClientOverviewLoader({ ...Object.fromEntries(names.map(name => [name, noop])), db: {}, auth: authFixture(),
    setAdminClientNutrition: value => { nutrition = value; }, setAdminClientStatus: value => { status = value; },
    setAdminSelectedClient: value => { selected = typeof value === "function" ? value(selected) : value; },
    mirrorClientForTrainer: async () => { mirrors++; } });
  await loader.loadAdminClientOverview({ id: "client" });
  assert.deepEqual(calls, [["client", { mode: "full" }]]); assert.equal(nutrition.__uid, "client"); assert.equal(mirrors, 1);
  readNutrition = async () => { throw Object.assign(new Error("Access denied"), { status: 403 }); };
  const originalError = console.error; console.error = noop;
  try { await loader.loadAdminClientOverview({ id: "client", nutritionState: { days: { stale: {} } } }); }
  finally { console.error = originalError; }
  assert.equal(nutrition, null); assert.equal(selected.trainerNutritionLoadError, true); assert.ok(status); assert.equal(mirrors, 1);
});

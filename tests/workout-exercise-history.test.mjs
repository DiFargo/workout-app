import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { invalidateWorkoutHistory } from "../src/utils/workoutHistoryRevision.js";

let fixtureSequence = 0;
const VIDEO = "gs://tren-85720.firebasestorage.app/template-exercise-videos/trainer/leg-curl.mp4";
const historyRow = (id = "day-1", overrides = {}) => ({ id, date: "2026-10-28T08:00:00.000Z", assignedProgramUpdatedAt: "v1",
  exercises: [{ id: "leg-curl", name: "Сгибание ног", sets: [{ set: 1, reps: 12, weight: "30", completed: true }] }], ...overrides });
const snapshot = rows => ({ docs: rows.map(({ id, ...data }) => ({ id, data: () => data })), metadata: { fromCache: false, hasPendingWrites: false } });

async function fixture() {
  const key = `history-test-${++fixtureSequence}`;
  const io = { queries: [], pending: [] };
  globalThis[key] = io;
  const sdk = `const io=globalThis[${JSON.stringify(key)}];
    export const collection=(db,...path)=>({db,path});
    export const orderBy=(field,direction)=>({type:'orderBy',field,direction});
    export const documentId=()=>({type:'documentId'});
    export const startAfter=(...values)=>({type:'startAfter',values});
    export const limit=count=>({type:'limit',count});
    export const query=(collection,...constraints)=>({collection,constraints});
    export const getDocs=query=>{io.queries.push(query);return new Promise((resolve,reject)=>io.pending.push({resolve,reject}))};`;
  let source = await readFile(new URL("../src/utils/workoutExerciseHistory.js", import.meta.url), "utf8");
  source = source.replace('from "firebase/firestore"', `from ${JSON.stringify(`data:text/javascript,${encodeURIComponent(sdk)}`)}`);
  for (const name of ["authSession", "sessionResource", "workoutHistoryRevision", "workoutMediaMerge"]) {
    source = source.replace(`from "./${name}.js"`, `from ${JSON.stringify(new URL(`../src/utils/${name}.js`, import.meta.url).href)}`);
  }
  const module = await import(`data:text/javascript,${encodeURIComponent(`${source}\n// ${key}`)}`);
  return { module, io, close: () => { delete globalThis[key]; } };
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test("история предпочитает точный ID/карточку, не объединяет одноимённые упражнения с разными ID", async () => {
  const { module, close } = await fixture();
  try {
    const target = { id: "leg-curl", name: "Сгибание ног", video: VIDEO };
    const exact = historyRow("exact", { exercises: [{ id: "leg-curl", name: "Переименованное упражнение", video: VIDEO, sets: [{ reps: 12, weight: 35, completed: true }] }] });
    const other = historyRow("same-name", { exercises: [{ id: "another-id", name: "Сгибание ног", sets: [{ reps: 12, weight: 999, completed: true }] }] });
    const selected = module.selectRecentWorkoutExerciseHistory([exact, other], target, { assignmentVersion: "v1" });
    assert.deepEqual(selected.entries.map(entry => entry.id), ["exact"]);
    assert.equal(selected.entries[0].summary, "1 × 35 кг × 12 повт.");
    const cardSets = [{ reps: 10, weight: 20, completed: true }];
    const card = { exerciseCardId: "card-1", exerciseCardOwnerUid: "trainer-a", name: "Новая подпись" };
    const cardRows = [historyRow("card", { exercises: [{ ...card, id: "instance-before", sets: cardSets }] }),
      historyRow("wrong-owner", { exercises: [{ ...card, exerciseCardOwnerUid: "trainer-b", id: "instance-now", sets: cardSets }] })];
    assert.deepEqual(module.selectRecentWorkoutExerciseHistory(cardRows, { ...card, id: "instance-now" }).entries.map(entry => entry.id), ["card"]);
    const nameOnly = historyRow("legacy-name", { exercises: [{ name: "  СГИБАНИЕ   НОГ  ", sets: cardSets }] });
    assert.equal(module.selectRecentWorkoutExerciseHistory([nameOnly], { name: "сгибание ног" }).entries.length, 1);
    assert.equal(module.selectRecentWorkoutExerciseHistory([nameOnly], target).entries.length, 0);
  } finally { close(); }
});

test("выборка ограничена20, строго учитывает назначение и возвращает только факты выполненных подходов", async () => {
  const { module, close } = await fixture();
  try {
    const target = { id: "leg-curl" };
    const rows = Array.from({ length: 21 }, (_, index) => historyRow(`day-${index}`, { date: new Date(Date.UTC(2026, 9, 28 - index)).toISOString() }));
    rows[0] = historyRow("other-assignment", { assignedProgramUpdatedAt: "v2" });
    rows[1] = historyRow("unversioned", { assignedProgramUpdatedAt: "" });
    rows[2] = historyRow("planned-only", { exercises: [], plannedSnapshot: { exercises: [{ id: "leg-curl", sets: [{ reps: 12, weight: 30 }] }] } });
    rows[3] = historyRow("partial", { exercises: [{ id: "leg-curl", sets: [
      { set: 1, reps: 12, weight: 30, completed: true },
      { set: 2, reps: 10, weight: 999, completed: false },
      { set: 3, enteredReps: 8, enteredWeight: "32,5" }
    ] }] });
    const result = module.selectRecentWorkoutExerciseHistory(rows, target, { assignmentVersion: "v1", scope: "assignment" });
    assert.equal(result.searchedWorkouts, 20); assert.equal(result.hasMore, true);
    assert.equal(result.entries.some(entry => ["other-assignment", "unversioned", "planned-only", "day-20"].includes(entry.id)), false);
    assert.deepEqual(result.entries.find(entry => entry.id === "partial").sets, [
      { set: 1, reps: 12, weight: 30, durationSeconds: null, setType: "work", type: "work", completed: true },
      { set: 3, reps: 8, weight: 32.5, durationSeconds: null, setType: "work", type: "work", completed: true }
    ]);
    const timed = module.selectRecentWorkoutExerciseHistory([historyRow("timed", { exercises: [{ id: "leg-curl", sets: [{ durationSeconds: 30, completed: true }] }] })], target);
    assert.equal(timed.entries[0].summary, "1 × 30 с");
    assert.deepEqual(module.selectRecentWorkoutExerciseHistory([], target), { entries: [], searchedWorkouts: 0, hasMore: false });
  } finally { close(); }
});

test("load делает только owner/date-desc/limit21 query, объединяет запросы и кеширует60с между упражнениями", async () => {
  const { module, io, close } = await fixture();
  const auth = { currentUser: { uid: "owner" } }, db = {};
  try {
    const args = { auth, db, exercise: { id: "leg-curl" }, assignmentVersion: "v1" };
    const first = module.loadRecentWorkoutExerciseHistory(args);
    const duplicate = module.loadRecentWorkoutExerciseHistory({ ...args, exercise: { id: "another" } });
    await nextTurn();
    assert.equal(io.queries.length, 1);
    assert.deepEqual(io.queries[0], { collection: { db, path: ["users", "owner", "history"] }, constraints: [
      { type: "orderBy", field: "date", direction: "desc" },
      { type: "orderBy", field: { type: "documentId" }, direction: "desc" }, { type: "limit", count: 21 }
    ] });
    io.pending[0].resolve(snapshot([historyRow()]));
    assert.equal((await first).entries.length, 1); assert.equal((await duplicate).entries.length, 0);
    assert.equal(first.isCurrent(), true); assert.equal(duplicate.isCurrent(), true);
    const realNow = Date.now, before = realNow();
    try {
      Date.now = () => before + 59000;
      assert.equal((await module.loadRecentWorkoutExerciseHistory(args)).entries.length, 1);
      assert.equal(io.queries.length, 1);
      Date.now = () => before + 61000;
      const expired = module.loadRecentWorkoutExerciseHistory(args);
      await nextTurn(); assert.equal(io.queries.length, 2);
      assert.equal(first.isCurrent(), false);
      io.pending[1].resolve(snapshot([]));
      assert.equal((await expired).searchedWorkouts, 0);
    } finally { Date.now = realNow; }
  } finally { close(); }
});

test("смена сеанса того же UID, force и новая ревизия блокируют устаревшие данные и ошибки", async () => {
  const { module, io, close } = await fixture();
  const auth = { currentUser: { uid: "owner" } }, args = { auth, db: {}, exercise: { id: "leg-curl" } };
  try {
    const oldSession = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); advanceAuthSession(auth, auth.currentUser);
    const current = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn();
    io.pending[1].resolve(snapshot([historyRow("current")]));
    assert.equal((await current).entries[0].id, "current");
    io.pending[0].resolve(snapshot([historyRow("old")]));
    assert.equal((await oldSession).isCurrent(), false);
    assert.equal(oldSession.isCurrent(), false);
    const forcedOld = module.loadRecentWorkoutExerciseHistory(args, { force: true });
    const joinedOld = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn();
    const forcedNew = module.loadRecentWorkoutExerciseHistory(args, { force: true });
    await nextTurn();
    assert.equal(forcedOld.isCurrent(), false); assert.equal(joinedOld.isCurrent(), false);
    io.pending[2].reject(new Error("obsolete failure"));
    assert.equal((await forcedOld).isCurrent(), false); assert.equal((await joinedOld).isCurrent(), false);
    io.pending[3].resolve(snapshot([historyRow("fresh")]));
    assert.equal((await forcedNew).entries[0].id, "fresh");
    invalidateWorkoutHistory(auth);
    assert.equal(forcedNew.isCurrent(), false);
    const afterSave = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); assert.equal(io.queries.length, 5);
    io.pending[4].resolve(snapshot([])); await afterSave;
  } finally { close(); }
});

test("timeout и ошибка не становятся пустой историей или cache; offline cache не выдаётся за свежую выборку", async () => {
  const { module, io, close } = await fixture();
  const args = { auth: { currentUser: { uid: "owner" } }, db: {}, exercise: { id: "leg-curl" } };
  try {
    const slow = module.loadRecentWorkoutExerciseHistory(args, { timeoutMs: 5 });
    await assert.rejects(slow, { code: "exercise-history/timeout" });
    const retry = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); assert.equal(slow.isCurrent(), false);
    io.pending[0].resolve(snapshot([historyRow("late")]));
    io.pending[1].resolve(snapshot([]));
    assert.deepEqual((({ entries, searchedWorkouts, hasMore }) => ({ entries, searchedWorkouts, hasMore }))(await retry), { entries: [], searchedWorkouts: 0, hasMore: false });
    const denied = module.loadRecentWorkoutExerciseHistory(args, { force: true });
    await nextTurn(); io.pending[2].reject(Object.assign(new Error("permission denied"), { code: "permission-denied" }));
    await assert.rejects(denied, { code: "permission-denied" });
    const cacheOnly = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[3].resolve({ ...snapshot([]), metadata: { fromCache: true } });
    await assert.rejects(cacheOnly, { code: "exercise-history/unverified" });
    const pendingWrites = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[4].resolve({ ...snapshot([]), metadata: { fromCache: false, hasPendingWrites: true } });
    await assert.rejects(pendingWrites, { code: "exercise-history/unverified" });
  } finally { close(); }
});

test("без авторизации запросов нет; account switch, database scope и отсутствие записей изолированы", async () => {
  const { module, io, close } = await fixture();
  const auth = { currentUser: null }, db = {};
  try {
    await assert.rejects(module.loadRecentWorkoutExerciseHistory({ auth, db }), { code: "exercise-history/auth-required" });
    assert.equal(io.queries.length, 0);
    auth.currentUser = { uid: "first" };
    const first = module.loadRecentWorkoutExerciseHistory({ auth, db, exercise: { id: "leg-curl" } });
    await nextTurn();
    auth.currentUser = { uid: "second" };
    const second = module.loadRecentWorkoutExerciseHistory({ auth, db, exercise: { id: "leg-curl" } });
    await nextTurn();
    assert.deepEqual(io.queries.map(item => item.collection.path), [["users", "first", "history"], ["users", "second", "history"]]);
    io.pending[0].resolve(snapshot([historyRow("first-private")]));
    io.pending[1].resolve(snapshot([]));
    assert.equal((await first).isCurrent(), false);
    assert.equal((await second).isCurrent(), true);
    const anotherDatabase = module.loadRecentWorkoutExerciseHistory({ auth, db: {}, exercise: { id: "leg-curl" } });
    await nextTurn(); assert.equal(io.queries.length, 3);
    io.pending[2].resolve(snapshot([])); await anotherDatabase;
  } finally { close(); }
});

test("пагинация не теряет21-й документ и не повторяет записи с одинаковой датой", async () => {
  const { module, io, close } = await fixture();
  const args = { auth: { currentUser: { uid: "owner" } }, db: {}, exercise: { id: "leg-curl" } };
  const date = "2026-10-28T08:00:00.000Z";
  const rows = Array.from({ length: 40 }, (_, index) => historyRow(`doc-${String(40 - index).padStart(3, "0")}`, { date }));
  try {
    const firstRequest = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[0].resolve(snapshot(rows.slice(0, 21)));
    const first = await firstRequest;
    assert.equal(first.entries.length, 20); assert.equal(first.searchedWorkouts, 20); assert.equal(first.hasMore, true);
    assert.equal(first.entries.at(-1).id, "doc-021");
    assert.equal(first.entries.some(entry => entry.id === "doc-020"), false);
    assert.equal(JSON.stringify(first.nextCursor), "{}"); assert.equal(Object.isFrozen(first.nextCursor), true);
    const cached = await module.loadRecentWorkoutExerciseHistory(args);
    assert.equal(cached.nextCursor, first.nextCursor);
    const secondRequest = module.loadRecentWorkoutExerciseHistory(args, { cursor: first.nextCursor });
    const joined = module.loadRecentWorkoutExerciseHistory(args, { cursor: first.nextCursor });
    await nextTurn(); assert.equal(io.queries.length, 2);
    assert.deepEqual(io.queries[1].constraints, [
      { type: "orderBy", field: "date", direction: "desc" },
      { type: "orderBy", field: { type: "documentId" }, direction: "desc" },
      { type: "startAfter", values: [date, "doc-021"] }, { type: "limit", count: 21 }
    ]);
    io.pending[1].resolve(snapshot(rows.slice(20)));
    const second = await secondRequest; await joined;
    assert.equal(second.entries[0].id, "doc-020"); assert.equal(second.hasMore, false); assert.equal(second.nextCursor, null);
    const all = [...first.entries, ...second.entries].map(entry => entry.id);
    assert.equal(all.length, 40); assert.equal(new Set(all).size, 40);
    assert.deepEqual(all, rows.map(row => row.id));
  } finally { close(); }
});

test("cursor сохраняет сырой Timestamp/date value, а не ISO для продолжения запроса", async () => {
  const { module, io, close } = await fixture();
  const args = { auth: { currentUser: { uid: "owner" } }, db: {}, exercise: { id: "leg-curl" } };
  const timestamp = { seconds: 1793174400, nanoseconds: 500, toDate: () => new Date("2026-10-28T08:00:00.000Z") };
  try {
    const request = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[0].resolve(snapshot(Array.from({ length: 21 }, (_, index) => historyRow(`timestamp-${21 - index}`, { date: timestamp }))));
    const first = await request;
    assert.equal(first.entries[0].date, "2026-10-28T08:00:00.000Z");
    const next = module.loadRecentWorkoutExerciseHistory(args, { cursor: first.nextCursor });
    await nextTurn();
    const continuation = io.queries[1].constraints.find(item => item.type === "startAfter");
    assert.equal(continuation.values[0], timestamp); assert.equal(continuation.values[1], "timestamp-2");
    io.pending[1].resolve(snapshot([])); await next;
  } finally { close(); }
});

test("cursor привязан к владельцу, сеансу, базе, упражнению, scope и ревизии; подделка не запускаетquery", async () => {
  const { module, io, close } = await fixture();
  const auth = { currentUser: { uid: "owner" } }, db = {}, args = { auth, db, exercise: { id: "leg-curl" } };
  try {
    const request = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[0].resolve(snapshot(Array.from({ length: 21 }, (_, index) => historyRow(`row-${index}`))));
    const { nextCursor } = await request;
    for (const [input, cursor] of [
      [args, {}], [args, JSON.parse(JSON.stringify(nextCursor))],
      [{ ...args, auth: { currentUser: { uid: "owner" } } }, nextCursor],
      [{ ...args, db: {} }, nextCursor], [{ ...args, exercise: { id: "other-exercise" } }, nextCursor],
      [{ ...args, scope: "assignment", assignmentVersion: "v1" }, nextCursor]
    ]) {
      await assert.rejects(module.loadRecentWorkoutExerciseHistory(input, { cursor }), { code: "exercise-history/cursor-invalid" });
    }
    assert.equal(io.queries.length, 1);
    advanceAuthSession(auth, auth.currentUser);
    await assert.rejects(module.loadRecentWorkoutExerciseHistory(args, { cursor: nextCursor }), { code: "exercise-history/cursor-invalid" });
    const freshRequest = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[1].resolve(snapshot(Array.from({ length: 21 }, (_, index) => historyRow(`new-${index}`))));
    const fresh = await freshRequest;
    invalidateWorkoutHistory(auth);
    await assert.rejects(module.loadRecentWorkoutExerciseHistory(args, { cursor: fresh.nextCursor }), { code: "exercise-history/cursor-invalid" });
    assert.equal(io.queries.length, 2);
  } finally { close(); }
});

test("обновление первой страницы инвалидирует всю старую цепочку и её поздний ответ", async () => {
  const { module, io, close } = await fixture();
  const args = { auth: { currentUser: { uid: "owner" } }, db: {}, exercise: { id: "leg-curl" } };
  const rows = Array.from({ length: 21 }, (_, index) => historyRow(`row-${index}`));
  try {
    const firstRequest = module.loadRecentWorkoutExerciseHistory(args);
    await nextTurn(); io.pending[0].resolve(snapshot(rows));
    const first = await firstRequest;
    const secondRequest = module.loadRecentWorkoutExerciseHistory(args, { cursor: first.nextCursor });
    await nextTurn();
    const replacement = module.loadRecentWorkoutExerciseHistory(args, { force: true });
    await nextTurn();
    assert.equal(firstRequest.isCurrent(), false); assert.equal(secondRequest.isCurrent(), false);
    io.pending[1].resolve(snapshot([historyRow("stale-page-two")]));
    assert.equal((await secondRequest).isCurrent(), false);
    await assert.rejects(module.loadRecentWorkoutExerciseHistory(args, { cursor: first.nextCursor }), { code: "exercise-history/cursor-invalid" });
    io.pending[2].resolve(snapshot(rows));
    const fresh = await replacement;
    assert.notEqual(fresh.nextCursor, first.nextCursor);
    assert.equal(fresh.isCurrent(), true);
  } finally { close(); }
});

test("all-time объединяет сменившиеся assignment IDs только по надёжнойcard/library или точнымvideo+имени/alias", async () => {
  const { module, close } = await fixture();
  const legacyUrl = "https://firebasestorage.googleapis.com/v0/b/tren-85720.firebasestorage.app/o/template-exercise-videos%2Ftrainer%2Fleg-curl.mp4?alt=media&token=old-token";
  const target = { id: "current-assignment-instance", name: "Сгибание ног лёжа", video: VIDEO,
    exerciseCardId: "card-current", exerciseCardOwnerUid: "trainer-a", exerciseCardNames: ["Сгибание ног"], previousNames: ["Сгибание ног в тренажёре"] };
  const legacy = historyRow("old-program", { assignedProgramUpdatedAt: "older-program", exercises: [{ id: "old-instance", name: "СГИБАНИЕ  НОГ", video: legacyUrl,
    sets: [{ reps: 12, weight: 30 }, { reps: 10, weight: 35, completed: false }] }] });
  const renamed = historyRow("older-name", { assignedProgramUpdatedAt: "even-older", exercises: [{ id: "another-instance", name: "Сгибание ног в тренажере", video: VIDEO,
    sets: [{ reps: 10, weight: 25 }] }] });
  const differentCard = historyRow("different-card", { exercises: [{ ...target, exerciseCardId: "not-this-card", name: "Сгибание ног", sets: [{ reps: 100, weight: 999 }] }] });
  const wrongVideo = historyRow("wrong-video", { exercises: [{ id: target.id, name: target.name, video: "gs://tren-85720.firebasestorage.app/another-exercise.mp4", sets: [{ reps: 100, weight: 999 }] }] });
  const fuzzyName = historyRow("not-exact-name", { exercises: [{ id: "different-id", name: "Сгибание ног сидя", video: VIDEO, sets: [{ reps: 100, weight: 999 }] }] });
  try {
    const result = module.selectRecentWorkoutExerciseHistory([legacy, renamed, differentCard, wrongVideo, fuzzyName], target, { assignmentVersion: "current-program" });
    assert.deepEqual(result.entries.map(entry => entry.id), ["old-program", "older-name"]);
    assert.equal(result.entries[0].sets.length, 1); assert.equal(result.entries[0].sets[0].weight, 30);
    assert.equal(module.selectRecentWorkoutExerciseHistory([legacy], target, { assignmentVersion: "current-program", scope: "assignment" }).entries.length, 0);
    const sameCard = historyRow("same-card", { exercises: [{ ...target, id: "old-copy", name: "Старое название", video: "gs://tren-85720.firebasestorage.app/old-demo.mp4", sets: [{ reps: 10, weight: 20 }] }] });
    assert.equal(module.selectRecentWorkoutExerciseHistory([sameCard], target).entries.length, 1);
    const libraryTarget = { ...target, exerciseCardId: undefined, libraryExerciseId: "stable-library" };
    const libraryRows = [historyRow("library", { exercises: [{ ...libraryTarget, id: "other-copy", name: "Старый заголовок", video: "different", sets: [{ reps: 10, weight: 20 }] }] }),
      historyRow("wrong-library", { exercises: [{ ...libraryTarget, libraryExerciseId: "other-library", sets: [{ reps: 999, weight: 999 }] }] })];
    assert.deepEqual(module.selectRecentWorkoutExerciseHistory(libraryRows, libraryTarget).entries.map(entry => entry.id), ["library"]);
  } finally { close(); }
});

test("старыеplain фактические подходы и типwarmup сохраняются; plannedSnapshot не подменяет actual результаты", async () => {
  const { module, close } = await fixture();
  const target = { id: "leg-curl" };
  try {
    const row = historyRow("legacy", { exercises: [{ id: "leg-curl", sets: [
      { reps: 15, weight: 10, type: "warmup" }, { reps: 12, weight: 30, setType: "work" },
      { durationSeconds: 45, weight: 0 }, { reps: 8, weight: 50, completed: false }
    ] }] });
    const sets = module.selectRecentWorkoutExerciseHistory([row], target).entries[0].sets;
    assert.equal(sets.length, 3); assert.equal(sets[0].setType, "warmup"); assert.equal(sets[0].type, "warmup");
    assert.equal(sets[1].weight, 30); assert.equal(sets[2].durationSeconds, 45);
    const transitional = historyRow("transitional", { exercises: [{ id: "leg-curl", sets: Array.from({ length: 3 }, () => ({ reps: 99, weight: 999 })) }],
      actualExercises: [{ id: "leg-curl", sets: [], actualSets: [{ reps: 12, weight: 35 }] }],
      plannedSnapshot: { exercises: [{ id: "leg-curl", sets: [{ reps: 99, weight: 999 }] }] } });
    assert.equal(module.selectRecentWorkoutExerciseHistory([transitional], target).entries[0].sets[0].weight, 35);
    assert.equal(module.selectRecentWorkoutExerciseHistory([historyRow("prescription", { exercises: [], plannedSnapshot: transitional.plannedSnapshot })], target).entries.length, 0);
  } finally { close(); }
});

test("вытеснение raw страниц из bounded LRU не ограничивает историю80 страницами", async () => {
  const { module, io, close } = await fixture();
  const args = { auth: { currentUser: { uid: "owner" } }, db: {}, exercise: { id: "leg-curl" } };
  const rows = Array.from({ length: 1800 }, (_, index) => historyRow(`doc-${String(1800 - index).padStart(4, "0")}`));
  try {
    let cursor = null, firstResult;
    const ids = [];
    for (let page = 0; page < 90; page++) {
      const request = module.loadRecentWorkoutExerciseHistory(args, { cursor });
      await nextTurn();
      assert.equal(io.queries.length, page + 1);
      io.pending[page].resolve(snapshot(rows.slice(page * 20, page * 20 + 21)));
      const result = await request;
      firstResult ||= result;
      assert.equal(result.isCurrent(), true); assert.equal(result.searchedWorkouts, 20);
      ids.push(...result.entries.map(entry => entry.id));
      cursor = result.nextCursor;
      assert.equal(result.hasMore, page < 89);
    }
    assert.equal(firstResult.isCurrent(), false); // Its cached raw payload was evicted.
    assert.equal(cursor, null);
    assert.deepEqual(ids, rows.map(row => row.id));
    assert.equal(new Set(ids).size, 1800);
  } finally { close(); }
});

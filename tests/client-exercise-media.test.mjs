import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";
import { mediaTrainerId, readClientExerciseMedia, resolveClientExerciseMedia } from "../functions/clientExerciseMedia.js";
import { loadClientExerciseMedia, withClientExerciseMedia } from "../src/utils/clientExerciseMedia.js";

const exercise = { id: "assigned-exercise", name: "Жим лёжа", sets: [{ reps: 12, weight: 20 }, { reps: 10, weight: 25 }], rest: "90 сек", video: "" };
const workout = { id: "day", assignedBy: "trainer", assignedProgramId: "program", assignedProgramUpdatedAt: "v1", status: "planned", exercises: [exercise] };
const template = { id: "library", ownerUid: "trainer", blocks: [{ weeks: [{ workouts: [{ exercises: [{ id: "library-exercise", name: "Жим лежа", video: "https://example.com/new.mp4", sets: [] }] }] }] }] };

test("new library videos resolve for existing copies without changing sets or stored history", () => {
  const before = structuredClone(workout);
  const media = resolveClientExerciseMedia([workout], [template], "trainer");
  assert.equal(media.length, 1);
  const resolved = withClientExerciseMedia(workout, media);
  assert.equal(resolved.exercises[0].video, "https://example.com/new.mp4");
  assert.deepEqual(resolved.exercises[0].sets, exercise.sets);
  assert.equal(resolved.exercises[0].rest, "90 сек");
  assert.deepEqual(workout, before);
  assert.equal(withClientExerciseMedia({ ...workout, assignedProgramUpdatedAt: "v2" }, media).exercises[0].video, "");
});

test("stable library identity survives renamed exercises and template layouts", () => {
  const renamed = { ...workout, exercises: [{ ...exercise, libraryExerciseId: "library-exercise", name: "Мой жим" }] };
  const flat = { ...template, blocks: undefined, workouts: template.blocks[0].weeks[0].workouts };
  const monthly = { ...template, blocks: undefined, months: [{ microcycles: template.blocks }] };
  for (const source of [template, flat, monthly]) assert.equal(resolveClientExerciseMedia([renamed], [source], "trainer").length, 1);
});

test("private videos and completed, archived, basic or other trainer assignments are untouched", () => {
  for (const patch of [{ status: "completed" }, { completedAt: "2026-09-09" }, { assignedProgramLifecycleStatus: "archived" }, { source: "basic" }, { assignedBy: "other" }]) {
    assert.deepEqual(resolveClientExerciseMedia([{ ...workout, ...patch }], [template], "trainer"), []);
  }
  const own = { ...workout, exercises: [{ ...exercise, video: "private.mp4" }] };
  assert.deepEqual(resolveClientExerciseMedia([own], [template], "trainer"), []);
  const inherited = { ...own, exercises: [{ ...own.exercises[0], videoAutoFilledFrom: exercise.name }] };
  assert.equal(resolveClientExerciseMedia([inherited], [template], "trainer")[0].video, "https://example.com/new.mp4");
  assert.deepEqual(resolveClientExerciseMedia([workout], [{ ...template, ownerUid: "other" }], "trainer"), []);
});

test("ambiguous names do not attach a different demonstration", () => {
  const duplicate = { id: "second", ownerUid: "trainer", workouts: [{ exercises: [{ id: "second-exercise", name: exercise.name, video: "different.mp4" }] }] };
  assert.deepEqual(resolveClientExerciseMedia([workout], [template, duplicate], "trainer"), []);
});

test("reviewed aliases fill old client copies but distinct filmed variants stay ambiguous", () => {
  const clientWorkout = { ...workout, exercises: [{ id: "legacy-copy", name: "Жим гантелей лёжа", sets: [{ reps: 12, weight: 40 }] }] };
  const libraryTemplate = { id: "library", ownerUid: "trainer", workouts: [{ exercises: [{ id: "filmed", name: "Жим лёжа с гантелями", video: "press.mp4" }] }] };
  assert.equal(resolveClientExerciseMedia([clientWorkout], [libraryTemplate], "trainer")[0]?.video, "press.mp4");
  libraryTemplate.workouts[0].exercises.push({ id: "variant", name: "Жим гантелей лёжа", video: "variant.mp4" });
  assert.deepEqual(resolveClientExerciseMedia([clientWorkout], [libraryTemplate], "trainer"), []);
});

function database(profile = {}, reassign = false) {
  let profileReads = 0;
  const queries = [];
  return { queries, collection(name) {
    if (name === "trainingTemplates") return { where(field, operation, value) {
      queries.push([field, operation, value]);
      return { get: async () => ({ docs: [{ id: template.id, data: () => template }] }) };
    } };
    assert.equal(name, "users");
    return { doc(id) { assert.equal(id, "client"); return {
      get: async () => { profileReads++; return { exists: true, data: () => ({ role: "client", assignedTrainerId: "trainer", trainerAssignmentState: "assigned", ...profile, ...(reassign && profileReads > 1 ? { trainerAssignmentState: "revoked" } : {}) }) }; },
      collection(collectionName) { assert.equal(collectionName, "workouts"); return { get: async () => ({ docs: [{ id: workout.id, data: () => workout }] }) }; }
    }; } };
  } };
}

test("media API allows the client, assigned trainer and admin; never other users", async () => {
  for (const context of [{ uid: "client", role: "client" }, { uid: "trainer", role: "trainer" }, { uid: "admin", token: { admin: true } }]) {
    const db = database();
    const response = await readClientExerciseMedia({ db, context, clientId: "client" });
    assert.equal(response.media.length, 1);
    assert.deepEqual(db.queries, [["ownerUid", "==", "trainer"]]);
    assert.deepEqual(Object.keys(response), ["media"]);
    assert.equal(JSON.stringify(response).includes('"sets"'), false);
  }
  for (const context of [{ uid: "other", role: "trainer" }, { uid: "other", role: "client" }, { uid: "fake", role: "admin" }, { uid: "trainer", role: "client" }]) {
    const db = database();
    await assert.rejects(readClientExerciseMedia({ db, context, clientId: "client" }), { status: 403 });
    assert.equal(db.queries.length, 0);
  }
  await assert.rejects(readClientExerciseMedia({ db: database(), context: {}, clientId: "client" }), { status: 401 });
  await assert.rejects(readClientExerciseMedia({ db: database(), context: { uid: "client" }, clientId: "bad/path" }), { status: 400 });
});

test("revocation and reassignment stop previous library access, including an in-flight read", async () => {
  assert.equal(mediaTrainerId({ trainerAssignmentState: "revoked", assignedTrainerId: "trainer", createdByUid: "trainer" }), "");
  const db = database({ trainerAssignmentState: "revoked" });
  assert.deepEqual(await readClientExerciseMedia({ db, context: { uid: "client" }, clientId: "client" }), { media: [] });
  assert.equal(db.queries.length, 0);
  await assert.rejects(readClientExerciseMedia({ db, context: { uid: "trainer", role: "trainer" }, clientId: "client" }), { status: 403 });
  await assert.rejects(readClientExerciseMedia({ db: database({}, true), context: { uid: "client" }, clientId: "client" }), { status: 409 });
});

test("optional lookup uses an authenticated bounded request and preserves the plan on failure", async () => {
  const media = resolveClientExerciseMedia([workout], [template], "trainer");
  const result = await loadClientExerciseMedia("client", async (url, options, timeout) => {
    assert.equal(url, "/api/client-exercise-media"); assert.equal(timeout, 6000);
    assert.deepEqual(JSON.parse(options.body), { clientId: "client" });
    return { ok: true, json: async () => ({ media }) };
  });
  assert.deepEqual(result, media);
  const fallback = await loadClientExerciseMedia("client", async () => { throw Error("offline"); });
  assert.deepEqual(withClientExerciseMedia(workout, fallback), workout);
});

test("release wires media API through active membership and both plan loaders", async () => {
  const backend = await readFile("functions/index.js", "utf8");
  const handler = backend.slice(backend.indexOf("export const clientExerciseMedia ="), backend.indexOf("export const setAdminClaim ="));
  assert.match(handler, /requireActiveMember\(req\)/);
  assert.match(handler, /private, no-store/);
  const config = JSON.parse(await readFile("firebase.json", "utf8"));
  assert.equal(config.hosting.rewrites.find(rule => rule.source === "/api/client-exercise-media").function.functionId, "clientExerciseMedia");
  for (const path of ["src/features/client/workouts/workoutFirebaseLoadHandlers.js", "src/features/trainer/trainerClientOverviewLoader.js"]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /withClientExerciseMedia\(/);
    assert.match(source, /loadClientExerciseMedia\(/);
  }
});

test("actual client loader displays newly uploaded library video on reopening an old assignment", async () => {
  let displayed;
  let currentTemplate = structuredClone(template);
  const profile = { assignedProgramId: "program", assignedProgramUpdatedAt: "v1" };
  const snapshot = (values) => { const docs = values.map(item => ({ id: item.id, data: () => item })); return { docs, forEach: callback => docs.forEach(callback) }; };
  const context = { console, Promise, Map, Set, String, Boolean, Array, programDraftSnapshot, withClientExerciseMedia,
    collection: (_db, ...parts) => ({ path: parts.join("/") }), doc: (_db, ...parts) => ({ path: parts.join("/") }),
    getDocs: async ref => snapshot(ref.path.endsWith("/workouts") ? [workout] : []),
    getDoc: async () => ({ exists: () => true, data: () => profile }),
    loadClientExerciseMedia: async () => resolveClientExerciseMedia([workout], [currentTemplate], "trainer"),
    safeReadUserJsonStorage: () => null, safeWriteUserJsonStorage: () => {}, clearStaleWorkoutCaches: () => {},
    resolveWorkoutPlanMode: () => "individual", isBasicWorkoutPlanItem: () => false,
    isTrainerProgramClientVisible: () => true, isTrainerClientCurrentAssignmentWorkout: () => true,
    buildTrainerClientProgramTimeline: () => [{ status: "active", workouts: [workout] }]
  };
  const source = await readFile("src/features/client/workouts/workoutFirebaseLoadHandlers.js", "utf8");
  vm.runInNewContext(source.replace(/import\s[\s\S]*?from\s+"[^"]+";\r?\n/g, "").replace(/export /g, ""), context);
  const settings = { db: {}, auth: { currentUser: { uid: "client" } }, plan: {}, normalizeExercise: e => e,
    sortWorkoutDays: days => days, canUseAdminFeatures: () => false, startPerformanceCheck: () => {},
    endPerformanceCheck: () => {}, showAppError: () => assert.fail("Plan load failed"), setPlan: plan => { displayed = plan; } };
  await context.loadWorkoutsFromFirebaseWithDeps(settings);
  assert.equal(displayed.workouts[0].exercises[0].video, "https://example.com/new.mp4");
  assert.equal(displayed.workouts[0]._editorSnapshot, programDraftSnapshot(workout));
  assert.equal(displayed.workouts[0].exercises[0].sets, workout.exercises[0].sets);
  currentTemplate.blocks[0].weeks[0].workouts[0].exercises[0].video = "https://example.com/replaced.mp4";
  await context.loadWorkoutsFromFirebaseWithDeps(settings);
  assert.equal(displayed.workouts[0].exercises[0].video, "https://example.com/replaced.mp4");
  assert.equal(workout.exercises[0].video, "", "Display lookup must not rewrite the persisted assignment");
});

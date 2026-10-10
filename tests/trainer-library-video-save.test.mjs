import assert from "node:assert/strict";
import { test, after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { exerciseCardDatabase } from "./helpers/exercise-card-database.mjs";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";

let template;
let uploads;
let writes;
let uploadFailure;
let cardDb;
let visibleTemplates;
const videoUrl = "https://example.test/replacement.mp4";
const cleanup = installRuntimeImports({
  "/src/utils/apiClient.js": {
    async fetchAuthorizedWithTimeout(_url, options) {
      try {
        const result = await manageTrainerExerciseCards({ db: cardDb, context: { uid: "trainer", role: "trainer" }, body: JSON.parse(options.body) });
        writes = cardDb.writes.length;
        return { ok: true, status: 200, json: async () => result };
      } catch (error) { return { ok: false, status: error.status, json: async () => ({ error: error.message }) }; }
    }
  },
  "firebase/firestore": {
    doc: (_db, collection, id) => `${collection}/${id}`,
    async runTransaction(_db, callback) {
      let next;
      const result = await callback({
        async get() { return { exists: () => true, id: "template", data: () => structuredClone(template) }; },
        set(ref, value) { assert.equal(ref, "trainingTemplates/template"); next = value; }
      });
      if (next) { template = next; writes += 1; }
      return result;
    }
  },
  "/src/utils/firebaseStorage.js": {
    async uploadStorageFile(path, file) {
      uploads.push({ path, name: file.name });
      if (uploadFailure) throw uploadFailure;
      return { path, url: videoUrl };
    }
  }
});
after(cleanup);
const { createTrainerPlanEditorHandlers } = await import("../src/features/trainer/trainerPlanEditorHandlers.js");

beforeEach(() => {
  uploads = []; writes = 0; uploadFailure = null;
  const exercise = { id: "leg-press", name: "Жим ногами", video: "https://example.test/old.mp4", rest: "90 сек", requiresWeight: true, usesWeight: true };
  template = { id: "template", ownerUid: "trainer", ownerRole: "trainer", workouts: [
    { id: "day-1", exercises: [{ ...exercise, sets: [{ reps: 12, weight: 110 }] }] },
    { id: "day-2", exercises: [{ ...exercise, sets: Array.from({ length: 3 }, () => ({ reps: 8, weight: 120 })) }] }
  ] };
  cardDb = exerciseCardDatabase({ "trainingTemplates/template": template });
  visibleTemplates = [structuredClone(template)];
});

function createEditor() {
  const original = structuredClone(template.workouts[0].exercises[0]);
  const clientPlan = structuredClone({ workouts: template.workouts });
  return {
    original: { ...original, librarySource: { type: "template", templateId: "template" } },
    clientPlan,
    handlers: createTrainerPlanEditorHandlers({
      plan: clientPlan, auth: { currentUser: { uid: "trainer" } }, db: {},
      adminTrainingTemplates: [template], canManageTrainingTemplate: item => item.ownerUid === "trainer",
      setAdminTrainingTemplates(updater) { visibleTemplates = updater(visibleTemplates); }, setAdminExerciseVideoUploadingId() {}, setAdminClientStatus() {},
      setPlan() { assert.fail("Library video must not modify the assigned plan"); },
      saveWorkoutsToFirebase() { assert.fail("Library video must not save assigned workouts"); }
    })
  };
}

test("replacement upload stays a draft; Save commits once and preserves every day's prescription", async () => {
  const { original, clientPlan, handlers } = createEditor();
  const before = structuredClone(template);
  const url = await handlers.uploadTrainerLibraryExerciseVideo(original, { name: "leg press.mp4" });
  assert.equal(url, videoUrl);
  assert.equal(uploads.length, 1);
  assert.equal(writes, 0, "Uploading must not change the exercise before Save");
  assert.deepEqual(template, before);
  const draft = { ...original, video: url, videoAutoFilledFrom: "" };
  assert.equal(await handlers.updateTrainerLibraryExercise(original, draft), true);
  assert.equal(writes, 1);
  assert.ok(visibleTemplates[0].workouts.every(day => day.exercises[0].video === videoUrl));
  assert.deepEqual(cardDb.documents.get("trainingTemplates/template"), before);
  assert.ok(cardDb.writes.every(path => path.startsWith("trainerExerciseCards/")));
  assert.deepEqual(template.workouts.map(day => day.exercises[0].sets), before.workouts.map(day => day.exercises[0].sets));
  assert.deepEqual(clientPlan.workouts, before.workouts);
});

test("closing after upload keeps the saved library untouched", async () => {
  const { original, handlers } = createEditor();
  const before = structuredClone(template);
  await handlers.uploadTrainerLibraryExerciseVideo(original, { name: "cancel.mp4" });
  assert.equal(writes, 0);
  assert.deepEqual(template, before);
});

test("failed upload preserves the old video and allows a retry", async (t) => {
  t.mock.method(console, "error", () => {});
  const { original, handlers } = createEditor();
  const before = structuredClone(template);
  uploadFailure = new Error("network");
  assert.equal(await handlers.uploadTrainerLibraryExerciseVideo(original, { name: "failed.mp4" }), false);
  assert.equal(writes, 0);
  assert.deepEqual(template, before);
  uploadFailure = null;
  assert.equal(await handlers.uploadTrainerLibraryExerciseVideo(original, { name: "retry.mp4" }), videoUrl);
  assert.equal(writes, 0);
});

test("the library uploader never writes video into an assigned client plan", async () => {
  const { original, handlers } = createEditor();
  const source = { ...original, librarySource: { type: "plan", workoutId: "day-1" } };
  assert.equal(await handlers.uploadTrainerLibraryExerciseVideo(source, { name: "plan.mp4" }), false);
  assert.equal(uploads.length, 0);
  assert.equal(writes, 0);
});

test("a real concurrent video change is still rejected with its specific explanation", async (t) => {
  t.mock.method(console, "error", () => {});
  const { original, handlers } = createEditor();
  await handlers.uploadTrainerLibraryExerciseVideo(original, { name: "draft.mp4" });
  for (const day of template.workouts) day.exercises[0].video = "https://example.test/other-tab.mp4";
  cardDb.documents.set("trainingTemplates/template", structuredClone(template));
  await assert.rejects(handlers.updateTrainerLibraryExercise(original, { video: videoUrl }), /Обновите библиотеку/);
  assert.equal(writes, 0);
  assert.ok(template.workouts.every(day => day.exercises[0].video.endsWith("other-tab.mp4")));
});

import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";
import { readClientExerciseMedia } from "../functions/clientExerciseMedia.js";
import { exerciseCardLegacyKey } from "../functions/exerciseCards.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("This test requires the local Firestore emulator. Production access is forbidden.");
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const projectId = "workout-exercise-cards-test";
let env, app, db;
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") } });
  app = initializeApp({ projectId }, "exercise-cards-emulator");
  db = getFirestore(app);
});
after(async () => { await db?.terminate(); if (app) await deleteApp(app); await env?.cleanup(); });

test("exercise cards: real transactions preserve programme copies, reject conflicts and keep trainer/client access isolated", async () => {
  await env.clearFirestore();
  const exercise = { id: "press", name: "Жим ногами", video: "https://example.test/old.mp4", rest: "100 сек", sets: Array.from({ length: 3 }, () => ({ reps: 12, weight: 110 })) };
  const workout = { id: "day", assignedBy: "trainer", assignedProgramId: "template", assignedProgramUpdatedAt: "version", status: "planned", exercises: [exercise] };
  const template = { ownerUid: "trainer", ownerRole: "trainer", workouts: [workout] };
  await db.doc("users/trainer").set({ role: "trainer" });
  await db.doc("users/other").set({ role: "trainer" });
  await db.doc("users/client").set({ role: "client", assignedTrainerId: "trainer" });
  await db.doc("trainingTemplates/template").set(template);
  await db.doc("users/client/workouts/day").set(workout);
  await db.doc("users/client/history/finished").set({ ...workout, completed: true });
  const context = { uid: "trainer", role: "trainer" };
  const videoCrop = { x: 0.2, y: 0.8, zoom: 1.5 };
  const { card } = await manageTrainerExerciseCards({ db, context, body: { action: "save", templateId: "template", exerciseId: "press", legacyKey: exerciseCardLegacyKey(exercise), patch: { name: exercise.name, video: "https://example.test/new.mp4", technique: "Новая техника", videoCrop, videoPosterTime: 1.2 } } });
  assert.equal("sets" in card, false);
  assert.equal(card.videoUpdatedAt, card.updatedAt);
  assert.deepEqual((await db.doc("trainingTemplates/template").get()).data(), template);
  assert.deepEqual((await db.doc("users/client/workouts/day").get()).data(), workout);
  assert.deepEqual((await db.doc("users/client/history/finished").get()).data(), { ...workout, completed: true });
  const media = await readClientExerciseMedia({ db, context: { uid: "client", role: "client" }, clientId: "client" });
  assert.equal(media.media[0].card.video, card.video);
  assert.deepEqual(media.media[0].card.videoCrop, videoCrop);
  assert.deepEqual((await db.doc(`trainerExerciseCards/${card.id}`).get()).data().videoCrop, videoCrop);
  assert.equal(media.media[0].card.videoPosterTime, 1.2);
  assert.equal((await db.doc(`trainerExerciseCards/${card.id}`).get()).data().videoPosterTime, 1.2);
  await assert.rejects(manageTrainerExerciseCards({ db, context: { uid: "other", role: "trainer" }, body: { action: "save", cardId: card.id, revision: 1, patch: { name: "Forbidden" } } }), { status: 403 });
  await assert.rejects(readClientExerciseMedia({ db, context: { uid: "other", role: "trainer" }, clientId: "client" }), { status: 403 });
  // One optimistic writer wins, the other sees a real transaction retry and a
  // stale revision, not a last-writer-wins overwrite.
  const edits = await Promise.allSettled(["A", "B"].map(name => manageTrainerExerciseCards({ db, context, body: { action: "save", cardId: card.id, revision: 1, patch: { name } } })));
  assert.equal(edits.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(edits.find(result => result.status === "rejected").reason.status, 409);
  assert.equal(edits.find(result => result.status === "fulfilled").value.card.videoUpdatedAt, card.videoUpdatedAt);
  for (const actor of [env.unauthenticatedContext(), env.authenticatedContext("trainer"), env.authenticatedContext("other"), env.authenticatedContext("client"), env.authenticatedContext("admin", { admin: true })]) {
    const ref = doc(actor.firestore(), "trainerExerciseCards", card.id);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { ...card, sets: [{ weight: 220 }] }));
  }
  await db.doc("users/client").update({ assignedTrainerId: "other" });
  assert.deepEqual((await readClientExerciseMedia({ db, context: { uid: "client", role: "client" }, clientId: "client" })).media, []);
});

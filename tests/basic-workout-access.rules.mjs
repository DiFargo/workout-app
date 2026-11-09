import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteField, Timestamp } from "firebase/firestore";
import { persistWorkoutCompletion } from "../src/features/client/workouts/workoutCompletionPersistence.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Local Firestore emulator required; Production is forbidden.");
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-basic-workout-access", firestore: {
    rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") } });
});
after(async () => env?.cleanup());

test("basic access is administrator-only and requires the existing security key proof", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "users/client"), { role: "client", assignedTrainerId: "trainer" });
    await setDoc(doc(db, "users/trainer"), { role: "trainer" });
    await setDoc(doc(db, "users/admin"), { role: "admin", adminSecurityKeyRequired: true, adminSecurityKeyVersion: "key-v1" });
  });
  const client = env.authenticatedContext("client").firestore();
  const trainer = env.authenticatedContext("trainer").firestore();
  const noKey = env.authenticatedContext("admin", { admin: true }).firestore();
  const admin = env.authenticatedContext("admin", { admin: true, adminSecurityKeyVersion: "key-v1", adminSecurityKeyRoleVersion: "legacy", adminSecurityKeyUntil: Date.now() + 3600000 }).firestore();
  for (const db of [client, trainer, noKey, env.unauthenticatedContext().firestore()]) {
    await assertFails(updateDoc(doc(db, "users/client"), { basicWorkoutAccess: true }));
  }
  await assertFails(updateDoc(doc(admin, "users/client"), { basicWorkoutAccess: "true" }));
  await assertSucceeds(updateDoc(doc(admin, "users/client"), { basicWorkoutAccess: true }));
  await assertFails(updateDoc(doc(client, "users/client"), { basicWorkoutAccess: false }));
  await assertFails(updateDoc(doc(client, "users/client"), { basicWorkoutAccess: deleteField() }));
  await assertSucceeds(setDoc(doc(client, "users/client/workouts/basic"), { source: "basic", exercises: [] }));
  await assertSucceeds(updateDoc(doc(client, "users/client"), { basicWorkoutPlan: { source: "basic", workouts: [] }, workoutModePreference: { mode: "basic" } }));
  await assertSucceeds(updateDoc(doc(admin, "users/client"), { basicWorkoutAccess: false }));
  await assertFails(setDoc(doc(client, "users/client/workouts/new"), { source: "basic", exercises: [] }));
  await assertFails(updateDoc(doc(client, "users/client/workouts/basic"), { exercises: [{ name: "new" }] }));
  await assertFails(updateDoc(doc(client, "users/client/workouts/basic"), { source: "trainer", exercises: [{ name: "disguised" }] }));
  await assertFails(updateDoc(doc(client, "users/client"), { basicWorkoutPlan: { source: "basic", workouts: [{ id: "new" }] } }));
  await assertSucceeds(updateDoc(doc(client, "users/client"), { workoutModePreference: { mode: "individual" } }));
  await assertSucceeds(getDoc(doc(client, "users/client/workouts/basic")));
  await assertSucceeds(setDoc(doc(client, "users/client/workouts/individual"), { source: "trainer", exercises: [] }));
  for (const [index, value] of [42, Timestamp.fromMillis(1000)].entries()) {
    const legacyRef = doc(client, `users/client/workouts/legacy-${index}`);
    await assertSucceeds(setDoc(legacyRef, { assignedProgramUpdatedAt: value, exercises: [] }));
    await assertSucceeds(updateDoc(legacyRef, { note: "Обычное индивидуальное занятие" }));
  }
  assert.equal((await getDoc(doc(client, "users/client"))).data().basicWorkoutAccess, false);
});

test("missing grants deny new basic plans; revocation still saves an in-flight result without advancing the plan", async () => {
  const plan = { id: "p", basicPlanId: "p", source: "basic", workouts: [{ id: "old", source: "basic", exercises: [] }] };
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "users/legacy"), { role: "client", basicWorkoutPlan: plan });
    await setDoc(doc(context.firestore(), "users/legacy/workouts/old"), plan.workouts[0]);
  });
  const db = env.authenticatedContext("legacy").firestore();
  await assertFails(updateDoc(doc(db, "users/legacy"), { workoutModePreference: { mode: "basic" } }));
  await assertFails(setDoc(doc(db, "users/legacy/workouts/new"), { source: "basic" }));
  await assertSucceeds(persistWorkoutCompletion({ db, uid: "legacy", entry: { id: "completed", date: "2026-11-09" }, completion: { plan, workout: plan.workouts[0] } }));
  assert.equal((await getDoc(doc(db, "users/legacy/history/completed"))).exists(), true);
  assert.deepEqual((await getDoc(doc(db, "users/legacy"))).data().basicWorkoutPlan, plan);
  await assertFails(setDoc(doc(env.authenticatedContext("other").firestore(), "users/legacy/history/forged"), { date: "2026-11-09" }));
});

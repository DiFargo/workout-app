import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

for (const name of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] || "")) {
    throw new Error(`${name} must point to a local emulator; production access is forbidden.`);
  }
}
// Storage's cross-service firestore.get/exists is resolved against the CLI's
// emulator project, not the bucket/test-environment project. Use the same ID
// when seeding profiles (emulators:exec supplies GCLOUD_PROJECT).
const projectId = process.env.GCLOUD_PROJECT;
if (!projectId?.startsWith("demo-")) {
  throw new Error("Start both emulators with --project demo-workout-rules; GCLOUD_PROJECT must match that demo project.");
}
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId,
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") },
    storage: { rules: await readFile(new URL("../storage.rules", import.meta.url), "utf8") } });
});
after(async () => { await env?.cleanup(); });
const bytes = new Uint8Array([1, 2, 3]);
const adminFile = (ctx) => ctx.storage().ref("admin/security-proof.txt");
const photo = (ctx) => ctx.storage().ref("progress-photos/client/session/front.webp");
const changeUser = (uid, patch) => env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "users", uid), patch));

test("Storage immediately rejects demoted/stale admin tokens while preserving legacy and current admin access", async () => {
  await env.clearFirestore(); await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/admin"), { role: "admin" });
    await setDoc(doc(ctx.firestore(), "users/client"), { role: "client", assignedTrainerId: "trainer" });
    await setDoc(doc(ctx.firestore(), "users/trainer"), { role: "trainer" });
  });
  const old = env.authenticatedContext("admin", { admin: true });
  await assertSucceeds(adminFile(old).put(bytes, { contentType: "text/plain" }));
  await assertSucceeds(adminFile(old).getMetadata());
  await changeUser("admin", { role: "client", adminClaimVersion: "revoked" });
  await assertFails(adminFile(old).getMetadata());
  await assertFails(adminFile(old).put(bytes, { contentType: "text/plain" }));
  await assertFails(adminFile(old).delete());
  await changeUser("admin", { role: "admin", adminClaimVersion: "new-grant" });
  await assertFails(adminFile(old).getMetadata());
  await assertFails(adminFile(env.authenticatedContext("admin", { admin: true, adminClaimVersion: "revoked" })).getMetadata());
  const current = env.authenticatedContext("admin", { admin: true, adminClaimVersion: "new-grant" });
  await assertSucceeds(adminFile(current).getMetadata());
  await assertSucceeds(adminFile(current).put(bytes, { contentType: "text/plain" }));
  await assertFails(adminFile(env.authenticatedContext("admin")).getMetadata());
  await assertSucceeds(adminFile(current).delete());
});

test("Storage photo upload remains available to the owner/assigned trainer and stops while client deletion is pending", async () => {
  await env.clearFirestore(); await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/client"), { role: "client", assignedTrainerId: "trainer" });
    await setDoc(doc(ctx.firestore(), "users/trainer"), { role: "trainer" });
    await setDoc(doc(ctx.firestore(), "users/other-trainer"), { role: "trainer" });
  });
  const owner = env.authenticatedContext("client"), trainer = env.authenticatedContext("trainer");
  await assertSucceeds(photo(owner).put(bytes, { contentType: "image/webp" }));
  await assertSucceeds(photo(trainer).put(bytes, { contentType: "image/webp" }));
  await assertFails(photo(env.authenticatedContext("other-trainer")).put(bytes, { contentType: "image/webp" }));
  await changeUser("client", { active: false, accessDisabled: true });
  await assertFails(photo(owner).put(bytes, { contentType: "image/webp" }));
  await assertFails(photo(trainer).put(bytes, { contentType: "image/webp" }));
});

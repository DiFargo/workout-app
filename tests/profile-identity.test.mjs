import { test } from "node:test";
import assert from "node:assert/strict";
import { requireRecentIdentityAuth, updateProfileEmail, updateProfileLogin } from "../functions/profileIdentity.js";
import { resolveAssignedTrainerId } from "../functions/trainerAssignment.js";
import { trainerExportRowsToCsv, buildAdminClientCsvLines } from "../src/utils/trainerClientExport.js";

function fixture() {
  const docs = new Map([
    ["users/a", { loginLower: "alpha", email: "a@example.test", accountProfile: { login: "alpha" } }],
    ["users/b", { loginLower: "bravo", email: "b@example.test" }],
    ["loginAliases/alpha", { uid: "a", email: "a@example.test" }],
    ["loginAliases/bravo", { uid: "b", email: "b@example.test" }]
  ]);
  const accounts = { a: { uid: "a", email: "a@example.test" }, b: { uid: "b", email: "b@example.test" } };
  let chain = Promise.resolve();
  const db = {
    failFinalize: false,
    collection: (name) => ({ doc: (id) => `${name}/${id}` }),
    runTransaction(fn) {
      const result = chain.then(async () => {
        const writes = [];
        const result = await fn({
          get: async (ref) => ({ exists: docs.has(ref), data: () => structuredClone(docs.get(ref)) }),
          set: (ref, data) => writes.push([ref, data]),
          delete: (ref) => writes.push([ref, null])
        });
        if (db.failFinalize && writes.some(([, data]) => data?.profileIdentityOperation === null && data?.email)) throw new Error("network");
        for (const [ref, data] of writes) data === null ? docs.delete(ref) : docs.set(ref, { ...docs.get(ref), ...data });
        return result;
      });
      chain = result.catch(() => {});
      return result;
    }
  };
  const auth = {
    getUser: async (uid) => ({ ...accounts[uid] }),
    getUserByEmail: async (email) => Object.values(accounts).find((item) => item.email === email) || null,
    updateUser: async (uid, values) => { Object.assign(accounts[uid], values); }
  };
  return { db, auth, docs, accounts };
}

test("email requires recent verified auth; explicit revoked/unknown states cannot fall back to a historical trainer", () => {
  const now = Date.now();
  for (const token of [{}, { auth_time: 1 }, { auth_time: (now + 60000) / 1000 }]) assert.throws(() => requireRecentIdentityAuth(token, now), /requires-recent-login/);
  requireRecentIdentityAuth({ auth_time: now / 1000 - 30 }, now);
  for (const state of ["revoked", "unassigned", "suspended"]) assert.equal(resolveAssignedTrainerId({ trainerAssignmentState: state, createdByUid: "old", trainerId: "old" }), "");
  assert.equal(resolveAssignedTrainerId({ createdByUid: "old" }), "old");
  assert.equal(resolveAssignedTrainerId({ trainerAssignmentState: "assigned", assignedTrainerId: "new", createdByUid: "old" }), "new");
});

test("foreign aliases cannot be overwritten or deleted through forged profile identity", async () => {
  const f = fixture();
  f.docs.set("users/a", { loginLower: "bravo", accountProfile: { login: "bravo" } });
  await assert.rejects(updateProfileEmail({ ...f, uid: "a", email: "new@example.test", operationId: "one" }), /ownership-conflict/);
  await assert.rejects(updateProfileLogin({ ...f, uid: "a", login: "charlie" }), /ownership-conflict/);
  assert.equal(f.accounts.a.email, "a@example.test");
  assert.equal(f.docs.get("loginAliases/bravo").uid, "b");
});

test("concurrent claims of a login have one winner and preserve the other identity", async () => {
  const f = fixture();
  const result = await Promise.allSettled(["a", "b"].map((uid) => updateProfileLogin({ ...f, uid, login: "shared" })));
  assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
  const winner = f.docs.get("loginAliases/shared").uid;
  assert.equal(f.docs.get(`users/${winner}`).loginLower, "shared");
  const loserAlias = winner === "a" ? "bravo" : "alpha";
  assert.ok(f.docs.has(`loginAliases/${loserAlias}`));
});

test("email finalization failure remains retryable and prevents interleaved login changes", async () => {
  const f = fixture();
  f.db.failFinalize = true;
  await assert.rejects(updateProfileEmail({ ...f, uid: "a", email: "new@example.test", operationId: "one" }), /network/);
  assert.equal(f.accounts.a.email, "new@example.test");
  assert.equal(f.docs.get("users/a").profileIdentityOperation.id, "one");
  await assert.rejects(updateProfileLogin({ ...f, uid: "a", login: "charlie" }), /email-update-pending/);
  f.db.failFinalize = false;
  await updateProfileEmail({ ...f, uid: "a", email: "new@example.test", operationId: "retry" });
  assert.equal(f.docs.get("users/a").email, "new@example.test");
  assert.equal(f.docs.get("loginAliases/alpha").email, "new@example.test");
  assert.equal(f.docs.get("users/a").profileIdentityOperation, null);
});

test("CSV exports keep text inert and preserve quoted names, delimiters and numeric values", () => {
  const csv = trainerExportRowsToCsv([["=1+1", "\t@SUM(1)", 'Name, "quote"', -2]]);
  assert.equal(csv, '"\'=1+1","\'\t@SUM(1)","Name, ""quote""","-2"');
  const row = buildAdminClientCsvLines([{ date: "+1", workout: "=1+1", readiness: { title: 'a,"b"' } }])[1];
  assert.ok(row.includes('"\'+1"'));
  assert.ok(row.includes('"a,""b"""'));
});

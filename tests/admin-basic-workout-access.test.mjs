import assert from "node:assert/strict";
import test from "node:test";
import { updateAdminBasicWorkoutAccess } from "../src/utils/adminBasicWorkoutAccess.js";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { handleTrainerClientActionWithDeps } from "../src/features/trainer/trainerClientActionHandlers.js";

const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
function fixture(options = {}) {
  const auth = { currentUser: { uid: "administrator" } }, calls = [];
  let saved;
  const args = { auth, db: { app: { options: { projectId: "workout-app-test" } } }, clientId: "client", allowed: true,
    timeoutMs: 30, readbackTimeoutMs: 20, request: async (url, init) => {
      calls.push({ url, ...init });
      if (init.method === "PATCH") {
        if (options.status) return response({}, options.status);
        saved = { fields: JSON.parse(init.body).fields, updateTime: "new-version" };
        if (options.lostReply) throw new TypeError("Network interrupted");
        if (options.hangingWrite) return new Promise(() => {});
        return response(saved);
      }
      if (options.hangingRead) return new Promise(() => {});
      return response(calls.length > 1 && !options.readbackMismatch ? saved : { fields: { role: { stringValue: options.role || "client" } }, updateTime: "2026-11-10T00:00:00Z" });
    } };
  return { args, calls, auth };
}
test("admin admission uses server REST and versioned two-field PATCH, never the SDK offline queue", async () => {
  const env = fixture(), patch = await updateAdminBasicWorkoutAccess(env.args);
  assert.equal(patch.basicWorkoutAccess, true); assert.equal(env.calls.length, 2);
  const save = env.calls[1], url = new URL(save.url);
  assert.equal(url.hostname, "firestore.googleapis.com");
  assert.deepEqual(url.searchParams.getAll("updateMask.fieldPaths"), ["basicWorkoutAccess", "updatedAt"]);
  assert.equal(url.searchParams.get("currentDocument.updateTime"), "2026-11-10T00:00:00Z");
  assert.deepEqual(Object.keys(JSON.parse(save.body).fields), ["basicWorkoutAccess", "updatedAt"]);
  assert.ok(save.signal instanceof AbortSignal);
});
test("current profile role is verified before any privileged PATCH", async () => {
  const env = fixture({ role: "trainer" }); await assert.rejects(updateAdminBasicWorkoutAccess(env.args), { code: "basic-access-invalid-target" });
  assert.equal(env.calls.length, 1);
});
test("403 and stale updateTime report errors without retrying a write or optimistic success", async () => {
  for (const [status, code] of [[403, "basic-access-permission-denied"], [412, "basic-access-conflict"], [409, "basic-access-conflict"]]) {
    const env = fixture({ status }); await assert.rejects(updateAdminBasicWorkoutAccess(env.args), { code }); assert.equal(env.calls.length, 2);
  }
});
test("ambiguous PATCH accepts only exact timestamped server readback", async () => {
  const success = fixture({ lostReply: true }); assert.equal((await updateAdminBasicWorkoutAccess(success.args)).basicWorkoutAccess, true); assert.equal(success.calls.length, 3);
  const uncertain = fixture({ lostReply: true, readbackMismatch: true }); await assert.rejects(updateAdminBasicWorkoutAccess(uncertain.args), { code: "basic-access-unconfirmed" });
  assert.equal(uncertain.calls.filter(call => call.method === "PATCH").length, 1);
});
test("an indefinitely pending transport is aborted and settles; no SDK write exists to replay later", async () => {
  const env = fixture({ hangingRead: true }); await assert.rejects(updateAdminBasicWorkoutAccess(env.args), { code: "basic-access-unavailable" });
  assert.equal(env.calls.length, 1); assert.equal(env.calls[0].signal.aborted, true);
});
test("old admin session cannot commit a newly confirmed operation", async () => {
  const env = fixture(), original = env.args.request;
  env.args.request = async (...args) => { const result = await original(...args); advanceAuthSession(env.auth, env.auth.currentUser); return result; };
  await assert.rejects(updateAdminBasicWorkoutAccess(env.args), { code: "basic-access-session-changed" });
  assert.equal(env.calls.length, 1);
});

test("session replacement aborts an in-flight read without waiting for its long network deadline", async () => {
  const env = fixture({ hangingRead: true }); env.args.timeoutMs = 5000;
  const pending = updateAdminBasicWorkoutAccess(env.args);
  setTimeout(() => advanceAuthSession(env.auth, env.auth.currentUser), 5);
  await assert.rejects(pending, { code: "basic-access-session-changed" });
  assert.equal(env.calls[0].signal.aborted, true); assert.equal(env.calls.length, 1);
});

test("a lost hanging PATCH is acknowledged only by its exact server readback", async () => {
  const confirmed = fixture({ hangingWrite: true });
  assert.equal((await updateAdminBasicWorkoutAccess(confirmed.args)).basicWorkoutAccess, true);
  assert.equal(confirmed.calls[1].signal.aborted, true);
  const unknown = fixture({ hangingWrite: true, readbackMismatch: true });
  await assert.rejects(updateAdminBasicWorkoutAccess(unknown.args), { code: "basic-access-unconfirmed" });
  assert.equal(unknown.calls.filter(call => call.method === "PATCH").length, 1);
});
function handlerFixture(overrides = {}) {
  const auth = { currentUser: { uid: "admin" } }, changes = [], statuses = [], client = { id: "client", role: "client", assignedProgramId: "preserved" };
  let selected = client, users = [client], writes = 0;
  const args = { auth, db: {}, adminSelectedClient: client, canUseTrainerFeatures: () => true, canUseAdminFeatures: () => true,
    canManageClientProgram: () => true, showAppConfirm: async () => true,
    saveBasicWorkoutAccess: async () => { writes++; return { basicWorkoutAccess: true, updatedAt: "confirmed" }; },
    setUsersList: update => { users = update(users); changes.push("users"); }, setAdminSelectedClient: update => { selected = update(selected); changes.push("selected"); },
    setAdminClientStatus: value => statuses.push(value), action: "grant_basic_access", ...overrides };
  return { args, changes, statuses, state: () => ({ selected, users, writes }) };
}
test("confirmed server result alone updates the selected client while preserving its assignment", async () => {
  const env = handlerFixture(); assert.equal(await handleTrainerClientActionWithDeps(env.args), true);
  assert.equal(env.state().selected.basicWorkoutAccess, true); assert.equal(env.state().selected.assignedProgramId, "preserved");
  assert.equal(env.state().writes, 1); assert.match(env.statuses.at(-1), /открыт/);
});
test("cancel and session change during confirmation never enqueue or send a grant", async () => {
  const cancelled = handlerFixture({ showAppConfirm: async () => false }); assert.equal(await handleTrainerClientActionWithDeps(cancelled.args), false); assert.equal(cancelled.state().writes, 0);
  const changed = handlerFixture(); changed.args.showAppConfirm = async () => { advanceAuthSession(changed.args.auth, changed.args.auth.currentUser); return true; };
  assert.equal(await handleTrainerClientActionWithDeps(changed.args), false); assert.equal(changed.state().writes, 0);
});
test("server failure leaves old access and assignment unchanged and returns actionable sheet error", async () => {
  const error = Object.assign(new Error("unconfirmed"), { basicWorkoutAccessMessage: "Обновите карточку клиента перед повторной попыткой." });
  const env = handlerFixture({ saveBasicWorkoutAccess: async () => { throw error; } });
  await assert.rejects(handleTrainerClientActionWithDeps(env.args), error); assert.deepEqual(env.changes, []);
  assert.equal(env.state().selected.basicWorkoutAccess, undefined); assert.equal(env.state().selected.assignedProgramId, "preserved"); assert.equal(env.statuses.at(-1), error.basicWorkoutAccessMessage);
});

test("a failed save from a replaced session does not publish late status or access changes", async () => {
  const env = handlerFixture(); env.args.saveBasicWorkoutAccess = async () => {
    advanceAuthSession(env.args.auth, env.args.auth.currentUser); throw new Error("old session");
  };
  assert.equal(await handleTrainerClientActionWithDeps(env.args), false);
  assert.deepEqual(env.statuses, []); assert.deepEqual(env.changes, []);
});

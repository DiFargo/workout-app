import test from "node:test";
import assert from "node:assert/strict";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { invalidateSessionResource, runSessionResource } from "../src/utils/sessionResource.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("session resources coalesce in-flight work and cache only on explicit request", async () => {
  const auth = { currentUser: { uid: "owner" } };
  const pending = deferred();
  let reads = 0;
  const load = () => { reads += 1; return pending.promise; };
  const first = runSessionResource(auth, "history:all", load);
  const duplicate = runSessionResource(auth, "history:all", load);
  assert.equal(first, duplicate);
  await Promise.resolve();
  assert.equal(reads, 1);
  pending.resolve(["one"]);
  assert.deepEqual(await first, ["one"]);
  assert.deepEqual(await runSessionResource(auth, "history:all", load, { maxAgeMs: 3000 }), ["one"]);
  assert.equal(reads, 1);
  await runSessionResource(auth, "history:all", () => { reads += 1; return ["two"]; });
  assert.equal(reads, 2);
});

test("force supersedes an older response and invalidates its application guard", async () => {
  const auth = { currentUser: { uid: "owner" } };
  const old = deferred();
  let canApply;
  const first = runSessionResource(auth, "plan", ({ isCurrent }) => { canApply = isCurrent; return old.promise; });
  await Promise.resolve();
  assert.equal(canApply(), true);
  assert.equal(await runSessionResource(auth, "plan", () => "new", { force: true }), "new");
  assert.equal(canApply(), false);
  old.resolve("old");
  assert.equal(await first, null);
  assert.equal(await runSessionResource(auth, "plan", () => "unexpected", { maxAgeMs: 3000 }), "new");
});

test("same-account re-login, scope and invalidation never share old work", async () => {
  const auth = { currentUser: { uid: "owner" } };
  const old = deferred();
  const first = runSessionResource(auth, "plan:v1", () => old.promise);
  await Promise.resolve();
  advanceAuthSession(auth, auth.currentUser);
  assert.equal(await runSessionResource(auth, "plan:v1", () => "current"), "current");
  assert.equal(await runSessionResource(auth, "plan:v2", () => "other"), "other");
  old.resolve("previous login");
  assert.equal(await first, null);
  invalidateSessionResource(auth, (key) => key.startsWith("plan:"));
  assert.equal(await runSessionResource(auth, "plan:v1", () => "reloaded", { maxAgeMs: 3000 }), "reloaded");
});

test("a failed resource can retry, and signed-out sessions do not dispatch", async () => {
  const auth = { currentUser: { uid: "owner" } };
  let canApplyFailure;
  await assert.rejects(runSessionResource(auth, "profile", ({ isCurrent }) => {
    canApplyFailure = isCurrent;
    throw new Error("network");
  }), /network/);
  assert.equal(canApplyFailure(), true);
  assert.equal(await runSessionResource(auth, "profile", () => "ok"), "ok");
  assert.equal(canApplyFailure(), false);
  auth.currentUser = null;
  assert.equal(await runSessionResource(auth, "profile", () => { throw new Error("must not run"); }), null);
});

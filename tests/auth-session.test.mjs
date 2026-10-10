import assert from "node:assert/strict";
import test from "node:test";
import { advanceAuthSession, captureAuthSession } from "../src/utils/authSession.js";

test("a captured session is invalid after switching accounts even before bootstrap runs", () => {
  const auth = { currentUser: { uid: "a" } };
  const session = captureAuthSession(auth);
  assert.equal(session.isCurrent(), true);
  auth.currentUser = { uid: "b" };
  assert.equal(session.isCurrent(), false);
  assert.equal(captureAuthSession(auth).uid, "b");
});

test("logout and same-account login invalidate deferred work even with the same user object", () => {
  const user = { uid: "a" };
  const auth = { currentUser: user };
  const session = captureAuthSession(auth);
  auth.currentUser = null;
  advanceAuthSession(auth, null);
  auth.currentUser = user;
  advanceAuthSession(auth, user);
  assert.equal(session.isCurrent(), false);
  assert.equal(captureAuthSession(auth).isCurrent(), true);
});

test("capturing more work in the same session does not invalidate earlier operations", () => {
  const auth = { currentUser: { uid: "a" } };
  advanceAuthSession(auth);
  const first = captureAuthSession(auth);
  const second = captureAuthSession(auth);
  assert.equal(first.isCurrent(), true);
  assert.equal(second.isCurrent(), true);
  assert.equal(captureAuthSession({ currentUser: null }).isCurrent(), false);
  assert.equal(captureAuthSession(null).isCurrent(), false);
});

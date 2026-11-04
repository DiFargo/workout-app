import assert from "node:assert/strict";
import test from "node:test";
import { loadProfileAchievementsHistory } from "../src/features/client/profile/profileAchievementsHistory.js";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { rememberClientWorkoutEvidence } from "../src/utils/clientWorkoutEvidence.js";
import { invalidateWorkoutHistory } from "../src/utils/workoutHistoryRevision.js";

test("achievements reuse verified complete all-period evidence without another read", async () => {
  const auth = { currentUser: { uid: "own" } };
  const model = { schemaVersion: 1, coverage: "complete", sourceRevision: "revision", completionHistory: [{ id: "old", date: "2025-05-05" }] };
  rememberClientWorkoutEvidence(model, () => true);
  const result = await loadProfileAchievementsHistory({ auth, uid: "own", plan: { readModel: model } }, () => { throw new Error("unexpected read"); });
  assert.equal(result.items[0].id, "old");
  assert.equal(result.isCurrent(), true);
  advanceAuthSession(auth);
  assert.equal(result.isCurrent(), false);
});

test("requireDetails bypasses confirmed compact evidence and reads verified full duration, status and exercises; default still skips", async () => {
  const auth = { currentUser: { uid: "own" } }, db = {};
  const model = { schemaVersion: 1, coverage: "complete", sourceRevision: "revision",
    completionHistory: [{ id: "old", date: "2025-05-05" }] };
  rememberClientWorkoutEvidence(model, () => true);
  const fullRecord = { date: "2025-05-05", durationSeconds: 2700, status: "completed",
    exercises: [{ id: "squat", sets: [{ completed: true, weight: 40, reps: 10 }] }] };
  let reads = 0;
  const readHistory = async (activeAuth, activeDb, uid) => {
    reads++;
    assert.equal(activeAuth, auth);
    assert.equal(activeDb, db);
    assert.equal(uid, "own");
    return { isCurrent: () => true, snapshot: { metadata: { fromCache: false, hasPendingWrites: false },
      forEach: fn => fn({ id: "old", data: () => fullRecord }) } };
  };
  const options = { auth, db, uid: "own", plan: { readModel: model } };
  const compact = await loadProfileAchievementsHistory(options, readHistory);
  assert.equal(reads, 0);
  assert.equal(compact.items[0].durationSeconds, undefined);
  const details = await loadProfileAchievementsHistory({ ...options, requireDetails: true }, readHistory);
  assert.equal(reads, 1);
  assert.deepEqual(details.items, [{ ...fullRecord, id: "old" }]);
  assert.equal(details.items[0].durationSeconds, 2700);
  assert.equal(details.isCurrent(), true);
});

test("fallback reads only the signed-in user's history and includes pending metadata", async () => {
  const auth = { currentUser: { uid: "own" } };
  const pending = { id: "pending", pendingSync: true };
  const result = await loadProfileAchievementsHistory({ auth, db: {}, uid: "own", history: [pending, { id: "stale" }] }, async (_auth, _db, uid) => {
    assert.equal(uid, "own");
    return { isCurrent: () => true, snapshot: { forEach: fn => fn({ id: "real", data: () => ({ id: "untrusted", date: "2026-05-05" }) }) } };
  });
  assert.deepEqual(result.items.map(item => item.id), ["real", "pending"]);
});

test("no read for an unrelated uid, and logout makes a pending result unusable", async () => {
  const auth = { currentUser: { uid: "own" } };
  assert.equal(await loadProfileAchievementsHistory({ auth, uid: "other" }, () => { throw new Error("unexpected read"); }), null);
  const result = await loadProfileAchievementsHistory({ auth, uid: "own" }, async () => {
    auth.currentUser = null;
    return { isCurrent: () => true, snapshot: { forEach() {} } };
  });
  assert.equal(result, null);
});

test("an obsolete history generation is never presented as an empty achievement history", async () => {
  const auth = { currentUser: { uid: "own" } };
  assert.equal(await loadProfileAchievementsHistory({ auth, uid: "own" }, async () => ({ isCurrent: () => false, snapshot: null })), null);
});

test("partial offline cache and pending writes cannot claim complete all-period achievements", async () => {
  const auth = { currentUser: { uid: "own" } };
  for (const metadata of [{ fromCache: true }, { hasPendingWrites: true }]) {
    const result = await loadProfileAchievementsHistory({ auth, uid: "own" }, async () => ({
      isCurrent: () => true, snapshot: { metadata, forEach() {} }
    }));
    assert.equal(result, null);
  }
});

test("accepted read-only facts survive a background reread, but not history invalidation", async () => {
  const auth = { currentUser: { uid: "own" } };
  let requestIsCurrent = true;
  const result = await loadProfileAchievementsHistory({ auth, uid: "own" }, async () => ({
    isCurrent: () => requestIsCurrent, snapshot: { forEach() {} }
  }));
  requestIsCurrent = false;
  assert.equal(result.isCurrent(), true);
  invalidateWorkoutHistory(auth);
  assert.equal(result.isCurrent(), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readClientLoadingSnapshot } from "../functions/clientLoadingSnapshot.js";
import { buildCompletedWorkoutSet } from "../functions/workoutCompletion.js";
import { buildTrainerClientProgramTimeline } from "../functions/trainerClientProgramAssignments.js";
import { buildLatestExerciseResults } from "../functions/workoutExerciseResults.js";

const profile = { role: "client", assignedProgramId: "program", assignedProgramUpdatedAt: "v2", assignedProgramAddedAt: "2026-10-01T00:00:00Z" };
const workout = { id: "day", assignedProgramId: "program", assignedProgramUpdatedAt: "v2", assignedProgramAddedAt: profile.assignedProgramAddedAt, exercises: [] };
function fixture({ user = profile, workouts = [workout], history = [], measurements = [], failPath, cachedPath } = {}) {
  const calls = [];
  const records = { "users/client/workouts": workouts, "users/client/history": history, "users/client/measurements": measurements };
  const reference = path => ({ path, collection: name => reference(`${path}/${name}`), doc: id => reference(`${path}/${id}`) });
  const doc = (id, data) => ({ id, exists: data !== null, data: () => data,
    updateTime: { toDate: () => new Date("2026-10-25T12:00:00Z") }, readTime: { toDate: () => new Date("2026-10-25T12:00:01Z") } });
  const db = { collection: name => reference(name), async runTransaction(run, options) {
    assert.deepEqual(options, { readOnly: true });
    return run({ async get(ref) {
      calls.push(ref.path);
      if (ref.path === failPath) throw new Error("synthetic-storage-error");
      if (ref.path === "users/client") return doc("client", user);
      return { docs: records[ref.path].map(row => doc(row.id, row)), metadata: { fromCache: ref.path === cachedPath } };
    } });
  } };
  return { db, calls };
}
const request = (f, extra = {}) => readClientLoadingSnapshot({ db: f.db, context: { uid: "client" }, ...extra });

test("workout snapshot reads every source in a read-only transaction, with metadata-only completion and no measurements", async () => {
  const history = [{ id: "history", workoutId: "day", assignedProgramUpdatedAt: "v2", assignedProgramAddedAt: profile.assignedProgramAddedAt,
    date: "2026-10-24", exercises: [{ id: "press", sets: [{ reps: 10, weight: "20,5" }] }], comment: "private full-history comment" }];
  const f = fixture({ history }); const result = await request(f);
  assert.deepEqual(f.calls, ["users/client", "users/client/workouts", "users/client/history"]);
  assert.deepEqual(result.coverage, { profile: "complete", workouts: "complete", history: "complete" });
  assert.deepEqual(result.sourceCounts, { workouts: 1, history: 1 });
  assert.match(result.sourceRevision, /^[a-f0-9]{64}$/);
  assert.equal(result.workouts[0].id, "day");
  assert.equal(result.completionHistory[0].exercises, undefined);
  assert.equal(result.completionHistory[0].comment, undefined);
  assert.deepEqual([...buildCompletedWorkoutSet(history, "v2", {}, [workout])], [...buildCompletedWorkoutSet(result.completionHistory, "v2", {}, [workout])]);
  const projection = rows => buildTrainerClientProgramTimeline({ workouts: [workout], history: rows, clientProfile: profile })
    .map(({ key, status, completedWorkoutIds, completedCount }) => ({ key, status, completedWorkoutIds, completedCount }));
  assert.deepEqual(projection(result.completionHistory), projection(history));
  assert.deepEqual(result.latestExerciseResultsByAssignment.v2, buildLatestExerciseResults(history, "v2"));
});

test("owner-only and fresh membership are checked before private subcollection reads", async () => {
  const f = fixture();
  await assert.rejects(request(f, { clientId: "another-client" }), { status: 403 });
  await assert.rejects(request(f, { context: null }), { status: 401 });
  await assert.rejects(request(f, { kind: "arbitrary" }), { status: 400 });
  assert.deepEqual(f.calls, []);
  for (const user of [null, { role: "client", active: false }, { role: "trainer", archived: true }, { role: "admin", accessDisabled: true },
    { role: "client", membershipStatus: "suspended" }, { role: "client", trainerAssignmentState: "unassigned" }]) {
    const denied = fixture({ user });
    await assert.rejects(request(denied), error => [403, 404].includes(error.status));
    assert.deepEqual(denied.calls, ["users/client"]);
  }
});

test("source failures or cached/partial evidence never produce a complete snapshot", async () => {
  for (const options of [{ failPath: "users/client/history" }, { failPath: "users/client/workouts" }, { cachedPath: "users/client/history" }]) {
    await assert.rejects(request(fixture(options)), { status: 503 });
  }
});

test("measurements snapshot is independent and normalizes legacy Timestamp dates before selecting weight/body/recent7", async () => {
  const measurements = [
    { id: "old-weight", weight: "70", savedAt: "2026-01-01" },
    { id: "body", belly: "80", createdAt: { toDate: () => new Date("2026-10-20T12:00:00Z") } },
    { id: "new-weight", measurementType: "weight_checkin", weight: "71,5", date: "2026-10-24" },
    { id: "missing-date", weight: 10 }
  ];
  const f = fixture({ measurements }); const result = await request(f, { kind: "measurements" });
  assert.deepEqual(f.calls, ["users/client", "users/client/measurements"]);
  assert.equal(result.measurements.latestWeight.id, "new-weight");
  assert.equal(result.measurements.latestBody.id, "body");
  assert.deepEqual(result.measurements.recent7.map(row => row.id), ["new-weight", "body", "old-weight", "missing-date"]);
  assert.equal(result.coverage.history, undefined);
});

test("1000-history baseline reduces wire payload, not server document reads or completion coverage", async () => {
  const history = Array.from({ length: 1000 }, (_, index) => ({ id: `history-${index}`, workoutId: "day", assignedProgramUpdatedAt: "v2",
    date: new Date(Date.UTC(2024, 0, index + 1)).toISOString(), exercises: Array.from({ length: 12 }, (_, exerciseIndex) => ({
      id: `exercise-${exerciseIndex}`, name: "Упражнение", video: "gs://synthetic-bucket/exercise-videos/synthetic.mp4",
      sets: Array.from({ length: 4 }, () => ({ reps: 10, weight: 20, completed: true })), note: "x".repeat(120)
    })) }));
  const f = fixture({ history }); const result = await request(f);
  assert.equal(result.sourceCounts.history, 1000);
  assert.equal(result.completionHistory.length, 1000);
  const inputBytes = Buffer.byteLength(JSON.stringify({ profile, workouts: [workout], history }));
  const outputBytes = Buffer.byteLength(JSON.stringify(result));
  assert.ok(outputBytes < inputBytes * .15, `${outputBytes}/${inputBytes}`);
  assert.equal(result.latestExerciseResultsByAssignment.v2["id:exercise-11"], "4×10 · 20 кг");
});

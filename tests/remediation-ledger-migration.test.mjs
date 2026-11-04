import assert from "node:assert/strict";
import test from "node:test";
import { parseMigrationArgs, assessBaselineSnapshot, publicBaselineObservation, planMigrationPhase, buildConfigCommit }
  from "../scripts/migrate-subscription-ledger.mjs";

const project = "tren-85720-staging";
const at = "2026-10-18T12:00:00.000Z";
const now = "2026-10-18T12:01:00.000Z";
function snapshot(overrides = {}) {
  return assessBaselineSnapshot({ observedAt: at,
    users: [{ name: "projects/synthetic/users/owned", createTime: at, updateTime: at, subscription: {
      cycleId: "cycle-owned", cycleStartedAt: "2026-10-18T10:00:00.000Z", periodMode: "sessions",
      purchasedSessions: 12, usedSessions: 2, remainingSessions: 10
    } }],
    histories: [{ name: "projects/synthetic/users/owned/history/one", createTime: at, updateTime: at,
      subscriptionCycleId: "cycle-owned" }], ...overrides });
}
const stable = () => [snapshot(), snapshot({ observedAt: "2026-10-18T12:00:10.000Z" })];
function baseline(config = { schemaVersion: 1, paused: true }, observations = stable()) {
  return planMigrationPhase({ phase: "baseline", config, observations, confirmDrained: true, now });
}
function readyConfig() {
  return { schemaVersion: 1, paused: true, baselineReady: true, baselineFingerprint: snapshot().fingerprint, cutoverTimestamp: at };
}

test("migration defaults to read-only inspect and only accepts exact whitelisted projects", () => {
  assert.deepEqual(parseMigrationArgs([`--project=${project}`]), {
    phase: "inspect", apply: false, confirmDrained: false, confirmLedgerDeployed: false, acceptInitialCycleBaseline: false, project
  });
  for (const target of ["", "tren-85720-staging.evil", "other", "tren-85720/"])
    assert.throws(() => parseMigrationArgs([`--project=${target}`]));
  assert.equal(parseMigrationArgs(["--project=tren-85720"]).apply, false);
});

test("all mutations require apply, explicit phase and matching project confirmation", () => {
  assert.throws(() => parseMigrationArgs([`--project=${project}`, "--pause", "--apply"]), /mutation-confirmation/);
  assert.throws(() => parseMigrationArgs([`--project=${project}`, "--pause", "--apply", "--confirm-project=tren-85720"]), /mismatch/);
  assert.throws(() => parseMigrationArgs([`--project=${project}`, "--apply", `--confirm-project=${project}`]), /mutation-confirmation/);
  assert.equal(parseMigrationArgs([`--project=${project}`, "--pause", "--apply", `--confirm-project=${project}`]).apply, true);
  assert.throws(() => parseMigrationArgs([`--project=${project}`, "--baseline"]), /drain-acknowledgment/);
  assert.throws(() => parseMigrationArgs([`--project=${project}`, "--resume"]), /ledger-deploy-acknowledgment/);
  for (const args of [["--pause", "--resume"], ["--pause", "--pause"], ["--uid=foreign"], ["--output=../private.json"]])
    assert.throws(() => parseMigrationArgs([`--project=${project}`, ...args]));
});

test("baseline pause and two stable sufficiently spaced observations are mandatory", () => {
  assert.throws(() => baseline({ schemaVersion: 1, paused: false }), /pause-required/);
  assert.throws(() => baseline(undefined, [snapshot()]), /baseline-not-ready/);
  assert.throws(() => baseline(undefined, [snapshot(), snapshot()]), /gap-required/);
  const changed = stable(); changed[1].fingerprint = "changed";
  assert.throws(() => baseline(undefined, changed), /changed-during-observation/);
  assert.throws(() => planMigrationPhase({ phase: "baseline", config: { paused: true }, observations: stable() }), /drain-acknowledgment/);
});

test("named cycles require authoritative boundary and inconsistent balances/markers refuse baseline", () => {
  const users = [{ name: "user", createTime: at, updateTime: at,
    subscription: { cycleId: "named", startDate: "2026-10-01", usedSessions: 2, purchasedSessions: 12, remainingSessions: 10 } }];
  const missing = snapshot({ users });
  assert.equal(missing.counts.missingCycleBoundaries, 1);
  assert.equal(missing.ready, false);
  assert.throws(() => baseline(undefined, [missing, { ...missing, observedAt: now }]), /not-ready/);
  users[0].subscription.lastRenewedAt = "2026-10-18T10:00:00.000Z";
  assert.equal(snapshot({ users }).ready, true);
  users[0].subscription.remainingSessions = 11;
  assert.equal(snapshot({ users }).counts.invalidBalances, 1);
  assert.equal(snapshot({ histories: [{ name: "history", createTime: at, updateTime: at, subscriptionCycleId: { forged: true } }] }).ready, false);
});

test("generated cycle timestamp supplies only the existing explicit compatibility boundary", () => {
  const generated = snapshot({ users: [{ name: "user", createTime: at, updateTime: at,
    subscription: { cycleId: `cycle_${Date.parse(at)}`, usedSessions: 0, purchasedSessions: 12 } }] });
  assert.equal(generated.ready, true);
  assert.equal(generated.counts.missingCycleBoundaries, 0);
});

test("baseline preserves manual balances and exposes only aggregates and deterministic digest", () => {
  const observations = stable(), before = JSON.stringify(observations);
  const plan = baseline(undefined, observations);
  assert.equal(JSON.stringify(observations), before);
  assert.equal(plan.setCutoverFromServerTime, true);
  assert.equal(plan.fields.paused, true);
  assert.equal(plan.fields.baselineReady, true);
  assert.equal(Object.keys(plan.fields).some(key => /usedSessions|remainingSessions|subscription/.test(key)), false);
  assert.equal(JSON.stringify(observations).includes("cycle-owned"), false);
  assert.equal(JSON.stringify(observations).includes("users/owned"), false);
  assert.equal(observations[0].counts.taggedHistories, 1);
});

test("stable fingerprint ignores map ordering/unrelated root updates but detects accounting changes", () => {
  const a = snapshot({ users: [{ name: "user", createTime: at, updateTime: at,
    subscription: { usedSessions: 2, purchasedSessions: 12, remainingSessions: 10 } }] });
  const b = snapshot({ users: [{ name: "user", createTime: at, updateTime: at,
    subscription: { remainingSessions: 10, purchasedSessions: 12, usedSessions: 2 } }] });
  assert.equal(a.fingerprint, b.fingerprint);
  const changed = snapshot({ users: [{ name: "user", createTime: at, updateTime: now,
    subscription: { usedSessions: 2, purchasedSessions: 12, remainingSessions: 10 } }] });
  assert.equal(a.fingerprint, changed.fingerprint);
  const changedBalance = snapshot({ users: [{ name: "user", createTime: at, updateTime: now,
    subscription: { usedSessions: 3, purchasedSessions: 12, remainingSessions: 9 } }] });
  assert.notEqual(a.fingerprint, changedBalance.fingerprint);
});

test("baseline rerun preserves fixed timestamp and refuses silently rebasing a changed baseline", () => {
  const config = readyConfig();
  assert.deepEqual(baseline(config), { mutate: false, reason: "fixed-baseline-already-recorded" });
  assert.equal(config.cutoverTimestamp, at);
  assert.throws(() => baseline({ ...config, baselineFingerprint: "different" }), /cannot-be-rebased/);
  assert.throws(() => baseline({ ...config, baselineReady: false }), /cannot-be-rebased/);
});

test("resume requires fixed ready cutover, unchanged stable baseline and operator deploy acknowledgment", () => {
  const config = readyConfig();
  const plan = input => planMigrationPhase({ phase: "resume", config, observations: stable(),
    confirmLedgerDeployed: true, now, ...input });
  assert.deepEqual(plan().fields, { paused: false, ledgerDeployAcknowledged: true });
  assert.throws(() => plan({ confirmLedgerDeployed: false }), /acknowledgment/);
  for (const patch of [{ baselineReady: false }, { cutoverTimestamp: undefined }, { cutoverTimestamp: "2099-01-01T00:00:00.000Z" }, { schemaVersion: 2 }])
    assert.throws(() => plan({ config: { ...config, ...patch } }));
  assert.throws(() => plan({ config: { ...config, baselineFingerprint: "different" } }), /changed-before-resume/);
  assert.deepEqual(plan({ config: { ...config, paused: false }, observations: [] }), { mutate: false, reason: "already-resumed" });
});

test("pause is idempotent and rejects malformed config before any plan", () => {
  assert.deepEqual(planMigrationPhase({ phase: "pause", config: {} }), { mutate: true, fields: { schemaVersion: 1, paused: true } });
  assert.deepEqual(planMigrationPhase({ phase: "pause", config: { paused: true } }), { mutate: false, reason: "already-paused" });
  for (const config of [{ paused: "private-value" }, { cutoverTimestamp: "invalid" }, { schemaVersion: 2 }])
    assert.throws(() => planMigrationPhase({ phase: "inspect", config }));
});

test("cancel-before-baseline is explicit, project-confirmed and cannot combine with another phase", () => {
  assert.equal(parseMigrationArgs([`--project=${project}`, "--cancel-before-baseline"]).apply, false);
  const options = parseMigrationArgs(["--project=tren-85720", "--cancel-before-baseline", "--apply", "--confirm-project=tren-85720"]);
  assert.equal(options.phase, "cancel-before-baseline");
  assert.equal(options.apply, true);
  for (const args of [["--apply"], ["--apply", "--confirm-project=tren-85720"], ["--pause"], ["--resume"],
    ["--accept-initial-cycle-baseline"]])
    assert.throws(() => parseMigrationArgs([`--project=${project}`, "--cancel-before-baseline", ...args]));
});

test("cancellation only unpauses schema1 config with no baseline or cutover, without observations", () => {
  const cancel = config => planMigrationPhase({ phase: "cancel-before-baseline", config });
  const config = { schemaVersion: 1, paused: true };
  assert.deepEqual(cancel(config), { mutate: true, cancelBeforeBaseline: true, fields: { paused: false } });
  assert.deepEqual(cancel({ ...config, baselineReady: false }).fields, { paused: false });
  assert.deepEqual(config, { schemaVersion: 1, paused: true });
  for (const patch of [{ schemaVersion: undefined }, { schemaVersion: 2 }, { paused: false }, { baselineReady: true },
    { baselineReady: null }, { cutoverTimestamp: at }, { cutoverTimestamp: undefined }, { baselineFingerprint: "" },
    { baselineCycleIds: {} }, { baselineCounts: {} }, { baselineObservedAt: at }, { drainAcknowledged: true },
    { ledgerDeployAcknowledged: true }]) assert.throws(() => cancel({ ...config, ...patch }));
  assert.throws(() => cancel(readyConfig()));
});

test("cancel commit updates paused only with exact document precondition; fixed baseline cannot be bypassed", () => {
  const config = { schemaVersion: 1, paused: true }, previous = { exists: true, updateTime: at, data: config };
  const plan = planMigrationPhase({ phase: "cancel-before-baseline", config });
  const body = buildConfigCommit({ project, plan, previous });
  assert.deepEqual(body.writes, [{
    update: { name: `projects/${project}/databases/(default)/documents/serverConfig/subscriptionAccounting`,
      fields: { paused: { booleanValue: false } } },
    updateMask: { fieldPaths: ["paused"] }, currentDocument: { updateTime: at }
  }]);
  assert.throws(() => buildConfigCommit({ project, plan, previous: { exists: false } }));
  assert.throws(() => buildConfigCommit({ project, plan, previous: { ...previous, data: readyConfig() } }));
  assert.throws(() => buildConfigCommit({ project, plan: { ...plan, fields: { paused: false, baselineReady: true } }, previous }));
  assert.throws(() => buildConfigCommit({ project, plan: { ...plan, setCutoverFromServerTime: true }, previous }));
});

test("native REST commit is fixed config-only, preconditioned and server-time cutover is write-once", () => {
  const plan = baseline(), previous = { exists: true, updateTime: at, data: { paused: true } };
  const body = buildConfigCommit({ project, plan, previous });
  assert.equal(body.writes.length, 1);
  assert.equal(body.writes[0].update.name, `projects/${project}/databases/(default)/documents/serverConfig/subscriptionAccounting`);
  assert.deepEqual(body.writes[0].currentDocument, { updateTime: at });
  assert.deepEqual(body.writes[0].updateTransforms, [{ fieldPath: "cutoverTimestamp", setToServerValue: "REQUEST_TIME" }]);
  assert.equal(body.writes[0].update.fields.cutoverTimestamp, undefined);
  assert.throws(() => buildConfigCommit({ project, plan, previous: { ...previous, data: { cutoverTimestamp: at } } }), /immutable/);
  assert.throws(() => buildConfigCommit({ project, plan: { mutate: true, fields: { arbitraryPath: "users/foreign" } }, previous }), /unsafe/);
  assert.throws(() => buildConfigCommit({ project: "foreign", plan, previous }), /invalid/);
  const pause = buildConfigCommit({ project, plan: planMigrationPhase({ phase: "pause" }), previous: { exists: false } });
  assert.deepEqual(pause.writes[0].currentDocument, { exists: false });
});

test("missing document generation metadata cannot be treated as a stable baseline", () => {
  assert.throws(() => snapshot({ users: [{ name: "user", subscription: {} }] }), /generation-metadata/);
});

test("initial named cycles are registered only under explicit one-time operator acknowledgment", () => {
  const users = [{ name: "projects/synthetic/users/initial-owner", createTime: at, updateTime: at,
    subscription: { cycleId: "initial-cycle", usedSessions: 2, purchasedSessions: 12, remainingSessions: 10 } }];
  const a = snapshot({ users, acceptInitialCycleBaseline: true });
  const b = snapshot({ users, acceptInitialCycleBaseline: true, observedAt: now });
  assert.equal(a.ready, true);
  assert.equal(a.counts.registeredInitialCycles, 1);
  assert.throws(() => baseline(undefined, [a, b]), /acknowledgment/);
  const plan = planMigrationPhase({ phase: "baseline", config: { schemaVersion: 1, paused: true }, observations: [a, b],
    confirmDrained: true, acceptInitialCycleBaseline: true, now });
  assert.deepEqual({ ...plan.fields.baselineCycleIds }, { "initial-owner": "initial-cycle" });
  assert.equal(plan.fields.cycleStartedAt, undefined);
  const published = JSON.stringify(publicBaselineObservation(a));
  assert.equal(published.includes("initial-owner"), false);
  assert.equal(published.includes("initial-cycle"), false);
  assert.equal(snapshot({ users, registeredBaselineCycleIds: { "initial-owner": "other-cycle" } }).ready, false);
  assert.equal(snapshot({ users, registeredBaselineCycleIds: { "initial-owner": "initial-cycle" } }).ready, true);
  assert.equal(parseMigrationArgs([`--project=${project}`, "--baseline", "--confirm-drained", "--accept-initial-cycle-baseline"]).acceptInitialCycleBaseline, true);
  assert.throws(() => parseMigrationArgs([`--project=${project}`, "--accept-initial-cycle-baseline"]), /phase-only/);
});

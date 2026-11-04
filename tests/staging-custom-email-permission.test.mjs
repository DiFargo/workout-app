import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments, makeOwnership, publicOwnership, restoreOwnership, assertRuntimeOwnership, mergePolicy, ownedMemberCount, editPolicyWithRetries, withTemporaryGrant, cleanupOwnedGrant, recoveryGrantState } from "../scripts/with-staging-custom-email-permission.mjs";

const flags = ["--approved-temporary-staging-token-creator", "--expected-version=3.0.840"];
const input = { signer: "runtime@tren-85720-staging.iam.gserviceaccount.com", projectNumber: "123456", operatorEmail: "synthetic-operator@example.invalid", runId: "a".repeat(24), now: Date.parse("2026-10-17T12:00:00Z") };
const own = () => makeOwnership(input);
const initial = () => ({ version: 3, etag: "fresh-etag", bindings: [
  { role: "roles/viewer", members: ["user:other@example.invalid"], condition: { title: "unrelated", expression: "request.time < timestamp(\"2030-01-01T00:00:00Z\")" } },
  { role: "roles/iam.serviceAccountTokenCreator", members: ["user:existing@example.invalid"] }
], auditConfigs: [{ service: "allServices", auditLogConfigs: [{ logType: "ADMIN_READ" }] }], extraField: { preserve: true } });

test("cleanup-only revalidates the live approved runtime instead of trusting a journal signer", () => {
  const ownership = own();
  const runtime = { name: ownership.functionName, serviceConfig: { serviceAccountEmail: ownership.signer } };
  assertRuntimeOwnership(runtime, ownership);
  assert.throws(() => assertRuntimeOwnership({ ...runtime, name: "projects/tren-85720/locations/europe-west1/functions/profileUpdateEmail" }, ownership));
  assert.throws(() => assertRuntimeOwnership({ ...runtime, serviceConfig: { serviceAccountEmail: "other@tren-85720-staging.iam.gserviceaccount.com" } }, ownership));
});

test("execution guards demand exact flags/version, forbid project/credentials, and restrict cleanup journals", () => {
  assert.equal(parseArguments(flags, {}).version, "3.0.840");
  for (const args of [[], flags.slice(1), flags.slice(0, 1), [...flags, flags[0]], [flags[0], "--expected-version=3.0.839"], [...flags, "--project=tren-85720"], [...flags, "--signer=other"], [...flags, "--cleanup-only=package.json"], [...flags, "--cleanup-only=artifacts/../package.json"]]) assert.throws(() => parseArguments(args, {}));
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) assert.throws(() => parseArguments(flags, { [key]: "forbidden" }));
});

test("ownership is staging-only, exact runtime function, human operator and 15-minute unique condition", () => {
  const ownership = own();
  assert.equal(Date.parse(ownership.expiresAt) - Date.parse(ownership.createdAt), 15 * 60 * 1000);
  assert.equal(ownership.condition.title, `staging-custom-email-${input.runId}`);
  assert.equal(ownership.condition.expression, `request.time < timestamp("${ownership.expiresAt}")`);
  assert.equal("member" in publicOwnership(ownership), false);
  assert.equal(JSON.stringify(publicOwnership(ownership)).includes(input.operatorEmail), false);
  assert.deepEqual(restoreOwnership(publicOwnership(ownership), input.operatorEmail, input.projectNumber), ownership);
  for (const signer of ["runtime@tren-85720.iam.gserviceaccount.com", "999999-compute@developer.gserviceaccount.com", "tren-85720@appspot.gserviceaccount.com"]) assert.throws(() => makeOwnership({ ...input, signer }));
  assert.throws(() => makeOwnership({ ...input, operatorEmail: "service@tren-85720-staging.iam.gserviceaccount.com" }));
  assert.throws(() => restoreOwnership(publicOwnership(ownership), "different@example.invalid", input.projectNumber));
  assert.throws(() => restoreOwnership(publicOwnership(ownership), input.operatorEmail, "999999"));
  assert.throws(() => restoreOwnership({ ...publicOwnership(ownership), project: "tren-85720" }, input.operatorEmail, input.projectNumber));
  assert.throws(() => restoreOwnership({ ...publicOwnership(ownership), expiresAt: "2030-01-01T00:00:00Z" }, input.operatorEmail, input.projectNumber));
});

test("adding/removing one owned grant preserves original policy, etag, audit fields and every other binding", () => {
  const original = initial(), ownership = own();
  const added = mergePolicy(original, ownership, "add");
  assert.equal(ownedMemberCount(added.policy, ownership), 1);
  assert.deepEqual(added.policy.bindings.slice(0, 2), original.bindings);
  assert.deepEqual(added.policy.auditConfigs, original.auditConfigs);
  assert.deepEqual(added.policy.extraField, original.extraField);
  assert.equal(added.policy.etag, original.etag);
  assert.equal(original.bindings.length, 2);
  assert.equal(mergePolicy(added.policy, ownership, "add").changed, false);
  const removed = mergePolicy(added.policy, ownership, "remove");
  assert.equal(ownedMemberCount(removed.policy, ownership), 0);
  assert.deepEqual(removed.policy, original);
  assert.throws(() => mergePolicy({ bindings: [] }, ownership, "add"));
  assert.throws(() => mergePolicy(original, { ...ownership, project: "tren-85720" }, "add"));
  assert.throws(() => mergePolicy(original, { ...ownership, signer: "prod@tren-85720.iam.gserviceaccount.com" }, "remove"));
});

test("cleanup removes only exact owned member and condition, retaining concurrent members and other conditions", () => {
  const ownership = own();
  const policy = mergePolicy(initial(), ownership, "add").policy;
  policy.bindings[1].members.push(ownership.member); // Existing unconditional permission is not ours.
  policy.bindings.at(-1).members.push("user:concurrent@example.invalid");
  policy.bindings.push({ role: ownership.role, members: [ownership.member], condition: { ...ownership.condition, title: "other-title" } });
  const removed = mergePolicy(policy, ownership, "remove").policy;
  assert.equal(ownedMemberCount(removed, ownership), 0);
  assert.deepEqual(removed.bindings.find(binding => binding.condition?.title === ownership.condition.title).members, ["user:concurrent@example.invalid"]);
  assert.equal(removed.bindings.at(-1).members[0], ownership.member);
  assert.equal(removed.bindings[1].members.includes(ownership.member), true);
  const conflict = structuredClone(policy); conflict.bindings[2].condition.expression = "true";
  assert.throws(() => mergePolicy(conflict, ownership, "remove"), /condition-ownership-conflict/);
  assert.equal(mergePolicy({ etag: "empty-fresh-policy", version: 1 }, ownership, "remove").changed, false);
});

test("ETag conflicts re-read and preserve concurrent changes; retries never exceed three", async () => {
  const ownership = own(); let policy = initial(), reads = 0, writes = 0;
  await editPolicyWithRetries({ ownership, operation: "add", readPolicy: async () => { reads++; return policy; }, setPolicy: async next => {
    writes++;
    if (writes === 1) { policy = { ...policy, etag: "concurrent-etag", extraField: { preserve: true, concurrent: true } }; throw Object.assign(new Error(), { status: 409 }); }
    assert.equal(next.etag, "concurrent-etag"); policy = next;
  } });
  assert.equal(reads, 2); assert.equal(writes, 2); assert.equal(policy.extraField.concurrent, true);
  writes = 0;
  await assert.rejects(editPolicyWithRetries({ ownership, operation: "remove", readPolicy: async () => policy, setPolicy: async () => { writes++; throw Object.assign(new Error(), { status: 412 }); } }));
  assert.equal(writes, 3);
});

test("journal is durable before grant; probe precedes exactly one smoke; finally removes the grant", async () => {
  const ownership = own(); let policy = initial(); const order = [];
  const result = await withTemporaryGrant({ ownership, readPolicy: async () => policy,
    setPolicy: async next => { order.push(ownedMemberCount(next, ownership) ? "grant" : "remove"); policy = next; },
    journal: async event => { order.push(event.phase); }, probe: async () => { order.push("probe"); },
    smoke: async () => { order.push("smoke"); return { passed: true, cleanup: { complete: true } }; } });
  assert.equal(order[0], "prepared-before-iam-mutation");
  assert.ok(order.indexOf("probe") < order.indexOf("smoke"));
  assert.equal(order.filter(step => step === "smoke").length, 1);
  assert.equal(result.smokeRuns, 1); assert.equal(result.cleanupVerified, true); assert.equal(result.passed, true);
  assert.deepEqual(policy, initial());
});

test("unknown successful set outcome still triggers fresh-read targeted cleanup and never creates an Auth user", async () => {
  const ownership = own(); let policy = initial(), writes = 0, smokes = 0;
  const result = await withTemporaryGrant({ ownership, readPolicy: async () => policy, setPolicy: async next => {
    policy = next; if (++writes === 1) throw new Error("ambiguous transport outcome");
  }, journal: async () => {}, probe: async () => {}, smoke: async () => { smokes++; } });
  assert.equal(result.grantAttempted, true); assert.equal(result.cleanupVerified, true); assert.equal(result.passed, false);
  assert.equal(result.grantObserved, true); assert.equal(result.grantOutcomeUnresolved, false);
  assert.equal(smokes, 0); assert.equal(ownedMemberCount(policy, ownership), 0); assert.equal(writes, 2);
});

test("a delayed unknown add committing after finally stays unresolved and cannot claim cleanup", async () => {
  const ownership = own(); let policy = initial(), delayedCommit, smokes = 0;
  const events = [];
  const result = await withTemporaryGrant({ ownership, readPolicy: async () => policy,
    setPolicy: async next => { delayedCommit = () => { policy = next; }; throw new Error("request still unresolved"); },
    journal: async event => { events.push(event); }, probe: async () => {}, smoke: async () => { smokes++; } });
  assert.equal(result.passed, false); assert.equal(result.smokeRuns, 0); assert.equal(smokes, 0);
  assert.equal(result.grantAddOutcomeConfirmed, false); assert.equal(result.grantObserved, false);
  assert.equal(result.cleanupVerified, false); assert.equal(result.grantOutcomeUnresolved, true);
  assert.equal(events.at(-1).result.grantOutcomeUnresolved, true);
  const recovery = recoveryGrantState({ events });
  await cleanupOwnedGrant({ ownership, readPolicy: async () => policy, setPolicy: async () => { throw new Error("Must not CAS identical absent policy"); }, state: recovery });
  assert.equal(recovery.cleanupVerified, false); assert.equal(recovery.grantOutcomeUnresolved, true);
  assert.equal(recoveryGrantState({ events: [...events, { result: { ...recovery } }] }).grantOutcomeUnresolved, true);
  delayedCommit();
  assert.equal(ownedMemberCount(policy, ownership), 1);
  assert.equal(result.cleanupVerified, false);
  await cleanupOwnedGrant({ ownership, readPolicy: async () => policy, setPolicy: async next => { policy = next; }, state: recovery });
  assert.equal(recovery.grantObserved, true); assert.equal(recovery.grantOutcomeUnresolved, false);
  assert.equal(recovery.cleanupVerified, true); assert.equal(ownedMemberCount(policy, ownership), 0);
});

test("failed probe prevents smoke; failed journal prevents IAM mutation", async () => {
  const ownership = own(); let policy = initial(), writes = 0, smokes = 0;
  const deps = { ownership, readPolicy: async () => policy, setPolicy: async next => { writes++; policy = next; },
    journal: async () => {}, probe: async () => { throw new Error("probe failed"); }, smoke: async () => { smokes++; } };
  const result = await withTemporaryGrant(deps);
  assert.equal(smokes, 0); assert.equal(result.cleanupVerified, true); assert.equal(result.passed, false);
  writes = 0;
  const noJournal = await withTemporaryGrant({ ...deps, journal: async () => { throw new Error("disk unavailable"); } });
  assert.equal(noJournal.grantAttempted, false); assert.equal(writes, 0);
});

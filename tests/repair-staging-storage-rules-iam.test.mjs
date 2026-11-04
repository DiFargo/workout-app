import assert from "node:assert/strict";
import test from "node:test";
import { parseStorageRulesIamArgs, planStorageRulesIam, verifyStorageRulesIam }
  from "../scripts/repair-staging-storage-rules-iam.mjs";

const project = "tren-85720-staging";
const roleName = "roles/firebaserules.firestoreServiceAgent";
const agent = "service-123456@gcp-sa-firebasestorage.iam.gserviceaccount.com";
const member = `serviceAccount:${agent}`;
function fixture() {
  return { project, metadata: { projectId: project, projectNumber: "123456" },
    serviceAccount: { projectId: project, email: agent }, role: { name: roleName, includedPermissions: ["datastore.entities.get"] },
    policy: { version: 3, etag: "synthetic-etag", auditConfigs: [{ service: "allServices", auditLogConfigs: [{ logType: "ADMIN_READ" }] }],
      bindings: [{ role: "roles/viewer", members: ["user:synthetic@example.invalid"],
        condition: { expression: "request.time < timestamp('2099-01-01T00:00:00Z')", title: "retain" } }] } };
}

test("repair defaults read-only and Production/override/ambiguous arguments fail closed", () => {
  assert.deepEqual(parseStorageRulesIamArgs([`--project=${project}`], {}), { project, apply: false });
  for (const args of [[], ["--project=tren-85720"], ["--project=tren-85720-staging.evil"], [`--project=${project}`, "--apply"],
    [`--project=${project}`, "--apply", "--confirm-project=tren-85720"], [`--project=${project}`, "--role=roles/owner"],
    [`--project=${project}`, "--principal=user:someone"], [`--project=${project}`, "--apply", "--apply"]])
    assert.throws(() => parseStorageRulesIamArgs(args, {}));
  assert.equal(parseStorageRulesIamArgs([`--project=${project}`, "--apply", `--confirm-project=${project}`], {}).apply, true);
});

test("environment credential overrides are prohibited", () => {
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN"])
    assert.throws(() => parseStorageRulesIamArgs([`--project=${project}`], { [key]: "override" }));
});

test("plan adds only exact existing Storage agent role and preserves complete policy", () => {
  const f = fixture(), original = structuredClone(f.policy);
  const plan = planStorageRulesIam(f);
  assert.equal(plan.changed, true); assert.equal(plan.addedMemberCount, 1);
  assert.deepEqual(f.policy, original);
  assert.deepEqual(plan.policy.bindings.slice(0, original.bindings.length), original.bindings);
  assert.deepEqual(plan.policy.auditConfigs, original.auditConfigs);
  assert.equal(plan.policy.etag, original.etag); assert.equal(plan.policy.version, 3);
  assert.deepEqual(plan.policy.bindings.at(-1), { role: roleName, members: [member] });
});

test("existing unconditional role keeps other members; conditional target binding is not modified", () => {
  const f = fixture();
  const conditional = { role: roleName, members: [member], condition: { expression: "false", title: "retain" } };
  f.policy.bindings.push(conditional, { role: roleName, members: ["serviceAccount:other@example.invalid"] });
  const plan = planStorageRulesIam(f);
  assert.deepEqual(plan.policy.bindings[1], conditional);
  assert.deepEqual(plan.policy.bindings[2].members, ["serviceAccount:other@example.invalid", member]);
  assert.equal(plan.policy.bindings.length, f.policy.bindings.length);
  assert.equal(planStorageRulesIam({ ...f, policy: plan.policy }).changed, false);
});

test("wrong project/agent/role permission/etag/service-account state cannot produce mutation", () => {
  const changes = [f => { f.project = "tren-85720"; }, f => { f.metadata.projectId = "tren-85720"; },
    f => { f.serviceAccount.email = "human@example.invalid"; }, f => { f.serviceAccount.disabled = true; },
    f => { f.role.name = "roles/owner"; }, f => { f.role.includedPermissions.push("datastore.entities.list"); },
    f => { f.role.includedPermissions = []; }, f => { f.policy.etag = ""; }];
  for (const mutate of changes) { const f = fixture(); mutate(f); assert.throws(() => planStorageRulesIam(f)); }
});

test("unreadable Google-managed agent requires the exact existing unconditional service-agent binding", () => {
  const f = fixture();
  delete f.serviceAccount;
  f.serviceAccountLookupUnavailable = true;
  assert.throws(() => planStorageRulesIam(f));
  const proof = { role: "roles/firebasestorage.serviceAgent", members: [member] };
  f.policy.bindings.push(proof);
  const plan = planStorageRulesIam(f);
  assert.equal(plan.bindingProof, true);
  assert.deepEqual(plan.policy.bindings[1], proof);
  for (const wrong of [
    { ...proof, members: ["serviceAccount:service-999@gcp-sa-firebasestorage.iam.gserviceaccount.com"] },
    { ...proof, role: "roles/viewer" }, { ...proof, condition: { expression: "true" } },
    { ...proof, members: ["user:synthetic@example.invalid"] }
  ]) {
    f.policy.bindings[1] = wrong;
    assert.throws(() => planStorageRulesIam(f));
  }
});

test("verification ignores order/new etag but rejects missing binding, changed condition or audit config", () => {
  const expected = planStorageRulesIam(fixture()).policy;
  const reordered = structuredClone(expected); reordered.etag = "new-etag"; reordered.bindings.reverse();
  assert.equal(verifyStorageRulesIam(expected, reordered), true);
  for (const mutate of [p => p.bindings.pop(), p => { p.bindings[0].condition.expression = "true"; },
    p => { p.auditConfigs = []; }, p => { p.version = 1; }]) {
    const changed = structuredClone(expected); mutate(changed);
    assert.throws(() => verifyStorageRulesIam(expected, changed));
  }
});

test("unconditional IAM version 3 to 1 normalization is semantic only and preserves all other checks", () => {
  const expected = { version: 3, etag: "before", bindings: [{ role: roleName, members: [member] }], auditConfigs: [] };
  const observed = { ...structuredClone(expected), version: 1, etag: "after" };
  assert.equal(verifyStorageRulesIam(expected, observed), true);
  assert.equal(expected.version, 3, "verification cannot mutate expected policy");
  for (const patch of [{ bindings: [] }, { auditConfigs: [{ service: "allServices" }] }, { version: 2 },
    { version: undefined }, { unexpectedPolicyField: true }])
    assert.throws(() => verifyStorageRulesIam(expected, { ...observed, ...patch }));
  const conditional = structuredClone(expected);
  conditional.bindings[0].condition = { title: "retained", expression: "false" };
  assert.throws(() => verifyStorageRulesIam(conditional, { ...structuredClone(conditional), version: 1, etag: "changed" }),
    error => error.safeReason === "policy-version-mismatch");
});

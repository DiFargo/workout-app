import assert from "node:assert/strict";
import test from "node:test";
import { parseProductionPublisherArgs as parse, planProductionPublisherRepair as plan }
  from "../scripts/repair-production-storage-publisher-iam.mjs";
import { verifyStorageRulesIam as verify } from "../scripts/repair-staging-storage-rules-iam.mjs";

const project = "tren-85720", role = "roles/pubsub.publisher";
const email = "service-870948637708@gs-project-accounts.iam.gserviceaccount.com", member = `serviceAccount:${email}`;
function fixture() {
  return { project, metadata: { projectId: project, projectNumber: "870948637708" },
    serviceAgent: { email_address: email, kind: "storage#serviceAccount" },
    role: { name: role, includedPermissions: ["pubsub.topics.publish"] },
    policy: { version: 3, etag: "synthetic-only", auditConfigs: [{ service: "allServices" }],
      bindings: [{ role: "roles/viewer", members: ["user:fixture@example.invalid"],
        condition: { title: "retain", expression: "false" } }] } };
}

test("Production repair is read-only by default; mutation requires both exact confirmations", () => {
  assert.deepEqual(parse([`--project=${project}`], {}), { project, apply: false });
  assert.equal(parse([`--project=${project}`, "--apply", `--confirm-project=${project}`], {}).apply, true);
  for (const args of [[], ["--project=tren-85720-staging"], [`--project=${project}`, "--apply"],
    [`--project=${project}`, "--apply", "--confirm-project=tren-85720-staging"],
    [`--project=${project}`, "--role=roles/owner"], [`--project=${project}`, "--principal=someone"],
    [`--project=${project}`, `--project=${project}`], [`--project=${project}.evil`]]) assert.throws(() => parse(args, {}));
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN"])
    assert.throws(() => parse([`--project=${project}`], { [key]: "override" }));
});

test("plan preserves every policy field and adds only one exact publisher member", () => {
  const f = fixture(), before = structuredClone(f.policy), result = plan(f);
  assert.deepEqual(f.policy, before);
  assert.deepEqual(result.policy.bindings.slice(0, -1), before.bindings);
  assert.deepEqual(result.policy.auditConfigs, before.auditConfigs);
  assert.equal(result.policy.etag, before.etag);
  assert.deepEqual(result.policy.bindings.at(-1), { role, members: [member] });
  assert.equal(result.addedMemberCount, 1);
});

test("existing unconditional publisher keeps other members; conditional grant is retained but insufficient", () => {
  const f = fixture();
  f.policy.bindings.push({ role, members: [member], condition: { title: "restricted", expression: "false" } },
    { role, members: ["serviceAccount:other@example.invalid"] });
  const result = plan(f);
  assert.deepEqual(result.policy.bindings[1], f.policy.bindings[1]);
  assert.deepEqual(result.policy.bindings[2].members, ["serviceAccount:other@example.invalid", member]);
  assert.equal(result.policy.bindings.length, f.policy.bindings.length);
  assert.equal(plan({ ...f, policy: result.policy }).changed, false);
});

test("wrong project, project number, managed identity, role authority or etag fails closed", () => {
  for (const change of [f => { f.project = "tren-85720-staging"; }, f => { f.metadata.projectId = "other"; },
    f => { f.metadata.projectNumber = "123"; }, f => { f.serviceAgent.email_address = "other@example.invalid"; },
    f => { f.serviceAgent.kind = "other"; }, f => { f.role.name = "roles/owner"; },
    f => { f.role.includedPermissions.push("pubsub.topics.delete"); }, f => { f.role.deleted = true; },
    f => { f.policy.etag = ""; }]) {
    const f = fixture(); change(f); assert.throws(() => plan(f));
  }
});

test("full readback rejects lost members, conditions and audit configs", () => {
  const expected = plan(fixture()).policy;
  assert.equal(verify(expected, { ...structuredClone(expected), etag: "new" }), true);
  for (const change of [p => { p.bindings.pop(); }, p => { p.bindings[0].condition.expression = "true"; },
    p => { p.auditConfigs = []; }]) {
    const observed = structuredClone(expected); change(observed); assert.throws(() => verify(expected, observed));
  }
});

test("unconditional readback accepts server version3-to1 without weakening conditional policies", () => {
  const f = fixture(); delete f.policy.bindings[0].condition;
  const expected = plan(f).policy;
  assert.equal(verify(expected, { ...structuredClone(expected), version: 1, etag: "after" }), true);
  const conditional = plan(fixture()).policy;
  assert.throws(() => verify(conditional, { ...structuredClone(conditional), version: 1, etag: "after" }));
});

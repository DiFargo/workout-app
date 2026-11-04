// Exact Production GCS service-agent publisher repair; read-only by default.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyStorageRulesIam } from "./repair-staging-storage-rules-iam.mjs";

const PROJECT = "tren-85720", NUMBER = "870948637708", ROLE = "roles/pubsub.publisher";
const EMAIL = `service-${NUMBER}@gs-project-accounts.iam.gserviceaccount.com`;
const MEMBER = `serviceAccount:${EMAIL}`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function parseProductionPublisherArgs(args, env = process.env) {
  const options = { apply: false }, seen = new Set();
  for (const argument of args) {
    const match = /^--(project|confirm-project)=(.+)$/.exec(argument);
    const key = match ? match[1] : argument;
    assert.ok(!seen.has(key), "Duplicate argument"); seen.add(key);
    if (argument === "--apply") options.apply = true;
    else if (match) options[match[1] === "project" ? "project" : "confirmProject"] = match[2];
    else assert.fail("Unsupported argument");
  }
  assert.equal(options.project, PROJECT, "Explicit exact Production project required");
  if (options.apply || options.confirmProject !== undefined) assert.equal(options.confirmProject, PROJECT, "Exact confirmation required");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN"])
    assert.ok(!env[key], "Cached CLI operator only");
  return options;
}

export function planProductionPublisherRepair({ project, metadata, serviceAgent, role, policy }) {
  assert.equal(project, PROJECT); assert.equal(metadata?.projectId, PROJECT);
  assert.equal(String(metadata.projectNumber), NUMBER);
  assert.equal(serviceAgent?.email_address, EMAIL, "Existing exact GCS agent required");
  assert.equal(serviceAgent.kind, "storage#serviceAccount");
  assert.equal(role?.name, ROLE); assert.notEqual(role.deleted, true);
  assert.deepEqual(role.includedPermissions, ["pubsub.topics.publish"], "Unexpected role authority");
  assert.ok(policy && typeof policy.etag === "string" && policy.etag);
  assert.ok([undefined, 1, 3].includes(policy.version));
  assert.ok(policy.bindings === undefined || Array.isArray(policy.bindings));
  const updated = structuredClone(policy); updated.bindings ||= [];
  for (const binding of updated.bindings) {
    assert.ok(typeof binding.role === "string" && Array.isArray(binding.members));
    assert.ok(binding.members.every(value => typeof value === "string"));
  }
  const unconditional = binding => binding.role === ROLE && !Object.hasOwn(binding, "condition");
  if (updated.bindings.some(binding => unconditional(binding) && binding.members.includes(MEMBER)))
    return { changed: false, addedMemberCount: 0, policy: updated };
  const existing = updated.bindings.find(unconditional);
  if (existing) existing.members.push(MEMBER);
  else updated.bindings.push({ role: ROLE, members: [MEMBER] });
  updated.version = 3;
  return { changed: true, addedMemberCount: 1, policy: updated };
}

async function cachedToken() {
  const require = createRequire(import.meta.url);
  const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); assert.ok(account);
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project: PROJECT }, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken(); assert.ok(typeof token === "string" && token);
  return token;
}

let phase = "argument-validation", mutationAttempted = false;
async function main() {
  const options = parseProductionPublisherArgs(process.argv.slice(2));
  phase = "cached-operator-authentication";
  const token = await cachedToken();
  async function request(url, body) {
    const response = await fetch(url, { method: body ? "POST" : "GET", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error("Request failed"), { safeHttpStatus: response.status }); }
    const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    return JSON.parse(text);
  }
  const resource = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`;
  phase = "project-metadata";
  const metadata = await request(`${resource}?fields=projectId,projectNumber`);
  assert.equal(metadata.projectId, PROJECT); assert.equal(String(metadata.projectNumber), NUMBER);
  phase = "existing-storage-agent-proof";
  const serviceAgent = await request(`https://storage.googleapis.com/storage/v1/projects/${PROJECT}/serviceAccount?fields=email_address,kind`);
  phase = "exact-role-definition";
  const role = await request(`https://iam.googleapis.com/v1/${ROLE}?fields=name,includedPermissions,deleted`);
  const getPolicy = () => request(`${resource}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } });
  phase = "read-policy-version-3";
  const before = await getPolicy();
  phase = "validate-exact-repair-plan";
  const plan = planProductionPublisherRepair({ project: PROJECT, metadata, serviceAgent, role, policy: before });
  if (options.apply && plan.changed) {
    phase = "apply-etag-protected-policy"; mutationAttempted = true;
    await request(`${resource}:setIamPolicy`, { policy: plan.policy });
  }
  phase = "verify-policy-readback";
  const after = options.apply && plan.changed ? await getPolicy() : before;
  if (options.apply) verifyStorageRulesIam(plan.policy, after);
  console.log(JSON.stringify({ project: PROJECT, readOnly: !options.apply, exactProjectNumberVerified: true,
    existingStorageAgentVerified: true, exactPublishOnlyRoleVerified: true, alreadyGranted: !plan.changed,
    wouldAddMemberCount: plan.addedMemberCount, addedMemberCount: options.apply ? plan.addedMemberCount : 0,
    bindingCountBefore: (before.bindings || []).length, bindingCountAfter: (after.bindings || []).length,
    observedPolicyVersion: after.version ?? 1,
    targetUnconditionalGrantPresent: (after.bindings || []).some(binding => binding.role === ROLE
      && !Object.hasOwn(binding, "condition") && binding.members?.includes(MEMBER)),
    mutationAttempted, verificationCompleted: options.apply, fullPolicyVerified: options.apply }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
  const reasons = ["policy-version-mismatch", "policy-bindings-mismatch", "policy-audit-configs-mismatch", "policy-other-fields-mismatch"];
  console.error(JSON.stringify({ ok: false, phase, mutationAttempted, verificationCompleted: false,
    reason: reasons.includes(error?.safeReason) ? error.safeReason : "request-or-validation-failed",
    httpStatus: Number.isInteger(error?.safeHttpStatus) ? error.safeHttpStatus : 0 }));
  process.exitCode = 1;
});

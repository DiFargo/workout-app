// Staging-only cross-service Rules permission repair. Read-only unless explicitly applied.
// https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT = "tren-85720-staging";
const ROLE = "roles/firebaserules.firestoreServiceAgent";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = value => value && typeof value === "object" ? Array.isArray(value)
  ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function parseStorageRulesIamArgs(args, env = process.env) {
  const options = { apply: false };
  const seen = new Set();
  for (const argument of args) {
    const match = /^--(project|confirm-project)=(.+)$/.exec(argument);
    const key = match ? match[1] : argument;
    assert.ok(!seen.has(key), "Duplicate argument"); seen.add(key);
    if (argument === "--apply") options.apply = true;
    else if (match) options[match[1] === "project" ? "project" : "confirmProject"] = match[2];
    else assert.fail("Unsupported argument");
  }
  assert.equal(options.project, PROJECT, "Exact staging project required");
  if (options.confirmProject !== undefined || options.apply) assert.equal(options.confirmProject, PROJECT, "Exact staging confirmation required");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN"])
    assert.ok(!env[key], "Cached CLI operator only");
  return options;
}

export function planStorageRulesIam({ project, metadata, serviceAccount, serviceAccountLookupUnavailable = false, role, policy }) {
  assert.equal(project, PROJECT);
  assert.equal(metadata?.projectId, PROJECT);
  assert.match(String(metadata.projectNumber), /^[1-9]\d{0,24}$/);
  const email = `service-${metadata.projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com`;
  const member = `serviceAccount:${email}`;
  const bindingProof = serviceAccountLookupUnavailable && !serviceAccount && (policy?.bindings || []).some(binding =>
    binding.role === "roles/firebasestorage.serviceAgent" && !Object.hasOwn(binding, "condition") && binding.members?.includes(member));
  if (!bindingProof) {
    assert.equal(serviceAccount?.email, email, "Existing Storage service agent required");
    assert.equal(serviceAccount.projectId, PROJECT);
    assert.notEqual(serviceAccount.disabled, true);
  }
  assert.equal(role?.name, ROLE);
  assert.notEqual(role.deleted, true);
  assert.deepEqual(role.includedPermissions, ["datastore.entities.get"], "Unexpected role authority");
  assert.ok(policy && typeof policy.etag === "string" && policy.etag, "Optimistic concurrency etag required");
  assert.ok([undefined, 1, 3].includes(policy.version), "Unsupported policy version");
  assert.ok(policy.bindings === undefined || Array.isArray(policy.bindings));
  const updated = structuredClone(policy);
  updated.bindings ||= [];
  for (const binding of updated.bindings) {
    assert.ok(typeof binding.role === "string" && Array.isArray(binding.members));
    assert.ok(binding.members.every(value => typeof value === "string"));
  }
  const unconditioned = binding => binding.role === ROLE && !Object.hasOwn(binding, "condition");
  if (updated.bindings.some(binding => unconditioned(binding) && binding.members.includes(member)))
    return { changed: false, policy: updated, addedMemberCount: 0, bindingProof: Boolean(bindingProof) };
  const binding = updated.bindings.find(unconditioned);
  if (binding) binding.members.push(member);
  else updated.bindings.push({ role: ROLE, members: [member] });
  updated.version = 3;
  return { changed: true, policy: updated, addedMemberCount: 1, bindingProof: Boolean(bindingProof) };
}

export function verifyStorageRulesIam(expected, observed) {
  const withoutEtag = policy => Object.fromEntries(Object.entries(policy).filter(([key]) => key !== "etag"));
  assert.ok(observed && typeof observed.etag === "string" && observed.etag);
  const want = withoutEtag(expected), got = withoutEtag(observed);
  const hasConditions = policy => (policy.bindings || []).some(binding => Object.hasOwn(binding, "condition"));
  // IAM can return version 1 for an unconditional policy submitted as version
  // 3. Only that equivalent representation is normalized; conditions stay strict.
  if (!hasConditions(want) && !hasConditions(got) && [1, 3].includes(want.version) && [1, 3].includes(got.version)) {
    want.version = 1; got.version = 1;
  }
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  let safeReason;
  if (want.version !== got.version) safeReason = "policy-version-mismatch";
  else if (!same(want.bindings, got.bindings)) safeReason = "policy-bindings-mismatch";
  else if (!same(want.auditConfigs, got.auditConfigs)) safeReason = "policy-audit-configs-mismatch";
  else if (!same(want, got)) safeReason = "policy-other-fields-mismatch";
  if (safeReason) throw Object.assign(new Error("Policy verification mismatch"), { safeReason });
  return true;
}

async function cachedToken() {
  const require = createRequire(import.meta.url);
  const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
  assert.ok(account, "Cached operator required");
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project: PROJECT }, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
  assert.ok(typeof token === "string" && token);
  return token;
}

let mutationAttempted = false;
let currentPhase = "argument-validation";
async function main() {
  const options = parseStorageRulesIamArgs(process.argv.slice(2));
  currentPhase = "cached-operator-authentication";
  const token = await cachedToken();
  async function request(url, body) {
    const response = await fetch(url, { method: body ? "POST" : "GET", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error("Request failed"), { safeHttpStatus: response.status });
    }
    const text = await response.text();
    assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024, "Response too large");
    return JSON.parse(text);
  }
  const resource = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`;
  currentPhase = "project-metadata";
  const metadata = await request(resource);
  assert.equal(metadata.projectId, PROJECT);
  assert.match(String(metadata.projectNumber), /^[1-9]\d{0,24}$/);
  const email = `service-${metadata.projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com`;
  let serviceAccount = null, serviceAccountLookupUnavailable = false, serviceAccountLookupHttpStatus = 200;
  currentPhase = "managed-service-agent-lookup";
  try {
    serviceAccount = await request(`https://iam.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(email)}`);
  } catch (error) {
    // Google-managed service agents may not be exposed as user-managed SAs.
    // A missing/unreadable managed identity can instead be proven by its exact
    // existing Google-provisioned binding. Quota/transport/server errors fail.
    if (![403, 404].includes(error?.safeHttpStatus)) throw error;
    serviceAccountLookupUnavailable = true;
    serviceAccountLookupHttpStatus = error.safeHttpStatus;
  }
  currentPhase = "exact-role-definition";
  const role = await request(`https://iam.googleapis.com/v1/${ROLE}`);
  const getPolicy = () => request(`${resource}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } });
  currentPhase = "read-policy-version-3";
  const policy = await getPolicy();
  currentPhase = "validate-exact-repair-plan";
  const plan = planStorageRulesIam({ project: PROJECT, metadata, serviceAccount, serviceAccountLookupUnavailable, role, policy });
  if (options.apply && plan.changed) {
    mutationAttempted = true;
    currentPhase = "apply-etag-protected-policy";
    // Full policy preserves every binding/condition/audit config and the etag.
    // Concurrent policy changes reject the write; never retry or overwrite them.
    await request(`${resource}:setIamPolicy`, { policy: plan.policy });
  }
  currentPhase = "verify-policy-readback";
  const observed = options.apply && plan.changed ? await getPolicy() : policy;
  if (options.apply) verifyStorageRulesIam(plan.policy, observed);
  console.log(JSON.stringify({ readOnly: !options.apply, serviceAgentIdentityProven: true,
    serviceAccountGetSucceeded: !serviceAccountLookupUnavailable, serviceAccountLookupHttpStatus,
    managedAgentBindingProof: plan.bindingProof, exactRolePermissionVerified: true,
    alreadyGranted: !plan.changed, addedMemberCount: options.apply ? plan.addedMemberCount : 0,
    wouldAddMemberCount: plan.addedMemberCount, bindingCountBefore: (policy.bindings || []).length,
    bindingCountAfter: (observed.bindings || []).length, mutationAttempted,
    observedPolicyVersion: observed.version ?? 1,
    conditionalBindingCount: (observed.bindings || []).filter(binding => Object.hasOwn(binding, "condition")).length,
    targetUnconditionalBindingPresent: (observed.bindings || []).some(binding => binding.role === ROLE &&
      !Object.hasOwn(binding, "condition") && binding.members?.includes(`serviceAccount:${email}`)),
    verificationCompleted: options.apply, policyPreserved: options.apply ? true : false }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
  console.error(JSON.stringify({ ok: false, phase: currentPhase, mutationAttempted, verificationCompleted: false,
    reason: ["policy-version-mismatch", "policy-bindings-mismatch", "policy-audit-configs-mismatch", "policy-other-fields-mismatch"].includes(error?.safeReason)
      ? error.safeReason : "request-or-validation-failed",
    httpStatus: Number.isInteger(error?.safeHttpStatus) ? error.safeHttpStatus : 0 }));
  process.exitCode = 1;
});

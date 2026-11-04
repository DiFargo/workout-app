import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Read-only metadata observer. Never downloads media, reads download tokens,
// prints object/account names or error bodies, or writes remote configuration.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = ["tren-85720", "tren-85720-staging"];
const LIMITS = { pages: 5, pageSize: 1000, individualAclFallbacks: 1000, timeoutMs: 15000, budgetMs: 180000, responseBytes: 4 * 1024 * 1024 };
const PUBLIC = new Set(["allUsers", "allAuthenticatedUsers"]);
let phase = "configuration_allowlist";
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !arg.startsWith("--output="))) throw new Error("Use only optional --output=artifacts/<file>.json");
const output = args[0] ? resolve(ROOT, args[0].slice("--output=".length)) : null;
if (output) {
  const child = relative(resolve(ROOT, "artifacts"), output);
  if (!child || child.startsWith("..") || isAbsolute(child) || !output.endsWith(".json")) throw new Error("Output must be a JSON file below artifacts");
}

async function cachedToken() {
  if (process.env.FIREBASE_TOKEN) throw new Error("cached-account-required");
  const require = createRequire(import.meta.url);
  const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
  if (!account) throw new Error("cached-account-unavailable");
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project: PROJECTS[0] }, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
  if (typeof token !== "string" || !token) throw new Error("cached-token-unavailable");
  return token;
}

async function boundedJson(response) {
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.byteLength;
      if (length > LIMITS.responseBytes) { await reader.cancel(); throw new Error("response-limit"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function publicAcl(items) {
  const grants = (items || []).filter(item => PUBLIC.has(item.entity));
  return {
    publicGrantCount: grants.length,
    publicReaderGrantCount: grants.filter(item => ["READER", "OWNER"].includes(item.role)).length,
    byRole: Object.fromEntries([...new Set(grants.map(item => item.role))].map(role => [role, grants.filter(item => item.role === role).length]))
  };
}

function publicBindings(bindings) {
  const grants = [];
  for (const binding of bindings || []) {
    const publicMembers = (binding.members || []).filter(member => PUBLIC.has(member));
    if (publicMembers.length) grants.push({ role: binding.role, publicPrincipalCount: publicMembers.length,
      conditional: Boolean(binding.condition), allUsers: publicMembers.includes("allUsers"), allAuthenticatedUsers: publicMembers.includes("allAuthenticatedUsers") });
  }
  return { publicBindingCount: grants.length, allUsersBindingCount: grants.filter(item => item.allUsers).length,
    allAuthenticatedUsersBindingCount: grants.filter(item => item.allAuthenticatedUsers).length, grants };
}

async function inspect() {
  phase = "cached_cli_authentication";
  let token;
  try { token = await cachedToken(); } catch { throw new Error("Cached CLI authentication unavailable; no inspection requests made, no credentials printed."); }
  phase = "readonly_metadata_queries";
  const deadline = Date.now() + LIMITS.budgetMs;
  const request = async (url, body) => {
    if (Date.now() >= deadline) return { ok: false, status: "budget_exhausted" };
    try {
      const response = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.min(LIMITS.timeoutMs, deadline - Date.now())) });
      if (!response.ok) { await response.body?.cancel(); return { ok: false, status: `unavailable_http_${response.status}` }; }
      return { ok: true, status: "observed", data: await boundedJson(response) };
    } catch { return { ok: false, status: "unavailable_transport_timeout_or_response" }; }
  };
  const results = [];
  for (const project of PROJECTS) {
    const result = { project };
    const projectPolicy = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy?fields=bindings(role,members,condition),version`, { options: { requestedPolicyVersion: 3 } });
    result.projectIam = projectPolicy.ok ? { status: "observed", ...publicBindings(projectPolicy.data.bindings) } : { status: projectPolicy.status };
    const projectInfo = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}?fields=projectId,parent`);
    result.ancestorScope = projectInfo.ok ? { status: "observed", hasOrganizationOrFolderParent: Boolean(projectInfo.data.parent),
      ancestorPoliciesInspected: false } : { status: projectInfo.status, ancestorPoliciesInspected: false };
    const identity = await request(`https://firebasestorage.googleapis.com/v1alpha/projects/${project}/defaultBucket?fields=bucket(name)`);
    const bucket = identity.ok ? String(identity.data.bucket?.name || "").split("/").at(-1) : "";
    if (![`${project}.firebasestorage.app`, `${project}.appspot.com`].includes(bucket)) {
      result.storage = { status: identity.ok ? "bucket_not_in_exact_allowlist" : identity.status }; results.push(result); continue;
    }
    const base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`;
    const metadata = await request(`${base}?fields=iamConfiguration(uniformBucketLevelAccess(enabled),publicAccessPrevention)`);
    result.bucket = bucket;
    result.controls = metadata.ok ? { status: "observed", uniformBucketLevelAccess: metadata.data.iamConfiguration?.uniformBucketLevelAccess?.enabled === true,
      publicAccessPrevention: metadata.data.iamConfiguration?.publicAccessPrevention || "unspecified" } : { status: metadata.status };
    const policy = await request(`${base}/iam?optionsRequestedPolicyVersion=3&fields=bindings(role,members,condition),version`);
    result.bucketIam = policy.ok ? { status: "observed", ...publicBindings(policy.data.bindings) } : { status: policy.status };
    for (const [property, endpoint] of [["bucketAcl", "acl"], ["defaultObjectAcl", "defaultObjectAcl"]]) {
      const acl = await request(`${base}/${endpoint}?fields=items(entity,role)`);
      result[property] = acl.ok ? { status: "observed", ...publicAcl(acl.data.items) } : { status: acl.status,
        ...(result.controls.uniformBucketLevelAccess ? { aclDisabledByUniformAccess: true } : {}) };
    }
    const objects = { status: "pending", versions: true, prefix: "progress-photos/", pages: 0, complete: false, scannedVersions: 0,
      aclInspectedVersions: 0, aclUnavailableVersions: 0, publicReadableVersions: 0, publicGrantCount: 0, publicReaderGrantCount: 0, fallbackAclRequests: 0, grantsByRole: {} };
    let pageToken = "";
    for (let page = 0; page < LIMITS.pages; page++) {
      const url = new URL(`${base}/o`);
      const params = { prefix: "progress-photos/", versions: "true", projection: "full", maxResults: String(LIMITS.pageSize), fields: "items(name,generation,acl(entity,role)),nextPageToken", ...(pageToken ? { pageToken } : {}) };
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const listing = await request(url); objects.pages++;
      if (!listing.ok) { objects.status = listing.status; break; }
      for (const object of listing.data.items || []) {
        objects.scannedVersions++;
        let acl = object.acl;
        if (!Array.isArray(acl) && typeof object.name === "string" && object.name.startsWith("progress-photos/") && object.generation && objects.fallbackAclRequests < LIMITS.individualAclFallbacks && !result.controls.uniformBucketLevelAccess) {
          objects.fallbackAclRequests++;
          const detail = new URL(`${base}/o/${encodeURIComponent(object.name)}/acl`);
          detail.searchParams.set("generation", String(object.generation)); detail.searchParams.set("fields", "items(entity,role)");
          const explicit = await request(detail); if (explicit.ok) acl = explicit.data.items || [];
        }
        if (!Array.isArray(acl)) { objects.aclUnavailableVersions++; continue; }
        objects.aclInspectedVersions++;
        const flags = publicAcl(acl);
        if (flags.publicReaderGrantCount) objects.publicReadableVersions++;
        objects.publicGrantCount += flags.publicGrantCount; objects.publicReaderGrantCount += flags.publicReaderGrantCount;
        for (const [role, count] of Object.entries(flags.byRole)) objects.grantsByRole[role] = (objects.grantsByRole[role] || 0) + count;
      }
      pageToken = listing.data.nextPageToken || "";
      if (!pageToken) { objects.complete = true; objects.status = objects.aclUnavailableVersions ? "partial_acl_unavailable" : "observed"; break; }
      if (page === LIMITS.pages - 1) objects.status = "page_limit_reached";
    }
    result.progressPhotosObjectAcl = objects;
    const publicRoles = [...new Set([...(result.projectIam.grants || []), ...(result.bucketIam.grants || [])].map(grant => grant.role))];
    result.publicRoleClassification = [];
    for (const role of publicRoles.slice(0, 10)) {
      if (!/^roles\/[A-Za-z0-9_.]+$/.test(role) && !new RegExp(`^projects/${project}/roles/[A-Za-z0-9_.]+$`).test(role)) {
        result.publicRoleClassification.push({ role, status: "unavailable_role_outside_allowlist" }); continue;
      }
      const definition = await request(`https://iam.googleapis.com/v1/${role}?fields=name,includedPermissions`);
      result.publicRoleClassification.push({ role, status: definition.status, ...(definition.ok ? {
        grantsObjectReadPermission: (definition.data.includedPermissions || []).includes("storage.objects.get"),
        grantsObjectListPermission: (definition.data.includedPermissions || []).includes("storage.objects.list")
      } : {}) });
    }
    results.push(result);
  }
  token = undefined;
  return { schemaVersion: 1, observedAt: new Date().toISOString(), readOnly: true, remoteWrites: 0, downloadedImageBytes: 0, limits: LIMITS,
    privacySafeAggregatesOnly: true, results, limitations: [
      "Only each exact allowlisted project's default bucket and progress-photos/ object versions are inspected. No other bucket or image content is read.",
      "UBLA/PAP values do not prove public exposure or its absence. Public IAM roles are classified only using official IAM role includedPermissions when available.",
      "Conditional public bindings are reported, not evaluated. Organization/folder ancestor IAM is outside scope if a project has a parent.",
      "Signed URLs, Firebase download tokens, external copies and non-default buckets are not inspected. No claim about them is made.",
      "Unavailable ACL or policy checks remain unavailable, never a verified zero. Object names, UIDs, emails, credential/token values and provider bodies are not emitted."
    ] };
}

// Keep this file operator-only; no imported application module is executed.
try {
  // Read the known aliases only to catch accidental repository/project drift.
  const configured = JSON.parse(await readFile(resolve(ROOT, ".firebaserc"), "utf8")).projects;
  if (configured.production !== PROJECTS[0] || configured.staging !== PROJECTS[1]) throw new Error("allowlist-mismatch");
  const report = await inspect();
  if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + "\n"); }
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(`Read-only private-photo exposure inspection unavailable at ${phase}. No credentials, object names or provider bodies emitted.`);
  process.exitCode = 1;
}

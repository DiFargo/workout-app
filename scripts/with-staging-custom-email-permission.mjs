import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { project, assertStagingConfiguration, assertStagingSigner, runSmoke } from "./smoke-staging-custom-email.mjs";

// These flags are execution guards, NOT human authorization. Do not execute
// until the human has separately approved this exact temporary staging grant.
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = "3.0.840";
const role = "roles/iam.serviceAccountTokenCreator";
const durationMs = 15 * 60 * 1000;
const functionName = `projects/${project}/locations/europe-west1/functions/profileUpdateEmail`;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const safeFailure = error => /^\d{3}$/.test(String(error?.status || "")) ? `http-${error.status}`
  : /^[a-z0-9-]{1,80}$/.test(error?.code || "") ? error.code : "operation-failed";

export function artifactPath(value) {
  const path = resolve(workspace, value);
  const child = relative(resolve(workspace, "artifacts"), path);
  assert.ok(child && !child.startsWith("..") && !isAbsolute(child) && path.endsWith(".json"), "Journal/output must be JSON below artifacts.");
  return path;
}

export function parseArguments(args, env = process.env) {
  let approved = false, expected = false, cleanupOnly = "";
  for (const argument of args) {
    if (argument === "--approved-temporary-staging-token-creator" && !approved) approved = true;
    else if (argument === `--expected-version=${version}` && !expected) expected = true;
    else if (argument.startsWith("--cleanup-only=") && !cleanupOnly) cleanupOnly = artifactPath(argument.slice(15));
    else fail("invalid-arguments");
  }
  assert.ok(approved && expected, "Both explicit approval guard and exact version 3.0.840 required. Flags are not authorization.");
  for (const key of ["FIREBASE_TOKEN", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS"]) {
    assert.ok(!env[key], "Only the cached CLI operator and real staging are allowed.");
  }
  return { version, cleanupOnly };
}

export function makeOwnership({ signer, projectNumber, operatorEmail, runId = randomBytes(12).toString("hex"), now = Date.now() }) {
  assert.match(runId, /^[a-f0-9]{24}$/);
  assert.match(String(projectNumber), /^\d+$/);
  assert.match(signer, /^[a-z0-9._-]+@[a-z0-9.-]+\.gserviceaccount\.com$/);
  assertStagingSigner(signer, projectNumber);
  const email = String(operatorEmail || "").trim().toLowerCase();
  assert.match(email, /^[^\s:@]+@[^\s@]+\.[^\s@]+$/);
  assert.ok(!email.endsWith(".gserviceaccount.com"), "A cached human CLI user is required.");
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + durationMs).toISOString();
  return { project, projectNumber: String(projectNumber), signer, functionName, runId, createdAt, expiresAt,
    operatorSha256: sha256(email), member: `user:${email}`, role,
    condition: { title: `staging-custom-email-${runId}`, description: "One-run staging custom-email verification; automatically expires after 15 minutes.",
      expression: `request.time < timestamp("${expiresAt}")` } };
}

export function publicOwnership(ownership) {
  const { member: _member, ...metadata } = ownership;
  return metadata;
}

export function restoreOwnership(metadata, operatorEmail, projectNumber) {
  assert.equal(metadata?.project, project);
  assert.equal(metadata?.functionName, functionName);
  assert.equal(String(metadata?.projectNumber), String(projectNumber));
  const recreated = makeOwnership({ signer: metadata.signer, projectNumber, operatorEmail,
    runId: metadata.runId, now: Date.parse(metadata.createdAt) });
  assert.deepEqual(metadata, publicOwnership(recreated), "Journal ownership metadata mismatch.");
  return recreated;
}

export function assertRuntimeOwnership(runtime, ownership) {
  assert.equal(runtime?.name, functionName, "Only the approved staging function is allowed.");
  assert.equal(runtime?.serviceConfig?.serviceAccountEmail, ownership.signer, "Runtime signer changed; manual review is required.");
}

const sameCondition = (left, right) => left?.title === right.title && left?.description === right.description && left?.expression === right.expression;
export function ownedMemberCount(policy, ownership) {
  return (policy.bindings || []).filter(binding => binding.role === ownership.role && sameCondition(binding.condition, ownership.condition))
    .reduce((count, binding) => count + (binding.members || []).filter(member => member === ownership.member).length, 0);
}

export function mergePolicy(policy, ownership, operation) {
  assert.ok(["add", "remove"].includes(operation));
  assert.equal(ownership.project, project); assert.equal(ownership.functionName, functionName);
  assertStagingSigner(ownership.signer, ownership.projectNumber);
  assert.equal(ownership.role, role);
  assert.ok(typeof policy?.etag === "string" && policy.etag, "A fresh policy ETag is required.");
  assert.ok(policy.bindings === undefined || Array.isArray(policy.bindings));
  if (operation === "remove" && !policy.bindings) return { policy: structuredClone(policy), changed: false };
  const next = structuredClone(policy);
  next.bindings ||= [];
  for (const binding of next.bindings) {
    assert.ok(Array.isArray(binding.members));
    if (binding.role === role && binding.condition?.title === ownership.condition.title && !sameCondition(binding.condition, ownership.condition)) {
      fail("condition-ownership-conflict");
    }
  }
  if (operation === "add") {
    const existing = next.bindings.find(binding => binding.role === role && sameCondition(binding.condition, ownership.condition));
    if (existing) { if (!existing.members.includes(ownership.member)) existing.members.push(ownership.member); }
    else next.bindings.push({ role, members: [ownership.member], condition: structuredClone(ownership.condition) });
    next.version = 3;
  } else {
    next.bindings = next.bindings.flatMap(binding => {
      if (binding.role !== role || !sameCondition(binding.condition, ownership.condition)) return [binding];
      binding.members = binding.members.filter(member => member !== ownership.member);
      return binding.members.length ? [binding] : [];
    });
  }
  return { policy: next, changed: JSON.stringify(next) !== JSON.stringify(policy) };
}

export async function editPolicyWithRetries({ readPolicy, setPolicy, ownership, operation }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const current = await readPolicy();
    const merged = mergePolicy(current, ownership, operation);
    if (!merged.changed) return { attempts: attempt, changed: false };
    try { await setPolicy(merged.policy); return { attempts: attempt, changed: true }; }
    catch (error) { if (![409, 412].includes(error.status) || attempt === 3) throw error; }
  }
  fail("etag-retries-exhausted");
}

export async function cleanupOwnedGrant({ ownership, readPolicy, setPolicy, state }) {
  const observePolicy = async () => {
    const policy = await readPolicy();
    if (ownedMemberCount(policy, ownership) > 0) {
      state.grantObserved = true;
      state.grantOutcomeUnresolved = false;
    }
    return policy;
  };
  await editPolicyWithRetries({ readPolicy: observePolicy, setPolicy, ownership, operation: "remove" });
  const absent = ownedMemberCount(await observePolicy(), ownership) === 0;
  // An unknown add may still be in flight. Absent reads or an identical-policy
  // CAS do not establish that it cannot commit later.
  state.cleanupVerified = absent && state.grantOutcomeUnresolved === false;
  return state;
}

export function recoveryGrantState(record) {
  const previous = [...(record.events || [])].reverse().find(event => event.result)?.result || {};
  return {
    grantOutcomeUnresolved: previous.grantOutcomeUnresolved !== false,
    grantObserved: previous.grantObserved === true,
    grantAddOutcomeConfirmed: previous.grantAddOutcomeConfirmed === true,
    cleanupVerified: false
  };
}

// Dependencies are injectable so unknown setIamPolicy outcomes and cleanup
// paths are tested without IAM calls, identities or credentials.
export async function withTemporaryGrant({ ownership, readPolicy, setPolicy, journal, probe, smoke }) {
  const result = { grantAttempted: false, grantVerified: false, grantAddOutcomeConfirmed: false, grantObserved: false,
    grantOutcomeUnresolved: true, probeVerified: false, smokeRuns: 0, smokePassed: false, cleanupVerified: false };
  let prepared = false;
  try {
    await journal({ phase: "prepared-before-iam-mutation", result: { ...result } });
    prepared = true;
    result.grantAttempted = true; // Includes ambiguous failures of setIamPolicy.
    await editPolicyWithRetries({ readPolicy, setPolicy, ownership, operation: "add" });
    result.grantAddOutcomeConfirmed = true;
    result.grantOutcomeUnresolved = false;
    assert.equal(ownedMemberCount(await readPolicy(), ownership), 1, "Temporary owned member must be confirmed exactly once.");
    result.grantObserved = true;
    result.grantVerified = true;
    await journal({ phase: "temporary-grant-confirmed", result: { ...result } });
    await probe();
    result.probeVerified = true;
    await journal({ phase: "harmless-signblob-probe-confirmed-before-auth-creation", result: { ...result } });
    result.smokeRuns++;
    const report = await smoke();
    result.smokePassed = report?.passed === true && report?.cleanup?.complete === true;
    if (!result.smokePassed) fail("synthetic-smoke-or-cleanup-failed");
  } catch (error) { result.failure = safeFailure(error); }
  finally {
    if (result.grantAttempted) {
      try {
        await cleanupOwnedGrant({ ownership, readPolicy, setPolicy, state: result });
        if (!result.cleanupVerified) result.cleanupFailure = result.grantOutcomeUnresolved ? "grant-outcome-unresolved" : "owned-grant-still-present";
      } catch (error) { result.cleanupFailure = safeFailure(error); }
    }
    result.passed = !result.failure && result.smokePassed && result.cleanupVerified;
    if (prepared) await journal({ phase: "finished", result: { ...result } });
  }
  return result;
}

async function main(options) {
  const require = createRequire(import.meta.url);
  const cli = resolve(workspace, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
  assert.ok(account?.user?.email, "Cached human CLI operator unavailable.");
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
  assert.ok(typeof token === "string" && token);
  const request = async (url, { method = "GET", body, timeoutMs = 20000, discard = false } = {}) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error("Privileged staging request failed"), { status: response.status }); }
    if (discard) { await response.body?.cancel(); return; }
    return response.json();
  };
  const metadata = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`);
  assert.equal(metadata.projectId, project); assert.match(String(metadata.projectNumber), /^\d+$/);
  let ownership, journalPath, record;
  if (options.cleanupOnly) {
    journalPath = options.cleanupOnly;
    record = JSON.parse(await readFile(journalPath, "utf8"));
    assert.equal(record.schema, "staging-custom-email-temporary-permission-v1"); assert.equal(record.version, version);
    ownership = restoreOwnership(record.ownership, account.user.email, metadata.projectNumber);
    assert.equal(journalPath, artifactPath(`artifacts/variant-a-${version}/staging-custom-email-permission-${ownership.runId}.json`));
    assertRuntimeOwnership(await request(`https://cloudfunctions.googleapis.com/v2/${functionName}`), ownership);
  } else {
    const base = `https://${project}.web.app`;
    const config = await fetch(`${base}/__/firebase/init.json`, { signal: AbortSignal.timeout(20000) });
    assert.equal(config.status, 200);
    const worker = await fetch(`${base}/sw.js?permission-preflight=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    assert.equal(worker.status, 200);
    assertStagingConfiguration(await config.json(), await worker.text(), version);
    const runtime = await request(`https://cloudfunctions.googleapis.com/v2/${functionName}`);
    assert.equal(runtime.name, functionName);
    ownership = makeOwnership({ signer: runtime.serviceConfig?.serviceAccountEmail || "", projectNumber: metadata.projectNumber, operatorEmail: account.user.email });
    assertRuntimeOwnership(runtime, ownership);
    journalPath = artifactPath(`artifacts/variant-a-${version}/staging-custom-email-permission-${ownership.runId}.json`);
    record = { schema: "staging-custom-email-temporary-permission-v1", version, authorizationNotice: "Execution flags are not authorization; separate explicit human approval is required.", ownership: publicOwnership(ownership), events: [] };
  }
  const policyUrl = `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(ownership.signer)}`;
  const readPolicy = () => request(`${policyUrl}:getIamPolicy?options.requestedPolicyVersion=3`, { method: "POST" });
  const setPolicy = policy => request(`${policyUrl}:setIamPolicy`, { method: "POST", body: { policy } });
  let initial = !options.cleanupOnly;
  const journal = async entry => {
    record.events.push({ at: new Date().toISOString(), ...entry });
    await mkdir(dirname(journalPath), { recursive: true });
    if (initial) { await writeFile(journalPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" }); initial = false; }
    else {
      const temporary = `${journalPath}.${randomBytes(6).toString("hex")}.tmp`;
      await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
      await rename(temporary, journalPath);
    }
  };
  if (options.cleanupOnly) {
    const state = recoveryGrantState(record);
    await journal({ phase: "explicit-cleanup-only-start", result: { ...state } });
    await cleanupOwnedGrant({ readPolicy, setPolicy, ownership, state });
    await journal({ phase: "explicit-cleanup-only-finished", result: { ...state } });
    if (!state.cleanupVerified) fail(state.grantOutcomeUnresolved ? "grant-outcome-unresolved" : "owned-grant-still-present");
    console.log(JSON.stringify({ project, version, cleanupOnly: true, cleanupVerified: true }));
    return;
  }
  const smokeOutput = artifactPath(`artifacts/variant-a-${version}/staging-custom-email-smoke-${ownership.runId}.json`);
  await access(smokeOutput).then(() => fail("smoke-output-already-exists"), error => { if (error.code !== "ENOENT") throw error; });
  const probe = async () => {
    const deadline = Date.now() + 150000;
    const payload = Buffer.from("Staging custom email permission probe; harmless non-JWT text.").toString("base64");
    while (Date.now() < deadline) {
      try {
        await request(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(ownership.signer)}:signBlob`,
          { method: "POST", body: { payload }, timeoutMs: Math.max(1, Math.min(10000, deadline - Date.now())), discard: true });
        return;
      } catch (error) { if (![403, 429, 500, 502, 503, 504].includes(error.status)) throw error; }
      const remaining = deadline - Date.now();
      if (remaining > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, Math.min(5000, remaining)));
    }
    fail("signblob-propagation-timeout");
  };
  const result = await withTemporaryGrant({ ownership, readPolicy, setPolicy, journal, probe,
    smoke: () => {
      if (Date.now() + 5 * 60 * 1000 >= Date.parse(ownership.expiresAt)) fail("temporary-permission-window-too-short");
      return runSmoke({ version, output: smokeOutput });
    } });
  console.log(JSON.stringify({ project, version, ...result, journal: relative(workspace, journalPath).replaceAll("\\", "/") }));
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(parseArguments(process.argv.slice(2))); }
  catch (error) { console.error(JSON.stringify({ project, version, passed: false, failure: safeFailure(error), note: "No credentials, signatures or raw policies logged. Inspect the run journal for cleanup-only recovery." })); process.exitCode = 1; }
}

import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = new Set(["tren-85720", "tren-85720-staging"]);
const CONFIG_PATH = "serverConfig/subscriptionAccounting";
const GAP_MS = 10000;
const MAX_USERS = 1000, MAX_HISTORY = 20000, MAX_REQUESTS = 500;
const SUBSCRIPTION_FIELDS = ["cycleId", "cycleStartedAt", "lastRenewedAt", "startDate", "endDate",
  "periodMode", "purchasedSessions", "totalSessions", "usedSessions", "remainingSessions"];
const LIMITATIONS = [
  "Operator --confirm-drained is an acknowledgment, not programmatic proof that old handlers or Admin SDK writers have stopped.",
  "Stable projected observations are not a database-wide lock or a backup. Maintenance rules and operator coordination must already be effective.",
  "Existing manual balances are preserved, not recalculated or certified correct. Legacy unmarked histories require a separate reconciliation decision.",
  "No paid backups/resources, IAM, API settings, Auth, Telegram, user documents or ledger entries are modified by this script.",
  "A fixed cutover and server-only ledger/config must remain intact across redeploys. Do not run old accounting handlers after baseline.",
  "Optional initial cycle IDs are a one-time ledger activation exception, not historical cycle-start evidence. Renewals must choose a new ID and real boundary; never reuse a baseline cycle ID.",
];
const fail = code => { throw Object.assign(new Error(code), { migrationCode: code }); };
const instant = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(value) && Number.isFinite(Date.parse(value));
const canonical = value => value && typeof value === "object" ? Array.isArray(value) ? value.map(canonical)
  : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function parseMigrationArgs(argv) {
  const options = { phase: "inspect", apply: false, confirmDrained: false, confirmLedgerDeployed: false,
    acceptInitialCycleBaseline: false };
  let phase = false;
  const seen = new Set();
  for (const arg of argv) {
    const valued = /^--(project|confirm-project|output)=(.+)$/.exec(arg);
    const key = valued ? valued[1] : arg;
    if (seen.has(key)) fail("duplicate-argument");
    seen.add(key);
    if (valued) options[{ project: "project", "confirm-project": "confirmProject", output: "output" }[key]] = valued[2];
    else if (["--pause", "--baseline", "--resume", "--cancel-before-baseline"].includes(arg)) {
      if (phase) fail("one-phase-required");
      options.phase = arg.slice(2); phase = true;
    } else if (arg === "--apply") options.apply = true;
    else if (arg === "--confirm-drained") options.confirmDrained = true;
    else if (arg === "--confirm-ledger-deployed") options.confirmLedgerDeployed = true;
    else if (arg === "--accept-initial-cycle-baseline") options.acceptInitialCycleBaseline = true;
    else fail("unknown-argument");
  }
  if (!PROJECTS.has(options.project)) fail("exact-whitelisted-project-required");
  if (options.confirmProject && options.confirmProject !== options.project) fail("project-confirmation-mismatch");
  if (options.apply && (options.phase === "inspect" || options.confirmProject !== options.project)) fail("mutation-confirmation-required");
  if (options.phase === "baseline" && !options.confirmDrained) fail("operator-drain-acknowledgment-required");
  if (options.phase === "resume" && !options.confirmLedgerDeployed) fail("operator-ledger-deploy-acknowledgment-required");
  if (options.acceptInitialCycleBaseline && options.phase !== "baseline") fail("initial-cycle-baseline-phase-only");
  if (options.output) {
    const output = resolve(ROOT, options.output), rel = relative(resolve(ROOT, "artifacts"), output);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || !output.endsWith(".json")) fail("artifact-output-required");
    options.output = output;
  }
  return options;
}

function cycleBoundary(subscription) {
  for (const value of [subscription.cycleStartedAt, subscription.lastRenewedAt]) if (instant(value)) return Date.parse(value);
  const generated = /^cycle_(\d{10,})$/.exec(String(subscription.cycleId || ""));
  const millis = generated ? Number(generated[1]) : NaN;
  return Number.isSafeInteger(millis) && millis > 0 ? millis : null;
}

export function assessBaselineSnapshot({ users, histories, observedAt, acceptInitialCycleBaseline = false, registeredBaselineCycleIds = {} }) {
  if (!Array.isArray(users) || !Array.isArray(histories) || !instant(observedAt)) fail("invalid-observation");
  const counts = { users: users.length, subscriptions: 0, histories: histories.length,
    missingCycleBoundaries: 0, registeredInitialCycles: 0, invalidBalances: 0, unmarkedHistories: 0, taggedHistories: 0, invalidMarkers: 0 };
  const baselineCycleIds = Object.create(null);
  const projected = [];
  for (const user of users) {
    const subscription = user.subscription;
    if (typeof user.name !== "string" || !instant(user.createTime) || !instant(user.updateTime)) fail("document-generation-metadata-required");
    if (!subscription) continue;
    // Unrelated root-profile writes/new awaiting users must not make a frozen
    // accounting baseline impossible to resume. Hash the subscription itself
    // plus user generation, not unrelated root updateTime or private fields.
    projected.push([user.name, user.createTime, subscription]);
    counts.subscriptions++;
    if (typeof subscription !== "object" || Array.isArray(subscription)) { counts.invalidBalances++; continue; }
    const purchased = subscription.purchasedSessions ?? subscription.totalSessions;
    if (!Number.isSafeInteger(subscription.usedSessions) || subscription.usedSessions < 0 ||
      !Number.isSafeInteger(purchased) || purchased < 0 ||
      (subscription.remainingSessions !== undefined && subscription.remainingSessions !== Math.max(0, purchased - subscription.usedSessions)))
      counts.invalidBalances++;
    if (subscription.cycleId && cycleBoundary(subscription) === null) {
      counts.missingCycleBoundaries++;
      const uid = user.name.split("/").at(-1), cycleId = subscription.cycleId;
      if (uid && typeof cycleId === "string" && cycleId.length <= 256 &&
        (acceptInitialCycleBaseline || (Object.hasOwn(registeredBaselineCycleIds, uid) && registeredBaselineCycleIds[uid] === cycleId))) {
        baselineCycleIds[uid] = cycleId;
        counts.registeredInitialCycles++;
      }
    }
  }
  for (const history of histories) {
    const marker = history.subscriptionCycleId;
    projected.push([history.name, history.createTime, history.updateTime, marker ?? null]);
    if (marker === undefined || marker === "") counts.unmarkedHistories++;
    else if (typeof marker === "string") counts.taggedHistories++;
    else counts.invalidMarkers++;
  }
  if (users.length > MAX_USERS || histories.length > MAX_HISTORY) fail("observation-limit-exceeded");
  if (histories.some(history => typeof history.name !== "string" || !instant(history.createTime) || !instant(history.updateTime)))
    fail("document-generation-metadata-required");
  projected.sort((a, b) => a[0].localeCompare(b[0]));
  return { observedAt, counts, fingerprint: createHash("sha256").update(JSON.stringify(canonical(projected))).digest("hex"),
    baselineCycleIds, ready: counts.missingCycleBoundaries === counts.registeredInitialCycles && counts.invalidBalances === 0 && counts.invalidMarkers === 0 };
}

export function publicBaselineObservation({ observedAt, counts, fingerprint, ready }) {
  // UID -> cycle mappings live only in the server config and transient memory.
  return { observedAt, counts, fingerprint, ready };
}

function requireUnbaselinedPause(config) {
  if (config.schemaVersion !== 1 || config.paused !== true) fail("unbaselined-maintenance-pause-required");
  if ((config.baselineReady !== undefined && config.baselineReady !== false) ||
    ["cutoverTimestamp", "baselineFingerprint", "baselineCounts", "baselineCycleIds", "baselineObservedAt",
      "drainAcknowledged", "ledgerDeployAcknowledged"].some(key => Object.hasOwn(config, key)))
    fail("cannot-cancel-existing-baseline-or-cutover");
}

export function planMigrationPhase({ phase, config = {}, observations = [], confirmDrained = false,
  confirmLedgerDeployed = false, acceptInitialCycleBaseline = false, now = new Date().toISOString() }) {
  if (config.schemaVersion !== undefined && config.schemaVersion !== 1) fail("unsupported-config-schema");
  if (config.paused !== undefined && typeof config.paused !== "boolean") fail("invalid-paused-state");
  if (config.cutoverTimestamp !== undefined && !instant(config.cutoverTimestamp)) fail("invalid-fixed-cutover");
  if (phase === "inspect") return { mutate: false, reason: "read-only-inspection" };
  if (phase === "pause") return config.paused === true ? { mutate: false, reason: "already-paused" }
    : { mutate: true, fields: { schemaVersion: 1, paused: true } };
  if (phase === "cancel-before-baseline") {
    requireUnbaselinedPause(config);
    return { mutate: true, cancelBeforeBaseline: true, fields: { paused: false } };
  }
  if (!["baseline", "resume"].includes(phase)) fail("invalid-phase");
  if (phase === "resume" && !confirmLedgerDeployed) fail("operator-ledger-deploy-acknowledgment-required");
  if (phase === "baseline" && !confirmDrained) fail("operator-drain-acknowledgment-required");
  if (phase === "resume" && config.paused === false && config.baselineReady === true && config.schemaVersion === 1 &&
    instant(config.cutoverTimestamp) && Date.parse(config.cutoverTimestamp) <= Date.parse(now))
    return { mutate: false, reason: "already-resumed" };
  if (config.paused !== true) fail("maintenance-pause-required");
  if (observations.length !== 2 || observations.some(observation => !observation.ready)) fail("baseline-not-ready");
  const [first, last] = observations;
  if (Date.parse(last.observedAt) - Date.parse(first.observedAt) < GAP_MS) fail("stable-observation-gap-required");
  if (first.fingerprint !== last.fingerprint) fail("baseline-changed-during-observation");
  if (phase === "baseline") {
    if (config.cutoverTimestamp !== undefined) {
      if (config.schemaVersion !== 1 || config.baselineReady !== true || config.baselineFingerprint !== last.fingerprint)
        fail("existing-cutover-cannot-be-rebased");
      return { mutate: false, reason: "fixed-baseline-already-recorded" };
    }
    if (last.counts.missingCycleBoundaries && !acceptInitialCycleBaseline) fail("initial-cycle-baseline-acknowledgment-required");
    return { mutate: true, setCutoverFromServerTime: true, fields: { schemaVersion: 1, paused: true,
      baselineReady: true, baselineFingerprint: last.fingerprint, baselineCounts: last.counts,
      baselineCycleIds: last.baselineCycleIds, baselineObservedAt: last.observedAt, drainAcknowledged: true } };
  }
  if (config.schemaVersion !== 1 || config.baselineReady !== true || !instant(config.cutoverTimestamp) ||
    !instant(now) || Date.parse(config.cutoverTimestamp) > Date.parse(now)) fail("fixed-ready-cutover-required");
  if (config.baselineFingerprint !== last.fingerprint) fail("baseline-changed-before-resume");
  return { mutate: true, fields: { paused: false, ledgerDeployAcknowledged: true } };
}

function decode(value) {
  if (value?.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, entry]) => [key, decode(entry)]));
  if (value?.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value?.integerValue !== undefined) return Number(value.integerValue);
  if (value?.doubleValue !== undefined) return value.doubleValue;
  if (value?.booleanValue !== undefined) return value.booleanValue;
  return value?.timestampValue ?? value?.stringValue ?? null;
}
function encode(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isSafeInteger(value)) return { integerValue: String(value) };
  if (typeof value === "string") return { stringValue: value };
  if (value && typeof value === "object" && !Array.isArray(value))
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encode(entry)])) } };
  fail("unsupported-config-value");
}

export function buildConfigCommit({ project, plan, previous }) {
  if (!PROJECTS.has(project) || !plan?.mutate || !plan.fields || !previous) fail("invalid-commit-plan");
  const allowed = new Set(["schemaVersion", "paused", "baselineReady", "baselineFingerprint", "baselineCounts",
    "baselineCycleIds", "baselineObservedAt", "drainAcknowledged", "ledgerDeployAcknowledged"]);
  if (Object.keys(plan.fields).some(key => !allowed.has(key)) ||
    (previous.exists && !instant(previous.updateTime))) fail("unsafe-config-write");
  if (plan.cancelBeforeBaseline) {
    if (!previous.exists || plan.setCutoverFromServerTime || Object.keys(plan.fields).length !== 1 || plan.fields.paused !== false)
      fail("unsafe-cancel-before-baseline-write");
    requireUnbaselinedPause(previous.data || {});
  }
  if (plan.setCutoverFromServerTime && (previous.data?.cutoverTimestamp !== undefined ||
    plan.fields.baselineReady !== true || plan.fields.paused !== true)) fail("fixed-cutover-is-immutable");
  const fields = Object.fromEntries(Object.entries(plan.fields).map(([key, value]) => [key, encode(value)]));
  return { writes: [{ update: { name: `projects/${project}/databases/(default)/documents/${CONFIG_PATH}`, fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: previous.exists ? { updateTime: previous.updateTime } : { exists: false },
    ...(plan.setCutoverFromServerTime ? { updateTransforms: [{ fieldPath: "cutoverTimestamp", setToServerValue: "REQUEST_TIME" }] } : {})
  }] };
}

async function cachedToken(project) {
  if (process.env.FIREBASE_TOKEN || process.env.GOOGLE_APPLICATION_CREDENTIALS) fail("cached-cli-account-only");
  try {
    const require = createRequire(import.meta.url);
    const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
    if (!account) fail("cached-cli-account-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
    if (typeof token !== "string" || !token) fail("cached-cli-account-unavailable");
    return token;
  } catch { fail("cached-cli-account-unavailable"); }
}

function transport(project, token) {
  const database = `projects/${project}/databases/(default)`;
  let requests = 0;
  const deadline = Date.now() + 240000;
  async function request(path, { method = "GET", body, query = [], allowMissing = false } = {}) {
    if (++requests > MAX_REQUESTS || Date.now() > deadline) fail("request-budget-exceeded");
    const url = new URL(`https://firestore.googleapis.com/v1/${database}${path}`);
    for (const [key, value] of query) url.searchParams.append(key, value);
    let response;
    try {
      response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000), redirect: "error" });
      if (allowMissing && response.status === 404) { await response.body?.cancel(); return null; }
      if (!response.ok) { await response.body?.cancel(); fail(`firestore-http-${response.status}`); }
      const text = await response.text();
      if (Buffer.byteLength(text) > 2 * 1024 * 1024) fail("response-size-exceeded");
      return JSON.parse(text);
    } catch (error) { if (error?.migrationCode) throw error; fail("firestore-transport-or-response-error"); }
  }
  async function config() {
    const document = await request(`/documents/${CONFIG_PATH}`, { allowMissing: true });
    return { exists: Boolean(document), updateTime: document?.updateTime,
      data: Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, decode(value)])) };
  }
  async function list(path, masks, cap) {
    const documents = [];
    let pageToken;
    do {
      const query = [["pageSize", "100"], ...masks.map(field => ["mask.fieldPaths", field]), ...(pageToken ? [["pageToken", pageToken]] : [])];
      const result = await request(`/documents/${path}`, { query });
      documents.push(...result.documents || []);
      if (documents.length > cap) fail("observation-limit-exceeded");
      pageToken = result.nextPageToken;
    } while (pageToken);
    return documents;
  }
  async function observation(assessmentOptions) {
    const users = await list("users", SUBSCRIPTION_FIELDS.map(field => `subscription.${field}`), MAX_USERS);
    const projectedUsers = [], histories = [];
    for (const user of users) {
      const prefix = `${database}/documents/users/`, uid = user.name?.startsWith(prefix) ? user.name.slice(prefix.length) : "";
      if (!uid || uid.length > 128 || /[/\\]/.test(uid) || [".", ".."].includes(uid)) fail("invalid-user-document-path");
      const subscription = user.fields?.subscription ? decode(user.fields.subscription) : null;
      projectedUsers.push({ name: user.name, createTime: user.createTime, updateTime: user.updateTime, subscription });
      if (subscription) {
        const entries = await list(`users/${encodeURIComponent(uid)}/history`, ["subscriptionCycleId"], MAX_HISTORY - histories.length);
        for (const history of entries) histories.push({ name: history.name, createTime: history.createTime, updateTime: history.updateTime,
          ...(history.fields?.subscriptionCycleId ? { subscriptionCycleId: decode(history.fields.subscriptionCycleId) } : {}) });
      }
    }
    return assessBaselineSnapshot({ users: projectedUsers, histories, observedAt: new Date().toISOString(), ...assessmentOptions });
  }
  async function commit(plan, previous) {
    await request("/documents:commit", { method: "POST", body: buildConfigCommit({ project, plan, previous }) });
    const current = await config();
    if (Object.entries(plan.fields).some(([key, value]) => JSON.stringify(canonical(current.data[key])) !== JSON.stringify(canonical(value))) ||
      (plan.setCutoverFromServerTime && !instant(current.data.cutoverTimestamp))) fail("config-write-verification-failed");
    if (plan.cancelBeforeBaseline) requireUnbaselinedPause({ ...current.data, paused: true });
    return current;
  }
  return { config, observation, commit };
}

let mutationAttempted = false;
let artifactHandle;
async function saveArtifact(report) {
  if (!artifactHandle) return;
  const text = `${JSON.stringify(report, null, 2)}\n`;
  await artifactHandle.write(text, 0, "utf8");
  await artifactHandle.truncate(Buffer.byteLength(text));
}
async function main() {
  const options = parseMigrationArgs(process.argv.slice(2));
  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    artifactHandle = await open(options.output, "wx");
    await saveArtifact({ status: "in-progress", project: options.project, phase: options.phase, containsPII: false });
  }
  const io = transport(options.project, await cachedToken(options.project));
  const initial = await io.config();
  const observations = [];
  const assessmentOptions = { registeredBaselineCycleIds: initial.data.baselineCycleIds || {},
    acceptInitialCycleBaseline: options.phase === "baseline" && options.acceptInitialCycleBaseline };
  if (["inspect", "baseline", "resume"].includes(options.phase)) {
    if (options.phase !== "inspect" && initial.data.paused !== true && initial.data.paused !== false) fail("maintenance-pause-required");
    observations.push(await io.observation(assessmentOptions));
    if (options.phase !== "inspect") { await delay(GAP_MS); observations.push(await io.observation(assessmentOptions)); }
  }
  const plan = planMigrationPhase({ ...options, config: initial.data, observations });
  if (options.apply && plan.mutate) mutationAttempted = true;
  const current = mutationAttempted ? await io.commit(plan, initial) : initial;
  const report = { schemaVersion: 1, project: options.project, phase: options.phase, apply: options.apply,
    completedAt: new Date().toISOString(), mutationPerformed: options.apply && plan.mutate,
    wouldMutate: plan.mutate, reason: plan.reason || (options.apply ? "phase-applied" : "dry-run-only"),
    config: { exists: current.exists, schemaVersion: current.data.schemaVersion ?? null, paused: current.data.paused ?? null,
      cutoverTimestamp: current.data.cutoverTimestamp ?? null, baselineReady: current.data.baselineReady === true },
    observations: observations.map(publicBaselineObservation), containsPII: false, balancesModified: false, limitations: LIMITATIONS };
  await saveArtifact(report);
  await artifactHandle?.close();
  artifactHandle = null;
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(async error => {
  const report = { ok: false, code: error?.migrationCode || "migration-failed", containsPII: false,
    completedAt: new Date().toISOString(), mutationMayHaveCommitted: mutationAttempted,
    note: "Inspect exact fixed config before retry; no automatic retry or rollback was attempted." };
  try { await saveArtifact(report); await artifactHandle?.close(); }
  catch { /* Never print filesystem errors or overwrite another run's evidence. */ }
  console.error(JSON.stringify(report));
  process.exitCode = 1;
});

// Read-only deployment evidence, not proof of drained invocations or event queues.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = new Set(["tren-85720", "tren-85720-staging"]);
const REGION = "europe-west1";
const HANDLERS = ["subscriptionUsageOnWorkoutCreated", "subscriptionUsageOnWorkoutDeleted"];
const revisionId = value => typeof value === "string" && /^[a-z][a-z0-9-]{0,199}$/.test(value) ? value : null;
const timestamp = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value)
  && Number.isFinite(Date.parse(value)) ? value : null;
const timeout = value => Number.isInteger(value) && value > 0 && value <= 3600 ? value : null;
const generation = value => (Number.isSafeInteger(value) || (typeof value === "string" && /^\d+$/.test(value)))
  && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function parseDeploymentInspectionArgs(args, env = process.env) {
  assert.equal(args.length, 1, "One explicit project argument required");
  const match = /^--project=(.+)$/.exec(args[0]);
  assert.ok(match && PROJECTS.has(match[1]), "Exact allowlisted project required");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN"])
    assert.ok(!env[key], "Cached CLI operator only");
  return { project: match[1] };
}

export function summarizeHandlerDeployment(fn, service) {
  const status = service?.status || {};
  const ready = (status.conditions || []).find(condition => condition.type === "Ready");
  const latestReadyRevisionName = revisionId(status.latestReadyRevisionName);
  const latestCreatedRevisionName = revisionId(status.latestCreatedRevisionName);
  const functionRevision = revisionId(fn?.serviceConfig?.revision);
  const traffic = (status.traffic || []).map(target => ({ revision: revisionId(target.revisionName),
    percent: target.percent === undefined ? 0 : Number.isInteger(target.percent) && target.percent >= 0 && target.percent <= 100 ? target.percent : null }));
  const readyTrafficPercent = traffic.filter(target => target.revision === latestReadyRevisionName)
    .reduce((sum, target) => sum + (target.percent || 0), 0);
  const totalTrafficPercent = traffic.reduce((sum, target) => sum + (target.percent || 0), 0);
  const timeoutSeconds = timeout(fn?.serviceConfig?.timeoutSeconds);
  const cloudRunTimeoutSeconds = timeout(service?.spec?.template?.spec?.timeoutSeconds);
  const generationResolved = generation(service?.metadata?.generation) !== null
    && generation(service.metadata.generation) === generation(status.observedGeneration);
  const latestReady = Boolean(latestReadyRevisionName && latestReadyRevisionName === latestCreatedRevisionName
    && latestReadyRevisionName === functionRevision);
  const readyStatus = ["True", "False", "Unknown"].includes(ready?.status) ? ready.status : "unavailable";
  const retryEnabled = fn?.eventTrigger?.retryPolicy === "RETRY_POLICY_RETRY";
  const active = fn?.state === "ACTIVE";
  const trafficOnLatestOnly = latestReady && totalTrafficPercent === 100 && readyTrafficPercent === 100
    && traffic.every(target => target.percent !== null && target.revision
      && (target.percent === 0 || target.revision === latestReadyRevisionName));
  return { active, updateTime: timestamp(fn?.updateTime), functionRevision, retryEnabled, timeoutSeconds,
    cloudRunTimeoutSeconds, timeoutMatches: timeoutSeconds !== null && timeoutSeconds === cloudRunTimeoutSeconds,
    latestReadyRevisionName, latestCreatedRevisionName, readyStatus, readyTransitionTime: timestamp(ready?.lastTransitionTime),
    generationResolved, traffic, totalTrafficPercent, readyTrafficPercent, trafficOnLatestOnly,
    deploymentReady: active && retryEnabled && readyStatus === "True" && generationResolved && trafficOnLatestOnly
      && timeoutSeconds !== null && timeoutSeconds === cloudRunTimeoutSeconds };
}

async function cachedToken(project) {
  const require = createRequire(import.meta.url);
  const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
  assert.ok(account, "Cached operator required");
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
  assert.ok(typeof token === "string" && token);
  return token;
}

async function main() {
  const { project } = parseDeploymentInspectionArgs(process.argv.slice(2));
  const token = await cachedToken(project);
  async function get(url, fields) {
    const target = new URL(url); target.searchParams.set("fields", fields);
    const response = await fetch(target, { method: "GET", redirect: "error", headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000) });
    if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error("Read unavailable"), { httpStatus: response.status }); }
    const text = await response.text();
    assert.ok(Buffer.byteLength(text) <= 256 * 1024);
    return JSON.parse(text);
  }
  const handlers = [];
  for (const name of HANDLERS) {
    let phase = "function-describe";
    try {
      const fn = await get(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${REGION}/functions/${name}`,
        "state,updateTime,serviceConfig(service,revision,timeoutSeconds),eventTrigger(retryPolicy)");
      const serviceName = fn?.serviceConfig?.service;
      assert.equal(serviceName, `projects/${project}/locations/${REGION}/services/${name.toLowerCase()}`);
      phase = "cloud-run-describe";
      const service = await get(`https://run.googleapis.com/v1/${serviceName}`,
        "metadata(generation),spec(template(spec(timeoutSeconds))),status(observedGeneration,traffic(percent,revisionName),latestReadyRevisionName,latestCreatedRevisionName,conditions(type,status,lastTransitionTime))");
      handlers.push({ name, available: true, ...summarizeHandlerDeployment(fn, service) });
    } catch (error) {
      handlers.push({ name, available: false, phase, httpStatus: Number.isInteger(error?.httpStatus) ? error.httpStatus : 0,
        reason: "read-permission-transport-or-contract-unavailable" });
    }
  }
  console.log(JSON.stringify({ project, readOnly: true, observedAt: new Date().toISOString(), handlers,
    deploymentReady: handlers.every(handler => handler.available && handler.deploymentReady),
    drainProven: false, limitations: ["One snapshot only; no invocation count, queue backlog or old-revision drain proof.",
      "Compare update/revision/Ready times with operator deploy completion, then allow at least the observed timeout for in-flight calls.",
      "This does not prove all old deliveries or Admin SDK writers have stopped; baseline acknowledgments and stable observations remain mandatory."] }, null, 2));
  if (!handlers.every(handler => handler.available && handler.deploymentReady)) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => {
  console.error(JSON.stringify({ readOnly: true, available: false, reason: "arguments-or-cached-auth-unavailable" }));
  process.exitCode = 1;
});

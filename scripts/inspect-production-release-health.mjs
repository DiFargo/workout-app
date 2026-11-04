import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Read-only release observation. Never queries users, secrets, Telegram or log payloads.
// Usage: node scripts/inspect-production-release-health.mjs --since=<UTC ISO> [--until=<UTC ISO>] [--output=artifacts/<file>.json]
const project = "tren-85720";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const limits = { pageSize: 1000, pagesPerQuery: 5, requestTimeoutMs: 15000, totalQueryBudgetMs: 120000, maximumWindowMinutes: 60 };
const documentation = {
  logging: "https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/entries/list",
  monitoring: "https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list",
  quota: "https://docs.cloud.google.com/monitoring/alerts/using-quota-metrics",
  metrics: "https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z",
  functions: "https://docs.cloud.google.com/monitoring/api/metrics_gcp_c",
  permissions: "https://docs.cloud.google.com/monitoring/access-control",
  projection: "https://docs.cloud.google.com/apis/docs/system-parameters",
};

function argumentsForRun() {
  const args = {};
  for (const argument of process.argv.slice(2)) {
    const match = /^--(since|until|output)=(.+)$/.exec(argument);
    if (!match || args[match[1]]) throw new Error("Use only --since=<UTC ISO>, optional --until=<UTC ISO>, and --output=artifacts/<file>.json.");
    args[match[1]] = match[2];
  }
  if (!args.since) throw new Error("--since=<UTC ISO> is required; no queries were made.");
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
      throw new Error("Timestamps must be explicit UTC ISO dates ending in Z.");
    }
    return new Date(value).toISOString();
  };
  const since = parse(args.since);
  const until = args.until ? parse(args.until) : new Date().toISOString();
  const duration = Date.parse(until) - Date.parse(since);
  if (duration <= 0 || duration > limits.maximumWindowMinutes * 60000 || Date.parse(until) > Date.now()) {
    throw new Error("Use a past, positive observation window no longer than 60 minutes.");
  }
  let output;
  if (args.output) {
    output = resolve(root, args.output);
    const pathFromArtifacts = relative(resolve(root, "artifacts"), output);
    if (!pathFromArtifacts || pathFromArtifacts.startsWith("..") || isAbsolute(pathFromArtifacts) || !output.endsWith(".json")) {
      throw new Error("--output must be a JSON file below this workspace's artifacts directory.");
    }
  }
  return { since, until, output };
}

function definitions(since, until) {
  const time = `timestamp >= "${since}" AND timestamp < "${until}"`;
  const metrics = [
    ["quotaExceeded", 'metric.type="serviceruntime.googleapis.com/quota/exceeded" AND resource.type="consumer_quota"', "ALIGN_COUNT_TRUE", "positive sampled quota intervals across series, not failed requests", null],
    ["api429OrResourceExhausted", 'metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api" AND (metric.labels.response_code="429" OR metric.labels.grpc_status_code="8")', "ALIGN_SUM", "reported API request count", 1860],
    ["functionOutOfQuota", 'metric.type="cloudfunctions.googleapis.com/function/execution_count" AND resource.type="cloud_function" AND metric.labels.status="out of quota"', "ALIGN_SUM", "reported function execution count", 300],
    ["container429", 'metric.type="run.googleapis.com/request_count" AND resource.type="cloud_run_revision" AND metric.labels.response_code="429"', "ALIGN_SUM", "reported requests reaching Cloud Run containers only", 180],
  ];
  return [
    { id: "errorLogs", kind: "logging", filter: `${time} AND severity >= ERROR`, unit: "matching log entries (not unique failures)" },
    { id: "quotaOr429Logs", kind: "logging", filter: `${time} AND (httpRequest.status=429 OR protoPayload.status.code=8 OR jsonPayload.code="RESOURCE_EXHAUSTED" OR jsonPayload.status="RESOURCE_EXHAUSTED" OR jsonPayload.error.status="RESOURCE_EXHAUSTED" OR jsonPayload.error.code=429)`, unit: "structured matching log entries (not unique failures)" },
    ...metrics.map(([id, filter, aligner, unit, freshnessSeconds]) => ({ id, kind: "monitoring", filter, aligner, unit, freshnessSeconds })),
  ];
}

async function cachedAccountToken() {
  if (process.env.FIREBASE_TOKEN) throw new Error("Cached Firebase CLI account required; environment-token override is not used.");
  const require = createRequire(import.meta.url);
  const cliRoot = resolve(root, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  // Do not let CLI diagnostics disclose account identity or transport headers on errors.
  require(resolve(cliRoot, "logger.js")).logger.silent = true;
  const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
  const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
  const { getAccessToken } = require(resolve(cliRoot, "apiv2.js"));
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("Cached Firebase CLI account unavailable; no health queries were made.");
  await requireAuth({ ...account, project }, true);
  // Native fetch avoids apiv2's network-error debug serialization of request headers.
  const token = await getAccessToken();
  if (typeof token !== "string" || !token) throw new Error("Cached Firebase CLI access token unavailable.");
  return token;
}

async function query(definition, context) {
  const result = { id: definition.id, kind: definition.kind, filter: definition.filter, unit: definition.unit, status: "pending", pages: 0, observedItems: 0, aggregate: null, truncated: false };
  if (definition.kind === "monitoring") {
    result.freshness = {
      documentedSamplingAndVisibilitySeconds: definition.freshnessSeconds,
      windowMayStillBeIncomplete: definition.freshnessSeconds === null || Date.now() - Date.parse(context.until) < definition.freshnessSeconds * 1000,
      ...(definition.freshnessSeconds === null ? { note: "Quota sampled every 60s; the catalog does not give a visibility-delay bound." } : {}),
    };
  }
  const buckets = {};
  let pageToken = "";
  let sum = 0;
  let numericPoints = 0;
  try {
    for (let page = 0; page < limits.pagesPerQuery; page += 1) {
      const remaining = context.deadline - Date.now();
      if (remaining <= 0) {
        result.status = "budget_exhausted";
        result.truncated = true;
        break;
      }
      let url;
      let body;
      if (definition.kind === "logging") {
        url = new URL("https://logging.googleapis.com/v2/entries:list");
        url.searchParams.set("fields", "entries(severity,resource(type),httpRequest(status)),nextPageToken");
        body = { resourceNames: [`projects/${project}`], filter: definition.filter, orderBy: "timestamp desc", pageSize: limits.pageSize, ...(pageToken ? { pageToken } : {}) };
      } else {
        url = new URL(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries`);
        const params = {
          filter: definition.filter, "interval.startTime": context.since, "interval.endTime": context.until,
          view: "FULL", pageSize: String(limits.pageSize), "aggregation.alignmentPeriod": "60s",
          "aggregation.perSeriesAligner": definition.aligner, "aggregation.crossSeriesReducer": "REDUCE_SUM",
          fields: "timeSeries(points(interval,value)),nextPageToken,executionErrors(code)",
          ...(pageToken ? { pageToken } : {}),
        };
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      }
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${context.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(Math.min(limits.requestTimeoutMs, remaining)),
      });
      result.pages += 1;
      result.httpStatus = response.status;
      if (!response.ok) {
        // Do not read or print error messages/details, which may contain raw payloads.
        await response.body?.cancel();
        result.status = response.status === 403 ? "unavailable_permission_scope_or_api_disabled" : response.status === 429 ? "observer_query_rate_limited" : "query_failed";
        result.truncated = true;
        break;
      }
      const data = await response.json();
      if (definition.kind === "logging") {
        for (const entry of data.entries || []) {
          result.observedItems += 1;
          const key = `${entry.resource?.type || "unspecified"}/${entry.severity || "DEFAULT"}`;
          buckets[key] = (buckets[key] || 0) + 1;
        }
      } else {
        if (data.executionErrors?.length) {
          result.partialExecutionErrors = data.executionErrors.map(error => Number(error.code) || 0);
          result.truncated = true;
        }
        for (const series of data.timeSeries || []) {
          for (const point of series.points || []) {
            result.observedItems += 1;
            const value = point.value?.int64Value ?? point.value?.doubleValue;
            if (value !== undefined && Number.isFinite(Number(value))) {
              numericPoints += 1;
              sum += Number(value);
            }
          }
        }
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken) {
        result.status = result.truncated ? "partial" : result.observedItems ? "observed" : "no_data";
        break;
      }
      if (page === limits.pagesPerQuery - 1) {
        result.status = "truncated";
        result.truncated = true;
      }
    }
  } catch {
    result.status = "transport_timeout_or_invalid_response";
    result.truncated = true;
  }
  if (definition.kind === "logging") result.aggregate = { matchingEntriesObserved: result.observedItems, byResourceAndSeverity: buckets };
  else if (numericPoints) result.aggregate = { valueObserved: sum, numericPoints };
  else if (result.observedItems) {
    result.status = "unexpected_metric_value";
    result.truncated = true;
  }
  result.interpretation = result.status === "no_data"
    ? "No data returned; not a verified zero and not proof the service emits this signal."
    : "Observed aggregate only; inspect status, freshness and truncation before interpreting.";
  return result;
}

async function main() {
  const { since, until, output } = argumentsForRun();
  let token;
  try {
    token = await cachedAccountToken();
  } catch {
    throw new Error("Cached Firebase CLI authentication unavailable; no health queries were made. No credentials were printed.");
  }
  const startedAt = new Date().toISOString();
  const context = { since, until, token, deadline: Date.now() + limits.totalQueryBudgetMs };
  const results = [];
  for (const definition of definitions(since, until)) results.push(await query(definition, context));
  context.token = undefined;
  token = undefined;
  const durationSeconds = (Date.parse(until) - Date.parse(since)) / 1000;
  const errorLogs = results.find(result => result.id === "errorLogs");
  const availableErrors = ["observed", "no_data"].includes(errorLogs.status) && !errorLogs.truncated;
  const incompleteMetrics = results.filter(result => result.kind === "monitoring" && (result.status !== "observed" || result.freshness.windowMayStillBeIncomplete)).length;
  const report = {
    schemaVersion: 1, project, startedAt, completedAt: new Date().toISOString(), window: { since, until, durationSeconds }, limits,
    summaryRU: `Окно наблюдения: ${Math.floor(durationSeconds / 60)} мин ${Math.floor(durationSeconds % 60)} с. ${availableErrors ? `В доступных серверных журналах ERROR+: ${errorLogs.observedItems} записей.` : "Проверка ERROR+ неполна или недоступна."} Метрики квот/429 проверены отдельными запросами; ${incompleteMetrics} из 4 сигналов имеют неполные, недоступные или ещё незрелые данные. Это не подтверждение отсутствия всех ошибок и достаточности квот.`,
    readOnly: true, containsRawLogPayloads: false, documentation, results,
    limitations: [
      "This is a bounded observation, not an assertion that all quotas, providers or clients are healthy.",
      "HTTP 429 is not necessarily quota exhaustion; RESOURCE_EXHAUSTED is a failure signal, not quota headroom.",
      "ERROR+ logs and quota/429 logs overlap; never sum query counts as unique incidents.",
      "Quota BOOL positive samples are not a failed-request count. Not every service exports these metrics.",
      "API request metrics can appear up to 30 minutes after sampling; recheck the same fixed 30-minute window at release+60 minutes.",
      "Cloud Run request_count omits pre-container rejections. Structured logs can miss unstructured upstream errors; log exclusions and IAM also constrain coverage.",
      "No usage/limit headroom, budgets, billing, third-party AI quotas or client-side failures are verified by these six queries.",
      "403 means unavailable (permissions, OAuth scopes or disabled API), not healthy. The script never enables APIs or changes IAM.",
    ],
  };
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  }
  console.log(JSON.stringify(report, null, 2));
  if (results.some(result => !["observed", "no_data"].includes(result.status))) process.exitCode = 2;
}

main().catch(error => {
  // Only our fixed validation messages are exposed; never stringify arbitrary SDK errors.
  const message = error instanceof Error && /^(Use |--since=|Timestamps |Cached Firebase CLI)/.test(error.message)
    ? error.message : "Release health inspection failed; no credentials or raw responses were printed.";
  console.error(message);
  process.exitCode = 1;
});

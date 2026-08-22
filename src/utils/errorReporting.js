const MAX_MESSAGE_LENGTH = 500;
const MAX_REPORTS_PER_MINUTE = 10;
const REPORT_WINDOW_MS = 60_000;
const sentAt = [];

const runtimeEnvironment = typeof import.meta.env === "undefined" ? {} : import.meta.env;

function limitText(value, maxLength = MAX_MESSAGE_LENGTH) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:access_?token|auth|id_?token|token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getSafeRoute(value) {
  const rawRoute = String(value || (typeof window === "undefined" ? "" : window.location?.href || ""));
  if (!rawRoute) return "";

  try {
    const baseUrl = typeof window === "undefined"
      ? "https://workout-app.invalid"
      : window.location.origin;
    return limitText(new URL(rawRoute, baseUrl).pathname, 240);
  } catch {
    return limitText(rawRoute.split(/[?#]/, 1)[0], 240);
  }
}

function getReportingEndpoint(value = runtimeEnvironment.VITE_ERROR_REPORTING_ENDPOINT) {
  const configuredEndpoint = String(value || "").trim();
  if (!configuredEndpoint) return "";

  try {
    const baseUrl = typeof window === "undefined"
      ? "https://workout-app.invalid"
      : window.location.origin;
    const endpoint = new URL(configuredEndpoint, baseUrl);
    const isSameOrigin = typeof window !== "undefined" && endpoint.origin === window.location.origin;
    if (endpoint.protocol !== "https:" && !isSameOrigin) return "";
    return endpoint.toString();
  } catch {
    return "";
  }
}

function maySendReport(now) {
  while (sentAt.length && now - sentAt[0] >= REPORT_WINDOW_MS) sentAt.shift();
  if (sentAt.length >= MAX_REPORTS_PER_MINUTE) return false;
  sentAt.push(now);
  return true;
}

function getErrorName(error) {
  return limitText(error?.name || "Error", 120) || "Error";
}

function getErrorMessage(error) {
  if (typeof error === "string") return limitText(error);
  return limitText(error?.message || "Unexpected client error");
}

export function createClientErrorReport(error, context = {}) {
  const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown";
  const route = getSafeRoute(context.route);

  return {
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    source: limitText(context.source || "client", 120) || "client",
    feature: limitText(context.feature || "", 120),
    role: limitText(context.role || "", 40),
    route,
    version: limitText(appVersion, 80),
    environment: limitText(runtimeEnvironment.VITE_FIREBASE_ENVIRONMENT || runtimeEnvironment.MODE || "unknown", 40),
    error: {
      name: getErrorName(error),
      message: getErrorMessage(error)
    }
  };
}

export async function reportClientError(error, context = {}, options = {}) {
  const endpoint = getReportingEndpoint(options.endpoint);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!endpoint || typeof fetchImpl !== "function" || !maySendReport(Date.now())) return false;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createClientErrorReport(error, context)),
      keepalive: true,
      credentials: "omit"
    });
    return response?.ok === true;
  } catch {
    return false;
  }
}

let globalHandlersInstalled = false;

export function installGlobalErrorReporting() {
  if (typeof window === "undefined" || globalHandlersInstalled) return () => {};

  const onError = (event) => {
    void reportClientError(event.error || event.message, { source: "window.error" });
  };
  const onUnhandledRejection = (event) => {
    void reportClientError(event.reason, { source: "window.unhandledrejection" });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  globalHandlersInstalled = true;

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    globalHandlersInstalled = false;
  };
}

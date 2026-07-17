const RESOLVE_LOGIN_FUNCTION_URL =
  "https://europe-west1-tren-85720.cloudfunctions.net/resolveLoginAlias";

function makeLoginResolutionError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function getLoginResolutionEndpoint(hostname = globalThis.location?.hostname || "") {
  return hostname === "127.0.0.1" || hostname === "localhost"
    ? RESOLVE_LOGIN_FUNCTION_URL
    : "/api/auth/resolve-login";
}

export async function resolveEmailForLogin(
  validation,
  {
    fetchImpl = globalThis.fetch,
    hostname = globalThis.location?.hostname || "",
    timeoutMs = 10000
  } = {}
) {
  if (validation.isEmail) {
    return validation.email.toLowerCase();
  }

  if (typeof fetchImpl !== "function") {
    throw makeLoginResolutionError("auth/network-request-failed");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(getLoginResolutionEndpoint(hostname), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: validation.loginAlias }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok !== true) {
      const errorCode = response.status === 429
        ? "auth/too-many-requests"
        : payload.error || "auth/login-not-found";
      throw makeLoginResolutionError(errorCode);
    }

    const email = String(payload.email || "").trim().toLowerCase();
    if (!email) throw makeLoginResolutionError("auth/login-not-found");
    return email;
  } catch (error) {
    if (error?.code) throw error;
    throw makeLoginResolutionError("auth/network-request-failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

import { getAppCheckApiHeaders } from "../../utils/apiClient.js";

function makeLoginResolutionError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function getLoginResolutionEndpoint() {
  return "/api/auth/resolve-login";
}

export async function resolveEmailForLogin(
  validation,
  {
    fetchImpl = globalThis.fetch,
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
    const response = await fetchImpl(getLoginResolutionEndpoint(), {
      method: "POST",
      headers: await getAppCheckApiHeaders({ "Content-Type": "application/json" }),
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

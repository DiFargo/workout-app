import { getAppCheckApiHeaders } from "../../utils/apiClient.js";

function makeLoginResolutionError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function getLoginResolutionEndpoint() {
  return "/api/auth/resolve-login";
}

async function sendAliasRequest(
  body,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = 10000
  } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw makeLoginResolutionError("auth/network-request-failed");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(getLoginResolutionEndpoint(), {
      method: "POST",
      headers: await getAppCheckApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok !== true) {
      const errorCode = response.status === 429
        ? "auth/too-many-requests"
        : "auth/invalid-credential";
      throw makeLoginResolutionError(errorCode);
    }

    return payload;
  } catch (error) {
    if (error?.code) throw error;
    throw makeLoginResolutionError("auth/network-request-failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function authenticateWithLoginAlias(validation, password = validation.password, options = {}) {
  const payload = await sendAliasRequest({ login: validation.loginAlias, password }, options);
  if (typeof payload.customToken !== "string" || !payload.customToken || payload.customToken.length > 16384) {
    throw makeLoginResolutionError("auth/invalid-credential");
  }
  return payload.customToken;
}

export async function requestLoginAliasPasswordReset(validation, options = {}) {
  await sendAliasRequest({ login: validation.loginAlias, action: "reset-password" }, options);
}

// Deliberately email-only: compatibility for callers must not restore the
// former public alias-to-email resolution behavior.
export async function resolveEmailForLogin(validation) {
  if (!validation.isEmail) throw makeLoginResolutionError("auth/invalid-credential");
  return validation.email.toLowerCase();
}

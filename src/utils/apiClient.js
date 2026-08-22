import { auth } from "../firebase.js";
import { getClientAppCheckToken } from "../app/appCheck.js";

function makeTimeoutSignal(timeoutMs = 16000, externalSignal = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId)
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 16000) {
  const timeout = makeTimeoutSignal(timeoutMs, options.signal);

  try {
    return await fetch(url, {
      ...options,
      signal: timeout.signal
    });
  } finally {
    timeout.clear();
  }
}

async function getAuthorizedApiHeaders(headers = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required");
  }

  return getAppCheckApiHeaders({
    ...headers,
    "Authorization": `Bearer ${await currentUser.getIdToken()}`
  });
}

export async function getAppCheckApiHeaders(headers = {}) {
  const appCheckToken = await getClientAppCheckToken();
  return withAppCheckHeader(headers, appCheckToken);
}

export function withAppCheckHeader(headers = {}, appCheckToken = "") {
  const token = String(appCheckToken || "").trim();
  return token
    ? {
        ...headers,
        "X-Firebase-AppCheck": token
      }
    : headers;
}

export async function fetchWithAppCheck(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: await getAppCheckApiHeaders(options.headers)
  });
}

export async function fetchAuthorized(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: await getAuthorizedApiHeaders(options.headers)
  });
}

export async function fetchAuthorizedWithTimeout(url, options = {}, timeoutMs = 16000) {
  return fetchWithTimeout(url, {
    ...options,
    headers: await getAuthorizedApiHeaders(options.headers)
  }, timeoutMs);
}

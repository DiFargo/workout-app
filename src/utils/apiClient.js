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

function awaitWithAbort(promise, signal) {
  if (signal?.aborted) {
    return Promise.reject(signal.reason || new DOMException("Aborted", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });

    Promise.resolve(promise).then(
      (value) => {
        signal?.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal?.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
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
  // Token refresh can wait on a mobile network switch just as a fetch can.
  // Start one deadline before it so UI loaders always finish on time.
  const timeout = makeTimeoutSignal(timeoutMs, options.signal);

  try {
    const headers = await awaitWithAbort(getAuthorizedApiHeaders(options.headers), timeout.signal);
    return await fetchWithTimeout(url, {
      ...options,
      headers,
      signal: timeout.signal
    }, timeoutMs);
  } finally {
    timeout.clear();
  }
}

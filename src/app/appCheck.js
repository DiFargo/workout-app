const runtimeEnvironment = typeof import.meta.env === "undefined" ? {} : import.meta.env;
const runtimeMode = typeof import.meta.env === "undefined" ? "test" : import.meta.env.MODE;

let appCheckInstance = null;
let initializationPromise = null;

function cleanValue(value) {
  return String(value || "").trim();
}

export function resolveAppCheckConfiguration({
  siteKey = runtimeEnvironment.VITE_APP_CHECK_SITE_KEY,
  debugToken = runtimeEnvironment.VITE_APP_CHECK_DEBUG_TOKEN,
  environment = runtimeEnvironment.VITE_FIREBASE_ENVIRONMENT || (runtimeMode === "production" ? "production" : "")
} = {}) {
  const resolvedEnvironment = cleanValue(environment).toLowerCase();
  const resolvedSiteKey = cleanValue(siteKey);
  const resolvedDebugToken = cleanValue(debugToken);

  if (resolvedEnvironment === "production" && resolvedDebugToken) {
    throw new Error("An App Check debug token must never be included in a production build.");
  }

  return {
    environment: resolvedEnvironment,
    siteKey: resolvedSiteKey,
    debugToken: resolvedDebugToken
  };
}

export async function initializeClientAppCheck(options = {}) {
  const { siteKey, debugToken } = resolveAppCheckConfiguration(options);
  if (!siteKey || typeof window === "undefined") return null;
  if (appCheckInstance) return appCheckInstance;

  if (!initializationPromise) {
    if (debugToken) {
      globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
    }

    initializationPromise = Promise.all([
      import("../firebase.js"),
      import("firebase/app-check")
    ])
      .then(([firebaseModule, appCheckModule]) => {
        appCheckInstance = appCheckModule.initializeAppCheck(firebaseModule.app, {
          provider: new appCheckModule.ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true
        });
        return appCheckInstance;
      })
      .catch((error) => {
        initializationPromise = null;
        throw error;
      });
  }

  return initializationPromise;
}

export async function getClientAppCheckToken() {
  try {
    const instance = appCheckInstance || await initializeClientAppCheck();
    if (!instance) return "";
    const { getToken } = await import("firebase/app-check");
    const tokenResult = await getToken(instance, false);
    return cleanValue(tokenResult?.token);
  } catch {
    return "";
  }
}

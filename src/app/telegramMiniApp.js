const SAFE_AREA_SIDES = ["top", "right", "bottom", "left"];
const APP_SURFACE_COLOR = "#f5f7f8";
const initializedWebApps = new WeakMap();

function setInsetVariables(root, prefix, insets) {
  for (const side of SAFE_AREA_SIDES) {
    const value = Number(insets?.[side]);
    root.style.setProperty(`--telegram-${prefix}-${side}`, `${Number.isFinite(value) && value > 0 ? value : 0}px`);
  }
}

export function initializeTelegramMiniApp(hostWindow = window, hostDocument = document) {
  const webApp = hostWindow?.Telegram?.WebApp;
  if (!webApp || typeof webApp !== "object") return null;

  const existing = initializedWebApps.get(webApp);
  if (existing) return existing;

  const root = hostDocument.documentElement;
  root.dataset.platform = "telegram";

  const syncViewport = (event) => {
    if (event?.isStateStable === false) return;
    const height = Number(webApp.viewportStableHeight) || Number(webApp.viewportHeight);
    if (height > 0) root.style.setProperty("--app-viewport-height", `${height}px`);
  };
  const syncSafeAreas = () => {
    setInsetVariables(root, "safe-area", webApp.safeAreaInset);
    setInsetVariables(root, "content-safe-area", webApp.contentSafeAreaInset);
  };
  const syncTheme = () => {
    root.dataset.telegramColorScheme = webApp.colorScheme === "dark" ? "dark" : "light";
    try {
      webApp.setHeaderColor?.(APP_SURFACE_COLOR);
      webApp.setBackgroundColor?.(APP_SURFACE_COLOR);
      webApp.setBottomBarColor?.(APP_SURFACE_COLOR);
    } catch {
      // Older Telegram clients may not expose all color setters.
    }
  };
  const subscribe = (eventName, handler) => {
    try {
      webApp.onEvent?.(eventName, handler);
      return () => webApp.offEvent?.(eventName, handler);
    } catch {
      return () => {};
    }
  };

  const unsubscribe = [
    subscribe("viewportChanged", syncViewport),
    subscribe("safeAreaChanged", syncSafeAreas),
    subscribe("contentSafeAreaChanged", syncSafeAreas),
    subscribe("themeChanged", syncTheme)
  ];

  syncViewport();
  syncSafeAreas();
  syncTheme();
  try {
    webApp.expand?.();
  } catch {
    // The web app remains usable if Telegram cannot expand the Mini App.
  }
  try {
    hostWindow.dispatchEvent?.(new hostWindow.Event("telegram-mini-app-ready"));
  } catch {
    // Optional bridge notification for app features that initialize before the SDK.
  }

  let readySignaled = false;
  const runtime = {
    webApp,
    ready() {
      if (readySignaled) return;
      readySignaled = true;
      try {
        webApp.ready?.();
      } catch {
        // Keep app startup independent from optional Telegram SDK methods.
      }
    },
    dispose() {
      unsubscribe.forEach((removeListener) => removeListener());
      initializedWebApps.delete(webApp);
    }
  };

  initializedWebApps.set(webApp, runtime);
  return runtime;
}

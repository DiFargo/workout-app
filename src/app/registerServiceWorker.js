export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  };

  const scheduleRegistration = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(register, { timeout: 3000 });
      return;
    }

    window.setTimeout(register, 1200);
  };

  if (document.readyState === "complete") {
    scheduleRegistration();
    return;
  }

  window.addEventListener("load", scheduleRegistration, { once: true });
}
